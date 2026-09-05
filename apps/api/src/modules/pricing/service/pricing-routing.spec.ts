import { describe, expect, it, vi } from 'vitest';
import { ProductNormalizationService } from '../../evolution-webhook/product-normalization.service';
import { SettingsService } from '../../settings/service/settings.service';
import { TemporaryImportPricingDto } from '../dto/pricing.dto';
import { ProductProfitProvider } from '../providers/product-profit.provider';
import { PricingRepository } from '../repository/pricing.repository';
import {
  COMMERCIAL_ROUNDING_ENDING_ONE_KEY,
  COMMERCIAL_ROUNDING_ENDING_TWO_KEY,
} from '../utils/commercial-price-rounding';
import { PricingService } from './pricing.service';

type Origin = 'CATALOG' | 'BR' | 'PY';
const origins: Origin[] = ['CATALOG', 'BR', 'PY'];

function setup(
  isAppleOriginal: boolean | null | undefined,
  cost = 700,
  profit: number | null = null,
) {
  const product = {
    id: 'catalog-product',
    profitProductId: 1,
    productDescription: 'iPhone 17 Pro Max 256GB',
    productType: 'IPHONE_SEALED',
    profitCondition: 'NOVO',
    isAppleOriginal,
    status: 'ACTIVE',
    category: { id: 'category', name: 'iPhone' },
    model: { id: 'model', name: 'iPhone 17 Pro Max' },
    storage: { id: 'storage', displayName: '256GB' },
  };
  const quote = {
    id: 'br-quote',
    productId: product.id,
    productName: product.productDescription,
    model: product.model.name,
    category: product.category.name,
    capacity: '256GB',
    condition: 'NOVO',
    price: cost,
    currentList: { supplierContact: { supplierName: 'BR supplier', address: 'SP' } },
  };
  const dto: TemporaryImportPricingDto = {
    sourceProductId: 'external-py-id',
    catalogProductId: product.id,
    productName: product.productDescription,
    category: 'iPhone',
    brand: 'Apple',
    model: product.model.name,
    condition: 'NOVO',
    capacity: '256GB',
    supplier: 'PY supplier',
    store: 'PY store',
    productUrl: 'https://example.com/item',
    priceUsd: 100,
    dollarQuote: 5,
    convertedPrice: 500,
    cdeExit: 20,
    redirectCost: 30,
    brazilDispatch: 40,
    invoiceTax: 60,
    correiosLabel: 50,
    totalCost: cost,
  };
  const configurations = [{ key: 'offer_increment', value: '75', type: 'currency' }];
  const repository = {
    findActiveCatalogProductById: vi.fn().mockResolvedValue(product),
    findActiveCatalogProduct: vi.fn().mockResolvedValue(product),
    findBrazilRadarQuote: vi.fn().mockResolvedValue(quote),
    listPricingConfigurations: vi.fn().mockResolvedValue(configurations),
    listQuotes: vi.fn().mockResolvedValue([
      {
        id: 'catalog-quote',
        productId: product.id,
        supplierId: 'supplier',
        costProduct: cost,
        quoteDate: new Date('2026-09-05T12:00:00Z'),
        product,
        supplier: { id: 'supplier', name: 'Supplier', status: 'ACTIVE' },
      },
    ]),
  };
  const records =
    profit === null
      ? []
      : [
          {
            productId: '1',
            condition: 'NOVO',
            productDescription: product.productDescription,
            normalizedDescription: 'iphone 17 pro max 256gb',
            netProfit: profit,
          },
        ];
  const provider = {
    getCatalog: vi.fn().mockResolvedValue({ records, fetchedAt: '2026-09-05T12:00:00Z' }),
  };
  const settings = {
    getSettings: vi.fn().mockResolvedValue({
      financial: { globalFixedCost: 200, defaultFreight: 50, defaultPaymentFee: 100 },
    }),
  };
  const normalization = {
    isPricingNormalizationEnabled: vi.fn().mockReturnValue(true),
    normalize: vi.fn(),
  };
  const service = new PricingService(
    repository as unknown as PricingRepository,
    settings as unknown as SettingsService,
    provider as unknown as ProductProfitProvider,
    normalization as unknown as ProductNormalizationService,
  );
  async function calculate(origin: Origin) {
    if (origin === 'CATALOG') return (await service.list())[0]!;
    if (origin === 'BR') return service.calculateBrazilRadarQuote({ sourceQuoteId: quote.id });
    return service.calculateTemporaryImport(dto);
  }
  return {
    product,
    quote,
    dto,
    configurations,
    repository,
    provider,
    settings,
    normalization,
    service,
    calculate,
  };
}

describe('Pricing canonical originality routing', () => {
  describe.each(origins)('%s', (origin) => {
    it.each([true, null, undefined])(
      'preserves legacy financial results for %s',
      async (classification) => {
        const fixture = setup(classification, 700, 500);
        const result = await fixture.calculate(origin);
        expect(result).toMatchObject({
          desiredNetProfit: 500,
          salePrice: 1570,
          offerPrice: 1645,
          margin: 500 / 1570,
          calculationStatus: 'ready',
          calculationError: null,
        });
        expect(result).not.toHaveProperty('engineMetadata');
        if ('pricingCosts' in result)
          expect(result.pricingCosts).toEqual({
            fixedCost: 200,
            freight: 50,
            paymentFee: 100,
            offerIncrement: 75,
          });
        else expect(result).toMatchObject({ fixedCost: 200, freight: 50, paymentFee: 100 });
        expect(fixture.normalization.normalize).not.toHaveBeenCalled();
      },
    );

    it.each([true, null, undefined])(
      'preserves missing_profit and manual registration for %s',
      async (classification) => {
        const fixture = setup(classification);
        const result = await fixture.calculate(origin);
        expect(result).toMatchObject({
          desiredNetProfit: null,
          salePrice: null,
          offerPrice: null,
          calculationStatus: 'missing_profit',
        });
        expect(result.calculationError).toBeTruthy();
        expect(result).not.toHaveProperty('engineMetadata');
        if ('catalogProductId' in result) expect(result.catalogProductId).toBe(fixture.product.id);
        if ('recalculationRequest' in result) expect(result.recalculationRequest).toBe(fixture.dto);
        expect(fixture.normalization.normalize).not.toHaveBeenCalled();
      },
    );

    it.each([
      [700, 300, 1150, 1349, 1424],
      [1500, 250, 1900, 2070, 2145],
      [6000, 480, 6630, 6849, 6924],
    ])('routes false without manual profit at cost %s', async (cost, profit, raw, sale, offer) => {
      const fixture = setup(false, cost);
      const result = await fixture.calculate(origin);
      expect(result).toMatchObject({
        desiredNetProfit: profit,
        salePrice: sale,
        offerPrice: offer,
        calculationStatus: 'ready',
        calculationError: null,
        engineMetadata: {
          engine: 'NON_APPLE_ELECTRONICS',
          ruleVersion: '1.0.0',
          acquisitionCost: cost,
          fixedCost: 150,
          targetProfit: profit,
          rawBasePrice: raw,
          protectedBasePrice: raw,
          continuityAdjustment: 0,
          basePrice: raw + 150,
          roundedPrice: sale,
          offerPrice: offer,
          applicableCharges: { defaultFreight: 50, defaultPaymentFee: 100 },
          offerIncrement: 75,
        },
      });
      if ('googleSheetsReady' in result) expect(result.googleSheetsReady).toBe(true);
      else expect(result.offerDraft?.payload.productId).toBe(fixture.product.id);
      expect(fixture.normalization.normalize).not.toHaveBeenCalled();
    });

    it('ignores manual profit as authority for false', async () => {
      const result = await setup(false, 700, 9999).calculate(origin);
      expect(result.desiredNetProfit).toBe(300);
      expect(result.salePrice).toBe(1349);
    });

    it('keeps continuity adjustment separate from policy target profit', async () => {
      const result = await setup(false, 1000.01).calculate(origin);
      expect(result).toMatchObject({
        desiredNetProfit: 250,
        engineMetadata: {
          rawBasePrice: 1400.01,
          continuityAdjustment: 49.99,
          protectedBasePrice: 1450,
          targetProfit: 250,
          targetProfitRateOnCost: 0.15,
          targetProfitFloor: 250,
          band: { lowerBoundExclusive: 1000, upperBoundInclusive: 2000 },
        },
      });
    });

    it('reuses configured commercial endings and offer increment', async () => {
      const fixture = setup(false);
      fixture.configurations.push(
        { key: COMMERCIAL_ROUNDING_ENDING_ONE_KEY, value: '49', type: 'number' },
        { key: COMMERCIAL_ROUNDING_ENDING_TWO_KEY, value: '70', type: 'number' },
      );
      expect(await fixture.calculate(origin)).toMatchObject({ salePrice: 1349, offerPrice: 1424 });
      fixture.configurations[1]!.value = '90';
      expect(await fixture.calculate(origin)).toMatchObject({ salePrice: 1370, offerPrice: 1445 });
    });
  });

  it('uses final PY acquisition cost once and leaves all import components untouched', async () => {
    const fixture = setup(false);
    const before = structuredClone(fixture.dto);
    const result = await fixture.service.calculateTemporaryImport(fixture.dto);
    expect(result.importCosts).toEqual({
      dollarQuote: 5,
      convertedPrice: 500,
      cdeExit: 20,
      redirectCost: 30,
      brazilDispatch: 40,
      invoiceTax: 60,
      correiosLabel: 50,
      totalCost: 700,
    });
    expect(result.engineMetadata?.acquisitionCost).toBe(700);
    expect(result.engineMetadata?.basePrice).toBe(1300);
    expect(fixture.dto).toEqual(before);
    expect(result.profit).toMatchObject({ source: 'non_apple_electronics_policy', recordId: null });
  });

  it('routes BR legacy lookup only after an active canonical product was located', async () => {
    const fixture = setup(false);
    fixture.quote.productId = '';
    const result = await fixture.calculate('BR');
    expect(result).toMatchObject({
      calculationStatus: 'ready',
      engineMetadata: { engine: 'NON_APPLE_ELECTRONICS' },
    });
    expect(fixture.repository.findActiveCatalogProduct).toHaveBeenCalledOnce();
  });

  it('keeps BR condition incompatibility blocked, including non-Apple', async () => {
    const fixture = setup(false);
    fixture.quote.condition = 'CPO';
    const result = await fixture.calculate('BR');
    expect(result).toMatchObject({ calculationStatus: 'missing_profit', salePrice: null });
    expect(result.calculationError).toContain('diverge');
    expect(result).not.toHaveProperty('engineMetadata');
  });

  it('does not route an unavailable/inactive canonical Product', async () => {
    const fixture = setup(false);
    fixture.repository.findActiveCatalogProductById.mockResolvedValue(null);
    await expect(fixture.calculate('PY')).rejects.toThrow('Produto canonico ativo nao encontrado');
    const result = await fixture.calculate('BR');
    expect(result.salePrice).toBeNull();
    expect(result).not.toHaveProperty('engineMetadata');
  });

  it('does not route inactive catalog quotes', async () => {
    const fixture = setup(false);
    fixture.product.status = 'INACTIVE';
    expect(await fixture.service.list()).toEqual([]);
  });

  it.each([0, -1, NaN, Infinity])('rejects invalid non-Apple acquisition cost %s', async (cost) => {
    const fixture = setup(false, cost);
    await expect(fixture.calculate('PY')).rejects.toThrow();
  });

  it.each(['IPAD', 'MACBOOK', 'APPLE_WATCH', 'AIRPODS', 'ACCESSORY'])(
    'never infers classification from %s or provider brand',
    async (productType) => {
      const fixture = setup(null);
      fixture.product.productType = productType;
      fixture.dto.brand = 'Non-Apple provider brand';
      for (const origin of origins) {
        const result = await fixture.calculate(origin);
        expect(result.calculationStatus).toBe('missing_profit');
        expect(result).not.toHaveProperty('engineMetadata');
      }
    },
  );
});
