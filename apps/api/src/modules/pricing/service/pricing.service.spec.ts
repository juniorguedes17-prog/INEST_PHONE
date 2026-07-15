import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../../settings/service/settings.service';
import { ProfitSheetCatalog } from '../interfaces/profit-sheet.interface';
import { GoogleSheetsProfitProvider } from '../providers/google-sheets-profit.provider';
import { PricingRepository } from '../repository/pricing.repository';
import { PricingService } from './pricing.service';

describe('PricingService profit sheet integration', () => {
  it('uses the exact net profit from Google Sheets in the existing pricing formula', async () => {
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
          productId: 'sheet-1',
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
      profitProvider as unknown as GoogleSheetsProfitProvider,
    );

    const [item] = await service.list();

    expect(item).toMatchObject({
      desiredNetProfit: 1190,
      salePrice: 6540,
      offerPrice: 6640,
      profitSource: 'google_sheets_profit',
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
      profitProvider as unknown as GoogleSheetsProfitProvider,
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
});
