import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { SettingsService } from '../../settings/service/settings.service';
import {
  BrazilRadarQuotePricingDto,
  GenerateOfferDraftDto,
  PricingQueryDto,
  TemporaryImportPricingDto,
  UpdateModelProfitDto,
} from '../dto/pricing.dto';
import {
  PricingBrazilRadarQuoteRecord,
  PricingPriceHistoryRecord,
} from '../interfaces/pricing-prisma.interface';
import {
  ProfitCondition,
  ProfitLookupResult,
  ProfitSheetCatalog,
} from '../interfaces/profit-sheet.interface';
import {
  lookupProfit,
  normalizeProfitProductDescription,
} from '../providers/google-sheets-profit.provider';
import { ProductProfitProvider } from '../providers/product-profit.provider';
import { OFFER_INCREMENT_KEY, PricingRepository } from '../repository/pricing.repository';
import {
  ProductNormalizationService,
  type ProductNormalizationInput,
} from '../../evolution-webhook/product-normalization.service';
import {
  COMMERCIAL_ROUNDING_ENDING_ONE_KEY,
  COMMERCIAL_ROUNDING_ENDING_TWO_KEY,
  normalizeCommercialPriceEndings,
  roundUpToCommercialPrice,
} from '../utils/commercial-price-rounding';
import { normalizeOfferIncrement } from '../utils/offer-increment';
import { quoteIsValid, toNumber } from '../validators/pricing.validators';
import {
  compareProfitIdentityResults,
  resolveProfitIdentity,
  type ProfitIdentityResolution,
} from './profit-identity-shadow';

function getBrazilRadarProfitCalculationState(resolution: ProfitIdentityResolution) {
  switch (resolution.status) {
    case 'found':
      return { calculationStatus: 'ready' as const, calculationError: null };
    case 'missing':
      return {
        calculationStatus: 'missing_profit' as const,
        calculationError: 'Lucro Liquido nao cadastrado para este produto e condicao.',
      };
    case 'insufficient_identity':
      return {
        calculationStatus: 'insufficient_identity' as const,
        calculationError: 'Informacoes insuficientes para identificar a configuracao financeira.',
      };
    case 'ambiguous_identity':
      return {
        calculationStatus: 'ambiguous_identity' as const,
        calculationError: 'Identidade financeira ambigua para este produto.',
      };
    case 'collision':
      return {
        calculationStatus: 'collision' as const,
        calculationError: 'Mais de um cadastro possui a mesma identidade financeira.',
      };
  }
}

function getDirectProductProfitCalculationState(lookup: ProfitLookupResult) {
  if (lookup.status === 'found') {
    return { calculationStatus: 'ready' as const, calculationError: null };
  }
  if (lookup.status === 'duplicate') {
    return {
      calculationStatus: 'collision' as const,
      calculationError: 'Mais de um cadastro possui a mesma identidade financeira.',
    };
  }
  return {
    calculationStatus: 'missing_profit' as const,
    calculationError: 'Lucro Liquido nao cadastrado para este produto e condicao.',
  };
}

@Injectable()
export class PricingService {
  private readonly logger = new Logger(PricingService.name);

  constructor(
    @Inject(PricingRepository) private readonly pricingRepository: PricingRepository,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
    @Inject(ProductProfitProvider)
    private readonly profitProvider: ProductProfitProvider,
    @Inject(ProductNormalizationService)
    private readonly productNormalization?: ProductNormalizationService,
  ) {}

  async list(query: PricingQueryDto = {}) {
    const [settings, pricingConfigurations, quotes, profitCatalog] = await Promise.all([
      this.settingsService.getSettings(),
      this.pricingRepository.listPricingConfigurations(),
      this.pricingRepository.listQuotes(),
      this.profitProvider.getCatalog(),
    ]);

    const offerIncrement = this.getOfferIncrement(pricingConfigurations);
    const commercialEndings = this.getCommercialPriceEndings(pricingConfigurations);
    const bestQuotes = this.getBestQuotesByProduct(quotes);

    const catalog = Array.from(bestQuotes.values()).map((quote) => {
      const product = quote.product;
      const costProduct = toNumber(quote.costProduct);
      const modelName = product?.model?.name ?? '';
      const profitCondition = this.getProfitCondition(product?.productType ?? '');
      const profitProductDescription = this.getProfitProductDescription(quote);
      const profitLookup = this.findProfit(
        profitCatalog,
        product?.profitProductId,
        profitCondition,
        profitProductDescription,
      );
      const fixedCost = toNumber(settings.financial.globalFixedCost);
      const freight = toNumber(settings.financial.defaultFreight);
      const paymentFee = toNumber(settings.financial.defaultPaymentFee);
      const desiredNetProfit =
        profitLookup.status === 'found' ? profitLookup.record.netProfit : null;
      const basePrice =
        desiredNetProfit === null
          ? null
          : costProduct + fixedCost + freight + paymentFee + desiredNetProfit;
      const salePrice =
        basePrice === null ? null : roundUpToCommercialPrice(basePrice, commercialEndings);
      const offerPrice = salePrice === null ? null : salePrice + offerIncrement;
      const calculationError =
        profitLookup.status === 'not_found'
          ? 'Lucro líquido não cadastrado para este modelo e condição.'
          : profitLookup.status === 'duplicate'
            ? 'Cadastro duplicado de lucro líquido para este modelo e condição.'
            : null;

      return {
        productId: quote.productId,
        quoteId: quote.id,
        productName: this.getProductName(quote),
        category: product?.category?.name ?? '',
        model: modelName,
        color: product?.color?.name ?? '',
        capacity: product?.storage?.displayName ?? '',
        productType: product?.productType ?? '',
        status: product?.status ?? '',
        supplier: {
          id: quote.supplier?.id ?? quote.supplierId,
          name: quote.supplier?.name ?? 'Fornecedor nao informado',
          source: quote.supplier?.source ?? '',
        },
        deliveryTime: quote.deliveryTime ?? '',
        costProduct,
        fixedCost,
        freight,
        paymentFee,
        desiredNetProfit,
        margin: salePrice && desiredNetProfit !== null ? desiredNetProfit / salePrice : null,
        salePrice,
        offerPrice,
        lastUpdatedAt: quote.createdAt ?? quote.quoteDate,
        profitSource: profitLookup.status === 'found' ? 'native_product_catalog' : 'unavailable',
        profitCondition,
        profitProductDescription,
        profitRecordId: profitLookup.status === 'found' ? profitLookup.record.productId : null,
        profitUpdatedAt: profitCatalog.fetchedAt,
        calculationStatus:
          profitLookup.status === 'found'
            ? 'ready'
            : profitLookup.status === 'duplicate'
              ? 'duplicate_profit'
              : 'missing_profit',
        calculationError,
        googleSheetsReady: profitLookup.status === 'found',
      };
    });

    return this.applyFilters(catalog, query);
  }

  async findOne(productId: string) {
    const items = await this.list({ productId } as PricingQueryDto);
    const item = items.find((pricing) => pricing.productId === productId);
    if (!item) {
      throw new NotFoundException('Preco calculado nao encontrado para o produto.');
    }
    if (
      !item.googleSheetsReady ||
      item.desiredNetProfit === null ||
      item.margin === null ||
      item.salePrice === null ||
      item.offerPrice === null
    ) {
      throw new BadRequestException(item.calculationError);
    }
    return {
      ...item,
      desiredNetProfit: item.desiredNetProfit,
      margin: item.margin,
      salePrice: item.salePrice,
      offerPrice: item.offerPrice,
    };
  }

  async recalculate(query: PricingQueryDto, user: AuthenticatedUser) {
    await this.profitProvider.refresh();
    const items = await this.list(query);
    await this.pricingRepository.createAuditLog({
      userId: user.id,
      operationType: 'UPDATE',
      context: { event: 'pricing.recalculated', affectedRecords: items.length },
    });
    return items;
  }

  async updateModelProfit(dto: UpdateModelProfitDto, user: AuthenticatedUser) {
    const updated = await this.pricingRepository.upsertModelProfit(
      dto.modelName,
      dto.desiredNetProfit,
    );
    await this.pricingRepository.createAuditLog({
      userId: user.id,
      operationType: 'UPDATE',
      entityId: dto.modelName,
      newValue: updated,
      context: {
        event: 'pricing.model_profit.updated',
        integration: 'google_sheets_ready',
      },
    });
    return updated;
  }

  async generateOfferDraft(dto: GenerateOfferDraftDto, user: AuthenticatedUser) {
    const pricing = await this.findOne(dto.productId);
    const draft = {
      targetModule: 'offers',
      route: '/offers',
      createdAt: new Date().toISOString(),
      payload: {
        productId: pricing.productId,
        productName: pricing.productName,
        color: pricing.color,
        capacity: pricing.capacity,
        salePrice: pricing.salePrice,
        offerPrice: pricing.offerPrice,
        deliveryTime: pricing.deliveryTime,
        warranty: 'Garantia padrao iNest Phone',
      },
    };

    await this.pricingRepository.createAuditLog({
      userId: user.id,
      operationType: 'CREATE',
      entityId: pricing.productId,
      newValue: draft,
      context: { event: 'pricing.offer_draft.generated' },
    });

    return draft;
  }

  async calculateTemporaryImport(dto: TemporaryImportPricingDto) {
    const [settings, pricingConfigurations, profitCatalog, catalogProduct] = await Promise.all([
      this.settingsService.getSettings(),
      this.pricingRepository.listPricingConfigurations(),
      this.profitProvider.getCatalog(),
      this.pricingRepository.findActiveCatalogProductById(dto.catalogProductId),
    ]);
    if (!catalogProduct || !catalogProduct.productDescription) {
      throw new BadRequestException('Produto canonico ativo nao encontrado para esta importacao.');
    }

    const profitCondition = this.resolveTemporaryProfitCondition(
      dto,
      catalogProduct.profitCondition,
    );
    const profitProductDescription = catalogProduct.productDescription;
    const profitLookup = this.findProfit(
      profitCatalog,
      catalogProduct.profitProductId,
      profitCondition,
      profitProductDescription,
    );

    if (profitLookup.status === 'not_found') {
      return this.buildTemporaryImportResult({
        dto,
        catalogProduct,
        profitCondition,
        profitProductDescription,
        profitCatalog,
        pricingConfigurations,
        settings,
        desiredNetProfit: null,
        calculationStatus: 'missing_profit',
        calculationError: 'Lucro liquido nao cadastrado para este modelo e condicao.',
      });
    }
    if (profitLookup.status === 'duplicate') {
      throw new BadRequestException(
        'Cadastro duplicado de lucro liquido para este modelo e condicao.',
      );
    }

    return this.buildTemporaryImportResult({
      dto,
      catalogProduct,
      profitCondition,
      profitProductDescription,
      profitCatalog,
      pricingConfigurations,
      settings,
      desiredNetProfit: profitLookup.record.netProfit,
      calculationStatus: 'ready',
    });
  }

  private buildTemporaryImportResult({
    dto,
    catalogProduct,
    profitCondition,
    profitProductDescription,
    profitCatalog,
    pricingConfigurations,
    settings,
    desiredNetProfit,
    calculationStatus,
    calculationError = null,
  }: {
    dto: TemporaryImportPricingDto;
    catalogProduct: NonNullable<
      Awaited<ReturnType<PricingRepository['findActiveCatalogProductById']>>
    >;
    profitCondition: ProfitCondition;
    profitProductDescription: string;
    profitCatalog: Awaited<ReturnType<ProductProfitProvider['getCatalog']>>;
    pricingConfigurations: Awaited<ReturnType<PricingRepository['listPricingConfigurations']>>;
    settings: Awaited<ReturnType<SettingsService['getSettings']>>;
    desiredNetProfit: number | null;
    calculationStatus: 'ready' | 'missing_profit';
    calculationError?: string | null;
  }) {
    const calculation = this.calculateExternalPricing(
      dto.totalCost,
      desiredNetProfit,
      settings,
      pricingConfigurations,
    );
    const productName = dto.productName.trim();

    return {
      temporary: true,
      origin: 'PY' as const,
      calculationStatus,
      calculationError,
      catalogProductId: catalogProduct.id,
      recalculationRequest: dto,
      product: {
        id: catalogProduct.id,
        name: productName,
        category: dto.category,
        brand: dto.brand ?? '',
        model: dto.model ?? '',
        capacity: dto.capacity ?? '',
        color: dto.color ?? '',
        supplier: dto.supplier,
        store: dto.store,
        city: dto.city ?? '',
        productUrl: dto.productUrl,
        priceUsd: dto.priceUsd,
      },
      importCosts: {
        dollarQuote: dto.dollarQuote,
        convertedPrice: dto.convertedPrice,
        cdeExit: dto.cdeExit,
        redirectCost: dto.redirectCost,
        brazilDispatch: dto.brazilDispatch,
        invoiceTax: dto.invoiceTax,
        correiosLabel: dto.correiosLabel,
        totalCost: dto.totalCost,
      },
      pricingCosts: {
        fixedCost: calculation.fixedCost,
        freight: calculation.freight,
        paymentFee: calculation.paymentFee,
        offerIncrement: calculation.offerIncrement,
      },
      desiredNetProfit,
      margin: calculation.margin,
      salePrice: calculation.salePrice,
      offerPrice: calculation.offerPrice,
      profit: {
        source: 'native_product_catalog',
        condition: profitCondition,
        productDescription: profitProductDescription,
        recordId:
          catalogProduct.profitProductId === null ? null : String(catalogProduct.profitProductId),
        updatedAt: profitCatalog.fetchedAt,
      },
      offerDraft:
        calculationStatus === 'ready' &&
        calculation.salePrice !== null &&
        calculation.offerPrice !== null
          ? {
              targetModule: 'offers',
              route: '/offers',
              createdAt: new Date().toISOString(),
              payload: {
                productId: catalogProduct.id,
                sourceQuoteId: `temporary-py-${dto.sourceProductId}`,
                productName,
                color: dto.color ?? '',
                capacity: dto.capacity ?? '',
                salePrice: calculation.salePrice,
                offerPrice: calculation.offerPrice,
                deliveryTime: '',
                warranty: 'Garantia padrao iNest Phone',
              },
            }
          : null,
    };
  }

  async calculateBrazilRadarQuote(dto: BrazilRadarQuotePricingDto) {
    const quote = await this.pricingRepository.findBrazilRadarQuote(dto.sourceQuoteId);
    if (!quote) {
      throw new NotFoundException('Cotacao do Radar Brasil nao encontrada.');
    }

    const quoteProfitCondition = this.resolveBrazilRadarProfitCondition(quote.condition);
    const quoteDescription = this.getBrazilRadarProfitDescription(quote);
    const normalizedDescription = normalizeProfitProductDescription(quoteDescription);
    const pricingResolutionSource = quote.productId ? 'PRODUCT_ID' : 'LEGACY_FALLBACK';
    const [settings, pricingConfigurations, profitCatalog, catalogProduct] = await Promise.all([
      this.settingsService.getSettings(),
      this.pricingRepository.listPricingConfigurations(),
      this.profitProvider.getCatalog(),
      quote.productId
        ? this.pricingRepository.findActiveCatalogProductById(quote.productId)
        : quoteProfitCondition
          ? this.pricingRepository.findActiveCatalogProduct(
              quoteProfitCondition,
              normalizedDescription,
            )
          : Promise.resolve(null),
    ]);
    const productIdUnavailable = Boolean(quote.productId && !catalogProduct);
    const catalogProfitCondition = catalogProduct
      ? this.resolveBrazilRadarProfitCondition(catalogProduct.profitCondition)
      : null;
    const conditionError = !quoteProfitCondition
      ? 'Condicao da cotacao do Radar Brasil ausente ou invalida.'
      : catalogProduct && !catalogProfitCondition
        ? 'Condicao do produto mestre associado ausente ou invalida.'
        : catalogProfitCondition && catalogProfitCondition !== quoteProfitCondition
          ? 'Condicao da cotacao do Radar Brasil diverge da condicao do produto mestre associado.'
          : null;
    const canResolveProfit = !productIdUnavailable && !conditionError;
    const profitCondition = quoteProfitCondition ?? quote.condition?.trim() ?? '';
    const profitProductDescription = catalogProduct?.productDescription?.trim() || quoteDescription;
    const legacyProfitLookup = !canResolveProfit
      ? { status: 'not_found' as const }
      : this.findProfit(
          profitCatalog,
          catalogProduct?.profitProductId,
          quoteProfitCondition!,
          profitProductDescription,
        );
    const profitIdentityResolution =
      canResolveProfit && pricingResolutionSource === 'LEGACY_FALLBACK'
        ? resolveProfitIdentity(profitCatalog, {
            productDescription: quoteDescription,
            condition: quoteProfitCondition!,
            category: quote.category,
            color: quote.color,
          })
        : null;
    if (profitIdentityResolution) {
      try {
        const shadowComparison = compareProfitIdentityResults(
          legacyProfitLookup,
          profitIdentityResolution,
        );
        this.logger.log({
          event: 'pricing.profit_identity.shadow',
          sourceQuoteId: quote.id,
          legacyStatus: legacyProfitLookup.status,
          shadowStatus: profitIdentityResolution.status,
          comparison: shadowComparison,
          legacyRecordId:
            legacyProfitLookup.status === 'found' ? legacyProfitLookup.record.productId : null,
          shadowRecordId:
            profitIdentityResolution.status === 'found'
              ? profitIdentityResolution.record.productId
              : null,
          shadowNetProfit:
            profitIdentityResolution.status === 'found'
              ? profitIdentityResolution.record.netProfit
              : null,
          profitLookupKey: profitIdentityResolution.identity.key,
          condition: profitCondition,
        });
      } catch (error) {
        this.logger.warn({
          event: 'pricing.profit_identity.shadow',
          sourceQuoteId: quote.id,
          legacyStatus: legacyProfitLookup.status,
          shadowStatus: 'error',
          comparison: 'SHADOW_ERROR',
          condition: profitCondition,
          errorType: error instanceof Error ? error.name : 'UnknownError',
        });
      }
    }
    const profitRecord = !canResolveProfit
      ? null
      : pricingResolutionSource === 'PRODUCT_ID'
        ? legacyProfitLookup.status === 'found'
          ? legacyProfitLookup.record
          : null
        : profitIdentityResolution?.status === 'found'
          ? profitIdentityResolution.record
          : null;
    const desiredNetProfit = profitRecord?.netProfit ?? null;
    const calculation = this.calculateExternalPricing(
      toNumber(quote.price),
      desiredNetProfit,
      settings,
      pricingConfigurations,
    );
    const { calculationStatus, calculationError } = !quoteProfitCondition
      ? {
          calculationStatus: 'missing_profit' as const,
          calculationError: conditionError,
        }
      : productIdUnavailable
        ? {
            calculationStatus: 'missing_profit' as const,
            calculationError: 'Produto mestre associado a cotacao nao esta ativo ou nao existe.',
          }
        : conditionError
          ? {
              calculationStatus: 'missing_profit' as const,
              calculationError: conditionError,
            }
          : pricingResolutionSource === 'PRODUCT_ID'
            ? getDirectProductProfitCalculationState(legacyProfitLookup)
            : getBrazilRadarProfitCalculationState(profitIdentityResolution!);
    const contact = quote.currentList.supplierContact;
    const productName = catalogProduct?.productDescription?.trim() || quote.productName.trim();

    this.logger.log({
      event: 'pricing.product_id.resolution',
      sourceQuoteId: quote.id,
      vm2Status: quote.productId ? 'FOUND' : null,
      productId: quote.productId ?? null,
      pricingResolutionSource,
      catalogProductId: catalogProduct?.id ?? null,
    });

    if (
      pricingResolutionSource === 'LEGACY_FALLBACK' &&
      profitIdentityResolution?.status === 'insufficient_identity'
    ) {
      this.observeBrazilPricingNormalization({
        sourceQuoteId: quote.id,
        sourceText: quoteDescription,
        productName: quote.productName,
        category: quote.category ?? null,
        model: quote.model ?? null,
        capacity: quote.capacity ?? null,
        color: quote.color ?? null,
        condition: quoteProfitCondition,
        price: toNumber(quote.price),
      });
    }

    return {
      temporary: true,
      origin: 'BR' as const,
      source: 'BRAZIL_RADAR' as const,
      sourceQuoteId: quote.id,
      catalogProductId: catalogProduct?.id ?? null,
      product: {
        id: catalogProduct?.id ?? null,
        name: productName,
        category: catalogProduct?.category?.name ?? quote.category ?? '',
        model: catalogProduct?.model?.name ?? quote.model ?? quote.productName,
        capacity: catalogProduct?.storage?.displayName ?? quote.capacity ?? '',
        color: catalogProduct?.color?.name ?? quote.color ?? '',
        supplier: contact.supplierName,
        city: contact.address ?? '',
        condition: profitCondition,
      },
      costProduct: toNumber(quote.price),
      pricingCosts: {
        fixedCost: calculation.fixedCost,
        freight: calculation.freight,
        paymentFee: calculation.paymentFee,
        offerIncrement: calculation.offerIncrement,
      },
      desiredNetProfit,
      margin: calculation.margin,
      salePrice: calculation.salePrice,
      offerPrice: calculation.offerPrice,
      profit: {
        source: profitRecord ? 'native_product_catalog' : 'unavailable',
        condition: profitCondition,
        productDescription: profitProductDescription,
        recordId: profitRecord?.productId ?? null,
        updatedAt: profitCatalog.fetchedAt,
      },
      calculationStatus,
      calculationError,
      offerDraft:
        calculationStatus === 'ready' &&
        calculation.salePrice !== null &&
        calculation.offerPrice !== null
          ? {
              targetModule: 'offers',
              route: '/offers',
              createdAt: new Date().toISOString(),
              payload: {
                productId: catalogProduct?.id ?? null,
                sourceQuoteId: quote.id,
                productName,
                color: catalogProduct?.color?.name ?? quote.color ?? '',
                capacity: catalogProduct?.storage?.displayName ?? quote.capacity ?? '',
                salePrice: calculation.salePrice,
                offerPrice: calculation.offerPrice,
                deliveryTime: '',
                warranty: 'Garantia padrao iNest Phone',
              },
            }
          : null,
    };
  }

  private calculateExternalPricing(
    costProduct: number,
    desiredNetProfit: number | null,
    settings: Awaited<ReturnType<SettingsService['getSettings']>>,
    pricingConfigurations: Awaited<ReturnType<PricingRepository['listPricingConfigurations']>>,
  ) {
    const fixedCost = toNumber(settings.financial.globalFixedCost);
    const freight = toNumber(settings.financial.defaultFreight);
    const paymentFee = toNumber(settings.financial.defaultPaymentFee);
    const offerIncrement = this.getOfferIncrement(pricingConfigurations);
    const basePrice =
      desiredNetProfit === null
        ? null
        : costProduct + fixedCost + freight + paymentFee + desiredNetProfit;
    const salePrice =
      basePrice === null
        ? null
        : roundUpToCommercialPrice(
            basePrice,
            this.getCommercialPriceEndings(pricingConfigurations),
          );
    const offerPrice = salePrice === null ? null : salePrice + offerIncrement;

    return {
      fixedCost,
      freight,
      paymentFee,
      offerIncrement,
      salePrice,
      offerPrice,
      margin: salePrice !== null && desiredNetProfit !== null ? desiredNetProfit / salePrice : null,
    };
  }

  private observeBrazilPricingNormalization(input: {
    sourceQuoteId: string;
    sourceText: string;
    productName: string;
    category: string | null;
    model: string | null;
    capacity: string | null;
    color: string | null;
    condition: ProfitCondition | null;
    price: number;
  }) {
    if (!this.productNormalization?.isPricingNormalizationEnabled()) return;

    void (async () => {
      try {
        const catalog = await this.pricingRepository.listActiveCatalogProducts();
        await this.productNormalization!.normalize(
          this.buildBrazilPricingNormalizationInput(input),
          catalog,
        );
      } catch (error) {
        this.logger.warn({
          event: 'pricing.ai_normalization.shadow',
          context: 'NORMALIZE_PRICING_BR',
          source: 'BR',
          sourceQuoteId: input.sourceQuoteId,
          normalizationStatus: 'MODEL_ERROR',
          errorCode: error instanceof Error ? error.name : 'unknown_error',
        });
      }
    })();
  }

  private buildBrazilPricingNormalizationInput(input: {
    sourceText: string;
    productName: string;
    category: string | null;
    model: string | null;
    capacity: string | null;
    color: string | null;
    condition: ProfitCondition | null;
    price: number;
  }): ProductNormalizationInput {
    return {
      context: 'NORMALIZE_PRICING_BR',
      source: 'BR',
      originalReason: 'identity_insufficient',
      sourceText: input.sourceText,
      productName: input.productName,
      category: input.category,
      model: input.model,
      capacity: input.capacity,
      color: input.color,
      condition: input.condition,
      rawLine: input.sourceText,
      previousLines: [],
      nextLines: [],
      activeProductHeading: input.productName,
      activeCategory: input.category,
      activeCondition: input.condition,
      qualityGrade: null,
      detectedPrice: input.price,
    };
  }

  private getCommercialPriceEndings(
    pricingConfigurations: Awaited<ReturnType<PricingRepository['listPricingConfigurations']>>,
  ) {
    return normalizeCommercialPriceEndings([
      pricingConfigurations.find((item) => item.key === COMMERCIAL_ROUNDING_ENDING_ONE_KEY)?.value,
      pricingConfigurations.find((item) => item.key === COMMERCIAL_ROUNDING_ENDING_TWO_KEY)?.value,
    ]);
  }

  private getOfferIncrement(
    pricingConfigurations: Awaited<ReturnType<PricingRepository['listPricingConfigurations']>>,
  ) {
    return normalizeOfferIncrement(
      pricingConfigurations.find((item) => item.key === OFFER_INCREMENT_KEY)?.value,
    );
  }

  private resolveBrazilRadarProfitCondition(condition?: string | null): ProfitCondition | null {
    const normalized = condition?.trim().toUpperCase();
    if (normalized === 'NOVO' || normalized === 'CPO' || normalized === 'SEMINOVO') {
      return normalized;
    }
    return null;
  }

  private getBrazilRadarProfitDescription(quote: PricingBrazilRadarQuoteRecord) {
    const base = (quote.model || quote.productName).trim();
    const capacity = quote.capacity?.trim();
    if (!capacity) return base;

    const normalizedBase = normalizeProfitProductDescription(base);
    const normalizedCapacity = normalizeProfitProductDescription(capacity);
    return normalizedBase.includes(normalizedCapacity) ? base : `${base} ${capacity}`;
  }

  private findProfit(
    catalog: ProfitSheetCatalog,
    productId: number | null | undefined,
    condition: ProfitCondition,
    productDescription: string,
  ) {
    if (productId !== null && productId !== undefined) {
      const directRecord = catalog.records.find((record) => record.productId === String(productId));
      if (directRecord) return { status: 'found' as const, record: directRecord };
    }

    return lookupProfit(catalog, condition, productDescription);
  }

  private getBestQuotesByProduct(quotes: PricingPriceHistoryRecord[]) {
    const bestQuotes = new Map<string, PricingPriceHistoryRecord>();

    quotes.forEach((quote) => {
      if (
        !quote.product ||
        !quoteIsValid({
          notes: quote.notes,
          quality: quote.product.qualityGrade,
          productStatus: quote.product.status,
          supplierStatus: quote.supplier?.status,
        })
      ) {
        return;
      }

      const current = bestQuotes.get(quote.productId);
      if (!current || toNumber(quote.costProduct) < toNumber(current.costProduct)) {
        bestQuotes.set(quote.productId, quote);
      }
    });

    return bestQuotes;
  }

  private applyFilters(items: ReturnType<PricingService['mapItem']>[], query: PricingQueryDto) {
    const normalizedSearch = query.search?.toLowerCase();
    const filtered = items.filter((item) => {
      if (normalizedSearch && !item.productName.toLowerCase().includes(normalizedSearch)) {
        return false;
      }
      if (query.productId && item.productId !== query.productId) {
        return false;
      }
      if (query.category && item.category !== query.category) {
        return false;
      }
      if (query.model && item.model !== query.model) {
        return false;
      }
      if (query.color && item.color !== query.color) {
        return false;
      }
      if (query.capacity && item.capacity !== query.capacity) {
        return false;
      }
      if (query.productType && item.productType !== query.productType) {
        return false;
      }
      if (query.status && item.status !== query.status) {
        return false;
      }
      if (
        query.minPrice !== undefined &&
        (item.salePrice === null || item.salePrice < Number(query.minPrice))
      ) {
        return false;
      }
      if (
        query.maxPrice !== undefined &&
        (item.salePrice === null || item.salePrice > Number(query.maxPrice))
      ) {
        return false;
      }
      return true;
    });

    if (query.sort === 'highest_price') {
      return filtered.sort((a, b) => nullableNumber(b.salePrice) - nullableNumber(a.salePrice));
    }
    if (query.sort === 'recent') {
      return filtered.sort(
        (a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime(),
      );
    }
    if (query.sort === 'highest_profit') {
      return filtered.sort(
        (a, b) => nullableNumber(b.desiredNetProfit) - nullableNumber(a.desiredNetProfit),
      );
    }
    return filtered.sort((a, b) => {
      if (a.salePrice === null) return 1;
      if (b.salePrice === null) return -1;
      return a.salePrice - b.salePrice;
    });
  }

  private getProductName(quote: PricingPriceHistoryRecord) {
    const productDescription = quote.product?.productDescription?.trim();
    if (productDescription) return productDescription;

    return [
      quote.product?.category?.name,
      quote.product?.model?.name,
      quote.product?.storage?.displayName,
      quote.product?.color?.name,
    ]
      .filter(Boolean)
      .join(' ');
  }

  private getProfitProductDescription(quote: PricingPriceHistoryRecord) {
    const model = quote.product?.model?.name?.trim() ?? '';
    const capacity = quote.product?.storage?.displayName?.trim() ?? '';
    if (!capacity) return model;

    const normalizedModel = normalizeProfitProductDescription(model);
    const normalizedCapacity = normalizeProfitProductDescription(capacity);
    const modelTokens = normalizedModel.split(' ');
    const capacityTokens = normalizedCapacity.split(' ');
    const containsCapacity = capacityTokens.every((token) => modelTokens.includes(token));
    return containsCapacity ? model : `${model} ${capacity}`.trim();
  }

  private getProfitCondition(productType: string): ProfitCondition {
    if (productType === 'APPLE_CPO') return 'CPO';
    if (productType === 'IPHONE_USED') return 'SEMINOVO';
    return 'NOVO';
  }

  private resolveTemporaryProfitCondition(
    dto: TemporaryImportPricingDto,
    catalogCondition: string | null | undefined,
  ): ProfitCondition {
    if (dto.condition && dto.condition === catalogCondition) return dto.condition;
    if (
      catalogCondition === 'NOVO' ||
      catalogCondition === 'SEMINOVO' ||
      catalogCondition === 'CPO'
    ) {
      return catalogCondition;
    }

    const productReference = `${dto.productName} ${dto.model ?? ''}`.toUpperCase();
    if (productReference.includes('CPO')) return 'CPO';
    if (productReference.includes('SEMINOVO')) return 'SEMINOVO';
    return this.getProfitCondition(dto.matchedProductType ?? '');
  }

  private mapItem() {
    return {
      productId: '',
      quoteId: '',
      productName: '',
      category: '',
      model: '',
      color: '',
      capacity: '',
      productType: '',
      status: '',
      supplier: { id: '', name: '', source: '' },
      deliveryTime: '',
      costProduct: 0,
      fixedCost: 0,
      freight: 0,
      paymentFee: 0,
      desiredNetProfit: null as number | null,
      margin: null as number | null,
      salePrice: null as number | null,
      offerPrice: null as number | null,
      lastUpdatedAt: new Date(),
      profitSource: '',
      profitCondition: 'NOVO' as ProfitCondition,
      profitProductDescription: '',
      profitRecordId: null as string | null,
      profitUpdatedAt: '',
      calculationStatus: 'missing_profit',
      calculationError: null as string | null,
      googleSheetsReady: false,
    };
  }
}

function nullableNumber(value: number | null) {
  return value ?? Number.NEGATIVE_INFINITY;
}
