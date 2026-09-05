import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { SettingsService } from '../../settings/service/settings.service';
import {
  CalculateImportCostDto,
  ImportSearchQueryDto,
  UpdateDollarQuoteDto,
} from '../dto/import-radar.dto';
import { ImportProvider } from '../interfaces/import-provider.interface';
import { ImportRadarRepository } from '../repository/import-radar.repository';
import { identifyRedirectRule, toNumber } from '../validators/import-radar.validators';
import { ComprasParaguaiProvider } from '../providers/compras-paraguai.provider';
import { MockImportProvider } from '../providers/mock-import.provider';
import { processParsedSupplierItemsShadow } from '../../evolution-webhook/product-identity-shadow';
import {
  ProductNormalizationService,
  type ProductNormalizationInput,
} from '../../evolution-webhook/product-normalization.service';
import { normalizeProductCondition, type ImportProductCondition } from '../condition-normalizer';
import {
  resolveFinancialClassification,
  type FinancialClassificationResult,
} from '../financial-classification';
import { formatSourceDisplayName } from '../source-display-name';
import { deriveProfitLookupIdentity } from '@inest/product-identity';
import {
  isReservedAppleManufacturerAlias,
  normalizeManufacturerAlias,
} from '../../manufacturers/manufacturer-alias-normalizer';
import { ManufacturersService } from '../../manufacturers/service/manufacturers.service';

@Injectable()
export class ImportRadarService {
  private readonly logger = new Logger(ImportRadarService.name);

  constructor(
    @Inject(SettingsService) private readonly settingsService: SettingsService,
    @Inject(ImportRadarRepository) private readonly repository: ImportRadarRepository,
    @Inject(MockImportProvider) private readonly mockProvider: MockImportProvider,
    @Inject(ComprasParaguaiProvider)
    private readonly comprasParaguaiProvider: ComprasParaguaiProvider,
    @Inject(ProductNormalizationService)
    private readonly productNormalization?: ProductNormalizationService,
    @Inject(ManufacturersService)
    private readonly manufacturersService?: ManufacturersService,
  ) {}

  async search(query: ImportSearchQueryDto, user: AuthenticatedUser) {
    const settings = await this.settingsService.getSettings();
    const provider = this.getProvider(query.provider);
    const products = await provider.search(query);
    const results = products.map((product) => ({
      ...product,
      provider: provider.name,
      priceBrl: product.priceUsd * settings.importation.dollarQuote,
      dollarQuote: settings.importation.dollarQuote,
    }));

    await this.repository.createAuditLog({
      userId: user.id,
      operationType: 'IMPORT',
      context: {
        event: 'import_radar.search',
        provider: provider.name,
        search: query.search,
        resultCount: results.length,
        dollarQuote: settings.importation.dollarQuote,
      },
    });

    return {
      provider: provider.name,
      dollarQuote: settings.importation.dollarQuote,
      results,
    };
  }

  async findProduct(id: string, query: ImportSearchQueryDto) {
    const provider = this.getProvider(query.provider);
    const products = await provider.search(query);
    const product = products.find((item) => item.id === id);
    if (!product) {
      throw new NotFoundException('Produto de importacao nao encontrado.');
    }
    return product;
  }

  async calculate(dto: CalculateImportCostDto, user: AuthenticatedUser) {
    const settings = await this.settingsService.getSettings();
    const importSettings = settings.importation;
    const convertedPrice = dto.priceUsd * importSettings.dollarQuote;
    const redirectRule = identifyRedirectRule(dto, importSettings);
    const redirectCost = toNumber(redirectRule?.redirectCost);
    const invoiceTax = convertedPrice * (toNumber(importSettings.invoiceTaxPercent) / 100);
    const total =
      convertedPrice +
      toNumber(importSettings.cdeExitPerBox) +
      redirectCost +
      toNumber(importSettings.brazilDispatchPerBox) +
      invoiceTax +
      toNumber(importSettings.correiosLabel);

    const catalog = await this.repository.listActiveCatalogProducts();
    const { productResolution, hasRecoverableIdentityGap } = this.analyzeCatalogProduct(
      dto,
      catalog,
    );
    const catalogProduct =
      productResolution.status === 'FOUND'
        ? (catalog.find((product) => product.id === productResolution.productId) ?? null)
        : null;
    const sourceCondition = normalizeProductCondition(dto.condition ?? dto.name);
    const condition =
      this.toStructuredCondition(catalogProduct?.profitCondition) ??
      (sourceCondition.status === 'RESOLVED' ? sourceCondition.condition : null);
    const manufacturerResolution = await this.resolveExplicitSourceManufacturer(
      dto.sourceManufacturer,
      dto.sourceManufacturerProvenance,
    );
    const financialClassification = resolveFinancialClassification({
      canonicalProduct: catalogProduct,
      productName: dto.name,
      category: dto.category,
      model: dto.model,
      capacity: dto.capacity,
      color: dto.color,
      condition,
      sourceManufacturer: dto.sourceManufacturer,
      sourceManufacturerProvenance: dto.sourceManufacturerProvenance,
      manufacturerResolution,
    });
    const result = {
      product: dto,
      sourceCommercialIdentity: {
        sourceProductId: dto.id,
        sourceName: dto.name,
        displayName: formatSourceDisplayName({
          sourceName: dto.name,
          sourceManufacturer: dto.sourceManufacturer,
          model: dto.model,
          capacity: dto.capacity,
        }),
        source: dto.origin ?? 'PY',
        sourceUrl: dto.productUrl,
        supplier: dto.store,
        sourceManufacturer: dto.sourceManufacturer ?? null,
        sourceManufacturerProvenance: dto.sourceManufacturerProvenance ?? null,
      },
      productResolution,
      catalogProductId:
        productResolution.status === 'FOUND' ? (productResolution.productId ?? null) : null,
      condition,
      financialClassification: financialClassification.classification,
      financialClassificationReason: financialClassification.reason,
      manufacturerKey: financialClassification.manufacturerKey ?? null,
      manufacturerProvenance: financialClassification.provenance ?? null,
      pricingEligibility: this.resolvePricingEligibility({
        dto,
        catalogProduct,
        condition,
        financialClassification,
      }),
      matchedProductType: redirectRule?.productType ?? 'Nao identificado',
      dollarQuote: importSettings.dollarQuote,
      breakdown: {
        convertedPrice,
        cdeExit: toNumber(importSettings.cdeExitPerBox),
        redirectCost,
        brazilDispatch: toNumber(importSettings.brazilDispatchPerBox),
        invoiceTax,
        correiosLabel: toNumber(importSettings.correiosLabel),
      },
      total,
    };

    await this.repository.createAuditLog({
      userId: user.id,
      operationType: 'CREATE',
      entityId: dto.id,
      newValue: result,
      context: {
        event: 'import_radar.calculated',
        matchedProductType: result.matchedProductType,
        dollarQuote: importSettings.dollarQuote,
        productResolutionStatus: productResolution.status,
        productResolutionReason: productResolution.reason ?? null,
      },
    });

    if (hasRecoverableIdentityGap) {
      this.observeParaguayPricingNormalization(dto, catalog);
    }

    return result;
  }

  history() {
    return this.repository.listHistory();
  }

  async updateDollarQuote(dto: UpdateDollarQuoteDto, user: AuthenticatedUser) {
    const current = await this.settingsService.getSettings();
    const updated = await this.settingsService.updateSettings(
      {
        importation: {
          ...current.importation,
          dollarQuote: dto.dollarQuote,
        },
      },
      user,
    );

    await this.repository.createAuditLog({
      userId: user.id,
      operationType: 'UPDATE',
      oldValue: { dollarQuote: current.importation.dollarQuote },
      newValue: { dollarQuote: dto.dollarQuote },
      context: { event: 'import_radar.dollar_quote.updated' },
    });

    return updated.importation;
  }

  private getProvider(provider?: string): ImportProvider {
    if (provider === this.comprasParaguaiProvider.name) {
      return this.comprasParaguaiProvider;
    }
    return this.mockProvider;
  }

  private analyzeCatalogProduct(
    dto: CalculateImportCostDto,
    catalog: Awaited<ReturnType<ImportRadarRepository['listActiveCatalogProducts']>>,
  ) {
    const conditionResolution = normalizeProductCondition(dto.condition ?? dto.name);
    if (conditionResolution.status !== 'RESOLVED') {
      return {
        productResolution: {
          status: 'MISSING' as const,
          reason: 'condition_unresolved' as const,
          candidateCount: 0,
        },
        hasRecoverableIdentityGap: false,
      };
    }

    const resolution = this.resolveCatalogProductForCondition(
      dto,
      catalog,
      conditionResolution.condition,
    );
    if (resolution.reason === 'identity_insufficient') {
      return {
        productResolution: {
          status: 'MISSING' as const,
          reason: 'catalog_no_match' as const,
          candidateCount: 0,
        },
        hasRecoverableIdentityGap: true,
      };
    }
    return {
      productResolution: resolution,
      hasRecoverableIdentityGap: false,
    };
  }

  private resolveCatalogProductForCondition(
    dto: CalculateImportCostDto,
    catalog: Awaited<ReturnType<ImportRadarRepository['listActiveCatalogProducts']>>,
    condition: ImportProductCondition,
  ) {
    return processParsedSupplierItemsShadow(
      [
        {
          productName: dto.name,
          normalizedName: dto.name.toLowerCase(),
          category: dto.category || null,
          model: dto.model ?? null,
          capacity: dto.capacity ?? null,
          color: dto.color ?? null,
          condition,
          qualityGrade: null,
          price: dto.priceUsd,
          availability: dto.availability ?? null,
          rawLine: dto.name,
        },
      ],
      catalog,
    )[0]!.productResolution;
  }

  private toStructuredCondition(value: string | null | undefined) {
    return value === 'NOVO' || value === 'SEMINOVO' || value === 'CPO' ? value : null;
  }

  private async resolveExplicitSourceManufacturer(
    sourceManufacturer: string | null | undefined,
    provenance: 'EXPLICIT_SOURCE' | null | undefined,
  ) {
    if (
      provenance !== 'EXPLICIT_SOURCE' ||
      !sourceManufacturer?.trim() ||
      isReservedAppleManufacturerAlias(sourceManufacturer)
    ) {
      return null;
    }
    if (!this.manufacturersService) {
      return {
        status: 'MISSING' as const,
        normalizedEvidence: normalizeManufacturerAlias(sourceManufacturer),
      };
    }
    return this.manufacturersService.resolve({
      evidence: sourceManufacturer,
      matchMode: 'EXACT_ALIAS',
      provenance: 'EXPLICIT_SOURCE_VALIDATED',
    });
  }

  private resolvePricingEligibility({
    dto,
    catalogProduct,
    condition,
    financialClassification,
  }: {
    dto: CalculateImportCostDto;
    catalogProduct:
      Awaited<ReturnType<ImportRadarRepository['listActiveCatalogProducts']>>[number] | null;
    condition: ImportProductCondition | null;
    financialClassification: FinancialClassificationResult;
  }) {
    if (financialClassification.classification === 'UNRESOLVED') {
      return { status: 'BLOCKED' as const, reason: 'classification_unresolved' as const };
    }
    if (financialClassification.classification === 'NON_APPLE') {
      return { status: 'ELIGIBLE' as const, reason: null };
    }
    if (!condition) {
      return { status: 'BLOCKED' as const, reason: 'condition_unresolved' as const };
    }
    if (catalogProduct?.isAppleOriginal === true) {
      return { status: 'ELIGIBLE' as const, reason: null };
    }

    const identity = deriveProfitLookupIdentity({
      productName: dto.name,
      category: dto.category,
      model: dto.model,
      capacity: dto.capacity,
      color: dto.color,
      quality: condition,
    });
    if (identity.status === 'ambiguous_identity') {
      return { status: 'BLOCKED' as const, reason: 'financial_identity_ambiguous' as const };
    }
    if (identity.status !== 'valid') {
      return { status: 'BLOCKED' as const, reason: 'financial_identity_insufficient' as const };
    }
    return { status: 'ELIGIBLE' as const, reason: null };
  }

  private observeParaguayPricingNormalization(
    dto: CalculateImportCostDto,
    catalog: Awaited<ReturnType<ImportRadarRepository['listActiveCatalogProducts']>>,
  ) {
    if (!this.productNormalization?.isPricingNormalizationEnabled()) return;

    void this.productNormalization
      .normalize(this.buildParaguayPricingNormalizationInput(dto), catalog)
      .catch((error) => {
        this.logger.warn({
          event: 'pricing.ai_normalization.shadow',
          context: 'NORMALIZE_PRICING_PY',
          source: 'PY',
          sourceProductId: dto.id,
          normalizationStatus: 'MODEL_ERROR',
          errorCode: error instanceof Error ? error.name : 'unknown_error',
        });
      });
  }

  private buildParaguayPricingNormalizationInput(
    dto: CalculateImportCostDto,
  ): ProductNormalizationInput {
    return {
      context: 'NORMALIZE_PRICING_PY',
      source: 'PY',
      originalReason: 'identity_insufficient',
      sourceText: dto.name,
      productName: dto.name,
      category: dto.category,
      model: dto.model ?? null,
      capacity: dto.capacity ?? null,
      color: dto.color ?? null,
      condition: null,
      rawLine: dto.name,
      previousLines: [],
      nextLines: [],
      activeProductHeading: dto.name,
      activeCategory: dto.category,
      activeCondition: null,
      qualityGrade: null,
      detectedPrice: dto.priceUsd,
    };
  }
}
