import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
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
import { ProfitCondition, ProfitSheetCatalog } from '../interfaces/profit-sheet.interface';
import {
  lookupProfit,
  normalizeProfitProductDescription,
} from '../providers/google-sheets-profit.provider';
import { ProductProfitProvider } from '../providers/product-profit.provider';
import { OFFER_INCREMENT_KEY, PricingRepository } from '../repository/pricing.repository';
import { quoteIsValid, toNumber } from '../validators/pricing.validators';

@Injectable()
export class PricingService {
  constructor(
    @Inject(PricingRepository) private readonly pricingRepository: PricingRepository,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
    @Inject(ProductProfitProvider)
    private readonly profitProvider: ProductProfitProvider,
  ) {}

  async list(query: PricingQueryDto = {}) {
    const [settings, pricingConfigurations, quotes, profitCatalog] = await Promise.all([
      this.settingsService.getSettings(),
      this.pricingRepository.listPricingConfigurations(),
      this.pricingRepository.listQuotes(),
      this.profitProvider.getCatalog(),
    ]);

    const offerIncrement = toNumber(
      pricingConfigurations.find((item) => item.key === OFFER_INCREMENT_KEY)?.value ?? 100,
    );
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
      const salePrice =
        desiredNetProfit === null
          ? null
          : costProduct + fixedCost + freight + paymentFee + desiredNetProfit;
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
    const [settings, pricingConfigurations, profitCatalog] = await Promise.all([
      this.settingsService.getSettings(),
      this.pricingRepository.listPricingConfigurations(),
      this.profitProvider.getCatalog(),
    ]);
    const profitCondition = this.resolveTemporaryProfitCondition(dto);
    const profitProductDescription = this.getTemporaryProfitProductDescription(dto);
    const profitLookup = lookupProfit(profitCatalog, profitCondition, profitProductDescription);

    if (profitLookup.status === 'not_found') {
      throw new BadRequestException('Lucro liquido nao cadastrado para este modelo e condicao.');
    }
    if (profitLookup.status === 'duplicate') {
      throw new BadRequestException(
        'Cadastro duplicado de lucro liquido para este modelo e condicao.',
      );
    }

    const desiredNetProfit = profitLookup.record.netProfit;
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
      product: {
        id: dto.productId,
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
        recordId: profitLookup.record.productId,
        updatedAt: profitCatalog.fetchedAt,
      },
      offerDraft: {
        targetModule: 'offers',
        route: '/offers',
        payload: {
          productId: null,
          sourceQuoteId: `temporary-py-${dto.productId}`,
          productName,
          color: dto.color ?? '',
          capacity: dto.capacity ?? '',
          salePrice: calculation.salePrice,
          offerPrice: calculation.offerPrice,
          deliveryTime: '',
          warranty: 'Garantia padrao iNest Phone',
        },
      },
    };
  }

  async calculateBrazilRadarQuote(dto: BrazilRadarQuotePricingDto) {
    const quote = await this.pricingRepository.findBrazilRadarQuote(dto.sourceQuoteId);
    if (!quote) {
      throw new NotFoundException('Cotacao do Radar Brasil nao encontrada.');
    }

    const profitCondition = this.resolveBrazilRadarProfitCondition(quote.condition);
    const quoteDescription = this.getBrazilRadarProfitDescription(quote);
    const normalizedDescription = normalizeProfitProductDescription(quoteDescription);
    const [settings, pricingConfigurations, profitCatalog, catalogProduct] = await Promise.all([
      this.settingsService.getSettings(),
      this.pricingRepository.listPricingConfigurations(),
      this.profitProvider.getCatalog(),
      this.pricingRepository.findActiveCatalogProduct(profitCondition, normalizedDescription),
    ]);
    const profitProductDescription = catalogProduct?.productDescription?.trim() || quoteDescription;
    const profitLookup = this.findProfit(
      profitCatalog,
      catalogProduct?.profitProductId,
      profitCondition,
      profitProductDescription,
    );
    const desiredNetProfit = profitLookup.status === 'found' ? profitLookup.record.netProfit : null;
    const calculation = this.calculateExternalPricing(
      toNumber(quote.price),
      desiredNetProfit,
      settings,
      pricingConfigurations,
    );
    const calculationStatus =
      profitLookup.status === 'found'
        ? ('ready' as const)
        : profitLookup.status === 'duplicate'
          ? ('duplicate_profit' as const)
          : ('missing_profit' as const);
    const calculationError =
      profitLookup.status === 'not_found'
        ? 'Lucro Liquido nao cadastrado para este produto e condicao.'
        : profitLookup.status === 'duplicate'
          ? 'Cadastro duplicado de Lucro Liquido para este produto e condicao.'
          : null;
    const contact = quote.currentList.supplierContact;
    const productName = catalogProduct?.productDescription?.trim() || quote.productName.trim();

    return {
      temporary: true,
      origin: 'BR' as const,
      source: 'BRAZIL_RADAR' as const,
      sourceQuoteId: quote.id,
      catalogProductId: catalogProduct?.id ?? null,
      product: {
        id: catalogProduct?.id ?? null,
        name: productName,
        category: quote.category ?? '',
        model: quote.model ?? quote.productName,
        capacity: quote.capacity ?? '',
        color: quote.color ?? '',
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
        source: profitLookup.status === 'found' ? 'native_product_catalog' : 'unavailable',
        condition: profitCondition,
        productDescription: profitProductDescription,
        recordId: profitLookup.status === 'found' ? profitLookup.record.productId : null,
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
              payload: {
                productId: catalogProduct?.id ?? null,
                sourceQuoteId: quote.id,
                productName,
                color: quote.color ?? '',
                capacity: quote.capacity ?? '',
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
    pricingConfigurations: Awaited<
      ReturnType<PricingRepository['listPricingConfigurations']>
    >,
  ) {
    const fixedCost = toNumber(settings.financial.globalFixedCost);
    const freight = toNumber(settings.financial.defaultFreight);
    const paymentFee = toNumber(settings.financial.defaultPaymentFee);
    const offerIncrement = toNumber(
      pricingConfigurations.find((item) => item.key === OFFER_INCREMENT_KEY)?.value ?? 100,
    );
    const salePrice =
      desiredNetProfit === null
        ? null
        : costProduct + fixedCost + freight + paymentFee + desiredNetProfit;
    const offerPrice = salePrice === null ? null : salePrice + offerIncrement;

    return {
      fixedCost,
      freight,
      paymentFee,
      offerIncrement,
      salePrice,
      offerPrice,
      margin:
        salePrice !== null && desiredNetProfit !== null ? desiredNetProfit / salePrice : null,
    };
  }

  private resolveBrazilRadarProfitCondition(condition?: string | null): ProfitCondition {
    const normalized = condition?.trim().toUpperCase();
    if (normalized === 'CPO') return 'CPO';
    if (normalized === 'SEMINOVO' || normalized === 'USADO' || normalized === 'VITRINE') {
      return 'SEMINOVO';
    }
    return 'NOVO';
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

  private resolveTemporaryProfitCondition(dto: TemporaryImportPricingDto): ProfitCondition {
    if (dto.condition) return dto.condition;

    const productReference = `${dto.productName} ${dto.model ?? ''}`.toUpperCase();
    if (productReference.includes('CPO')) return 'CPO';
    if (productReference.includes('SEMINOVO')) return 'SEMINOVO';
    return this.getProfitCondition(dto.matchedProductType ?? '');
  }

  private getTemporaryProfitProductDescription(dto: TemporaryImportPricingDto) {
    const model = (dto.model?.trim() || dto.productName.trim()).trim();
    const capacity = dto.capacity?.trim() ?? '';
    if (!capacity) return model;

    const modelTokens = normalizeProfitProductDescription(model).split(' ');
    const capacityTokens = normalizeProfitProductDescription(capacity).split(' ');
    const containsCapacity = capacityTokens.every((token) => modelTokens.includes(token));
    return containsCapacity ? model : `${model} ${capacity}`.trim();
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
