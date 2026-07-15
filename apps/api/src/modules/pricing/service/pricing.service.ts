import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { SettingsService } from '../../settings/service/settings.service';
import { GenerateOfferDraftDto, PricingQueryDto, UpdateModelProfitDto } from '../dto/pricing.dto';
import { PricingPriceHistoryRecord } from '../interfaces/pricing-prisma.interface';
import { ProfitCondition } from '../interfaces/profit-sheet.interface';
import {
  GoogleSheetsProfitProvider,
  lookupProfit,
  normalizeProfitProductDescription,
} from '../providers/google-sheets-profit.provider';
import { OFFER_INCREMENT_KEY, PricingRepository } from '../repository/pricing.repository';
import { quoteIsValid, toNumber } from '../validators/pricing.validators';

@Injectable()
export class PricingService {
  constructor(
    @Inject(PricingRepository) private readonly pricingRepository: PricingRepository,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
    @Inject(GoogleSheetsProfitProvider)
    private readonly profitProvider: GoogleSheetsProfitProvider,
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
      const profitLookup = lookupProfit(profitCatalog, profitCondition, profitProductDescription);
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
        profitSource: profitLookup.status === 'found' ? 'google_sheets_profit' : 'unavailable',
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
