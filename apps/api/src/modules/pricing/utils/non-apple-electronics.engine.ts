import { roundUpToCommercialPrice } from './commercial-price-rounding';
import { normalizeOfferIncrement } from './offer-increment';
import {
  getNonAppleElectronicsRuntimePolicy,
  NON_APPLE_ELECTRONICS_RULE_VERSION,
  NonAppleElectronicsPolicy,
} from './non-apple-electronics.policy';

export type NonAppleElectronicsInput = {
  acquisitionCost: number;
  // Only additional charges not already included in acquisitionCost, in BRL.
  applicableCharges?: { defaultFreight?: number; defaultPaymentFee?: number };
  commercialEndings?: readonly unknown[];
  offerIncrement?: unknown;
  policy?: NonAppleElectronicsPolicy;
};

function cents(value: number, field: string): number {
  const scaled = value * 100;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    !Number.isSafeInteger(Math.round(scaled)) ||
    Math.abs(scaled - Math.round(scaled)) > 1e-6
  ) {
    throw new RangeError(`Invalid monetary amount: ${field}`);
  }
  return Math.round(scaled);
}

function rawPrice(
  costCents: number,
  policy: ReturnType<typeof getNonAppleElectronicsRuntimePolicy>,
) {
  const bandIndex = policy.profitBands.findIndex((band) => costCents <= band.upperBound * 100);
  const band = policy.profitBands[bandIndex]!;
  const fixedCost =
    policy.fixedCostBands.find((entry) => costCents <= entry.upperBound * 100)!.fixedCost * 100;
  // Percentage profit is rounded to the nearest cent before composing the price.
  const targetProfit = Math.max(
    band.fixedProfit === null
      ? Math.round(costCents * band.profitRateOnCost!)
      : band.fixedProfit * 100,
    (band.minimumProfit ?? 0) * 100,
  );
  return {
    band,
    bandIndex,
    fixedCost,
    targetProfit,
    rawBasePrice: costCents + fixedCost + targetProfit,
  };
}

/** Pure calculation; the caller owns product classification and routing. */
export function calculateNonAppleElectronics(input: NonAppleElectronicsInput) {
  const policy = getNonAppleElectronicsRuntimePolicy(input.policy);
  const costCents = cents(input.acquisitionCost, 'acquisitionCost');
  if (costCents === 0) throw new RangeError('acquisitionCost must be positive');
  const raw = rawPrice(costCents, policy);
  const boundaryMaxima = [
    ...new Set([
      ...policy.profitBands.map((band) => band.upperBound),
      ...policy.fixedCostBands.map((band) => band.upperBound),
    ]),
  ]
    .filter(Number.isFinite)
    .sort((left, right) => left - right)
    .map((boundary) => ({
      costCents: boundary * 100,
      priceCents: rawPrice(boundary * 100, policy).rawBasePrice,
    }));
  // Every band increases internally, so earlier endpoint maxima define the least
  // nondecreasing majorant on the BRL-cent domain.
  const protectedCents = boundaryMaxima.reduce(
    (maximum, boundary) =>
      boundary.costCents < costCents ? Math.max(maximum, boundary.priceCents) : maximum,
    raw.rawBasePrice,
  );
  const freight = cents(input.applicableCharges?.defaultFreight ?? 0, 'defaultFreight');
  const paymentFee = cents(input.applicableCharges?.defaultPaymentFee ?? 0, 'defaultPaymentFee');
  const baseCents = protectedCents + freight + paymentFee;
  if (!Number.isSafeInteger(baseCents)) throw new RangeError('basePrice exceeds safe precision');
  const basePrice = baseCents / 100;
  const roundedPrice = roundUpToCommercialPrice(basePrice, input.commercialEndings);
  const offerIncrement = normalizeOfferIncrement(input.offerIncrement);
  const offerCents = cents(roundedPrice, 'roundedPrice') + cents(offerIncrement, 'offerIncrement');
  if (!Number.isSafeInteger(offerCents)) throw new RangeError('offerPrice exceeds safe precision');

  return {
    engine: 'NON_APPLE_ELECTRONICS' as const,
    ruleVersion: NON_APPLE_ELECTRONICS_RULE_VERSION,
    acquisitionCost: costCents / 100,
    band: {
      lowerBoundExclusive: policy.profitBands[raw.bandIndex - 1]?.upperBound ?? 0,
      upperBoundInclusive: Number.isFinite(raw.band.upperBound) ? raw.band.upperBound : null,
    },
    fixedCost: raw.fixedCost / 100,
    targetProfit: raw.targetProfit / 100,
    targetProfitRateOnCost: raw.band.profitRateOnCost,
    targetProfitFloor: raw.band.minimumProfit,
    rawBasePrice: raw.rawBasePrice / 100,
    continuityAdjustment: (protectedCents - raw.rawBasePrice) / 100,
    protectedBasePrice: protectedCents / 100,
    applicableCharges: { defaultFreight: freight / 100, defaultPaymentFee: paymentFee / 100 },
    basePrice,
    roundedPrice,
    offerIncrement,
    offerPrice: offerCents / 100,
  };
}
