import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SettingsService } from '../../settings/service/settings.service';
import * as redDelawareCalculator from '../calculators/red-delaware-cost.calculator';
import * as reiDoImportadoCalculator from '../calculators/rei-do-importado-cost.calculator';
import type { UsaRedirectorSelection } from '../usa-cost.contract';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import { roundMoneyToCents } from '../validators/import-radar.validators';
import type { UsaCostPreflightResult, UsaCostPreflightService } from './usa-cost-preflight.service';
import { UsaCostExecutionService } from './usa-cost-execution.service';

const sourceProduct: UsaSourceProduct = {
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

const settings = {
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

function ready(
  redirector: UsaRedirectorSelection,
  overrides: Partial<Extract<UsaCostPreflightResult, { status: 'READY_FOR_COST' }>> = {},
): Extract<UsaCostPreflightResult, { status: 'READY_FOR_COST' }> {
  return {
    status: 'READY_FOR_COST',
    redirector,
    taxTreatment: 'EXEMPT',
    logisticClassification: redirector.redirector === 'REI_DO_IMPORTADO' ? 'OTHER' : null,
    quantity: null,
    shippingWeightLbs: 2,
    ...overrides,
  };
}

function setup(preflightResult: UsaCostPreflightResult, source = sourceProduct) {
  const preflight = { preflight: vi.fn().mockResolvedValue(preflightResult) };
  const settingsService = { getSettings: vi.fn().mockResolvedValue(settings) };
  return {
    service: new UsaCostExecutionService(
      preflight as unknown as UsaCostPreflightService,
      settingsService as unknown as SettingsService,
    ),
    preflight,
    settingsService,
    input: {
      sourceProduct: source,
      redirector: preflightResult.redirector ?? { redirector: 'REI_DO_IMPORTADO' },
      composition: { kind: 'SINGLE_ITEM' as const },
    },
  };
}

describe('UsaCostExecutionService', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [0.5, 1],
    [0.65, 1],
    [1, 1],
    [1.001, 2],
    [2, 2],
    [3.95, 4],
    [4, 4],
  ])('dispatches Red Delaware once for %s lb', async (shippingWeightLbs, chargedLbs) => {
    const red = { redirector: 'RED_DELAWARE' as const, shippingMode: 'EXPRESS' as const };
    const { service, input } = setup(ready(red, { shippingWeightLbs }));
    const calculator = vi.spyOn(redDelawareCalculator, 'calculateRedDelawareExpressCost');
    const reiCalculator = vi.spyOn(reiDoImportadoCalculator, 'calculateReiDoImportadoCost');

    const result = await service.execute(input);

    expect(calculator).toHaveBeenCalledTimes(1);
    expect(result.calculation).toMatchObject({
      sourceProductId: sourceProduct.sourceProductId,
      redirector: red,
      finalCost: { currency: 'BRL' },
      breakdown: { shippingWeightLbs, chargedLbs },
    });
    expect(reiCalculator).not.toHaveBeenCalled();
  });

  it.each([
    [1, 'EXEMPT', 135, 0],
    [2, 'TAXABLE', 270, 449.03],
  ] as const)(
    'passes validated cellular quantity %s directly to Rei with %s TAX',
    async (quantity, taxTreatment, shippingUsd, taxBrl) => {
      const rei = { redirector: 'REI_DO_IMPORTADO' as const };
      const { service, input } = setup(
        ready(rei, {
          logisticClassification: 'CELULAR',
          quantity,
          shippingWeightLbs: null,
          taxTreatment,
        }),
      );
      const calculator = vi.spyOn(reiDoImportadoCalculator, 'calculateReiDoImportadoCost');
      const redCalculator = vi.spyOn(redDelawareCalculator, 'calculateRedDelawareExpressCost');

      const result = await service.execute(input);

      expect(calculator).toHaveBeenCalledTimes(1);
      expect(calculator).toHaveBeenCalledWith(
        expect.objectContaining({
          logisticsClassification: 'CELULAR',
          quantity,
          shippingWeightLbs: null,
          taxTreatment,
        }),
      );
      expect(result.calculation).toMatchObject({
        finalCost: { currency: 'BRL' },
        breakdown: { classification: 'CELULAR', quantity, shippingUsd, taxBrl },
      });
      expect(redCalculator).not.toHaveBeenCalled();
    },
  );

  it.each([
    [1.101, 'EXEMPT', 1],
    [1.103, 'TAXABLE', 2],
  ] as const)(
    'dispatches Rei OTHER with approved weight %s and %s TAX',
    async (shippingWeightLbs, taxTreatment, halfKgBlocks) => {
      const rei = { redirector: 'REI_DO_IMPORTADO' as const };
      const { service, input } = setup(
        ready(rei, { shippingWeightLbs, quantity: null, taxTreatment }),
      );
      const calculator = vi.spyOn(reiDoImportadoCalculator, 'calculateReiDoImportadoCost');

      const result = await service.execute(input);

      expect(calculator).toHaveBeenCalledTimes(1);
      expect(calculator).toHaveBeenCalledWith(
        expect.objectContaining({
          logisticsClassification: 'OTHER',
          shippingWeightLbs,
          quantity: null,
          taxTreatment,
        }),
      );
      expect(result.calculation).toMatchObject({
        breakdown: { classification: 'OTHER', quantity: null, halfKgBlocks, taxTreatment },
      });
    },
  );

  it.each<UsaCostPreflightResult>([
    {
      status: 'NEEDS_INPUT',
      reason: 'MISSING_WEIGHT',
      input: { type: 'WEIGHT', field: 'shippingWeightLbs' },
      redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
    },
    {
      status: 'BLOCKED',
      reason: 'KEY_INSUFFICIENT',
      redirector: { redirector: 'REI_DO_IMPORTADO' },
    },
    {
      status: 'BLOCKED',
      reason: 'USD_BRL_QUOTE_NOT_CONFIGURED',
      redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
    },
    {
      status: 'BLOCKED',
      reason: 'RETAILER_UNRESOLVED',
      redirector: { redirector: 'REI_DO_IMPORTADO' },
    },
  ])('does not call a calculator when preflight is %s', async (preflightResult) => {
    const { service, input, settingsService } = setup(preflightResult);
    const red = vi.spyOn(redDelawareCalculator, 'calculateRedDelawareExpressCost');
    const rei = vi.spyOn(reiDoImportadoCalculator, 'calculateReiDoImportadoCost');

    const result = await service.execute(input);

    expect(result).toEqual({ preflight: preflightResult, calculation: null });
    expect(red).not.toHaveBeenCalled();
    expect(rei).not.toHaveBeenCalled();
    expect(settingsService.getSettings).not.toHaveBeenCalled();
  });

  it.each([
    [
      'Apple Store + Red',
      { ...sourceProduct, providerName: 'apple_us', retailer: 'Apple Store USA' },
      ready({ redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' }),
      'RED_DELAWARE',
      null,
      'EXEMPT',
    ],
    [
      'Apple Store + Rei',
      { ...sourceProduct, providerName: 'apple_us', retailer: 'Apple Store USA' },
      ready(
        { redirector: 'REI_DO_IMPORTADO' },
        {
          logisticClassification: 'CELULAR',
          quantity: 1,
          shippingWeightLbs: null,
          taxTreatment: 'TAXABLE',
        },
      ),
      'REI_DO_IMPORTADO',
      1,
      'TAXABLE',
    ],
    [
      'Amazon + Rei',
      sourceProduct,
      ready(
        { redirector: 'REI_DO_IMPORTADO' },
        {
          logisticClassification: 'CELULAR',
          quantity: 1,
          shippingWeightLbs: null,
          taxTreatment: 'EXEMPT',
        },
      ),
      'REI_DO_IMPORTADO',
      1,
      'EXEMPT',
    ],
    [
      'Amazon Non-Apple without Product.id',
      {
        ...sourceProduct,
        sourceManufacturer: 'Canon',
        category: 'Camera',
        retailer: 'Amazon',
      },
      ready({ redirector: 'REI_DO_IMPORTADO' }),
      'REI_DO_IMPORTADO',
      null,
      'EXEMPT',
    ],
    [
      'UPCitemdb Best Buy',
      { ...sourceProduct, providerName: 'upcitemdb_us', retailer: 'Best Buy' },
      ready({ redirector: 'REI_DO_IMPORTADO' }),
      'REI_DO_IMPORTADO',
      null,
      'EXEMPT',
    ],
    [
      'UPCitemdb B&H',
      { ...sourceProduct, providerName: 'upcitemdb_us', retailer: 'B&H Photo Video' },
      ready({ redirector: 'REI_DO_IMPORTADO' }),
      'REI_DO_IMPORTADO',
      null,
      'EXEMPT',
    ],
    [
      'UPCitemdb Adorama',
      { ...sourceProduct, providerName: 'upcitemdb_us', retailer: 'Adorama' },
      ready({ redirector: 'REI_DO_IMPORTADO' }),
      'REI_DO_IMPORTADO',
      null,
      'EXEMPT',
    ],
  ] as const)(
    'returns FinalCost for %s',
    async (_label, source, preflightResult, redirector, quantity, taxTreatment) => {
      const { service, input } = setup(preflightResult, source);

      const result = await service.execute(input);

      expect(result.calculation).toMatchObject({
        sourceProductId: source.sourceProductId,
        redirector: preflightResult.redirector,
        finalCost: { currency: 'BRL' },
      });
      if (redirector === 'REI_DO_IMPORTADO') {
        expect(result.calculation?.breakdown).toMatchObject({ quantity, taxTreatment });
      }
      expect(source).not.toHaveProperty('productId');
      expect(redirector).toBe(preflightResult.redirector.redirector);
    },
  );

  it('preserves calculator cent-safe FinalCost for a PY 2677.0675-like fraction', async () => {
    const red = { redirector: 'RED_DELAWARE' as const, shippingMode: 'EXPRESS' as const };
    const fractionalPrice = { ...sourceProduct, priceUsd: 500.39 };
    const { service, input } = setup(ready(red, { shippingWeightLbs: 3.95 }), fractionalPrice);

    const result = await service.execute(input);

    expect(result.calculation).not.toBeNull();
    const calculation = result.calculation!;
    expect(calculation.breakdown).toMatchObject({ productValueBrl: 2677.09 });
    expect(calculation.finalCost.amountBrl).toBe(
      roundMoneyToCents(calculation.finalCost.amountBrl),
    );
    expect(
      roundMoneyToCents(
        (calculation.breakdown as redDelawareCalculator.RedDelawareCostBreakdown).productValueBrl +
          (calculation.breakdown as redDelawareCalculator.RedDelawareCostBreakdown).shippingBrl,
      ),
    ).toBe(calculation.finalCost.amountBrl);
  });
});
