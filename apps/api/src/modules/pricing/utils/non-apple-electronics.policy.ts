export const NON_APPLE_ELECTRONICS_RULE_VERSION = '1.0.0';

type ProfitBand = Readonly<{
  upperBound: number;
  profitRateOnCost: number | null;
  fixedProfit: number | null;
  minimumProfit: number | null;
}>;

export const NON_APPLE_PROFIT_BANDS: readonly ProfitBand[] = Object.freeze(
  [
    { upperBound: 100, profitRateOnCost: 1.2, fixedProfit: null, minimumProfit: null },
    { upperBound: 200, profitRateOnCost: 1, fixedProfit: null, minimumProfit: null },
    { upperBound: 300, profitRateOnCost: null, fixedProfit: 200, minimumProfit: null },
    { upperBound: 500, profitRateOnCost: null, fixedProfit: 300, minimumProfit: null },
    { upperBound: 1000, profitRateOnCost: null, fixedProfit: 300, minimumProfit: null },
    { upperBound: 2000, profitRateOnCost: 0.15, fixedProfit: null, minimumProfit: 250 },
    { upperBound: 3000, profitRateOnCost: 0.12, fixedProfit: null, minimumProfit: 300 },
    { upperBound: 5000, profitRateOnCost: 0.1, fixedProfit: null, minimumProfit: 350 },
    { upperBound: Infinity, profitRateOnCost: 0.08, fixedProfit: null, minimumProfit: 400 },
  ].map((band) => Object.freeze(band)),
);

export const NON_APPLE_FIXED_COST_BANDS = Object.freeze([
  Object.freeze({ upperBound: 500, fixedCost: 0 }),
  Object.freeze({ upperBound: Infinity, fixedCost: 150 }),
]);
