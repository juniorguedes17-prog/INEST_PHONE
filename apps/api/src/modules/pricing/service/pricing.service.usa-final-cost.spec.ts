import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../../settings/service/settings.service';
import type { UsaSourceProduct } from '../../import-radar/usa-source-product.adapter';
import { getDefaultNonAppleElectronicsPolicy } from '../utils/non-apple-electronics.policy';
import { ProductProfitProvider } from '../providers/product-profit.provider';
import { PricingRepository } from '../repository/pricing.repository';
import { PricingService } from './pricing.service';

const profitCatalog = {
  fetchedAt: '2026-09-06T00:00:00.000Z',
  records: [
    {
      productId: 'profit-iphone-17pm-256',
      condition: 'NOVO' as const,
      productDescription: 'iPhone 17 Pro Max 256GB',
      normalizedDescription: 'iphone 17 pro max 256gb',
      netProfit: 1200,
    },
  ],
};

function usaSource(overrides: Partial<UsaSourceProduct> = {}): UsaSourceProduct {
  return {
    providerName: 'APPLE_US',
    source: 'US',
    sourceProductId: 'apple-iphone-17pm-256',
    sourceName: 'iPhone 17 Pro Max 256GB',
    displayName: 'iPhone 17 Pro Max 256GB',
    sourceUrl: 'https://www.apple.com/shop',
    supplier: 'Apple Store USA',
    sourceManufacturer: null,
    sourceManufacturerProvenance: null,
    retailer: 'Apple Store USA',
    category: 'iPhone',
    priceUsd: 999,
    ...overrides,
  };
}

function setup() {
  const repository = {
    findActiveCatalogProductById: vi.fn().mockResolvedValue(null),
    listPricingConfigurations: vi.fn().mockResolvedValue([{ key: 'offer_increment', value: '75' }]),
  };
  const settings = {
    getSettings: vi.fn().mockResolvedValue({
      financial: { globalFixedCost: 200, defaultFreight: 50, defaultPaymentFee: 100 },
      pricing: { nonAppleElectronicsPolicy: getDefaultNonAppleElectronicsPolicy() },
    }),
  };
  const profits = { getCatalog: vi.fn().mockResolvedValue(profitCatalog) };
  const manufacturers = { resolve: vi.fn() };
  const service = new PricingService(
    repository as unknown as PricingRepository,
    settings as unknown as SettingsService,
    profits as unknown as ProductProfitProvider,
    undefined,
    manufacturers as never,
  );
  return { service, repository, settings, profits, manufacturers };
}

describe('PricingService USA FinalCost entrypoint', () => {
  it('routes an Apple FinalCost through the existing financial identity and pricing path', async () => {
    const { service, manufacturers } = setup();

    const result = await service.calculateUsaFinalCost({
      sourceProduct: usaSource(),
      finalCost: { currency: 'BRL', amountBrl: 2677.09 },
      condition: 'NOVO',
    });

    expect(result).toMatchObject({
      origin: 'US',
      acquisitionCost: 2677.09,
      financialClassification: 'APPLE',
      calculationStatus: 'ready',
      desiredNetProfit: 1200,
    });
    expect(result.salePrice).not.toBeNull();
    expect(result).not.toHaveProperty('offerDraft');
    expect(manufacturers.resolve).not.toHaveBeenCalled();
  });

  it('routes a Non-Apple external source without Product.id through the existing P4 engine', async () => {
    const { service, manufacturers } = setup();

    const result = await service.calculateUsaFinalCost({
      sourceProduct: usaSource({
        providerName: 'UPCITEMDB',
        sourceProductId: 'upc-canon-t7',
        sourceName: 'Canon EOS Rebel T7 DSLR Camera',
        displayName: 'Canon EOS Rebel T7 DSLR Camera',
        category: 'Camera',
        sourceManufacturer: 'Canon',
        sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
      }),
      finalCost: { currency: 'BRL', amountBrl: 2677.09 },
      condition: null,
      manufacturerResolution: {
        status: 'FOUND',
        manufacturerId: 'canon-id',
        manufacturerKey: 'canon',
        canonicalName: 'Canon',
        provenance: 'EXPLICIT_SOURCE_VALIDATED',
        normalizedEvidence: 'canon',
        matchedAlias: 'Canon',
        normalizedAlias: 'canon',
      },
    });

    expect(result).toMatchObject({
      origin: 'US',
      catalogProductId: null,
      acquisitionCost: 2677.09,
      financialClassification: 'NON_APPLE',
      calculationStatus: 'ready',
      engineMetadata: { acquisitionCost: 2677.09 },
    });
    expect(manufacturers.resolve).not.toHaveBeenCalled();
  });

  it('blocks unresolved financial classification before Pricing math', async () => {
    const { service } = setup();

    const result = await service.calculateUsaFinalCost({
      sourceProduct: usaSource({ sourceName: 'Unknown device', displayName: 'Unknown device' }),
      finalCost: { currency: 'BRL', amountBrl: 2677.09 },
      condition: null,
    });

    expect(result).toMatchObject({
      financialClassification: 'UNRESOLVED',
      calculationStatus: 'classification_unresolved',
      salePrice: null,
      offerPrice: null,
      pricingCosts: null,
    });
  });

  it('keeps the strict cents validator at the USA boundary', async () => {
    const { service } = setup();

    await expect(
      service.calculateUsaFinalCost({
        sourceProduct: usaSource(),
        finalCost: { currency: 'BRL', amountBrl: 2677.0675 },
        condition: 'NOVO',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
