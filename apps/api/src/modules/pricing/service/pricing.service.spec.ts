import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../../settings/service/settings.service';
import { PricingBrazilRadarQuoteRecord } from '../interfaces/pricing-prisma.interface';
import { ProfitSheetCatalog } from '../interfaces/profit-sheet.interface';
import { ProductProfitProvider } from '../providers/product-profit.provider';
import { PricingRepository } from '../repository/pricing.repository';
import {
  COMMERCIAL_ROUNDING_ENDING_ONE_KEY,
  COMMERCIAL_ROUNDING_ENDING_TWO_KEY,
} from '../utils/commercial-price-rounding';
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
  it('assigns an immutable ISO timestamp when a catalog offer draft is created', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-21T16:30:00.000Z'));

    const repository = { createAuditLog: vi.fn() };
    const service = new PricingService(
      repository as unknown as PricingRepository,
      {} as SettingsService,
      {} as ProductProfitProvider,
    );
    vi.spyOn(service, 'findOne').mockResolvedValue({
      productId: CATALOG_PRODUCT_ID,
      productName: 'iPhone 17 Pro Max 256GB',
      color: 'Azul',
      capacity: '256GB',
      salePrice: 6999,
      offerPrice: 7099,
      deliveryTime: 'Entrega imediata',
    } as never);

    try {
      const draft = await service.generateOfferDraft({ productId: CATALOG_PRODUCT_ID }, {
        id: 'user-a',
      } as never);

      expect(draft.createdAt).toBe('2026-08-21T16:30:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

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
      salePrice: 6549,
      offerPrice: 6649,
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
    ['NOVO', 'iPhone 17 Pro Max 256GB', 690, 6049],
    ['SEMINOVO', 'iPhone 16 Pro 256GB', 549, 5949],
    ['CPO', 'iPhone 17 Pro Max 256GB', 690, 6049],
  ] as const)(
    'uses the native %s profit record for temporary radar pricing',
    async (condition, productDescription, expectedProfit, expectedSalePrice) => {
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
        salePrice: expectedSalePrice,
        offerPrice: expectedSalePrice + 100,
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

  it('applies commercial endings configured in the pricing scope', async () => {
    const repository = {
      listPricingConfigurations: vi.fn().mockResolvedValue([
        { key: 'offer_increment', value: '100', type: 'currency' },
        { key: COMMERCIAL_ROUNDING_ENDING_ONE_KEY, value: '90', type: 'number' },
        { key: COMMERCIAL_ROUNDING_ENDING_TWO_KEY, value: '49', type: 'number' },
      ]),
    };
    const settingsService = { getSettings: vi.fn().mockResolvedValue(pricingSettings()) };
    const profitProvider = {
      getCatalog: vi.fn().mockResolvedValue({
        records: [
          {
            productId: '1',
            condition: 'NOVO',
            productDescription: 'iPhone 17 128GB',
            normalizedDescription: 'iphone 17 128gb',
            netProfit: 5,
          },
        ],
        fetchedAt: '2026-08-17T00:00:00.000Z',
      }),
    };
    const service = new PricingService(
      repository as unknown as PricingRepository,
      settingsService as unknown as SettingsService,
      profitProvider as unknown as ProductProfitProvider,
    );

    const result = await service.calculateTemporaryImport({
      productId: 'radar-py-1',
      productName: 'iPhone 17 128GB',
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
      model: 'iPhone 17 128GB',
      condition: 'NOVO',
    });

    expect(result).toMatchObject({
      desiredNetProfit: 5,
      salePrice: 5390,
      offerPrice: 5490,
      margin: 5 / 5390,
    });
  });

  it.each([
    ['iPhone', 'iPhone 17 Pro Max', '256GB'],
    ['MacBook', 'MacBook Air M5 13" 16GB', '512GB'],
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
          profitCondition: 'NOVO',
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
        salePrice: 6049,
        offerPrice: 6149,
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

  it('prioritizes a resolved master Product.id without reinterpreting the Radar description', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const repository = {
      findBrazilRadarQuote: vi.fn().mockResolvedValue(
        brazilRadarQuote({
          productId: CATALOG_PRODUCT_ID,
          productName: 'Mac Neo 13 8/256',
          model: 'Mac Neo 13 8/256',
          category: 'MacBook',
          condition: 'CPO',
        }),
      ),
      findActiveCatalogProductById: vi.fn().mockResolvedValue({
        id: CATALOG_PRODUCT_ID,
        profitProductId: 901,
        productDescription: 'MacBook Neo A18 Pro 13" 8GB/256GB',
        normalizedDescription: 'macbook neo a18 pro 13 8gb 256gb',
        productType: 'MACBOOK',
        profitCondition: 'CPO',
        category: { name: 'MacBook' },
        model: { name: 'MacBook Neo' },
        color: { name: 'Prateado' },
        storage: { displayName: '256GB' },
      }),
      findActiveCatalogProduct: vi.fn(),
      listPricingConfigurations: vi.fn().mockResolvedValue([]),
    };
    const settingsService = { getSettings: vi.fn().mockResolvedValue(pricingSettings()) };
    const profitProvider = {
      getCatalog: vi.fn().mockResolvedValue({
        records: [
          {
            productId: '901',
            condition: 'CPO',
            productDescription: 'MacBook Neo A18 Pro 13" 8GB/256GB',
            normalizedDescription: 'macbook neo a18 pro 13 8gb 256gb',
            netProfit: 800,
          },
        ],
        fetchedAt: '2026-08-18T10:00:00.000Z',
      }),
    };
    const service = new PricingService(
      repository as unknown as PricingRepository,
      settingsService as unknown as SettingsService,
      profitProvider as unknown as ProductProfitProvider,
    );

    const result = await service.calculateBrazilRadarQuote({ sourceQuoteId: BRAZIL_QUOTE_ID });

    expect(repository.findActiveCatalogProductById).toHaveBeenCalledWith(CATALOG_PRODUCT_ID);
    expect(repository.findActiveCatalogProduct).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      catalogProductId: CATALOG_PRODUCT_ID,
      product: {
        id: CATALOG_PRODUCT_ID,
        name: 'MacBook Neo A18 Pro 13" 8GB/256GB',
        capacity: '256GB',
        condition: 'CPO',
      },
      desiredNetProfit: 800,
      calculationStatus: 'ready',
      offerDraft: {
        payload: {
          productId: CATALOG_PRODUCT_ID,
          color: 'Prateado',
          capacity: '256GB',
        },
      },
    });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'pricing.product_id.resolution',
        sourceQuoteId: BRAZIL_QUOTE_ID,
        vm2Status: 'FOUND',
        productId: CATALOG_PRODUCT_ID,
        pricingResolutionSource: 'PRODUCT_ID',
      }),
    );
    log.mockRestore();
  });

  it.each([
    ['CPO', 'NOVO'],
    ['SEMINOVO', 'NOVO'],
    ['NOVO', 'CPO'],
  ] as const)(
    'blocks Brazil Radar pricing when quote condition %s diverges from Product condition %s',
    async (quoteCondition, productCondition) => {
      const repository = {
        findBrazilRadarQuote: vi
          .fn()
          .mockResolvedValue(
            brazilRadarQuote({ productId: CATALOG_PRODUCT_ID, condition: quoteCondition }),
          ),
        findActiveCatalogProductById: vi.fn().mockResolvedValue({
          id: CATALOG_PRODUCT_ID,
          profitProductId: 901,
          productDescription: 'iPhone 17 Pro Max 256GB',
          productType: 'IPHONE_SEALED',
          profitCondition: productCondition,
        }),
        findActiveCatalogProduct: vi.fn(),
        listPricingConfigurations: vi.fn().mockResolvedValue([]),
      };
      const settingsService = { getSettings: vi.fn().mockResolvedValue(pricingSettings()) };
      const profitProvider = {
        getCatalog: vi.fn().mockResolvedValue({
          records: [
            {
              productId: '901',
              condition: productCondition,
              productDescription: 'iPhone 17 Pro Max 256GB',
              normalizedDescription: 'iphone 17 pro max 256gb',
              netProfit: 800,
            },
          ],
          fetchedAt: '2026-08-21T00:00:00.000Z',
        }),
      };
      const service = new PricingService(
        repository as unknown as PricingRepository,
        settingsService as unknown as SettingsService,
        profitProvider as unknown as ProductProfitProvider,
      );

      const result = await service.calculateBrazilRadarQuote({ sourceQuoteId: BRAZIL_QUOTE_ID });

      expect(result).toMatchObject({
        product: { condition: quoteCondition },
        desiredNetProfit: null,
        salePrice: null,
        offerPrice: null,
        calculationStatus: 'missing_profit',
        calculationError:
          'Condicao da cotacao do Radar Brasil diverge da condicao do produto mestre associado.',
        offerDraft: null,
      });
    },
  );

  it('blocks Brazil Radar pricing when the associated Product has no profit condition', async () => {
    const repository = {
      findBrazilRadarQuote: vi
        .fn()
        .mockResolvedValue(brazilRadarQuote({ productId: CATALOG_PRODUCT_ID })),
      findActiveCatalogProductById: vi.fn().mockResolvedValue({
        id: CATALOG_PRODUCT_ID,
        profitProductId: 901,
        productDescription: 'iPhone 17 Pro Max 256GB',
        productType: 'IPHONE_SEALED',
        profitCondition: null,
      }),
      findActiveCatalogProduct: vi.fn(),
      listPricingConfigurations: vi.fn().mockResolvedValue([]),
    };
    const settingsService = { getSettings: vi.fn().mockResolvedValue(pricingSettings()) };
    const profitProvider = {
      getCatalog: vi.fn().mockResolvedValue({ records: [], fetchedAt: '2026-08-21T00:00:00.000Z' }),
    };
    const service = new PricingService(
      repository as unknown as PricingRepository,
      settingsService as unknown as SettingsService,
      profitProvider as unknown as ProductProfitProvider,
    );

    const result = await service.calculateBrazilRadarQuote({ sourceQuoteId: BRAZIL_QUOTE_ID });

    expect(result).toMatchObject({
      product: { condition: 'NOVO' },
      desiredNetProfit: null,
      salePrice: null,
      offerPrice: null,
      calculationStatus: 'missing_profit',
      calculationError: 'Condicao do produto mestre associado ausente ou invalida.',
      offerDraft: null,
    });
  });

  it.each([null, '', 'CONDITION_UNKNOWN'] as const)(
    'blocks Brazil Radar pricing without defaulting condition %j to NOVO',
    async (condition) => {
      const repository = {
        findBrazilRadarQuote: vi.fn().mockResolvedValue(brazilRadarQuote({ condition })),
        findActiveCatalogProduct: vi.fn(),
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
          fetchedAt: '2026-08-21T00:00:00.000Z',
        }),
      };
      const service = new PricingService(
        repository as unknown as PricingRepository,
        settingsService as unknown as SettingsService,
        profitProvider as unknown as ProductProfitProvider,
      );

      const result = await service.calculateBrazilRadarQuote({ sourceQuoteId: BRAZIL_QUOTE_ID });

      expect(repository.findActiveCatalogProduct).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        product: { condition: condition ?? '' },
        desiredNetProfit: null,
        salePrice: null,
        offerPrice: null,
        calculationStatus: 'missing_profit',
        calculationError: 'Condicao da cotacao do Radar Brasil ausente ou invalida.',
        offerDraft: null,
      });
    },
  );

  it('fails closed without falling back when a persisted Product.id is inactive or missing', async () => {
    const repository = {
      findBrazilRadarQuote: vi
        .fn()
        .mockResolvedValue(brazilRadarQuote({ productId: CATALOG_PRODUCT_ID })),
      findActiveCatalogProductById: vi.fn().mockResolvedValue(null),
      findActiveCatalogProduct: vi.fn(),
      listPricingConfigurations: vi.fn().mockResolvedValue([]),
    };
    const settingsService = { getSettings: vi.fn().mockResolvedValue(pricingSettings()) };
    const profitProvider = {
      getCatalog: vi.fn().mockResolvedValue({ records: [], fetchedAt: '' }),
    };
    const service = new PricingService(
      repository as unknown as PricingRepository,
      settingsService as unknown as SettingsService,
      profitProvider as unknown as ProductProfitProvider,
    );

    const result = await service.calculateBrazilRadarQuote({ sourceQuoteId: BRAZIL_QUOTE_ID });

    expect(repository.findActiveCatalogProduct).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      catalogProductId: null,
      desiredNetProfit: null,
      salePrice: null,
      offerPrice: null,
      calculationStatus: 'missing_profit',
      calculationError: 'Produto mestre associado a cotacao nao esta ativo ou nao existe.',
      offerDraft: null,
    });
  });

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

  it('uses canonical profit identity for iPhone 17 Pro instead of the legacy duplicate', async () => {
    const log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const repository = {
      findBrazilRadarQuote: vi.fn().mockResolvedValue(
        brazilRadarQuote({
          productName: 'iPhone 17 Pro 256gb eSIM Americano',
          model: 'iPhone 17 Pro 256gb eSIM Americano',
          capacity: '256GB',
        }),
      ),
      findActiveCatalogProduct: vi.fn().mockResolvedValue(null),
      listPricingConfigurations: vi.fn().mockResolvedValue([]),
    };
    const settingsService = { getSettings: vi.fn().mockResolvedValue(pricingSettings()) };
    const profitProvider = {
      getCatalog: vi.fn().mockResolvedValue({
        records: [
          {
            productId: '34',
            condition: 'NOVO',
            productDescription: 'iPhone 17 256GB',
            normalizedDescription: 'iphone 17 256gb',
            netProfit: 450,
          },
          {
            productId: '38',
            condition: 'NOVO',
            productDescription: 'iPhone 17 Pro 256GB',
            normalizedDescription: 'iphone 17 pro 256gb',
            netProfit: 500,
          },
          {
            productId: '41',
            condition: 'NOVO',
            productDescription: 'iPhone 17 Pro Max 256GB',
            normalizedDescription: 'iphone 17 pro max 256gb',
            netProfit: 500,
          },
        ],
        fetchedAt: '2026-08-17T10:00:00.000Z',
      }),
    };
    const service = new PricingService(
      repository as unknown as PricingRepository,
      settingsService as unknown as SettingsService,
      profitProvider as unknown as ProductProfitProvider,
    );

    const result = await service.calculateBrazilRadarQuote({ sourceQuoteId: BRAZIL_QUOTE_ID });

    expect(result).toMatchObject({
      calculationStatus: 'ready',
      desiredNetProfit: 500,
      salePrice: 5870,
      offerPrice: 5970,
      profit: {
        source: 'native_product_catalog',
        condition: 'NOVO',
        recordId: '38',
      },
      offerDraft: {
        payload: { productId: null, sourceQuoteId: BRAZIL_QUOTE_ID },
      },
    });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'pricing.profit_identity.shadow',
        sourceQuoteId: BRAZIL_QUOTE_ID,
        legacyStatus: 'duplicate',
        shadowStatus: 'found',
        comparison: 'LEGACY_DUPLICATE_SHADOW_FOUND',
        legacyRecordId: null,
        shadowRecordId: '38',
        shadowNetProfit: 500,
        condition: 'NOVO',
      }),
    );
    log.mockRestore();
  });

  it.each([
    ['NOVO', '38', 500],
    ['SEMINOVO', '100', 400],
    ['CPO', '116', 450],
  ] as const)(
    'keeps Brazil Radar profit independent for condition %s',
    async (condition, id, profit) => {
      const repository = {
        findBrazilRadarQuote: vi.fn().mockResolvedValue(
          brazilRadarQuote({
            condition,
            productName: 'iPhone 17 Pro 256GB',
            model: 'iPhone 17 Pro 256GB',
          }),
        ),
        findActiveCatalogProduct: vi.fn().mockResolvedValue(null),
        listPricingConfigurations: vi.fn().mockResolvedValue([]),
      };
      const settingsService = { getSettings: vi.fn().mockResolvedValue(pricingSettings()) };
      const profitProvider = {
        getCatalog: vi.fn().mockResolvedValue({
          records: [
            {
              productId: '38',
              condition: 'NOVO',
              productDescription: 'iPhone 17 Pro 256GB',
              normalizedDescription: 'iphone 17 pro 256gb',
              netProfit: 500,
            },
            {
              productId: '100',
              condition: 'SEMINOVO',
              productDescription: 'iPhone 17 Pro 256GB',
              normalizedDescription: 'iphone 17 pro 256gb',
              netProfit: 400,
            },
            {
              productId: '116',
              condition: 'CPO',
              productDescription: 'iPhone 17 Pro 256GB',
              normalizedDescription: 'iphone 17 pro 256gb',
              netProfit: 450,
            },
          ],
          fetchedAt: '2026-08-17T10:00:00.000Z',
        }),
      };
      const service = new PricingService(
        repository as unknown as PricingRepository,
        settingsService as unknown as SettingsService,
        profitProvider as unknown as ProductProfitProvider,
      );

      const result = await service.calculateBrazilRadarQuote({ sourceQuoteId: BRAZIL_QUOTE_ID });

      expect(result).toMatchObject({
        calculationStatus: 'ready',
        desiredNetProfit: profit,
        profit: { condition, recordId: id },
      });
    },
  );

  it('shares profit across colors while preserving each Radar quote cost', async () => {
    const calculate = async (color: string, price: number) => {
      const repository = {
        findBrazilRadarQuote: vi.fn().mockResolvedValue(
          brazilRadarQuote({
            color,
            price,
            productName: 'iPhone 17 Pro 256GB',
            model: 'iPhone 17 Pro 256GB',
          }),
        ),
        findActiveCatalogProduct: vi.fn().mockResolvedValue(null),
        listPricingConfigurations: vi.fn().mockResolvedValue([]),
      };
      const settingsService = { getSettings: vi.fn().mockResolvedValue(pricingSettings()) };
      const profitProvider = {
        getCatalog: vi.fn().mockResolvedValue({
          records: [
            {
              productId: '38',
              condition: 'NOVO',
              productDescription: 'iPhone 17 Pro 256GB',
              normalizedDescription: 'iphone 17 pro 256gb',
              netProfit: 500,
            },
          ],
          fetchedAt: '2026-08-17T10:00:00.000Z',
        }),
      };
      const service = new PricingService(
        repository as unknown as PricingRepository,
        settingsService as unknown as SettingsService,
        profitProvider as unknown as ProductProfitProvider,
      );
      return service.calculateBrazilRadarQuote({ sourceQuoteId: BRAZIL_QUOTE_ID });
    };

    const orange = await calculate('Laranja', 6580);
    const white = await calculate('Branco', 6780);

    expect(orange).toMatchObject({
      costProduct: 6580,
      desiredNetProfit: 500,
      salePrice: 7449,
      profit: { recordId: '38' },
    });
    expect(white).toMatchObject({
      costProduct: 6780,
      desiredNetProfit: 500,
      salePrice: 7649,
      profit: { recordId: '38' },
    });
  });

  it('uses canonical profit identity for the real MacBook Pro M5 14 16/512 quote', async () => {
    const repository = {
      findBrazilRadarQuote: vi.fn().mockResolvedValue(
        brazilRadarQuote({
          productName: 'MacBook Pro M5 14" 16GB/512GB',
          normalizedName: 'macbook pro m5 14 16gb 512gb',
          category: 'MacBook',
          model: 'MacBook Pro M5 14" 16GB/512GB',
          capacity: '512GB',
          price: 11250,
        }),
      ),
      findActiveCatalogProduct: vi.fn().mockResolvedValue(null),
      listPricingConfigurations: vi
        .fn()
        .mockResolvedValue([{ key: 'pricing.offer_increment', value: '100', type: 'currency' }]),
    };
    const settingsService = { getSettings: vi.fn().mockResolvedValue(pricingSettings()) };
    const profitProvider = {
      getCatalog: vi.fn().mockResolvedValue({
        records: [
          {
            productId: '14',
            condition: 'NOVO',
            productDescription: 'MacBook Pro M5 14 16/512GB',
            normalizedDescription: 'macbook pro m5 14 16 512gb',
            netProfit: 1300,
          },
        ],
        fetchedAt: '2026-08-17T10:00:00.000Z',
      }),
    };
    const service = new PricingService(
      repository as unknown as PricingRepository,
      settingsService as unknown as SettingsService,
      profitProvider as unknown as ProductProfitProvider,
    );

    const result = await service.calculateBrazilRadarQuote({ sourceQuoteId: BRAZIL_QUOTE_ID });

    expect(result).toMatchObject({
      calculationStatus: 'ready',
      costProduct: 11250,
      desiredNetProfit: 1300,
      pricingCosts: { fixedCost: 200, freight: 50, paymentFee: 100, offerIncrement: 100 },
      salePrice: 12949,
      offerPrice: 13049,
      profit: { source: 'native_product_catalog', condition: 'NOVO', recordId: '14' },
    });
  });

  it('fails closed when a MacBook quote omits RAM', async () => {
    const repository = {
      findBrazilRadarQuote: vi.fn().mockResolvedValue(
        brazilRadarQuote({
          productName: 'MacBook Pro M5 14" 512GB',
          normalizedName: 'macbook pro m5 14 512gb',
          category: 'MacBook',
          model: 'MacBook Pro M5 14" 512GB',
          capacity: '512GB',
        }),
      ),
      findActiveCatalogProduct: vi.fn().mockResolvedValue(null),
      listPricingConfigurations: vi.fn().mockResolvedValue([]),
    };
    const settingsService = { getSettings: vi.fn().mockResolvedValue(pricingSettings()) };
    const profitProvider = {
      getCatalog: vi.fn().mockResolvedValue({
        records: [
          {
            productId: '14',
            condition: 'NOVO',
            productDescription: 'MacBook Pro M5 14 16/512GB',
            normalizedDescription: 'macbook pro m5 14 16 512gb',
            netProfit: 1300,
          },
          {
            productId: '16',
            condition: 'NOVO',
            productDescription: 'MacBook Pro M5 14 24/512GB',
            normalizedDescription: 'macbook pro m5 14 24 512gb',
            netProfit: 1600,
          },
        ],
        fetchedAt: '2026-08-17T10:00:00.000Z',
      }),
    };
    const service = new PricingService(
      repository as unknown as PricingRepository,
      settingsService as unknown as SettingsService,
      profitProvider as unknown as ProductProfitProvider,
    );

    const result = await service.calculateBrazilRadarQuote({ sourceQuoteId: BRAZIL_QUOTE_ID });

    expect(result).toMatchObject({
      calculationStatus: 'insufficient_identity',
      calculationError: 'Informacoes insuficientes para identificar a configuracao financeira.',
      desiredNetProfit: null,
      salePrice: null,
      offerPrice: null,
      profit: { source: 'unavailable', recordId: null },
      offerDraft: null,
    });
  });

  it.each([
    {
      name: 'ambiguous identity',
      productName: 'iPhone 17 Pro 256GB Apple Watch S11 46mm',
      records: [],
      status: 'ambiguous_identity',
      error: 'Identidade financeira ambigua para este produto.',
    },
    {
      name: 'catalog collision',
      productName: 'iPhone 17 Pro 256GB',
      records: [
        {
          productId: '38',
          condition: 'NOVO' as const,
          productDescription: 'iPhone 17 Pro 256GB',
          normalizedDescription: 'iphone 17 pro 256gb',
          netProfit: 500,
        },
        {
          productId: '138',
          condition: 'NOVO' as const,
          productDescription: 'iPhone 17 Pro 256GB',
          normalizedDescription: 'iphone 17 pro 256gb',
          netProfit: 550,
        },
      ],
      status: 'collision',
      error: 'Mais de um cadastro possui a mesma identidade financeira.',
    },
  ])('does not calculate for $name', async ({ productName, records, status, error }) => {
    const repository = {
      findBrazilRadarQuote: vi
        .fn()
        .mockResolvedValue(brazilRadarQuote({ productName, model: productName })),
      findActiveCatalogProduct: vi.fn().mockResolvedValue(null),
      listPricingConfigurations: vi.fn().mockResolvedValue([]),
    };
    const settingsService = { getSettings: vi.fn().mockResolvedValue(pricingSettings()) };
    const profitProvider = {
      getCatalog: vi.fn().mockResolvedValue({
        records,
        fetchedAt: '2026-08-17T10:00:00.000Z',
      }),
    };
    const service = new PricingService(
      repository as unknown as PricingRepository,
      settingsService as unknown as SettingsService,
      profitProvider as unknown as ProductProfitProvider,
    );

    const result = await service.calculateBrazilRadarQuote({ sourceQuoteId: BRAZIL_QUOTE_ID });

    expect(result).toMatchObject({
      calculationStatus: status,
      calculationError: error,
      desiredNetProfit: null,
      salePrice: null,
      offerPrice: null,
      offerDraft: null,
    });
  });
});
