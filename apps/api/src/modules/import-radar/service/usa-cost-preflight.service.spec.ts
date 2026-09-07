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
  condition: string | null = 'NOVO',
) {
  return {
    logisticClassification:
      classification === 'UNRESOLVED'
        ? { classification, reason: 'INSUFFICIENT_EVIDENCE', sources: [] }
        : { classification, sources: ['PRODUCT_IDENTITY_FAMILY'] },
    fields: {
      manufacturer: { value: 'Apple' },
      category: { value: product.category },
      family: { value: null },
      model: { value: product.model },
      storage: { value: product.capacity },
      ram: { value: null },
      chip: { value: null },
      screen: { value: null },
      color: { value: product.color ?? null },
      connectivity: { value: null },
      condition: { value: condition },
      quantity: { value: null },
      feature: { value: null },
      connector: { value: null },
      power: { value: null },
      length: { value: null },
    },
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
  it.each(['RED_DELAWARE', 'REI_DO_IMPORTADO'] as const)(
    'blocks family starting prices before any operational processing for %s',
    async (selection) => {
      const { service, enrichmentDecisions, shippingWeights } = createService(
        readyDecision,
        createContext('CELULAR'),
      );
      const result = await service.preflight({
        sourceProduct: { ...product, offerKind: 'FAMILY_STARTING_AT' },
        composition: { kind: 'SINGLE_ITEM' },
        redirector: redirector(selection),
      });
      expect(result).toMatchObject({ status: 'BLOCKED', reason: 'SOURCE_CONFIGURATION_REQUIRED' });
      expect(enrichmentDecisions.resolve).not.toHaveBeenCalled();
      expect(shippingWeights.resolve).not.toHaveBeenCalled();
    },
  );
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
      condition: null,
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

  it('uses the explicit SINGLE_ITEM composition as operational quantity 1', async () => {
    const { service } = createService(readyDecision, createContext('CELULAR'));

    await expect(
      service.preflight({
        sourceProduct: product,
        redirector: redirector('REI_DO_IMPORTADO'),
        composition: { kind: 'SINGLE_ITEM' },
      }),
    ).resolves.toMatchObject({
      status: 'READY_FOR_COST',
      logisticClassification: 'CELULAR',
      quantity: 1,
    });
  });

  it('carries the P6F-normalized condition to the ready cost contract', async () => {
    const { service } = createService(readyDecision, createContext('CELULAR', 'Seminovo'));

    await expect(
      service.preflight({
        sourceProduct: { ...product, condition: undefined },
        redirector: redirector('REI_DO_IMPORTADO'),
        composition: { kind: 'SINGLE_ITEM' },
      }),
    ).resolves.toMatchObject({ status: 'READY_FOR_COST', condition: 'SEMINOVO' });
  });

  it('carries P6F-approved model and storage to the Pricing handoff', async () => {
    const context = createContext('CELULAR', 'SEMINOVO');
    context.fields.model.value = 'iPhone 17 Pro';
    context.fields.storage.value = '512GB';
    const { service } = createService(readyDecision, context);

    await expect(
      service.preflight({
        sourceProduct: {
          ...product,
          sourceName: 'Amazon title with renewed and marketing descriptors',
          model: undefined,
          capacity: undefined,
        },
        redirector: redirector('REI_DO_IMPORTADO'),
        composition: { kind: 'SINGLE_ITEM' },
      }),
    ).resolves.toMatchObject({
      status: 'READY_FOR_COST',
      normalizedPricing: {
        category: 'iPhone',
        model: 'iPhone 17 Pro',
        capacity: '512GB',
      },
    });
  });

  it('readies the B0G45F93BH-equivalent single iPhone purchase without a Product Identity quantity', async () => {
    const { service, shippingWeights } = createService(
      readyDecision,
      createContext('CELULAR', 'SEMINOVO'),
    );
    const renewedAmazonIphone = {
      ...product,
      sourceProductId: 'amazon-us:B0G45F93BH',
      sourceName:
        'Apple iPhone 17 Pro, US Version, 1TB, eSIM, Cosmic Orange - Unlocked (Renewed Premium)',
      condition: undefined,
    };

    await expect(
      service.preflight({
        sourceProduct: renewedAmazonIphone,
        redirector: redirector('REI_DO_IMPORTADO'),
        composition: { kind: 'SINGLE_ITEM' },
      }),
    ).resolves.toMatchObject({
      status: 'READY_FOR_COST',
      logisticClassification: 'CELULAR',
      condition: 'SEMINOVO',
      quantity: 1,
      shippingWeightLbs: null,
    });
    expect(shippingWeights.resolve).not.toHaveBeenCalled();
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
    const { service, shippingWeights } = createService(readyDecision, createContext('CELULAR'));

    const result = await service.preflight({
      sourceProduct: product,
      redirector: redirector('REI_DO_IMPORTADO'),
      composition: { kind: 'SINGLE_ITEM' },
    });

    expect(result).toMatchObject({
      status: 'READY_FOR_COST',
      logisticClassification: 'CELULAR',
      quantity: 1,
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

  it('does not infer quantity for a bundle composition', async () => {
    const { service } = createService(readyDecision, createContext('CELULAR'));

    await expect(
      service.preflight({
        sourceProduct: product,
        redirector: redirector('REI_DO_IMPORTADO'),
        composition: { kind: 'UNSTRUCTURED_BUNDLE' },
      }),
    ).resolves.toMatchObject({
      status: 'BLOCKED',
      reason: 'QUANTITY_UNRESOLVED',
    });
  });

  it('does not add quantity as a gate for Rei OTHER', async () => {
    const { service } = createService(readyDecision, createContext('OTHER'));

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
