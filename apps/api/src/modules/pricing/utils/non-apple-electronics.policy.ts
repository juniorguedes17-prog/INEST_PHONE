export const NON_APPLE_ELECTRONICS_RULE_VERSION = '1.0.0';
export const NON_APPLE_ELECTRONICS_POLICY_KEY = 'non_apple_electronics_policy';

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

const PROFIT_BAND_IDS = [
  'cost_up_to_100',
  'cost_up_to_200',
  'cost_up_to_300',
  'cost_up_to_500',
  'cost_up_to_1000',
  'cost_up_to_2000',
  'cost_up_to_3000',
  'cost_up_to_5000',
  'cost_above_5000',
] as const;

const FIXED_COST_BAND_IDS = ['cost_up_to_500', 'cost_above_500'] as const;

export type NonAppleElectronicsPolicy = {
  version: typeof NON_APPLE_ELECTRONICS_RULE_VERSION;
  profitBands: Array<{
    id: (typeof PROFIT_BAND_IDS)[number];
    profitPercentOnCost: number | null;
    fixedProfit: number | null;
    minimumProfit: number | null;
  }>;
  fixedCostBands: Array<{
    id: (typeof FIXED_COST_BAND_IDS)[number];
    fixedCost: number;
  }>;
};

export type NonAppleElectronicsRuntimePolicy = {
  profitBands: readonly ProfitBand[];
  fixedCostBands: readonly Readonly<{ upperBound: number; fixedCost: number }>[];
};

function cloneDefaultPolicy(): NonAppleElectronicsPolicy {
  return {
    version: NON_APPLE_ELECTRONICS_RULE_VERSION,
    profitBands: NON_APPLE_PROFIT_BANDS.map((band, index) => ({
      id: PROFIT_BAND_IDS[index]!,
      profitPercentOnCost: band.profitRateOnCost === null ? null : band.profitRateOnCost * 100,
      fixedProfit: band.fixedProfit,
      minimumProfit: band.minimumProfit,
    })),
    fixedCostBands: NON_APPLE_FIXED_COST_BANDS.map((band, index) => ({
      id: FIXED_COST_BAND_IDS[index]!,
      fixedCost: band.fixedCost,
    })),
  };
}

export function getDefaultNonAppleElectronicsPolicy(): NonAppleElectronicsPolicy {
  return cloneDefaultPolicy();
}

function isFiniteNonNegative(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isMonetaryAmount(value: unknown) {
  if (!isFiniteNonNegative(value)) return false;
  const cents = (value as number) * 100;
  return Number.isSafeInteger(Math.round(cents)) && Math.abs(cents - Math.round(cents)) <= 1e-6;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

/** Returns null unless this is a complete, supported policy document. */
export function parseNonAppleElectronicsPolicy(value: unknown): NonAppleElectronicsPolicy | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const policy = value as Record<string, unknown>;
  if (
    !hasOnlyKeys(policy, ['version', 'profitBands', 'fixedCostBands']) ||
    policy.version !== NON_APPLE_ELECTRONICS_RULE_VERSION ||
    !Array.isArray(policy.profitBands) ||
    !Array.isArray(policy.fixedCostBands) ||
    policy.profitBands.length !== PROFIT_BAND_IDS.length ||
    policy.fixedCostBands.length !== FIXED_COST_BAND_IDS.length
  ) {
    return null;
  }

  const profitBands = policy.profitBands.map((band, index) => {
    if (!band || typeof band !== 'object' || Array.isArray(band)) return null;
    const item = band as Record<string, unknown>;
    const expected = NON_APPLE_PROFIT_BANDS[index]!;
    if (
      !hasOnlyKeys(item, ['id', 'profitPercentOnCost', 'fixedProfit', 'minimumProfit']) ||
      item.id !== PROFIT_BAND_IDS[index]
    ) {
      return null;
    }
    const hasRate = expected.profitRateOnCost !== null;
    const hasFixedProfit = expected.fixedProfit !== null;
    const hasMinimum = expected.minimumProfit !== null;
    if (
      (hasRate
        ? !isFiniteNonNegative(item.profitPercentOnCost)
        : item.profitPercentOnCost !== null) ||
      (hasFixedProfit ? !isMonetaryAmount(item.fixedProfit) : item.fixedProfit !== null) ||
      (hasMinimum ? !isMonetaryAmount(item.minimumProfit) : item.minimumProfit !== null)
    ) {
      return null;
    }
    return {
      id: item.id as (typeof PROFIT_BAND_IDS)[number],
      profitPercentOnCost: item.profitPercentOnCost as number | null,
      fixedProfit: item.fixedProfit as number | null,
      minimumProfit: item.minimumProfit as number | null,
    };
  });

  const fixedCostBands = policy.fixedCostBands.map((band, index) => {
    if (!band || typeof band !== 'object' || Array.isArray(band)) return null;
    const item = band as Record<string, unknown>;
    if (
      !hasOnlyKeys(item, ['id', 'fixedCost']) ||
      item.id !== FIXED_COST_BAND_IDS[index] ||
      !isMonetaryAmount(item.fixedCost)
    ) {
      return null;
    }
    return {
      id: item.id as (typeof FIXED_COST_BAND_IDS)[number],
      fixedCost: item.fixedCost as number,
    };
  });

  if (profitBands.some((band) => band === null) || fixedCostBands.some((band) => band === null)) {
    return null;
  }

  return {
    version: NON_APPLE_ELECTRONICS_RULE_VERSION,
    profitBands: profitBands as NonAppleElectronicsPolicy['profitBands'],
    fixedCostBands: fixedCostBands as NonAppleElectronicsPolicy['fixedCostBands'],
  };
}

export function getNonAppleElectronicsRuntimePolicy(
  policy?: NonAppleElectronicsPolicy | null,
): NonAppleElectronicsRuntimePolicy {
  const effectivePolicy =
    parseNonAppleElectronicsPolicy(policy) ?? getDefaultNonAppleElectronicsPolicy();
  return {
    profitBands: effectivePolicy.profitBands.map((band, index) =>
      Object.freeze({
        upperBound: NON_APPLE_PROFIT_BANDS[index]!.upperBound,
        profitRateOnCost: band.profitPercentOnCost === null ? null : band.profitPercentOnCost / 100,
        fixedProfit: band.fixedProfit,
        minimumProfit: band.minimumProfit,
      }),
    ),
    fixedCostBands: effectivePolicy.fixedCostBands.map((band, index) =>
      Object.freeze({
        upperBound: NON_APPLE_FIXED_COST_BANDS[index]!.upperBound,
        fixedCost: band.fixedCost,
      }),
    ),
  };
}
