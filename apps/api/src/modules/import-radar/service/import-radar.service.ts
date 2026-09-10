import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { SettingsService } from '../../settings/service/settings.service';
import {
  CalculateImportCostDto,
  ConfirmImportManufacturerDto,
  ImportSearchQueryDto,
  UpdateDollarQuoteDto,
} from '../dto/import-radar.dto';
import { ImportProvider } from '../interfaces/import-provider.interface';
import { ImportRadarRepository } from '../repository/import-radar.repository';
import {
  identifyRedirectRule,
  roundMoneyToCents,
  toNumber,
} from '../validators/import-radar.validators';
import { ComprasParaguaiProvider } from '../providers/compras-paraguai.provider';
import { MockImportProvider } from '../providers/mock-import.provider';
import { processParsedSupplierItemsShadow } from '../../evolution-webhook/product-identity-shadow';
import {
  ProductNormalizationService,
  type ProductSemanticNormalizationCandidate,
  type ProductSemanticNormalizationStatus,
} from '../../evolution-webhook/product-normalization.service';
import { normalizeProductCondition, type ImportProductCondition } from '../condition-normalizer';
import {
  resolveFinancialClassification,
  resolveClassificationPricingEligibility,
  type FinancialClassificationResult,
  type PricingEligibilityDecision,
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
    const semanticNormalization = await this.normalizeParaguayProduct(dto);
    const semanticDto = semanticNormalization.product;
    const settings = await this.settingsService.getSettings();
    const importSettings = settings.importation;
    const convertedPriceRaw = dto.priceUsd * importSettings.dollarQuote;
    const convertedPrice = roundMoneyToCents(convertedPriceRaw);
    const redirectRule = identifyRedirectRule(dto, importSettings);
    const cdeExit = roundMoneyToCents(toNumber(importSettings.cdeExitPerBox));
    const redirectCost = roundMoneyToCents(toNumber(redirectRule?.redirectCost));
    const brazilDispatch = roundMoneyToCents(toNumber(importSettings.brazilDispatchPerBox));
    const invoiceTax = roundMoneyToCents(
      convertedPriceRaw * (toNumber(importSettings.invoiceTaxPercent) / 100),
    );
    const correiosLabel = roundMoneyToCents(toNumber(importSettings.correiosLabel));
    const total = roundMoneyToCents(
      convertedPrice + cdeExit + redirectCost + brazilDispatch + invoiceTax + correiosLabel,
    );

    const catalog = await this.repository.listActiveCatalogProducts();
    const { productResolution } = semanticNormalization.accepted
      ? this.analyzeCatalogProduct(semanticDto, catalog, semanticNormalization.identityText)
      : {
          productResolution: {
            status: 'MISSING' as const,
            reason: 'catalog_no_match' as const,
            candidateCount: 0,
          },
        };
    const catalogProduct =
      productResolution.status === 'FOUND'
        ? (catalog.find((product) => product.id === productResolution.productId) ?? null)
        : null;
    const sourceCondition = normalizeProductCondition(semanticDto.condition ?? '');
    const condition =
      this.toStructuredCondition(catalogProduct?.profitCondition) ??
      (sourceCondition.status === 'RESOLVED' ? sourceCondition.condition : null);
    const manufacturerResolution = await this.resolveExplicitSourceManufacturer(
      semanticDto.sourceManufacturer,
      semanticDto.sourceManufacturerProvenance,
    );
    const financialClassification = resolveFinancialClassification({
      canonicalProduct: catalogProduct,
      productName: semanticNormalization.identityText,
      category: semanticDto.category,
      model: semanticDto.model,
      capacity: semanticDto.capacity,
      color: semanticDto.color,
      condition,
      sourceManufacturer: semanticDto.sourceManufacturer,
      sourceManufacturerProvenance: semanticDto.sourceManufacturerProvenance,
      manufacturerResolution,
    });
    const result = {
      product: semanticDto,
      sourceCommercialIdentity: {
        sourceProductId: dto.id,
        sourceName: dto.name,
        commercialName: semanticNormalization.commercialName,
        displayName: formatSourceDisplayName({
          sourceName: dto.name,
          sourceManufacturer: semanticDto.sourceManufacturer,
          model: semanticDto.model,
          capacity: semanticDto.capacity,
        }),
        source: dto.origin ?? 'PY',
        sourceUrl: dto.productUrl,
        supplier: dto.store,
        sourceManufacturer: semanticDto.sourceManufacturer ?? null,
        sourceManufacturerProvenance: semanticDto.sourceManufacturerProvenance ?? null,
      },
      productResolution,
      catalogProductId:
        productResolution.status === 'FOUND' ? (productResolution.productId ?? null) : null,
      condition,
      financialClassification: financialClassification.classification,
      financialClassificationReason: financialClassification.reason,
      manufacturerKey: financialClassification.manufacturerKey ?? null,
      manufacturerProvenance: financialClassification.provenance ?? null,
      pricingEligibility: semanticNormalization.accepted
        ? this.resolvePricingEligibility({
            dto: semanticDto,
            identityText: semanticNormalization.identityText,
            catalogProduct,
            condition,
            financialClassification,
          })
        : ({ status: 'BLOCKED', reason: 'financial_identity_insufficient' } as const),
      matchedProductType: redirectRule?.productType ?? 'Nao identificado',
      dollarQuote: importSettings.dollarQuote,
      breakdown: {
        convertedPrice,
        cdeExit,
        redirectCost,
        brazilDispatch,
        invoiceTax,
        correiosLabel,
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
        semanticNormalizationStatus: semanticNormalization.status,
        semanticNormalizationAccepted: semanticNormalization.accepted,
        semanticNormalizationErrorCode: semanticNormalization.errorCode,
      },
    });

    return result;
  }

  async confirmManufacturer(dto: ConfirmImportManufacturerDto, user: AuthenticatedUser) {
    if (!this.manufacturersService) {
      throw new BadRequestException('Servico de fabricantes indisponivel.');
    }
    const catalog = await this.repository.listActiveCatalogProducts();
    const { productResolution } = this.analyzeCatalogProduct(dto, catalog);
    const catalogProduct =
      productResolution.status === 'FOUND'
        ? (catalog.find((product) => product.id === productResolution.productId) ?? null)
        : null;
    const conditionResolution = normalizeProductCondition(dto.condition ?? dto.name);
    const manufacturerResolution = await this.resolveExplicitSourceManufacturer(
      dto.sourceManufacturer,
      dto.sourceManufacturerProvenance,
    );
    const classification = resolveFinancialClassification({
      canonicalProduct: catalogProduct,
      productName: dto.name,
      category: dto.category,
      model: dto.model,
      capacity: dto.capacity,
      color: dto.color,
      condition: conditionResolution.status === 'RESOLVED' ? conditionResolution.condition : null,
      manufacturerResolution,
    });
    if (classification.classification === 'APPLE') {
      throw new BadRequestException('Produto Apple nao pode ser confirmado no registry externo.');
    }
    if (classification.reason !== 'manufacturer_missing') {
      throw new BadRequestException('A confirmacao de fabricante nao e necessaria para este item.');
    }

    await this.manufacturersService.confirm({
      canonicalName: dto.confirmation.canonicalName,
      alias: dto.confirmation.alias,
      userId: user.id,
      context: {
        origin: dto.origin ?? 'PY',
        sourceProductId: dto.id,
        sourceName: dto.name,
        sourceManufacturer: dto.sourceManufacturer ?? null,
      },
    });
    return this.calculate(dto, user);
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
    identityText = dto.name,
  ) {
    const conditionResolution = normalizeProductCondition(dto.condition ?? identityText);
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
      identityText,
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
    identityText = dto.name,
  ) {
    return processParsedSupplierItemsShadow(
      [
        {
          productName: identityText,
          normalizedName: identityText.toLowerCase(),
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
    identityText,
    catalogProduct,
    condition,
    financialClassification,
  }: {
    dto: CalculateImportCostDto;
    identityText: string;
    catalogProduct:
      Awaited<ReturnType<ImportRadarRepository['listActiveCatalogProducts']>>[number] | null;
    condition: ImportProductCondition | null;
    financialClassification: FinancialClassificationResult;
  }): PricingEligibilityDecision & { input?: { type: 'MANUFACTURER'; suggestedValue?: string } } {
    const classificationDecision = resolveClassificationPricingEligibility(financialClassification);
    if (classificationDecision.status !== 'ELIGIBLE') {
      return classificationDecision.status === 'NEEDS_INPUT' && dto.sourceManufacturer?.trim()
        ? {
            ...classificationDecision,
            input: { type: 'MANUFACTURER', suggestedValue: dto.sourceManufacturer.trim() },
          }
        : classificationDecision;
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
      productName: identityText,
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

  private async normalizeParaguayProduct(
    dto: CalculateImportCostDto,
  ): Promise<ParaguaySemanticNormalization> {
    if (!this.productNormalization) {
      return failedParaguayNormalization(dto, 'MODEL_ERROR', 'normalizer_unavailable');
    }

    try {
      const result = await this.productNormalization.normalizeSemanticProduct({
        context: 'NORMALIZE_PRICING_PY',
        source: 'PY',
        sourceName: dto.name,
        sourceEvidence: dto.sourceEvidence ?? dto.name,
        structuredFields: {
          manufacturer: dto.sourceManufacturer ?? dto.brand ?? null,
          category: dto.category,
          model: dto.model ?? null,
          storage: dto.capacity ?? null,
          color: dto.color ?? null,
          condition: dto.condition ?? null,
        },
      });
      return adaptParaguaySemanticCandidate(
        dto,
        result.normalizationStatus,
        result.candidate,
        result.errorCode ?? null,
      );
    } catch (error) {
      this.logger.warn({
        event: 'pricing.ai_normalization.primary',
        context: 'NORMALIZE_PRICING_PY',
        source: 'PY',
        sourceProductId: dto.id,
        normalizationStatus: 'MODEL_ERROR',
        errorCode: error instanceof Error ? error.name : 'unknown_error',
      });
      return failedParaguayNormalization(
        dto,
        'MODEL_ERROR',
        error instanceof Error ? error.name : 'unknown_error',
      );
    }
  }
}

type ParaguaySemanticNormalization = {
  product: CalculateImportCostDto;
  identityText: string;
  commercialName: string | null;
  status: ProductSemanticNormalizationStatus;
  accepted: boolean;
  errorCode: string | null;
};

function adaptParaguaySemanticCandidate(
  dto: CalculateImportCostDto,
  status: ProductSemanticNormalizationStatus,
  candidate: ProductSemanticNormalizationCandidate | null,
  normalizationErrorCode: string | null,
): ParaguaySemanticNormalization {
  if (status !== 'CANDIDATE' || !candidate) {
    return failedParaguayNormalization(
      dto,
      status,
      normalizationErrorCode ?? 'semantic_candidate_unavailable',
    );
  }

  const evidence = [
    dto.name,
    dto.sourceEvidence,
    dto.sourceManufacturer,
    dto.brand,
    dto.category,
    dto.model,
    dto.capacity,
    dto.color,
    dto.condition,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ');
  const grounded = (value: string | null) =>
    value && candidateIsSourceGrounded(value, evidence) ? value.trim() : null;

  const manufacturer = grounded(candidate.manufacturerCandidate);
  const family = grounded(candidate.familyCandidate);
  const modelCandidate = grounded(candidate.modelCandidate);
  const storage = grounded(candidate.storageCandidate);
  const ram = grounded(candidate.ramCandidate);
  const chip = grounded(candidate.chipCandidate);
  const screen = grounded(candidate.screenCandidate);
  const color = grounded(candidate.colorCandidate);
  const connectivity = grounded(candidate.connectivityCandidate);
  const condition = grounded(candidate.conditionCandidate);
  const explicitManufacturerConflict = Boolean(
    dto.sourceManufacturerProvenance === 'EXPLICIT_SOURCE' &&
    dto.sourceManufacturer?.trim() &&
    candidate.manufacturerCandidate?.trim() &&
    !sameMechanicalValue(dto.sourceManufacturer, candidate.manufacturerCandidate),
  );
  const explicitConditionConflict = Boolean(
    dto.condition && candidate.conditionCandidate && dto.condition !== candidate.conditionCandidate,
  );
  if (explicitManufacturerConflict || explicitConditionConflict) {
    return failedParaguayNormalization(dto, status, 'explicit_source_conflict');
  }

  const category = grounded(candidate.categoryCandidate);
  const model = composeStructuredModel(modelCandidate, chip, screen, ram);
  const candidateHasIdentity = Boolean(
    candidate.manufacturerCandidate ||
    candidate.categoryCandidate ||
    candidate.familyCandidate ||
    candidate.modelCandidate,
  );
  if (candidateHasIdentity && !manufacturer && !category && !model) {
    return failedParaguayNormalization(dto, status, 'grounding_insufficient');
  }
  const product: CalculateImportCostDto = {
    ...dto,
    brand: manufacturer ?? undefined,
    category: category ?? '',
    model: model ?? undefined,
    capacity: storage ?? undefined,
    color: color ?? undefined,
    condition: (condition ?? dto.condition) as ImportProductCondition | undefined,
  };
  const identityText = [
    product.model,
    product.capacity,
    product.color,
    product.condition,
    product.brand,
    product.category,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ');

  const presentationAttributes = [
    manufacturer,
    family,
    modelCandidate,
    category,
    screen,
    ram,
    storage,
    connectivity,
    color,
    condition,
    grounded(candidate.quantityCandidate),
    ...candidate.featureCandidates.map(grounded),
    grounded(candidate.connectorCandidate),
    grounded(candidate.powerCandidate),
    grounded(candidate.lengthCandidate),
  ].filter((value): value is string => Boolean(value));
  return {
    product,
    identityText,
    commercialName: validatedCommercialName(candidate.commercialName, presentationAttributes),
    status,
    accepted: true,
    errorCode: null,
  };
}

function failedParaguayNormalization(
  dto: CalculateImportCostDto,
  status: ProductSemanticNormalizationStatus,
  errorCode: string,
): ParaguaySemanticNormalization {
  return {
    product: {
      ...dto,
      brand: undefined,
      category: '',
      model: undefined,
      capacity: undefined,
      color: undefined,
      condition: dto.condition,
    },
    identityText: '',
    commercialName: null,
    status,
    accepted: false,
    errorCode,
  };
}

function validatedCommercialName(commercialName: string | null, groundedAttributes: string[]) {
  const normalized = commercialName?.trim();
  if (!normalized) return null;
  const groundedTokens = new Set(groundedAttributes.flatMap(mechanicalTokens));
  const nameTokens = mechanicalTokens(normalized);
  return nameTokens.length > 0 && nameTokens.every((token) => groundedTokens.has(token))
    ? normalized
    : null;
}

function composeStructuredModel(
  model: string | null,
  chip: string | null,
  screen: string | null,
  ram: string | null,
) {
  if (!model) return null;
  return [model, chip, screen, ram]
    .filter((value): value is string => Boolean(value))
    .reduce<string[]>((parts, value) => {
      if (!candidateIsSourceGrounded(value, parts.join(' '))) parts.push(value);
      return parts;
    }, [])
    .join(' ');
}

function candidateIsSourceGrounded(candidate: string, evidence: string) {
  const candidateTokens = mechanicalTokens(candidate);
  const evidenceTokens = mechanicalTokens(evidence);
  if (!candidateTokens.length || !evidenceTokens.length) return false;
  return candidateTokens.every((candidateToken) =>
    evidenceTokens.some(
      (evidenceToken) =>
        candidateToken === evidenceToken ||
        numericUnitEquivalent(candidateToken, evidenceToken) ||
        (Math.min(candidateToken.length, evidenceToken.length) >= 3 &&
          (candidateToken.startsWith(evidenceToken) || evidenceToken.startsWith(candidateToken))),
    ),
  );
}

function numericUnitEquivalent(left: string, right: string) {
  const leftMatch = left.match(/^(\d+)(?:gb|tb|mm|cm)?$/);
  const rightMatch = right.match(/^(\d+)(?:gb|tb|mm|cm)?$/);
  return Boolean(leftMatch?.[1] && leftMatch[1] === rightMatch?.[1]);
}

function sameMechanicalValue(left: string, right: string) {
  const leftTokens = mechanicalTokens(left);
  const rightTokens = mechanicalTokens(right);
  return (
    leftTokens.join(' ') === rightTokens.join(' ') ||
    leftTokens.every((token) => rightTokens.includes(token)) ||
    rightTokens.every((token) => leftTokens.includes(token))
  );
}

function mechanicalTokens(value: string): string[] {
  return (
    value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .match(/[a-z]+\d*|\d+[a-z]*/g) ?? []
  );
}
