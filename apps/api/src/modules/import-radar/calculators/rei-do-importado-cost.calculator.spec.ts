import { describe, expect, it } from 'vitest';
import { roundMoneyToCents } from '../validators/import-radar.validators';
import {
  calculateReiDoImportadoCost,
  ReiDoImportadoCalculationError,
  type ReiDoImportadoCostCalculatorInput,
} from './rei-do-importado-cost.calculator';

const LBS_TO_KG = 0.45359237;
const reiRates = {
  phoneShippingUsd: 150,
  otherProductsShippingUsdPerHalfKg: 120,
  insurancePercent: 15,
  usTaxPercent: 7,
  airFreightDiscountPercent: 10,
} as const;

function input(
  overrides: Partial<ReiDoImportadoCostCalculatorInput> = {},
): ReiDoImportadoCostCalculatorInput {
  return {
    productPriceUsd: 100,
    usdBrlQuote: 5,
    shippingWeightLbs: 1,
    logisticsClassification: 'OTHER',
    taxTreatment: 'TAXABLE',
    ...reiRates,
    ...overrides,
  };
}

function expectCalculationError(
  overrides: Partial<ReiDoImportadoCostCalculatorInput>,
  code: ReiDoImportadoCalculationError['code'],
) {
  expect(() => calculateReiDoImportadoCost(input(overrides))).toThrow(
    expect.objectContaining({ code }),
  );
}

describe('calculateReiDoImportadoCost', () => {
  it.each([
    [1, 150, 15, 135],
    [2, 300, 30, 270],
  ])(
    'applies the configured freight discount to %s cellular unit(s)',
    (quantity, baseShippingUsd, shippingDiscountUsd, shippingUsd) => {
      const result = calculateReiDoImportadoCost(
        input({
          logisticsClassification: 'CELULAR',
          quantity,
          shippingWeightLbs: null,
        }),
      );

      expect(result.breakdown).toMatchObject({
        classification: 'CELULAR',
        quantity,
        shippingWeightLbs: null,
        weightKg: null,
        halfKgBlocks: null,
        baseShippingUsd,
        shippingDiscountPercent: 10,
        shippingDiscountUsd,
        shippingUsd,
      });
    },
  );

  it.each([
    [0, 0, 150],
    [100, 150, 0],
  ])(
    'uses the configured %s%% cellular freight discount',
    (discount, shippingDiscountUsd, shippingUsd) => {
      const result = calculateReiDoImportadoCost(
        input({
          logisticsClassification: 'CELULAR',
          quantity: 1,
          airFreightDiscountPercent: discount,
        }),
      );

      expect(result.breakdown).toMatchObject({
        baseShippingUsd: 150,
        shippingDiscountPercent: discount,
        shippingDiscountUsd,
        shippingUsd,
      });
    },
  );

  it('keeps an available cellular weight as audit context without using it for freight', () => {
    const result = calculateReiDoImportadoCost(
      input({
        logisticsClassification: 'CELULAR',
        quantity: 1,
        shippingWeightLbs: 3.95,
      }),
    );

    expect(result.breakdown).toMatchObject({
      shippingWeightLbs: 3.95,
      weightKg: null,
      halfKgBlocks: null,
      shippingUsd: 135,
    });
  });

  it.each([
    [1, 1, 120, 12, 108],
    [0.5 / LBS_TO_KG + 0.000001, 2, 240, 24, 216],
    [2, 2, 240, 24, 216],
    [1 / LBS_TO_KG + 0.000001, 3, 360, 36, 324],
  ])(
    'derives %s lb into %s half-kg blocks and US$ %s effective freight',
    (shippingWeightLbs, halfKgBlocks, baseShippingUsd, shippingDiscountUsd, shippingUsd) => {
      const result = calculateReiDoImportadoCost(input({ shippingWeightLbs }));

      expect(result.breakdown).toMatchObject({
        classification: 'OTHER',
        shippingWeightLbs,
        halfKgBlocks,
        baseShippingUsd,
        shippingDiscountPercent: 10,
        shippingDiscountUsd,
        shippingUsd,
      });
      expect(result.breakdown.weightKg).toBe(shippingWeightLbs * LBS_TO_KG);
    },
  );

  it('uses configured Rei do Importado rates rather than calculator defaults', () => {
    const result = calculateReiDoImportadoCost(
      input({
        logisticsClassification: 'CELULAR',
        quantity: 2,
        phoneShippingUsd: 95,
        insurancePercent: 0,
        usTaxPercent: 0,
        airFreightDiscountPercent: 0,
      }),
    );

    expect(result.breakdown).toMatchObject({
      baseShippingUsd: 190,
      shippingUsd: 190,
      insurancePercent: 0,
      taxPercent: 0,
      shippingDiscountUsd: 0,
    });
  });

  it('applies insurance only to the converted product value', () => {
    const result = calculateReiDoImportadoCost(
      input({
        productPriceUsd: 100,
        usdBrlQuote: 10,
        insurancePercent: 15,
        logisticsClassification: 'CELULAR',
        quantity: 1,
        taxTreatment: 'EXEMPT',
      }),
    );

    expect(result.breakdown.productValueBrl).toBe(1000);
    expect(result.breakdown.insuranceBrl).toBe(150);
  });

  it('reflects the discounted cellular freight in FinalCost', () => {
    const result = calculateReiDoImportadoCost(
      input({
        logisticsClassification: 'CELULAR',
        quantity: 1,
        shippingWeightLbs: null,
      }),
    );

    expect(result.breakdown).toMatchObject({
      shippingUsd: 135,
      shippingBrl: 675,
      insuranceBrl: 75,
      taxBrl: 35,
    });
    expect(result.finalCost).toEqual({ currency: 'BRL', amountBrl: 1285 });
  });

  it('keeps final BRL components cent-safe when conversions and insurance produce fractions', () => {
    const result = calculateReiDoImportadoCost(
      input({
        productPriceUsd: 19.99,
        usdBrlQuote: 5.35,
        logisticsClassification: 'OTHER',
        shippingWeightLbs: 1,
      }),
    );

    expect(result.breakdown.productValueBrl).toBe(106.95);
    expect(result.breakdown.insuranceBrl).toBe(16.04);
    expect(roundMoneyToCents(result.breakdown.productValueBrl)).toBe(
      result.breakdown.productValueBrl,
    );
    expect(roundMoneyToCents(result.breakdown.shippingBrl)).toBe(result.breakdown.shippingBrl);
    expect(roundMoneyToCents(result.breakdown.insuranceBrl)).toBe(result.breakdown.insuranceBrl);
    expect(roundMoneyToCents(result.breakdown.taxBrl)).toBe(result.breakdown.taxBrl);
    expect(roundMoneyToCents(result.finalCost.amountBrl)).toBe(result.finalCost.amountBrl);
    expect(
      roundMoneyToCents(
        result.breakdown.productValueBrl +
          result.breakdown.shippingBrl +
          result.breakdown.insuranceBrl +
          result.breakdown.taxBrl,
      ),
    ).toBe(result.finalCost.amountBrl);
  });

  it('applies the resolved TAX treatment without inferring a retailer', () => {
    const taxable = calculateReiDoImportadoCost(input({ taxTreatment: 'TAXABLE' }));
    const exempt = calculateReiDoImportadoCost(input({ taxTreatment: 'EXEMPT' }));

    expect(taxable.breakdown).toMatchObject({ taxPercent: 7, taxUsd: 7, taxBrl: 35 });
    expect(exempt.breakdown).toMatchObject({ taxPercent: 7, taxUsd: 0, taxBrl: 0 });
  });

  it('returns FinalCost with only homologated Rei do Importado components', () => {
    const result = calculateReiDoImportadoCost(input());

    expect(result).toMatchObject({
      redirector: 'REI_DO_IMPORTADO',
      finalCost: { currency: 'BRL', amountBrl: 1150 },
      breakdown: {
        productValueBrl: 500,
        shippingBrl: 540,
        insuranceBrl: 75,
        taxBrl: 35,
      },
    });
    expect(result.breakdown).not.toHaveProperty('importDutyBrl');
    expect(result.breakdown).not.toHaveProperty('iofBrl');
    expect(result.breakdown).not.toHaveProperty('redDelawareShippingUsd');
  });

  it('does not calculate when the USA quote is not configured', () => {
    expectCalculationError({ usdBrlQuote: null }, 'USD_BRL_QUOTE_NOT_CONFIGURED');
    expectCalculationError({ usdBrlQuote: undefined }, 'USD_BRL_QUOTE_NOT_CONFIGURED');
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid USD/BRL quote %s',
    (usdBrlQuote) => {
      expectCalculationError({ usdBrlQuote }, 'INVALID_USD_BRL_QUOTE');
    },
  );

  it('requires a valid weight only for OTHER', () => {
    expectCalculationError(
      { logisticsClassification: 'OTHER', shippingWeightLbs: null },
      'SHIPPING_WEIGHT_MISSING',
    );
    expectCalculationError(
      { logisticsClassification: 'OTHER', shippingWeightLbs: 0 },
      'INVALID_SHIPPING_WEIGHT',
    );
    expectCalculationError(
      { logisticsClassification: 'OTHER', shippingWeightLbs: -0.5 },
      'INVALID_SHIPPING_WEIGHT',
    );
    expectCalculationError(
      { logisticsClassification: 'OTHER', shippingWeightLbs: Number.NaN },
      'INVALID_SHIPPING_WEIGHT',
    );
  });

  it.each([null, undefined, 0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid cellular quantity %s',
    (quantity) => {
      expectCalculationError(
        { logisticsClassification: 'CELULAR', quantity },
        'INVALID_CELLULAR_QUANTITY',
      );
    },
  );

  it('fails closed for unknown logistics classification and TAX treatment', () => {
    expectCalculationError(
      { logisticsClassification: 'TABLET' as never },
      'UNSUPPORTED_LOGISTICS_CLASSIFICATION',
    );
    expectCalculationError({ taxTreatment: 'MAYBE' as never }, 'UNSUPPORTED_TAX_TREATMENT');
  });

  it.each<
    [string, Partial<ReiDoImportadoCostCalculatorInput>, ReiDoImportadoCalculationError['code']]
  >([
    ['product price', { productPriceUsd: Number.NaN }, 'INVALID_PRODUCT_PRICE'],
    ['phone rate', { phoneShippingUsd: -1 }, 'INVALID_REI_DO_IMPORTADO_RATE'],
    [
      'other-product rate',
      { otherProductsShippingUsdPerHalfKg: Number.POSITIVE_INFINITY },
      'INVALID_REI_DO_IMPORTADO_RATE',
    ],
    ['insurance', { insurancePercent: 100.01 }, 'INVALID_REI_DO_IMPORTADO_PERCENTAGE'],
    ['TAX', { usTaxPercent: -0.01 }, 'INVALID_REI_DO_IMPORTADO_PERCENTAGE'],
    [
      'freight discount',
      { airFreightDiscountPercent: Number.NaN },
      'INVALID_REI_DO_IMPORTADO_PERCENTAGE',
    ],
  ])('rejects invalid %s input', (_field, overrides, code) => {
    expectCalculationError(overrides, code);
  });
});
