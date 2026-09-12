import { Inject, Injectable, Logger } from '@nestjs/common';
import { deriveExtendedProductIdentity } from '@inest/product-identity';
import { isReservedAppleManufacturerAlias } from '../../manufacturers/manufacturer-alias-normalizer';
import { ManufacturersService } from '../../manufacturers/service/manufacturers.service';
import {
  type ProductSemanticNormalizationCandidate,
  type ProductSemanticNormalizationStatus,
} from '../../evolution-webhook/product-normalization.service';
import { normalizeProductCondition } from '../condition-normalizer';
import { resolveLogisticProductClassification } from '../logistic-product-classification';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import { sourceSemanticText } from '../usa-source-evidence';
import { UsaLunaEnrichmentShadowService } from './usa-luna-enrichment-shadow.service';

export type UsaCandidateValidationStatus = 'VALIDATED' | 'INSUFFICIENT' | 'CONFLICT';
export type UsaEnrichmentProvenance = 'SOURCE' | 'LUNA_VALIDATED';

const enrichmentFields = [
  'manufacturer',
  'category',
  'family',
  'model',
  'storage',
  'ram',
  'chip',
  'screen',
  'color',
  'connectivity',
  'condition',
  'quantity',
  'feature',
  'connector',
  'power',
  'length',
] as const;

export type UsaEnrichmentField = (typeof enrichmentFields)[number];

const explicitSourceConflictFields = new Set<UsaEnrichmentField>([
  'manufacturer',
  'model',
  'storage',
  'color',
  'condition',
]);

export interface UsaNormalizedProductField {
  value: string | null;
  provenance: UsaEnrichmentProvenance | null;
  candidateStatus: UsaCandidateValidationStatus | null;
}

export interface UsaNormalizedProductContext {
  sourceProduct: UsaSourceProduct;
  /** Presentation only; excluded from every identity, logistics, and financial input. */
  commercialName: string | null;
  fields: Record<UsaEnrichmentField, UsaNormalizedProductField>;
  /** Runtime-only candidate values; never an authority or persisted memory. */
  candidateValues: Partial<Record<UsaEnrichmentField, string>>;
  candidateFields: UsaEnrichmentField[];
  validatedFields: UsaEnrichmentField[];
  insufficientFields: UsaEnrichmentField[];
  conflictFields: UsaEnrichmentField[];
  logisticClassification: ReturnType<typeof resolveLogisticProductClassification>;
  semanticNormalizationStatus: ProductSemanticNormalizationStatus;
  lunaLatencyMs: number | null;
  lunaErrorCode: string | null;
}

type CandidateValidation = {
  status: UsaCandidateValidationStatus;
  value: string | null;
};

/**
 * Adapts the Luna-first semantic result to the existing USA runtime context.
 * Post-Luna checks are limited to source grounding, explicit source conflicts,
 * manufacturer resolution, and structural condition normalization. Product
 * Identity is invoked only after adaptation for the unchanged downstream
 * logistic classifier; it is not used to validate or discard Luna fields.
 */
@Injectable()
export class UsaLunaEnrichmentValidatorService {
  private readonly logger = new Logger(UsaLunaEnrichmentValidatorService.name);

  constructor(
    @Inject(UsaLunaEnrichmentShadowService)
    private readonly lunaShadow: UsaLunaEnrichmentShadowService,
    @Inject(ManufacturersService)
    private readonly manufacturers: ManufacturersService,
  ) {}

  async enrich(product: UsaSourceProduct): Promise<UsaNormalizedProductContext> {
    const [observation] = await this.lunaShadow.observe([product]);
    const result = observation?.result ?? null;
    const candidate = result?.candidate ?? null;
    const fields = baseFields(product);
    const candidateValues: Partial<Record<UsaEnrichmentField, string>> = {};

    for (const field of enrichmentFields) {
      const candidateValue = candidateValueFor(field, candidate);
      if (candidateValue === null) continue;
      const grounded = candidateIsSourceGrounded(field, candidateValue, product);
      if (grounded) candidateValues[field] = candidateValue;
      const validation = await this.validateCandidate(field, candidateValue, grounded);
      fields[field] = mergeCandidateField(field, fields[field], validation);
    }

    const downstreamIdentity = identityFromFields(product, fields);
    const logisticClassification = resolveLogisticProductClassification({
      productIdentity: downstreamIdentity,
      canonicalCategory: fields.category.value,
    });
    const validatedCommercialNameValue = validatedCommercialName(
      candidate?.commercialName ?? null,
      fields,
    );
    const context: UsaNormalizedProductContext = {
      sourceProduct: product,
      commercialName: validatedCommercialNameValue,
      fields,
      candidateValues,
      candidateFields: enrichmentFields.filter(
        (field) => candidateValueFor(field, candidate) !== null,
      ),
      validatedFields: enrichmentFields.filter(
        (field) => fields[field].candidateStatus === 'VALIDATED',
      ),
      insufficientFields: enrichmentFields.filter(
        (field) => fields[field].candidateStatus === 'INSUFFICIENT',
      ),
      conflictFields: enrichmentFields.filter(
        (field) => fields[field].candidateStatus === 'CONFLICT',
      ),
      logisticClassification,
      semanticNormalizationStatus:
        result?.normalizationStatus ??
        (product.offerKind === 'FAMILY_STARTING_AT' ? 'SKIPPED_NOT_ELIGIBLE' : 'MODEL_ERROR'),
      lunaLatencyMs: result?.latencyMs ?? null,
      lunaErrorCode: result?.errorCode ?? null,
    };
    this.logger.debug({
      event: 'USA_COMMERCIAL_NAME_TRACE',
      provider: product.providerName,
      sourceProductId: product.sourceProductId,
      semanticNormalizationStatus: context.semanticNormalizationStatus,
      sourceName: product.sourceName,
      displayName: product.displayName,
      candidateCommercialName: candidate?.commercialName ?? null,
      validatedCommercialName: validatedCommercialNameValue,
    });
    this.log(context);
    return context;
  }

  private async validateCandidate(
    field: UsaEnrichmentField,
    value: string,
    grounded: boolean,
  ): Promise<CandidateValidation> {
    if (!grounded) return { status: 'INSUFFICIENT', value: null };
    if (field === 'manufacturer') return this.validateManufacturer(value);
    if (field === 'condition') return validateCondition(value);
    return { status: 'VALIDATED', value };
  }

  private async validateManufacturer(value: string): Promise<CandidateValidation> {
    if (isReservedAppleManufacturerAlias(value)) {
      return { status: 'VALIDATED', value: 'Apple' };
    }
    const resolution = await this.manufacturers.resolve({
      evidence: value,
      matchMode: 'EXACT_ALIAS',
      provenance: 'AI_CANDIDATE_VALIDATED',
    });
    if (resolution.status === 'FOUND') {
      return { status: 'VALIDATED', value: resolution.canonicalName };
    }
    return {
      status: resolution.status === 'AMBIGUOUS' ? 'CONFLICT' : 'INSUFFICIENT',
      value: null,
    };
  }

  private log(context: UsaNormalizedProductContext) {
    this.logger.debug({
      event: 'import_radar.usa_semantic_normalization.validation',
      source: 'US',
      provider: context.sourceProduct.providerName,
      sourceProductId: context.sourceProduct.sourceProductId,
      semanticNormalizationStatus: context.semanticNormalizationStatus,
      candidateFields: context.candidateFields,
      validatedFields: context.validatedFields,
      insufficientFields: context.insufficientFields,
      conflictFields: context.conflictFields,
      provenance: Object.fromEntries(
        enrichmentFields.map((field) => [field, context.fields[field].provenance]),
      ),
      lunaLatencyMs: context.lunaLatencyMs,
      ...(context.lunaErrorCode ? { lunaErrorCode: context.lunaErrorCode } : {}),
    });
  }
}

function validatedCommercialName(
  commercialName: string | null,
  fields: Record<UsaEnrichmentField, UsaNormalizedProductField>,
) {
  const normalized = commercialName?.trim();
  if (!normalized) return null;
  const groundedAttributes = enrichmentFields
    .map((field) => fields[field].value)
    .filter((value): value is string => Boolean(value));
  const groundedTokens = new Set(groundedAttributes.flatMap(words));
  const nameTokens = words(normalized);
  return nameTokens.length > 0 && nameTokens.every((token) => groundedTokens.has(token))
    ? normalized
    : null;
}

function baseFields(
  product: UsaSourceProduct,
): Record<UsaEnrichmentField, UsaNormalizedProductField> {
  return {
    manufacturer: sourceField(product.sourceManufacturer),
    category: sourceField(product.category),
    family: emptyField(),
    model: sourceField(product.model),
    storage: sourceField(product.capacity),
    ram: emptyField(),
    chip: emptyField(),
    screen: emptyField(),
    color: sourceField(product.color),
    connectivity: emptyField(),
    condition: sourceField(product.condition),
    quantity: emptyField(),
    feature: emptyField(),
    connector: emptyField(),
    power: emptyField(),
    length: emptyField(),
  };
}

function sourceField(value: string | null | undefined): UsaNormalizedProductField {
  const normalized = value?.trim() || null;
  return {
    value: normalized,
    provenance: normalized ? 'SOURCE' : null,
    candidateStatus: null,
  };
}

function emptyField(): UsaNormalizedProductField {
  return { value: null, provenance: null, candidateStatus: null };
}

function identityFromFields(
  product: UsaSourceProduct,
  fields: Record<UsaEnrichmentField, UsaNormalizedProductField>,
) {
  return deriveExtendedProductIdentity({
    productName: product.sourceName,
    category: fields.category.value,
    model: fields.model.value,
    capacity: fields.storage.value,
    color: fields.color.value,
    quality: fields.condition.value,
    notes: [
      fields.ram.value,
      fields.chip.value,
      fields.screen.value,
      fields.connectivity.value,
      fields.quantity.value,
      fields.feature.value,
      fields.connector.value,
      fields.power.value,
      fields.length.value,
    ]
      .filter(Boolean)
      .join(' '),
  });
}

function validateCondition(value: string): CandidateValidation {
  const normalized = normalizeProductCondition(value);
  return normalized.status === 'RESOLVED'
    ? { status: 'VALIDATED', value: normalized.condition }
    : { status: 'INSUFFICIENT', value: null };
}

function mergeCandidateField(
  field: UsaEnrichmentField,
  current: UsaNormalizedProductField,
  validation: CandidateValidation,
): UsaNormalizedProductField {
  if (validation.status !== 'VALIDATED' || validation.value === null) {
    return { ...current, candidateStatus: validation.status };
  }
  if (current.value === null) {
    return {
      value: validation.value,
      provenance: 'LUNA_VALIDATED',
      candidateStatus: 'VALIDATED',
    };
  }
  if (sameMechanicalValue(field, current.value, validation.value)) {
    return { ...current, candidateStatus: 'VALIDATED' };
  }
  if (!explicitSourceConflictFields.has(field)) {
    return {
      value: validation.value,
      provenance: 'LUNA_VALIDATED',
      candidateStatus: 'VALIDATED',
    };
  }
  return { ...current, candidateStatus: 'CONFLICT' };
}

function sameMechanicalValue(field: UsaEnrichmentField, current: string, candidate: string) {
  if (field === 'condition') {
    const currentCondition = normalizeProductCondition(current);
    const candidateCondition = normalizeProductCondition(candidate);
    return (
      currentCondition.status === 'RESOLVED' &&
      candidateCondition.status === 'RESOLVED' &&
      currentCondition.condition === candidateCondition.condition
    );
  }
  return mechanicallyNormalize(current) === mechanicallyNormalize(candidate);
}

function candidateValueFor(
  field: UsaEnrichmentField,
  candidate: ProductSemanticNormalizationCandidate | null,
): string | null {
  if (!candidate) return null;
  if (field === 'feature') {
    return candidate.featureCandidates.length === 1 ? candidate.featureCandidates[0]! : null;
  }
  const values: Record<Exclude<UsaEnrichmentField, 'feature'>, string | null> = {
    manufacturer: candidate.manufacturerCandidate,
    category: candidate.categoryCandidate,
    family: candidate.familyCandidate,
    model: candidate.modelCandidate,
    storage: candidate.storageCandidate,
    ram: candidate.ramCandidate,
    chip: candidate.chipCandidate,
    screen: candidate.screenCandidate,
    color: candidate.colorCandidate,
    connectivity: candidate.connectivityCandidate,
    condition: candidate.conditionCandidate,
    quantity: candidate.quantityCandidate,
    connector: candidate.connectorCandidate,
    power: candidate.powerCandidate,
    length: candidate.lengthCandidate,
  };
  return values[field];
}

function candidateIsSourceGrounded(
  field: UsaEnrichmentField,
  value: string,
  product: UsaSourceProduct,
): boolean {
  const text = sourceGroundingText(product);
  if (field === 'condition') {
    const source = normalizeProductCondition(product.condition ?? text);
    const proposed = normalizeProductCondition(value);
    return (
      source.status === 'RESOLVED' &&
      proposed.status === 'RESOLVED' &&
      source.condition === proposed.condition
    );
  }

  const proposedTokens = words(value);
  const sourceTokens = words(text);
  if (proposedTokens.length === 0 || sourceTokens.length === 0) return false;
  if (proposedTokens.every((token) => sourceTokens.includes(token))) return true;

  const proposedNumbers = numericParts(value);
  const sourceNumbers = numericParts(text);
  if (
    proposedNumbers.length > 0 &&
    proposedNumbers.every((number) => sourceNumbers.includes(number)) &&
    abbreviationSignals(value).some((signal) => sourceAbbreviationTokens(text).includes(signal))
  ) {
    return true;
  }
  return false;
}

function sourceGroundingText(product: UsaSourceProduct) {
  return [
    sourceSemanticText(product),
    product.sourceManufacturer,
    product.category,
    product.model,
    product.capacity,
    product.color,
    product.condition,
  ]
    .filter(Boolean)
    .join(' ');
}

function words(value: string) {
  return mechanicallyNormalize(value).split(' ').filter(Boolean);
}

function numericParts(value: string): string[] {
  return mechanicallyCompact(value).match(/\d+/g) ?? [];
}

function abbreviationSignals(value: string) {
  const textTokens = words(value).filter((token) => /[a-z]/.test(token));
  const signals = new Set<string>();
  for (let start = 0; start < textTokens.length; start += 1) {
    for (let end = start + 2; end <= textTokens.length; end += 1) {
      signals.add(
        textTokens
          .slice(start, end)
          .map((token) => token[0])
          .join(''),
      );
    }
  }
  return [...signals].filter((signal) => signal.length >= 2);
}

function sourceAbbreviationTokens(value: string) {
  return words(value).flatMap((token) => token.match(/[a-z]+/g) ?? []);
}

function mechanicallyNormalize(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(\d)\s*(gb|tb|mm|cm)\b/g, '$1$2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function mechanicallyCompact(value: string) {
  return mechanicallyNormalize(value).replace(/\s+/g, '');
}
