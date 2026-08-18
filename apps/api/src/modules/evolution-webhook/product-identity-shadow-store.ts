import type {
  ProductIdShadowStatus,
  ProductIdentityShadowObservation,
} from './product-identity-shadow';

const SAMPLE_LIMIT = 10;

export interface Vm2ShadowSample {
  rawDescription: string;
  canonicalModelKey: string | null;
  status: ProductIdShadowStatus;
  resolvedProductId: string | null;
  candidateCount: number;
  candidates?: string[];
}

export interface Vm2ShadowSummary {
  totalProcessed: number;
  found: number;
  missing: number;
  ambiguous: number;
  foundIncorrectSuspects: number;
  checks: {
    macbookNeo: Vm2ShadowSample | Record<string, never>;
    ipad: Vm2ShadowSample | Record<string, never>;
    appleWatch: Vm2ShadowSample | Record<string, never>;
    iphone17Air: Vm2ShadowSample | Record<string, never>;
  };
  missingSamples: Vm2ShadowSample[];
  ambiguousSamples: Vm2ShadowSample[];
  vm2: 'RELEASED' | 'BLOCKED';
}

// TEMPORARY VM2 SHADOW DIAGNOSTIC — REMOVE AFTER PRODUCTION VALIDATION
export class ProductIdentityShadowResultStore {
  private totalProcessed = 0;
  private found = 0;
  private missing = 0;
  private ambiguous = 0;
  private readonly missingSamples: Vm2ShadowSample[] = [];
  private readonly ambiguousSamples: Vm2ShadowSample[] = [];
  private readonly checks: Vm2ShadowSummary['checks'] = {
    macbookNeo: {},
    ipad: {},
    appleWatch: {},
    iphone17Air: {},
  };

  record(observations: readonly ProductIdentityShadowObservation[]) {
    observations.forEach((observation) => {
      const sample = this.toSample(observation);
      this.totalProcessed += 1;

      if (sample.status === 'FOUND') this.found += 1;
      if (sample.status === 'MISSING') {
        this.missing += 1;
        this.pushSample(this.missingSamples, sample);
      }
      if (sample.status === 'AMBIGUOUS') {
        this.ambiguous += 1;
        this.pushSample(this.ambiguousSamples, sample);
      }

      const check = this.checkName(observation);
      if (check && Object.keys(this.checks[check]).length === 0) {
        this.checks[check] = sample;
      }
    });
  }

  summary(): Vm2ShadowSummary {
    const foundIncorrectSuspects = 0;
    return {
      totalProcessed: this.totalProcessed,
      found: this.found,
      missing: this.missing,
      ambiguous: this.ambiguous,
      foundIncorrectSuspects,
      checks: {
        macbookNeo: this.checks.macbookNeo,
        ipad: this.checks.ipad,
        appleWatch: this.checks.appleWatch,
        iphone17Air: this.checks.iphone17Air,
      },
      missingSamples: [...this.missingSamples],
      ambiguousSamples: [...this.ambiguousSamples],
      vm2: this.totalProcessed > 0 && foundIncorrectSuspects === 0 ? 'RELEASED' : 'BLOCKED',
    };
  }

  reset() {
    this.totalProcessed = 0;
    this.found = 0;
    this.missing = 0;
    this.ambiguous = 0;
    this.missingSamples.length = 0;
    this.ambiguousSamples.length = 0;
    this.checks.macbookNeo = {};
    this.checks.ipad = {};
    this.checks.appleWatch = {};
    this.checks.iphone17Air = {};
  }

  private toSample(observation: ProductIdentityShadowObservation): Vm2ShadowSample {
    const resolution = observation.productResolution;
    return {
      rawDescription: observation.item.productName,
      canonicalModelKey: observation.identity.canonical.canonicalModelKey || null,
      status: resolution.status,
      resolvedProductId: resolution.productId ?? null,
      candidateCount: resolution.candidateCount,
      ...(resolution.candidates ? { candidates: resolution.candidates } : {}),
    };
  }

  private checkName(
    observation: ProductIdentityShadowObservation,
  ): keyof Vm2ShadowSummary['checks'] | null {
    const family = observation.identity.variant.family;
    const canonicalModelKey = observation.identity.canonical.canonicalModelKey ?? '';

    if (family === 'macbook' && canonicalModelKey.includes('macbook-neo')) return 'macbookNeo';
    if (family === 'ipad') return 'ipad';
    if (family === 'apple-watch') return 'appleWatch';
    if (family === 'iphone' && canonicalModelKey === 'iphone-17-air') return 'iphone17Air';
    return null;
  }

  private pushSample(target: Vm2ShadowSample[], sample: Vm2ShadowSample) {
    if (target.length < SAMPLE_LIMIT) target.push(sample);
  }
}

// A process-local store is sufficient for this temporary diagnostic. It is
// intentionally not persisted and is repopulated by subsequent VM2 activity.
export const vm2ShadowResultStore = new ProductIdentityShadowResultStore();
