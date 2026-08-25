import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../../settings/service/settings.service';
import { ProductIdShadowCandidate } from '../../evolution-webhook/product-identity-shadow';
import { ComprasParaguaiProvider } from '../providers/compras-paraguai.provider';
import { MockImportProvider } from '../providers/mock-import.provider';
import { ImportRadarRepository } from '../repository/import-radar.repository';
import { ImportRadarService } from './import-radar.service';

const PRODUCT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function catalogProduct(id = PRODUCT_ID): ProductIdShadowCandidate {
  return {
    id,
    productDescription: 'iPhone 17 Pro Max 256GB',
    productType: 'IPHONE_SEALED',
    profitCondition: 'NOVO',
    variantAttributes: null,
    category: null,
    model: null,
    color: null,
    storage: { displayName: '256 GB', value: '256', unit: 'GB' },
  };
}

function createService(catalog: ProductIdShadowCandidate[]) {
  const repository = {
    listActiveCatalogProducts: vi.fn().mockResolvedValue(catalog),
    createAuditLog: vi.fn(),
  };
  const settings = {
    getSettings: vi.fn().mockResolvedValue({
      importation: {
        dollarQuote: 5,
        cdeExitPerBox: 0,
        invoiceTaxPercent: 0,
        brazilDispatchPerBox: 0,
        correiosLabel: 0,
        redirectRules: [],
      },
    }),
  };
  return new ImportRadarService(
    settings as unknown as SettingsService,
    repository as unknown as ImportRadarRepository,
    {} as MockImportProvider,
    {} as ComprasParaguaiProvider,
  );
}

const importProduct = {
  id: 'external-compras-paraguai-id',
  name: 'iPhone 17 Pro Max 256GB',
  store: 'Loja PY',
  category: 'iPhone',
  priceUsd: 1000,
  productUrl: 'https://example.com/iphone-17',
  model: 'iPhone 17 Pro Max',
  capacity: '256GB',
};

describe('ImportRadarService catalog product handoff', () => {
  it('uses only the resolved active catalog Product id and structured condition', async () => {
    const result = await createService([catalogProduct()]).calculate(importProduct, {
      id: 'user-1',
    } as never);

    expect(result).toMatchObject({
      catalogProductId: PRODUCT_ID,
      condition: 'NOVO',
      productResolution: { status: 'FOUND', productId: PRODUCT_ID },
    });
    expect(result.catalogProductId).not.toBe(importProduct.id);
  });

  it('fails closed when no active Product matches the imported product', async () => {
    const result = await createService([]).calculate(importProduct, { id: 'user-1' } as never);

    expect(result).toMatchObject({
      catalogProductId: null,
      condition: null,
      productResolution: { status: 'MISSING' },
    });
  });

  it('fails closed when more than one active Product matches the imported product', async () => {
    const result = await createService([
      catalogProduct(),
      catalogProduct('cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
    ]).calculate(importProduct, { id: 'user-1' } as never);

    expect(result).toMatchObject({
      catalogProductId: null,
      condition: null,
      productResolution: { status: 'AMBIGUOUS', candidateCount: 2 },
    });
  });
});
