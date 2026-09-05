import type { SourceManufacturerProvenance } from '../financial-classification';

/**
 * Origins used by the commercial source contracts. MOCK remains available only
 * because the existing import provider contract exposes it for simulations.
 */
export type SourceOrigin = 'BR' | 'PY' | 'US' | 'MOCK';

/** Origins that represent an external commercial radar. */
export type ExternalRadarOrigin = Exclude<SourceOrigin, 'MOCK'>;

/** Origins supported by the current import provider contract. */
export type ImportProviderOrigin = Exclude<SourceOrigin, 'BR'>;

/**
 * Commercial identity supplied by a source before any financial calculation.
 * It deliberately carries no pricing or redirector-specific data.
 */
export interface SourceCommercialIdentity<TOrigin extends SourceOrigin = SourceOrigin> {
  sourceProductId: string;
  sourceName: string;
  displayName: string;
  source: TOrigin;
  sourceUrl: string;
  supplier: string;
  sourceManufacturer: string | null;
  sourceManufacturerProvenance: SourceManufacturerProvenance | null;
}
