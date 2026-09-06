import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import type { OffersService } from '../../offers/service/offers.service';
import type { ManufacturerResolution } from '../../manufacturers/manufacturer-resolver';
import type { PricingService } from '../../pricing/service/pricing.service';
import type { UsaFinalCostPricingResult } from '../../pricing/usa-final-cost-pricing.contract';
import type { UsaRedirectorSelection } from '../usa-cost.contract';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import type { UsaCostExecutionResult, UsaCostExecutionService } from './usa-cost-execution.service';
import { UsaPricedOfferService } from './usa-priced-offer.service';

const sourceProduct: UsaSourceProduct = {
  providerName: 'AMAZON_US',
  source: 'US',
  sourceProductId: 'amazon:B0USA',
  sourceName: 'Apple iPhone 17 Pro Max 256GB',
  displayName: 'Apple iPhone 17 Pro Max 256GB',
  sourceUrl: 'https://example.test/dp/B0USA',
  supplier: 'Amazon',
  sourceManufacturer: 'Apple',
  sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
  retailer: 'Amazon',
  category: 'iPhone',
  condition: 'NOVO',
  priceUsd: 1199,
};

function readyCost(
  redirector: UsaRedirectorSelection = { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
): UsaCostExecutionResult {
  return {
    preflight: {
      status: 'READY_FOR_COST',
      redirector,
      taxTreatment: 'EXEMPT',
      logisticClassification: null,
      quantity: null,
      condition: 'NOVO',
      shippingWeightLbs: 1,
    },
    calculation: {
      sourceProductId: sourceProduct.sourceProductId,
      sourceCommercialIdentity: sourceProduct,
      redirector,
      productPriceUsd: sourceProduct.priceUsd,
      finalCost: { currency: 'BRL', amountBrl: 2677.09 },
      breakdown: {},
    },
  } as unknown as UsaCostExecutionResult;
}

function pricingResult(
  overrides: Partial<UsaFinalCostPricingResult> = {},
): UsaFinalCostPricingResult {
  return {
    origin: 'US',
    sourceProductId: sourceProduct.sourceProductId,
    catalogProductId: null,
    acquisitionCost: 2677.09,
    financialClassification: 'APPLE',
    financialClassificationReason: 'canonical_product',
    manufacturerKey: null,
    calculationStatus: 'ready',
    calculationError: null,
    salePrice: 3999.9,
    offerPrice: 4074.9,
    margin: 0.2,
    desiredNetProfit: 1200,
    pricingCosts: { fixedCost: 200, freight: 50, paymentFee: 100, offerIncrement: 75 },
    profit: {
      source: 'native_product_catalog',
      condition: 'NOVO',
      productDescription: sourceProduct.sourceName,
      recordId: 'profit-1',
      updatedAt: '2026-09-06T00:00:00.000Z',
    },
    ...overrides,
  };
}

function setup(costResult = readyCost(), pricing = pricingResult()) {
  const costs = { execute: vi.fn().mockResolvedValue(costResult) };
  const pricingService = { calculateUsaFinalCost: vi.fn().mockResolvedValue(pricing) };
  const offers = {
    persistPricedOfferDraft: vi.fn().mockResolvedValue({ id: 'offer-1', productId: null }),
  };
  return {
    service: new UsaPricedOfferService(
      costs as unknown as UsaCostExecutionService,
      pricingService as unknown as PricingService,
      offers as unknown as OffersService,
    ),
    costs,
    pricingService,
    offers,
  };
}

function input(
  overrides: Partial<Parameters<UsaPricedOfferService['execute']>[0]> = {},
): Parameters<UsaPricedOfferService['execute']>[0] {
  return {
    sourceProduct,
    redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' } as const,
    composition: { kind: 'SINGLE_ITEM' as const },
    user: {
      id: 'user-1',
      email: 'user@example.test',
      name: 'User Test',
      role: 'ADMIN',
      permissions: [],
    } satisfies AuthenticatedUser,
    ...overrides,
  };
}

describe('UsaPricedOfferService', () => {
  it.each([
    ['APPLE with Product', 'APPLE', 'product-1', 'CANONICAL'],
    ['APPLE without Product', 'APPLE', null, 'EXTERNAL'],
    ['NON_APPLE with Product', 'NON_APPLE', 'product-2', 'CANONICAL'],
    ['NON_APPLE without Product', 'NON_APPLE', null, 'EXTERNAL'],
  ] as const)(
    'wires %s from the single FinalCost pricing result to OfferDraft and OfferItem',
    async (_label, financialClassification, catalogProductId, identityKind) => {
      const { service, costs, pricingService, offers } = setup(
        readyCost(),
        pricingResult({ financialClassification, catalogProductId }),
      );

      const result = await service.execute(input({ catalogProductId }));

      expect(result).toMatchObject({ status: 'READY', pricing: { acquisitionCost: 2677.09 } });
      expect(costs.execute).toHaveBeenCalledTimes(1);
      expect(pricingService.calculateUsaFinalCost).toHaveBeenCalledTimes(1);
      expect(pricingService.calculateUsaFinalCost).toHaveBeenCalledWith(
        expect.objectContaining({ finalCost: { currency: 'BRL', amountBrl: 2677.09 } }),
      );
      expect(offers.persistPricedOfferDraft).toHaveBeenCalledTimes(1);
      const draft = offers.persistPricedOfferDraft.mock.calls[0]![0];
      expect(draft.payload.productId).toBe(catalogProductId);
      if (identityKind === 'EXTERNAL') {
        expect(draft.payload.externalIdentity).toMatchObject({
          origin: 'US',
          provider: 'AMAZON_US',
          sourceProductId: 'amazon:B0USA',
        });
      } else {
        expect(draft.payload.externalIdentity).toBeUndefined();
      }
    },
  );

  it.each([
    'condition_unresolved',
    'insufficient_identity',
    'ambiguous_identity',
    'missing_profit',
    'collision',
    'classification_unresolved',
  ] as const)('does not persist an offer when Pricing is %s', async (calculationStatus) => {
    const { service, offers } = setup(
      readyCost(),
      pricingResult({ calculationStatus, salePrice: null, offerPrice: null }),
    );

    const result = await service.execute(input());

    expect(result).toMatchObject({ status: 'BLOCKED', reason: calculationStatus, offer: null });
    expect(offers.persistPricedOfferDraft).not.toHaveBeenCalled();
  });

  it('does not price or persist when P7A requires input', async () => {
    const needsInput: UsaCostExecutionResult = {
      preflight: {
        status: 'NEEDS_INPUT',
        reason: 'MISSING_WEIGHT',
        input: { type: 'WEIGHT', field: 'shippingWeightLbs' },
        redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
      },
      calculation: null,
    };
    const { service, pricingService, offers } = setup(needsInput);

    const result = await service.execute(input());

    expect(result).toMatchObject({ status: 'NEEDS_INPUT', reason: 'MISSING_WEIGHT' });
    expect(pricingService.calculateUsaFinalCost).not.toHaveBeenCalled();
    expect(offers.persistPricedOfferDraft).not.toHaveBeenCalled();
  });

  it('does not price or persist when P7A is blocked', async () => {
    const blocked: UsaCostExecutionResult = {
      preflight: {
        status: 'BLOCKED',
        reason: 'USD_BRL_QUOTE_NOT_CONFIGURED',
        redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
      },
      calculation: null,
    };
    const { service, pricingService, offers } = setup(blocked);

    const result = await service.execute(input());

    expect(result).toMatchObject({ status: 'BLOCKED', reason: 'USD_BRL_QUOTE_NOT_CONFIGURED' });
    expect(pricingService.calculateUsaFinalCost).not.toHaveBeenCalled();
    expect(offers.persistPricedOfferDraft).not.toHaveBeenCalled();
  });

  it('preserves distinct external provenance for the same source ID from different providers', async () => {
    const { service, offers } = setup();
    await service.execute(input());
    await service.execute(
      input({ sourceProduct: { ...sourceProduct, providerName: 'UPCITEMDB' } }),
    );

    expect(
      offers.persistPricedOfferDraft.mock.calls.map((call) => call[0].payload.externalIdentity),
    ).toEqual([
      expect.objectContaining({ provider: 'AMAZON_US', sourceProductId: 'amazon:B0USA' }),
      expect.objectContaining({ provider: 'UPCITEMDB', sourceProductId: 'amazon:B0USA' }),
    ]);
  });

  it('does not rederive a manufacturer decision before Pricing', async () => {
    const manufacturerResolution: ManufacturerResolution = {
      status: 'FOUND',
      manufacturerId: 'canon-id',
      manufacturerKey: 'canon',
      canonicalName: 'Canon',
      provenance: 'EXPLICIT_SOURCE_VALIDATED',
      normalizedEvidence: 'canon',
      matchedAlias: 'Canon',
      normalizedAlias: 'canon',
    };
    const { service, pricingService } = setup();

    await service.execute(input({ manufacturerResolution }));

    expect(pricingService.calculateUsaFinalCost).toHaveBeenCalledWith(
      expect.objectContaining({ manufacturerResolution }),
    );
  });

  it('passes the normalized preflight condition to Pricing instead of the source field', async () => {
    const cost = readyCost();
    if (cost.preflight.status !== 'READY_FOR_COST') {
      throw new Error('Expected a ready cost fixture.');
    }
    const preflight: Extract<UsaCostExecutionResult['preflight'], { status: 'READY_FOR_COST' }> = {
      ...cost.preflight,
      condition: 'SEMINOVO',
    };
    const { service, pricingService } = setup({
      ...cost,
      preflight,
    } as UsaCostExecutionResult);

    await service.execute(input({ sourceProduct: { ...sourceProduct, condition: undefined } }));

    expect(pricingService.calculateUsaFinalCost).toHaveBeenCalledWith(
      expect.objectContaining({ condition: 'SEMINOVO' }),
    );
  });
});
