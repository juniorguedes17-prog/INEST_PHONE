import { Inject, Injectable, Logger } from '@nestjs/common';
import { deriveExtendedProductIdentity } from '@inest/product-identity';
import {
  ProductNormalizationService,
  type UsaProductEnrichmentResult,
} from '../../evolution-webhook/product-normalization.service';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import { sourceSemanticText, compactSourceEvidence } from '../usa-source-evidence';

export type UsaDeterministicIdentityState = 'RESOLVED' | 'INSUFFICIENT' | 'AMBIGUOUS';

export interface UsaProductEnrichmentShadowObservation {
  sourceProductId: string;
  provider: string;
  deterministicState: UsaDeterministicIdentityState;
  lunaCalled: boolean;
  result: UsaProductEnrichmentResult | null;
  skipReason?: 'DETERMINISTICALLY_COMPLETE' | 'DISCOVERY_ONLY';
}

/**
 * Runtime-only Luna handoff for USA source products. It consumes the shared
 * NORMALIZE_PRICING_US infrastructure but deliberately has no authority to
 * alter source, identity, retailer, TAX, logistics, or pricing state.
 */
@Injectable()
export class UsaLunaEnrichmentShadowService {
  private readonly logger = new Logger(UsaLunaEnrichmentShadowService.name);

  constructor(
    @Inject(ProductNormalizationService)
    private readonly productNormalization: ProductNormalizationService,
  ) {}

  async observe(
    products: readonly UsaSourceProduct[],
  ): Promise<UsaProductEnrichmentShadowObservation[]> {
    const uniqueProducts = new Map<string, UsaSourceProduct>();
    for (const product of products) {
      uniqueProducts.set(`${product.providerName}:${product.sourceProductId}`, product);
    }

    return Promise.all([...uniqueProducts.values()].map((product) => this.observeOne(product)));
  }

  private async observeOne(
    product: UsaSourceProduct,
  ): Promise<UsaProductEnrichmentShadowObservation> {
    const deterministicState = deriveDeterministicIdentityState(product);
    if (!shouldCallUsaLuna(product, deterministicState)) {
      const observation: UsaProductEnrichmentShadowObservation = {
        sourceProductId: product.sourceProductId,
        provider: product.providerName,
        deterministicState,
        lunaCalled: false,
        result: null,
        skipReason:
          product.offerKind === 'FAMILY_STARTING_AT'
            ? 'DISCOVERY_ONLY'
            : 'DETERMINISTICALLY_COMPLETE',
      };
      this.log(observation);
      return observation;
    }

    try {
      const result = await this.productNormalization.enrichUsaProduct({
        source: 'US',
        provider: product.providerName,
        sourceProductId: product.sourceProductId,
        sourceName: product.sourceName,
        sourceEvidence: compactSourceEvidence(product.sourceEvidence ?? ''),
        retailer: product.retailer,
        sourceManufacturer: product.sourceManufacturer,
        category: product.category,
        model: product.model ?? null,
        capacity: product.capacity ?? null,
        color: product.color ?? null,
        condition: product.condition ?? null,
        deterministicState,
      });
      const observation = {
        sourceProductId: product.sourceProductId,
        provider: product.providerName,
        deterministicState,
        lunaCalled: result.lunaCalled,
        result,
      } satisfies UsaProductEnrichmentShadowObservation;
      this.log(observation);
      return observation;
    } catch (error) {
      const result = unavailableResult(error);
      const observation = {
        sourceProductId: product.sourceProductId,
        provider: product.providerName,
        deterministicState,
        lunaCalled: true,
        result,
      } satisfies UsaProductEnrichmentShadowObservation;
      this.log(observation);
      return observation;
    }
  }

  private log(observation: UsaProductEnrichmentShadowObservation) {
    const result = observation.result;
    this.logger.debug({
      event: 'import_radar.usa_luna_enrichment.shadow_handoff',
      source: 'US',
      provider: observation.provider,
      sourceProductId: observation.sourceProductId,
      deterministicState: observation.deterministicState,
      lunaCalled: observation.lunaCalled,
      candidateFieldsProduced: candidateFieldNames(result?.candidate ?? null),
      latencyMs: result?.latencyMs ?? null,
      schemaValid: result?.schemaValid ?? false,
      ...(result?.errorCode ? { errorCode: result.errorCode } : {}),
      ...(observation.skipReason ? { skipReason: observation.skipReason } : {}),
    });
  }
}

export function deriveDeterministicIdentityState(
  product: UsaSourceProduct,
): UsaDeterministicIdentityState {
  const identity = deriveExtendedProductIdentity({
    productName: sourceSemanticText(product),
    category: product.category,
    model: product.model,
    capacity: product.capacity,
    color: product.color,
    quality: product.condition,
  });

  if (identity.profit.status === 'valid') return 'RESOLVED';
  return identity.profit.status === 'ambiguous_identity' ? 'AMBIGUOUS' : 'INSUFFICIENT';
}

export function shouldCallUsaLuna(
  product: UsaSourceProduct,
  deterministicState: UsaDeterministicIdentityState,
) {
  return (
    product.offerKind !== 'FAMILY_STARTING_AT' &&
    deterministicState !== 'RESOLVED' &&
    Boolean(sourceSemanticText(product).trim())
  );
}

function unavailableResult(error: unknown): UsaProductEnrichmentResult {
  return {
    context: 'NORMALIZE_PRICING_US',
    enrichmentStatus: 'MODEL_ERROR',
    candidate: null,
    schemaValid: false,
    lunaCalled: true,
    model: 'unavailable',
    inputTokens: null,
    outputTokens: null,
    estimatedCostUsd: null,
    latencyMs: null,
    errorCode: error instanceof Error ? error.name : 'unknown_error',
  };
}

function candidateFieldNames(candidate: UsaProductEnrichmentResult['candidate']) {
  if (!candidate) return [];
  return Object.entries(candidate)
    .filter(([, value]) => (Array.isArray(value) ? value.length > 0 : value !== null))
    .map(([key]) => key);
}
