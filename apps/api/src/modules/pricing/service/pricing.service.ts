import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { SettingsService } from '../../settings/service/settings.service';
import { GenerateOfferDraftDto, PricingQueryDto, UpdateModelProfitDto } from '../dto/pricing.dto';
import { PricingPriceHistoryRecord } from '../interfaces/pricing-prisma.interface';
import {
  MODEL_PROFIT_PREFIX,
  OFFER_INCREMENT_KEY,
  PricingRepository,
} from '../repository/pricing.repository';
import { quoteIsValid, toNumber } from '../validators/pricing.validators';

@Injectable()
export class PricingService {
  constructor(
    @Inject(PricingRepository) private readonly pricingRepository: PricingRepository,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
  ) {}

  async list(query: PricingQueryDto = {}) {
    const [settings, pricingConfigurations, quotes] = await Promise.all([
      this.settingsService.getSettings(),
      this.pricingRepository.listPricingConfigurations(),
      this.pricingRepository.listQuotes(),
    ]);

    const modelProfits = this.getModelProfits(pricingConfigurations);
    const offerIncrement = toNumber(
      pricingConfigurations.find((item) => item.key === OFFER_INCREMENT_KEY)?.value ?? 100,
    );
    const bestQuotes = this.getBestQuotesByProduct(quotes);

    const catalog = Array.from(bestQuotes.values()).map((quote) => {
      const product = quote.product;
      const costProduct = toNumber(quote.costProduct);
      const modelName = product?.model?.name ?? '';
      const desiredNetProfit =
        modelProfits[modelName] ?? toNumber(settings.financial.defaultMargin);
      const fixedCost = toNumber(settings.financial.globalFixedCost);
      const freight = toNumber(settings.financial.defaultFreight);
      const paymentFee = toNumber(settings.financial.defaultPaymentFee);
      const salePrice = costProduct + fixedCost + freight + paymentFee + desiredNetProfit;
      const offerPrice = salePrice + offerIncrement;

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
        margin: salePrice ? desiredNetProfit / salePrice : 0,
        salePrice,
        offerPrice,
        lastUpdatedAt: quote.createdAt ?? quote.quoteDate,
        profitSource: modelProfits[modelName] !== undefined ? 'pricing_configuration' : 'default',
        googleSheetsReady: true,
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
    return item;
  }

  async recalculate(query: PricingQueryDto, user: AuthenticatedUser) {
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

  private getModelProfits(configurations: Array<{ key: string; value: string }>) {
    return configurations.reduce<Record<string, number>>((result, item) => {
      if (item.key.startsWith(MODEL_PROFIT_PREFIX)) {
        result[item.key.replace(MODEL_PROFIT_PREFIX, '')] = toNumber(item.value);
      }
      return result;
    }, {});
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
      if (query.minPrice !== undefined && item.salePrice < Number(query.minPrice)) {
        return false;
      }
      if (query.maxPrice !== undefined && item.salePrice > Number(query.maxPrice)) {
        return false;
      }
      return true;
    });

    if (query.sort === 'highest_price') {
      return filtered.sort((a, b) => b.salePrice - a.salePrice);
    }
    if (query.sort === 'recent') {
      return filtered.sort(
        (a, b) => new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime(),
      );
    }
    if (query.sort === 'highest_profit') {
      return filtered.sort((a, b) => b.desiredNetProfit - a.desiredNetProfit);
    }
    return filtered.sort((a, b) => a.salePrice - b.salePrice);
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
      desiredNetProfit: 0,
      margin: 0,
      salePrice: 0,
      offerPrice: 0,
      lastUpdatedAt: new Date(),
      profitSource: '',
      googleSheetsReady: true,
    };
  }
}
