import { describe, expect, it, vi } from 'vitest';
import type { SettingsService } from '../../settings/service/settings.service';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import type { UsaRedirectorSelection } from '../usa-cost.contract';
import type { ShippingWeightRegistrationService } from '../shipping-weights/shipping-weight-registration.service';
import { UsaCostPreflightService } from './usa-cost-preflight.service';
import type { UsaEnrichmentInputDecisionService } from './usa-enrichment-input-decision.service';

const product: UsaSourceProduct = {
  providerName: 'amazon_us',
  sourceProductId: 'amazon-us:B0EXAMPLE',
  sourceName: 'Apple iPhone 17 Pro 256GB',
  displayName: 'Apple iPhone 17 Pro 256GB',
  source: 'US',
  sourceUrl: 'https://example.test/iphone',
  supplier: 'Amazon USA',
  sourceManufacturer: 'Apple',
  sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
  retailer: 'Amazon',
  category: 'iPhone',
  model: 'iPhone 17 Pro',
  capacity: '256GB',
  condition: 'NOVO',
  priceUsd: 1199,
};

const baseSettings = {
  usaImport: {
    usdBrlQuote: 5.35,
    redDelaware: { firstLbUsd: 27.89, additionalLbUsd: 11.5, shippingMode: 'EXPRESS' as const },
    reiDoImportado: {
      phoneShippingUsd: 150,
      otherProductsShippingUsdPerHalfKg: 120,
      insurancePercent: 15,
      usTaxPercent: 7,
      airFreightDiscountPercent: 10,
    },
  },
};

type TestSettings = {
  usaImport: {
    usdBrlQuote: number | null;
    redDelaware: typeof baseSettings.usaImport.redDelaware;
    reiDoImportado: typeof baseSettings.usaImport.reiDoImportado;
  };
};

function createContext(
  classification: 'CELULAR' | 'OTHER' | 'UNRESOLVED',
  quantity: string | null = '1',
) {
  return {
    logisticClassification:
      classification === 'UNRESOLVED'
        ? { classification, reason: 'INSUFFICIENT_EVIDENCE', sources: [] }
        : { classification, sources: ['PRODUCT_IDENTITY_FAMILY'] },
    fields: { quantity: { value: quantity } },
  };
}

function createService(
  decision: Record<string, unknown>,
  context: Record<string, unknown>,
  weight: Record<string, unknown> = {
    status: 'WEIGHT_FOUND',
    shippingWeightLbs: 2,
  },
  settings: TestSettings = baseSettings,
) {
  const enrichmentDecisions = {
    resolve: vi.fn().mockResolvedValue({ decision, context }),
  };
  const shippingWeights = { resolve: vi.fn().mockResolvedValue(weight) };
  const settingsService = { getSettings: vi.fn().mockResolvedValue(settings) };
  return {
    service: new UsaCostPreflightService(
      enrichmentDecisions as unknown as UsaEnrichmentInputDecisionService,
      shippingWeights as unknown as ShippingWeightRegistrationService,
      settingsService as unknown as SettingsService,
    ),
    enrichmentDecisions,
    shippingWeights,
  };
}

function redirector(value: 'RED_DELAWARE' | 'REI_DO_IMPORTADO'): UsaRedirectorSelection {
  return value === 'RED_DELAWARE'
    ? { redirector: value, shippingMode: 'EXPRESS' }
    : { redirector: value };
}

const readyDecision = {
  status: 'READY',
  reason: null,
  context: {
    provider: product.providerName,
    sourceProductId: product.sourceProductId,
    source: 'US',
  },
};

describe('UsaCostPreflightService', () => {
  it('returns READY_FOR_COST for Red Delaware without requiring logistics classification', async () => {
    const { service } = createService(readyDecision, createContext('UNRESOLVED', null));

    await expect(
      service.preflight({
        sourceProduct: product,
        redirector: redirector('RED_DELAWARE'),
        composition: { kind: 'SINGLE_ITEM' },
      }),
    ).resolves.toMatchObject({
      status: 'READY_FOR_COST',
      taxTreatment: 'EXEMPT',
      logisticClassification: null,
      quantity: null,
      shippingWeightLbs: 2,
    });
  });

  it('does not require Product.id or a catalog Product for a resolved Amazon Apple item', async () => {
    const { service } = createService(readyDecision, createContext('CELULAR'));

    const result = await service.preflight({
      sourceProduct: product,
      redirector: redirector('REI_DO_IMPORTADO'),
      composition: { kind: 'SINGLE_ITEM' },
    });

    expect(result).toMatchObject({ status: 'READY_FOR_COST', quantity: 1 });
  });

  it('transports validated cellular quantity 2 for Rei', async () => {
    const { service } = createService(readyDecision, createContext('CELULAR', '2'));

    await expect(
      service.preflight({
        sourceProduct: product,
        redirector: redirector('REI_DO_IMPORTADO'),
        composition: { kind: 'SINGLE_ITEM' },
      }),
    ).resolves.toMatchObject({
      status: 'READY_FOR_COST',
      logisticClassification: 'CELULAR',
      quantity: 2,
    });
  });

  it('allows a resolved Non-Apple item without a catalog Product', async () => {
    const nonApple = { ...product, sourceManufacturer: 'Canon', category: 'Camera' };
    const { service } = createService(readyDecision, createContext('OTHER'));

    const result = await service.preflight({
      sourceProduct: nonApple,
      redirector: redirector('REI_DO_IMPORTADO'),
      composition: { kind: 'SINGLE_ITEM' },
    });

    expect(result.status).toBe('READY_FOR_COST');
  });

  it('propagates manufacturer NEEDS_INPUT before checking cost requirements', async () => {
    const decision = {
      status: 'NEEDS_INPUT',
      reason: 'MANUFACTURER_MISSING',
      input: { type: 'MANUFACTURER', field: 'manufacturer', suggestedValue: 'Garmin' },
    };
    const { service, shippingWeights } = createService(decision, createContext('OTHER'));

    const result = await service.preflight({
      sourceProduct: product,
      redirector: redirector('RED_DELAWARE'),
      composition: { kind: 'SINGLE_ITEM' },
    });

    expect(result).toMatchObject({
      status: 'NEEDS_INPUT',
      reason: 'MANUFACTURER_MISSING',
      input: { type: 'MANUFACTURER', suggestedValue: 'Garmin' },
    });
    expect(shippingWeights.resolve).not.toHaveBeenCalled();
  });

  it('blocks an ambiguous manufacturer', async () => {
    const decision = { status: 'BLOCKED', reason: 'MANUFACTURER_AMBIGUOUS' };
    const { service } = createService(decision, createContext('OTHER'));

    await expect(
      service.preflight({
        sourceProduct: product,
        redirector: redirector('RED_DELAWARE'),
        composition: { kind: 'SINGLE_ITEM' },
      }),
    ).resolves.toMatchObject({ status: 'BLOCKED', reason: 'ENRICHMENT_CONFLICT' });
  });

  it('does not block a Non-Apple flow merely because Product Identity has no catalog match', async () => {
    const { service } = createService(readyDecision, createContext('OTHER'));

    await expect(
      service.preflight({
        sourceProduct: { ...product, sourceManufacturer: 'Canon', category: 'Camera' },
        redirector: redirector('REI_DO_IMPORTADO'),
        composition: { kind: 'SINGLE_ITEM' },
      }),
    ).resolves.toMatchObject({ status: 'READY_FOR_COST' });
  });

  it('maps missing weight to NEEDS_INPUT without registering it', async () => {
    const { service, shippingWeights } = createService(readyDecision, createContext('OTHER'), {
      status: 'MISSING_WEIGHT',
    });

    const result = await service.preflight({
      sourceProduct: product,
      redirector: redirector('RED_DELAWARE'),
      composition: { kind: 'SINGLE_ITEM' },
    });

    expect(result).toMatchObject({
      status: 'NEEDS_INPUT',
      reason: 'MISSING_WEIGHT',
      input: { type: 'WEIGHT', field: 'shippingWeightLbs' },
    });
    expect(shippingWeights.resolve).toHaveBeenCalledTimes(1);
  });

  it('blocks insufficient and ambiguous weight keys', async () => {
    for (const weight of [{ status: 'KEY_INSUFFICIENT' }, { status: 'KEY_AMBIGUOUS' }]) {
      const { service } = createService(readyDecision, createContext('OTHER'), weight);
      const result = await service.preflight({
        sourceProduct: product,
        redirector: redirector('RED_DELAWARE'),
        composition: { kind: 'SINGLE_ITEM' },
      });

      expect(result.status).toBe('BLOCKED');
      if (result.status === 'BLOCKED') {
        expect(result.reason).toBe(
          weight.status === 'KEY_INSUFFICIENT' ? 'KEY_INSUFFICIENT' : 'KEY_AMBIGUOUS',
        );
      }
    }
  });

  it('does not require weight for Rei cellular', async () => {
    const { service, shippingWeights } = createService(
      readyDecision,
      createContext('CELULAR', '2'),
    );

    const result = await service.preflight({
      sourceProduct: product,
      redirector: redirector('REI_DO_IMPORTADO'),
      composition: { kind: 'SINGLE_ITEM' },
    });

    expect(result).toMatchObject({
      status: 'READY_FOR_COST',
      logisticClassification: 'CELULAR',
      quantity: 2,
      shippingWeightLbs: null,
    });
    expect(shippingWeights.resolve).not.toHaveBeenCalled();
  });

  it('requires weight for Rei OTHER', async () => {
    const { service, shippingWeights } = createService(readyDecision, createContext('OTHER'), {
      status: 'MISSING_WEIGHT',
    });

    const result = await service.preflight({
      sourceProduct: product,
      redirector: redirector('REI_DO_IMPORTADO'),
      composition: { kind: 'SINGLE_ITEM' },
    });

    if (result.status === 'NEEDS_INPUT') {
      expect(result.reason).toBe('MISSING_WEIGHT');
    }
    expect(shippingWeights.resolve).toHaveBeenCalledTimes(1);
  });

  it.each(['0', '-1', '1.5'])('rejects invalid cellular quantity %s', async (quantity) => {
    const { service } = createService(readyDecision, createContext('CELULAR', quantity));

    await expect(
      service.preflight({
        sourceProduct: product,
        redirector: redirector('REI_DO_IMPORTADO'),
        composition: { kind: 'SINGLE_ITEM' },
      }),
    ).resolves.toMatchObject({
      status: 'BLOCKED',
      reason: 'QUANTITY_UNRESOLVED',
    });
  });

  it('does not add quantity as a gate for Rei OTHER', async () => {
    const { service } = createService(readyDecision, createContext('OTHER', null));

    await expect(
      service.preflight({
        sourceProduct: product,
        redirector: redirector('REI_DO_IMPORTADO'),
        composition: { kind: 'SINGLE_ITEM' },
      }),
    ).resolves.toMatchObject({
      status: 'READY_FOR_COST',
      logisticClassification: 'OTHER',
      quantity: null,
      shippingWeightLbs: 2,
    });
  });

  it('blocks unresolved retailer and never uses the PY quote as fallback', async () => {
    const { service } = createService(
      readyDecision,
      createContext('OTHER'),
      {
        status: 'WEIGHT_FOUND',
        shippingWeightLbs: 2,
      },
      { ...baseSettings, usaImport: { ...baseSettings.usaImport, usdBrlQuote: null } },
    );

    const result = await service.preflight({
      sourceProduct: { ...product, retailer: null },
      redirector: redirector('REI_DO_IMPORTADO'),
      composition: { kind: 'SINGLE_ITEM' },
    });

    expect(result).toMatchObject({ status: 'BLOCKED', reason: 'USD_BRL_QUOTE_NOT_CONFIGURED' });
  });

  it('blocks a missing retailer when the USA quote is configured', async () => {
    const { service } = createService(readyDecision, createContext('OTHER'));

    const result = await service.preflight({
      sourceProduct: { ...product, retailer: null },
      redirector: redirector('REI_DO_IMPORTADO'),
      composition: { kind: 'SINGLE_ITEM' },
    });

    expect(result).toMatchObject({ status: 'BLOCKED', reason: 'RETAILER_UNRESOLVED' });
  });

  it('blocks an unresolved Rei logistic classification', async () => {
    const { service } = createService(readyDecision, createContext('UNRESOLVED'));

    const result = await service.preflight({
      sourceProduct: product,
      redirector: redirector('REI_DO_IMPORTADO'),
      composition: { kind: 'SINGLE_ITEM' },
    });

    expect(result).toMatchObject({
      status: 'BLOCKED',
      reason: 'LOGISTIC_CLASSIFICATION_UNRESOLVED',
    });
  });

  it('rejects an unsupported Red shipping mode without calling an engine', async () => {
    const { service, shippingWeights } = createService(readyDecision, createContext('OTHER'));

    const result = await service.preflight({
      sourceProduct: product,
      redirector: { redirector: 'RED_DELAWARE', shippingMode: 'STANDARD' } as never,
      composition: { kind: 'SINGLE_ITEM' },
    });

    expect(result).toMatchObject({ status: 'BLOCKED', reason: 'SHIPPING_MODE_UNSUPPORTED' });
    expect(shippingWeights.resolve).not.toHaveBeenCalled();
  });
});
