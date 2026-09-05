import { describe, expect, it } from 'vitest';
import { calculateNonAppleElectronics as calculate } from './non-apple-electronics.engine';
import { NON_APPLE_PROFIT_BANDS } from './non-apple-electronics.policy';

describe('isolated non-Apple electronics engine', () => {
  it.each([
    [50, 0, 60, 110, 1.2, null],
    [150, 0, 150, 300, 1, null],
    [250, 0, 200, 450, null, null],
    [400, 0, 300, 700, null, null],
    [700, 150, 300, 1150, null, null],
    [1500, 150, 250, 1900, 0.15, 250],
    [2500, 150, 300, 2950, 0.12, 300],
    [4000, 150, 400, 4550, 0.1, 350],
    [6000, 150, 480, 6630, 0.08, 400],
  ])(
    'prices acquisition cost %s using approved profit and CF',
    (cost, fixed, profit, base, rate, floor) => {
      expect(calculate({ acquisitionCost: cost! })).toMatchObject({
        engine: 'NON_APPLE_ELECTRONICS',
        ruleVersion: '1.0.0',
        acquisitionCost: cost,
        fixedCost: fixed,
        targetProfit: profit,
        targetProfitRateOnCost: rate,
        targetProfitFloor: floor,
        rawBasePrice: base,
        protectedBasePrice: base,
        basePrice: base,
        continuityAdjustment: 0,
      });
    },
  );

  it.each([
    [100, 220, 200.02, 220],
    [200, 400, 400.01, 400.01],
    [300, 500, 600.01, 600.01],
    [500, 800, 950.01, 950.01],
    [1000, 1450, 1400.01, 1450],
    [2000, 2450, 2450.01, 2450.01],
    [3000, 3510, 3500.01, 3510],
    [5000, 5650, 5550.01, 5650],
  ])('protects both sides of boundary %s', (boundary, exactRaw, nextRaw, nextProtected) => {
    const before = calculate({ acquisitionCost: Math.round((boundary - 0.01) * 100) / 100 });
    const exact = calculate({ acquisitionCost: boundary });
    const after = calculate({ acquisitionCost: Math.round((boundary + 0.01) * 100) / 100 });
    expect(exact.rawBasePrice).toBe(exactRaw);
    expect(after.rawBasePrice).toBe(nextRaw);
    expect(after.protectedBasePrice).toBe(nextProtected);
    expect(exact.protectedBasePrice).toBeGreaterThanOrEqual(before.protectedBasePrice);
    expect(after.protectedBasePrice).toBeGreaterThanOrEqual(exact.protectedBasePrice);
    expect(after.continuityAdjustment).toBeCloseTo(nextProtected - nextRaw, 8);
  });

  it('equals the running raw maximum for every cent through R$10,000', () => {
    let maximum = 0;
    for (let cost = 1; cost <= 1_000_000; cost += 1) {
      const result = calculate({ acquisitionCost: cost / 100, offerIncrement: 0 });
      maximum = Math.max(maximum, result.rawBasePrice);
      if (result.protectedBasePrice !== maximum) {
        throw new Error(`Non-minimal or decreasing protection at ${cost / 100}`);
      }
    }
    expect(maximum).toBe(10950);
  }, 30000);

  it.each([
    [1000.01, 250, 49.99],
    [3000.01, 350, 9.99],
    [5000.01, 400, 99.99],
  ])('keeps target profit independent of continuity at %s', (cost, profit, adjustment) => {
    expect(calculate({ acquisitionCost: cost })).toMatchObject({
      targetProfit: profit,
      continuityAdjustment: adjustment,
    });
  });

  it.each([
    [1600, 250],
    [1800, 270],
    [2500, 300],
    [2800, 336],
    [3200, 350],
    [4000, 400],
    [6000, 480],
  ])('uses MAX floors at %s', (cost, profit) => {
    expect(calculate({ acquisitionCost: cost }).targetProfit).toBe(profit);
  });

  it('adds only explicit BRL charges after continuity, then rounds and increments', () => {
    const input = {
      acquisitionCost: 1000.01,
      applicableCharges: { defaultFreight: 12.34, defaultPaymentFee: 5.67 },
      offerIncrement: 50,
    };
    const before = structuredClone(input);
    expect(calculate(input)).toMatchObject({
      rawBasePrice: 1400.01,
      protectedBasePrice: 1450,
      continuityAdjustment: 49.99,
      applicableCharges: { defaultFreight: 12.34, defaultPaymentFee: 5.67 },
      basePrice: 1468.01,
      roundedPrice: 1470,
      offerIncrement: 50,
      offerPrice: 1520,
    });
    expect(input).toEqual(before);
    expect(calculate({ acquisitionCost: 700 })).toMatchObject({
      applicableCharges: { defaultFreight: 0, defaultPaymentFee: 0 },
      basePrice: 1150,
      roundedPrice: 1170,
      offerIncrement: 100,
      offerPrice: 1270,
    });
  });

  it('reuses commercial endings and increment normalization', () => {
    expect(calculate({ acquisitionCost: 50, offerIncrement: 0 })).toMatchObject({
      roundedPrice: 149,
      offerPrice: 149,
    });
    expect(
      calculate({ acquisitionCost: 50, commercialEndings: [20, 90], offerIncrement: '50' }),
    ).toMatchObject({ roundedPrice: 120, offerPrice: 170 });
    expect(calculate({ acquisitionCost: 50, offerIncrement: -1 }).offerIncrement).toBe(100);
  });

  it.each([0, -1, NaN, Infinity, -Infinity, 0.001, Number.MAX_VALUE, '50', null, undefined])(
    'rejects invalid acquisition cost %s',
    (value) => {
      expect(() => calculate({ acquisitionCost: value as number })).toThrow(RangeError);
    },
  );

  it.each([-1, NaN, Infinity, 0.001, '20'])('rejects invalid additional charges %s', (value) => {
    for (const field of ['defaultFreight', 'defaultPaymentFee']) {
      expect(() =>
        calculate({ acquisitionCost: 700, applicableCharges: { [field]: value } }),
      ).toThrow(RangeError);
    }
  });

  it('reports finite serializable band metadata and freezes policy', () => {
    expect(calculate({ acquisitionCost: 6000 }).band).toEqual({
      lowerBoundExclusive: 5000,
      upperBoundInclusive: null,
    });
    expect(Object.isFrozen(NON_APPLE_PROFIT_BANDS)).toBe(true);
    expect(NON_APPLE_PROFIT_BANDS.every(Object.isFrozen)).toBe(true);
  });
});
