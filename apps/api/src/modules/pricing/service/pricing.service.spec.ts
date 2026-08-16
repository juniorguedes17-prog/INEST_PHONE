import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../../settings/service/settings.service';
import { PricingBrazilRadarQuoteRecord } from '../interfaces/pricing-prisma.interface';
import { ProfitSheetCatalog } from '../interfaces/profit-sheet.interface';
import { ProductProfitProvider } from '../providers/product-profit.provider';
import { PricingRepository } from '../repository/pricing.repository';
import { PricingService } from './pricing.service';

const BRAZIL_QUOTE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CATALOG_PRODUCT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function brazilRadarQuote(
  overrides: Partial<PricingBrazilRadarQuoteRecord> = {},
): PricingBrazilRadarQuoteRecord {
  return {
    id: BRAZIL_QUOTE_ID,
    productName: 'iPhone 17 Pro Max 256GB',
    normalizedName: 'iphone 17 pro max 256gb',
    category: 'iPhone',
    model: 'iPhone 17 Pro Max',
    capacity: '256GB',
    color: 'Azul',
    condition: 'NOVO',
    price: 5000,
    rawLine: 'Azul R$ 5.000',
    createdAt: new Date('2026-08-16T10:00:00.000Z'),
    currentList: {
      updatedAt: new Date('2026-08-16T10:00:00.000Z'),
      receivedAt: new Date('2026-08-16T10:00:00.000Z'),
      supplierContact: {
        id: 'contact-1',
        supplierName: 'Fornecedor Brasil',
        whatsappNumber: '5511999999999',
        address: 'Sao Paulo, SP',
      },
    },
    ...overrides,
  };
}

function pricingSettings() {
  return {
    financial: {
      globalFixedCost: 200,
      defaultFreight: 50,
      defaultPaymentFee: 100,
    },
  };
}

describe('PricingService native product profit integration', () => {
  it('uses the exact native net profit in the existing pricing formula', async () => {
    const repository = {
      listPricingConfigurations: vi
        .fn()
        .mockResolvedValue([{ key: 'pricing.offer_increment', value: '100', type: 'currency' }]),
      listQuotes: vi.fn().mockResolvedValue([
        {
          id: 'quote-1',
          supplierId: 'supplier-1',
          productId: 'product-1',
          costProduct: 5000,
          quoteDate: new Date('2026-07-14T00:00:00.000Z'),
          supplier: { id: 'supplier-1', name: 'Fornecedor', status: 'ACTIVE' },
          product: {
            id: 'product-1',
            profitProductId: 1,
            productType: 'IPHONE_SEALED',
            status: 'ACTIVE',
            category: { id: 'category-1', name: 'iPhone' },
            model: { id: 'model-1', name: 'iPhone 17 Pro Max' },
            storage: { id: 'storage-1', displayName: '256GB' },
          },
        },
      ]),
    };
    const settingsService = {
      getSettings: vi.fn().mockResolvedValue({
        financial: {
          globalFixedCost: 200,
          defaultFreight: 50,
          defaultPaymentFee: 100,
          defaultMargin: 9999,
        },
      }),
    };
    const profitCatalog: ProfitSheetCatalog = {
      records: [
        {
          productId: '1',
          condition: 'NOVO',
          productDescription: 'iPhone 17 Pro Max 256GB',
          normalizedDescription: 'iphone 17 pro max 256gb',
          netProfit: 1190,
        },
      ],
      fetchedAt: '2026-07-14T00:00:00.000Z',
    };
    const profitProvider = { getCatalog: vi.fn().mockResolvedValue(profitCatalog) };
    const service = new PricingService(
      repository as unknown as PricingRepository,
      settingsService as unknown as SettingsService,
      profitProvider as unknown as ProductProfitProvider,
    );

    const [item] = await service.list();

    expect(item).toMatchObject({
      desiredNetProfit: 1190,
      salePrice: 6540,
      offerPrice: 6640,
      profitSource: 'native_product_catalog',
      calculationStatus: 'ready',
    });
    expect(item?.desiredNetProfit).not.toBe(9999);
  });

  it('blocks automatic calculation instead of applying a default profit', async () => {
    const repository = {
      listPricingConfigurations: vi.fn().mockResolvedValue([]),
      listQuotes: vi.fn().mockResolvedValue([
        {
          id: 'quote-1',
          supplierId: 'supplier-1',
          productId: 'product-1',
          costProduct: 5000,
          quoteDate: new Date(),
          supplier: { id: 'supplier-1', name: 'Fornecedor', status: 'ACTIVE' },
          product: {
            id: 'product-1',
            productType: 'APPLE_CPO',
            status: 'ACTIVE',
            model: { id: 'model-1', name: 'iPhone 17 Pro Max' },
            storage: { id: 'storage-1', displayName: '256GB' },
          },
        },
      ]),
    };
    const settingsService = {
      getSettings: vi.fn().mockResolvedValue({
        financial: {
          globalFixedCost: 200,
          defaultFreight: 50,
          defaultPaymentFee: 100,
          defaultMargin: 9999,
        },
      }),
    };
    const profitProvider = {
      getCatalog: vi.fn().mockResolvedValue({ records: [], fetchedAt: new Date().toISOString() }),
    };
    const service = new PricingService(
      repository as unknown as PricingRepository,
      settingsService as unknown as SettingsService,
      profitProvider as unknown as ProductProfitProvider,
    );

    const [item] = await service.list();

    expect(item).toMatchObject({
      desiredNetProfit: null,
      salePrice: null,
      offerPrice: null,
      profitCondition: 'CPO',
      calculationStatus: 'missing_profit',
      calculationError: 'Lucro líquido não cadastrado para este modelo e condição.',
    });
  });

  it.each([
    ['NOVO', 'iPhone 17 Pro Max 256GB', 690],
    ['SEMINOVO', 'iPhone 16 Pro 256GB', 549],
    ['CPO', 'iPhone 17 Pro Max 256GB', 690],
  ] as const)(
    'uses the native %s profit record for temporary radar pricing',
    async (condition, productDescription, expectedProfit) => {
      const repository = {
        listPricingConfigurations: vi
          .fn()
          .mockResolvedValue([{ key: 'pricing.offer_increment', value: '100', type: 'currency' }]),
      };
      const settingsService = {
        getSettings: vi.fn().mockResolvedValue({
          financial: {
            globalFixedCost: 200,
            defaultFreight: 50,
            defaultPaymentFee: 100,
          },
        }),
      };
      const profitProvider = {
        getCatalog: vi.fn().mockResolvedValue({
          records: [
            {
              productId: '1',
              condition,
              productDescription,
              normalizedDescription: productDescription.toLowerCase(),
              netProfit: expectedProfit,
            },
          ],
          fetchedAt: '2026-08-15T00:00:00.000Z',
        }),
      };
      const service = new PricingService(
        repository as unknown as PricingRepository,
        settingsService as unknown as SettingsService,
        profitProvider as unknown as ProductProfitProvider,
      );

      const result = await service.calculateTemporaryImport({
        productId: 'radar-py-1',
        productName: productDescription,
        category: 'iPhone',
        supplier: 'Fornecedor',
        store: 'Loja',
        productUrl: 'https://example.com/product',
        priceUsd: 1000,
        dollarQuote: 5,
        convertedPrice: 5000,
        cdeExit: 0,
        redirectCost: 0,
        brazilDispatch: 0,
        invoiceTax: 0,
        correiosLabel: 0,
        totalCost: 5000,
        model: productDescription,
        condition,
      });

      expect(result).toMatchObject({
        desiredNetProfit: expectedProfit,
        pricingCosts: { fixedCost: 200, freight: 50, paymentFee: 100 },
        salePrice: 5350 + expectedProfit,
        offerPrice: 5450 + expectedProfit,
        profit: { source: 'native_product_catalog', condition },
        offerDraft: {
          payload: {
            productId: null,
            sourceQuoteId: 'temporary-py-radar-py-1',
          },
        },
      });
    },
  );

  it.each([
    ['iPhone', 'iPhone 17 Pro Max', '256GB'],
    ['MacBook', 'MacBook Air M5 13"', '512GB'],
    ['iPad', 'iPad Air M4 13"', '128GB'],
    ['Apple Watch', 'Apple Watch Series 11 46mm', ''],
  ] as const)(
    'prepares a trusted Brazil Radar handoff for %s with a catalog UUID',
    async (category, model, capacity) => {
      const productDescription = [model, capacity].filter(Boolean).join(' ');
      const repository = {
        findBrazilRadarQuote: vi.fn().mockResolvedValue(
          brazilRadarQuote({
            category,
            model,
            capacity,
            productName: productDescription,
          }),
        ),
        findActiveCatalogProduct: vi.fn().mockResolvedValue({
          id: CATALOG_PRODUCT_ID,
          profitProductId: 42,
          productDescription,
          normalizedDescription: productDescription.toLowerCase(),
          productType: 'IPHONE_SEALED',
        }),
        listPricingConfigurations: vi
          .fn()
          .mockResolvedValue([{ key: 'pricing.offer_increment', value: '100', type: 'currency' }]),
      };
      const settingsService = { getSettings: vi.fn().mockResolvedValue(pricingSettings()) };
      const profitProvider = {
        getCatalog: vi.fn().mockResolvedValue({
          records: [
            {
              productId: '42',
              condition: 'NOVO',
              productDescription,
              normalizedDescription: productDescription.toLowerCase(),
              netProfit: 690,
            },
          ],
          fetchedAt: '2026-08-16T10:00:00.000Z',
        }),
      };
      const service = new PricingService(
        repository as unknown as PricingRepository,
        settingsService as unknown as SettingsService,
        profitProvider as unknown as ProductProfitProvider,
      );

      const result = await service.calculateBrazilRadarQuote({ sourceQuoteId: BRAZIL_QUOTE_ID });

      expect(repository.findBrazilRadarQuote).toHaveBeenCalledWith(BRAZIL_QUOTE_ID);
      expect(result).toMatchObject({
        sourceQuoteId: BRAZIL_QUOTE_ID,
        catalogProductId: CATALOG_PRODUCT_ID,
        product: { id: CATALOG_PRODUCT_ID, name: productDescription, category },
        costProduct: 5000,
        desiredNetProfit: 690,
        pricingCosts: { fixedCost: 200, freight: 50, paymentFee: 100, offerIncrement: 100 },
        salePrice: 6040,
        offerPrice: 6140,
        calculationStatus: 'ready',
        offerDraft: {
          payload: {
            productId: CATALOG_PRODUCT_ID,
            sourceQuoteId: BRAZIL_QUOTE_ID,
          },
        },
      });
    },
  );

  it('keeps an unmatched Radar product and resolves profit by condition and canonical description', async () => {
    const repository = {
      findBrazilRadarQuote: vi.fn().mockResolvedValue(brazilRadarQuote()),
      findActiveCatalogProduct: vi.fn().mockResolvedValue(null),
      listPricingConfigurations: vi.fn().mockResolvedValue([]),
    };
    const settingsService = { getSettings: vi.fn().mockResolvedValue(pricingSettings()) };
    const profitProvider = {
      getCatalog: vi.fn().mockResolvedValue({
        records: [
          {
            productId: '17',
            condition: 'NOVO',
            productDescription: 'iPhone 17 Pro Max 256GB',
            normalizedDescription: 'iphone 17 pro max 256gb',
            netProfit: 690,
          },
        ],
        fetchedAt: '2026-08-16T10:00:00.000Z',
      }),
    };
    const service = new PricingService(
      repository as unknown as PricingRepository,
      settingsService as unknown as SettingsService,
      profitProvider as unknown as ProductProfitProvider,
    );

    const result = await service.calculateBrazilRadarQuote({ sourceQuoteId: BRAZIL_QUOTE_ID });

    expect(result).toMatchObject({
      catalogProductId: null,
      product: { id: null, name: 'iPhone 17 Pro Max 256GB' },
      calculationStatus: 'ready',
      offerDraft: {
        payload: { productId: null, sourceQuoteId: BRAZIL_QUOTE_ID },
      },
    });
  });

  it('returns missing_profit without inventing profit or prices for an unmatched product', async () => {
    const repository = {
      findBrazilRadarQuote: vi.fn().mockResolvedValue(brazilRadarQuote()),
      findActiveCatalogProduct: vi.fn().mockResolvedValue(null),
      listPricingConfigurations: vi.fn().mockResolvedValue([]),
    };
    const settingsService = { getSettings: vi.fn().mockResolvedValue(pricingSettings()) };
    const profitProvider = {
      getCatalog: vi.fn().mockResolvedValue({
        records: [],
        fetchedAt: '2026-08-16T10:00:00.000Z',
      }),
    };
    const service = new PricingService(
      repository as unknown as PricingRepository,
      settingsService as unknown as SettingsService,
      profitProvider as unknown as ProductProfitProvider,
    );

    const result = await service.calculateBrazilRadarQuote({ sourceQuoteId: BRAZIL_QUOTE_ID });

    expect(result).toMatchObject({
      catalogProductId: null,
      desiredNetProfit: null,
      margin: null,
      salePrice: null,
      offerPrice: null,
      calculationStatus: 'missing_profit',
      calculationError: 'Lucro Liquido nao cadastrado para este produto e condicao.',
      offerDraft: null,
    });
  });
});
