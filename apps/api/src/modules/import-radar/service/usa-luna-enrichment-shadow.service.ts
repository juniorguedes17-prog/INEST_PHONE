import { Inject, Injectable, Logger } from '@nestjs/common';
import { deriveExtendedProductIdentity } from '@inest/product-identity';
import {
  ProductNormalizationService,
  type ProductSemanticNormalizationResult,
} from '../../evolution-webhook/product-normalization.service';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import { sourceSemanticText, compactSourceEvidence } from '../usa-source-evidence';

export type UsaDeterministicIdentityState = 'RESOLVED' | 'INSUFFICIENT' | 'AMBIGUOUS';

export interface UsaProductEnrichmentShadowObservation {
  sourceProductId: string;
  provider: string;
  lunaCalled: boolean;
  result: ProductSemanticNormalizationResult | null;
  skipReason?: 'DISCOVERY_ONLY';
}

/**
 * Primary semantic Luna handoff for purchasable USA source products. It
 * deliberately forwards no identifier, retailer, price, TAX, logistics, or
 * pricing state to the semantic normalization boundary.
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
    if (!shouldCallUsaLuna(product)) {
      const observation: UsaProductEnrichmentShadowObservation = {
        sourceProductId: product.sourceProductId,
        provider: product.providerName,
        lunaCalled: false,
        result: null,
        skipReason: 'DISCOVERY_ONLY',
      };
      this.log(observation);
      return observation;
    }

    try {
      const result = await this.productNormalization.normalizeSemanticProduct({
        context: 'NORMALIZE_PRICING_US',
        source: 'US',
        sourceName: product.sourceName,
        sourceEvidence: compactSourceEvidence(product.sourceEvidence ?? ''),
        structuredFields: {
          manufacturer: product.sourceManufacturer,
          category: product.category,
          model: product.model ?? null,
          storage: product.capacity ?? null,
          color: product.color ?? null,
          condition: product.condition ?? null,
        },
      });
      const observation = {
        sourceProductId: product.sourceProductId,
        provider: product.providerName,
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
      event: 'import_radar.usa_semantic_normalization.handoff',
      source: 'US',
      provider: observation.provider,
      sourceProductId: observation.sourceProductId,
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

export function shouldCallUsaLuna(product: UsaSourceProduct) {
  return product.offerKind !== 'FAMILY_STARTING_AT' && Boolean(sourceSemanticText(product).trim());
}

function unavailableResult(error: unknown): ProductSemanticNormalizationResult {
  return {
    context: 'NORMALIZE_PRICING_US',
    source: 'US',
    normalizationStatus: 'MODEL_ERROR',
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

function candidateFieldNames(candidate: ProductSemanticNormalizationResult['candidate']) {
  if (!candidate) return [];
  return Object.entries(candidate)
    .filter(([, value]) => (Array.isArray(value) ? value.length > 0 : value !== null))
    .map(([key]) => key);
}
