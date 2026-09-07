import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  deriveExtendedProductIdentity,
  normalizeCanonicalText,
  type ExtendedProductIdentity,
} from '@inest/product-identity';
import { isReservedAppleManufacturerAlias } from '../../manufacturers/manufacturer-alias-normalizer';
import { ManufacturersService } from '../../manufacturers/service/manufacturers.service';
import { normalizeProductCondition } from '../condition-normalizer';
import { resolveLogisticProductClassification } from '../logistic-product-classification';
import type { UsaProductEnrichmentCandidate } from '../../evolution-webhook/product-normalization.service';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import { sourceSemanticText } from '../usa-source-evidence';
import { UsaLunaEnrichmentShadowService } from './usa-luna-enrichment-shadow.service';

export type UsaCandidateValidationStatus = 'VALIDATED' | 'INSUFFICIENT' | 'CONFLICT';
export type UsaEnrichmentProvenance = 'SOURCE' | 'DETERMINISTIC' | 'LUNA_VALIDATED';

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

export interface UsaNormalizedProductField {
  value: string | null;
  provenance: UsaEnrichmentProvenance | null;
  candidateStatus: UsaCandidateValidationStatus | null;
}

export interface UsaNormalizedProductContext {
  sourceProduct: UsaSourceProduct;
  fields: Record<UsaEnrichmentField, UsaNormalizedProductField>;
  /** Runtime-only candidate values; never an authority or persisted memory. */
  candidateValues: Partial<Record<UsaEnrichmentField, string>>;
  candidateFields: UsaEnrichmentField[];
  validatedFields: UsaEnrichmentField[];
  insufficientFields: UsaEnrichmentField[];
  conflictFields: UsaEnrichmentField[];
  logisticClassification: ReturnType<typeof resolveLogisticProductClassification>;
  lunaLatencyMs: number | null;
  lunaErrorCode: string | null;
}

type CandidateValidation = {
  status: UsaCandidateValidationStatus;
  value: string | null;
};

/**
 * The operational USA bridge. Luna values pass through existing deterministic
 * authorities before becoming runtime-only context; source fields always win.
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
    const candidate = observation?.result?.candidate ?? null;
    const sourceIdentity = identityFromSource(product);
    const candidateIdentity = candidate ? identityFromCandidate(candidate) : null;
    const fields = baseFields(product, sourceIdentity);
    const candidateValidations = await this.validateCandidates(candidate, candidateIdentity);

    for (const field of enrichmentFields) {
      const candidateValue = candidateValueFor(field, candidate);
      if (candidateValue === null) continue;
      const validation = candidateValidations[field];
      fields[field] = mergeCandidateField(
        field,
        fields[field],
        candidateValue,
        validation,
        product,
        sourceIdentity,
        candidateIdentity,
      );
      if (
        fields[field].candidateStatus !== 'CONFLICT' &&
        !candidateIsSourceAnchored(field, candidateValue, product, sourceIdentity)
      ) {
        fields[field] = {
          ...baseFields(product, sourceIdentity)[field],
          candidateStatus: 'INSUFFICIENT',
        };
      }
    }

    const enrichedIdentity = identityFromFields(product, fields);
    const logisticClassification = resolveLogisticProductClassification({
      productIdentity: enrichedIdentity,
      canonicalCategory: fields.category.value,
    });
    const context: UsaNormalizedProductContext = {
      sourceProduct: product,
      fields,
      candidateValues: Object.fromEntries(
        enrichmentFields
          .map((field) => [field, candidateValueFor(field, candidate)])
          .filter((entry): entry is [UsaEnrichmentField, string] => entry[1] !== null)
          .filter(([field, value]) =>
            candidateIsSourceAnchored(field, value, product, sourceIdentity),
          ),
      ),
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
      lunaLatencyMs: observation?.result?.latencyMs ?? null,
      lunaErrorCode: observation?.result?.errorCode ?? null,
    };
    this.log(context);
    return context;
  }

  private async validateCandidates(
    candidate: UsaProductEnrichmentCandidate | null,
    identity: ExtendedProductIdentity | null,
  ): Promise<Record<UsaEnrichmentField, CandidateValidation>> {
    const result = Object.fromEntries(
      enrichmentFields.map((field) => [field, { status: 'INSUFFICIENT', value: null }]),
    ) as Record<UsaEnrichmentField, CandidateValidation>;
    if (!candidate || !identity) return result;

    result.manufacturer = await this.validateManufacturer(candidate.manufacturerCandidate);
    result.condition = validateCondition(candidate.conditionCandidate);
    for (const field of enrichmentFields.filter(
      (field) => field !== 'manufacturer' && field !== 'condition',
    )) {
      result[field] = validateIdentityField(field, candidateValueFor(field, candidate), identity);
    }
    return result;
  }

  private async validateManufacturer(value: string | null): Promise<CandidateValidation> {
    if (!value) return { status: 'INSUFFICIENT', value: null };
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
      event: 'import_radar.usa_luna_enrichment.validation',
      source: 'US',
      provider: context.sourceProduct.providerName,
      sourceProductId: context.sourceProduct.sourceProductId,
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

function baseFields(
  product: UsaSourceProduct,
  identity: ExtendedProductIdentity,
): Record<UsaEnrichmentField, UsaNormalizedProductField> {
  const attributes = identity.variant.attributes;
  return {
    manufacturer: sourceField(product.sourceManufacturer),
    category: sourceField(product.category),
    family: deterministicField(
      identity.variant.family === 'unknown' ? null : identity.variant.family,
    ),
    model: product.model
      ? sourceField(product.model)
      : deterministicField(
          identity.canonical.canonicalModelMatched ? identity.canonical.canonicalModelLabel : null,
        ),
    storage: product.capacity
      ? sourceField(product.capacity)
      : deterministicField(identity.canonical.canonicalStorage),
    ram: deterministicField(identity.canonical.canonicalRam),
    chip: deterministicField(identity.canonical.canonicalChip),
    screen: deterministicField(identity.canonical.canonicalScreen),
    color: product.color
      ? sourceField(product.color)
      : deterministicField(identity.canonical.canonicalColor),
    connectivity: deterministicField(identity.canonical.canonicalConnectivity),
    condition: product.condition
      ? sourceField(product.condition)
      : deterministicField(identity.canonical.canonicalCondition),
    quantity: deterministicField(attributes.quantity ?? null),
    feature: deterministicField(attributes.feature ?? null),
    connector: deterministicField(attributes.connector ?? null),
    power: deterministicField(attributes.power ?? null),
    length: deterministicField(attributes.length ?? null),
  };
}

function sourceField(value: string | null | undefined): UsaNormalizedProductField {
  return {
    value: value?.trim() || null,
    provenance: value?.trim() ? 'SOURCE' : null,
    candidateStatus: null,
  };
}

function deterministicField(value: string | null | undefined): UsaNormalizedProductField {
  return {
    value: value?.trim() || null,
    provenance: value?.trim() ? 'DETERMINISTIC' : null,
    candidateStatus: null,
  };
}

function identityFromSource(product: UsaSourceProduct) {
  return deriveExtendedProductIdentity({
    productName: sourceSemanticText(product),
    category: product.category,
    model: product.model,
    capacity: product.capacity,
    color: product.color,
    quality: product.condition,
  });
}

function identityFromCandidate(candidate: UsaProductEnrichmentCandidate) {
  return deriveExtendedProductIdentity({
    productName:
      candidate.modelCandidate ?? candidate.familyCandidate ?? candidate.categoryCandidate ?? '',
    category: candidate.categoryCandidate,
    model: candidate.modelCandidate,
    capacity: candidate.storageCandidate,
    color: candidate.colorCandidate,
    quality: candidate.conditionCandidate,
    notes: [
      candidate.ramCandidate,
      candidate.chipCandidate,
      candidate.screenCandidate,
      candidate.connectivityCandidate,
      candidate.quantityCandidate,
      ...candidate.featureCandidates,
      candidate.connectorCandidate,
      candidate.powerCandidate,
      candidate.lengthCandidate,
    ]
      .filter(Boolean)
      .join(' '),
  });
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

function validateCondition(value: string | null): CandidateValidation {
  if (!value) return { status: 'INSUFFICIENT', value: null };
  const normalized = normalizeProductCondition(value);
  return normalized.status === 'RESOLVED'
    ? { status: 'VALIDATED', value: normalized.condition }
    : { status: 'INSUFFICIENT', value: null };
}

function validateIdentityField(
  field: Exclude<UsaEnrichmentField, 'manufacturer' | 'condition'>,
  candidateValue: string | null,
  identity: ExtendedProductIdentity,
): CandidateValidation {
  if (!candidateValue) return { status: 'INSUFFICIENT', value: null };
  const value = identityValue(field, identity);
  if (!value) return { status: 'INSUFFICIENT', value: null };
  if (field === 'family' && normalizeCanonicalText(candidateValue) !== value) {
    return { status: 'INSUFFICIENT', value: null };
  }
  return { status: 'VALIDATED', value };
}

function mergeCandidateField(
  field: UsaEnrichmentField,
  current: UsaNormalizedProductField,
  candidateValue: string,
  validation: CandidateValidation,
  product: UsaSourceProduct,
  sourceIdentity: ExtendedProductIdentity,
  candidateIdentity: ExtendedProductIdentity | null,
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
  if (
    sameFieldValue(
      field,
      current.value,
      validation.value,
      product,
      sourceIdentity,
      candidateIdentity,
    )
  ) {
    return { ...current, candidateStatus: 'VALIDATED' };
  }
  return { ...current, candidateStatus: 'CONFLICT' };
}

function sameFieldValue(
  field: UsaEnrichmentField,
  current: string,
  candidate: string,
  product: UsaSourceProduct,
  sourceIdentity: ExtendedProductIdentity,
  candidateIdentity: ExtendedProductIdentity | null,
) {
  if (!candidateIdentity) return false;
  if (field === 'model') {
    return Boolean(
      sourceIdentity.canonical.canonicalModelMatched &&
      sourceIdentity.canonical.canonicalModelKey === candidateIdentity.canonical.canonicalModelKey,
    );
  }
  if (field === 'color') {
    return sourceIdentity.canonical.canonicalColor === candidateIdentity.canonical.canonicalColor;
  }
  if (field === 'storage') {
    return (
      sourceIdentity.canonical.canonicalStorage === candidateIdentity.canonical.canonicalStorage
    );
  }
  if (field === 'condition') {
    const currentCondition = normalizeProductCondition(current);
    const candidateCondition = normalizeProductCondition(candidate);
    return (
      currentCondition.status === 'RESOLVED' &&
      candidateCondition.status === 'RESOLVED' &&
      currentCondition.condition === candidateCondition.condition
    );
  }
  return normalizeCanonicalText(current) === normalizeCanonicalText(candidate);
}

function identityValue(
  field: Exclude<UsaEnrichmentField, 'manufacturer' | 'condition'>,
  identity: ExtendedProductIdentity,
) {
  const attributes = identity.variant.attributes;
  switch (field) {
    case 'category':
      return identity.canonical.canonicalCategory || null;
    case 'family':
      return identity.variant.family === 'unknown' ? null : identity.variant.family;
    case 'model':
      return identity.canonical.canonicalModelMatched
        ? identity.canonical.canonicalModelLabel
        : null;
    case 'storage':
      return identity.canonical.canonicalStorage;
    case 'ram':
      return identity.canonical.canonicalRam;
    case 'chip':
      return identity.canonical.canonicalChip;
    case 'screen':
      return identity.canonical.canonicalScreen;
    case 'color':
      return identity.canonical.canonicalColor;
    case 'connectivity':
      return identity.canonical.canonicalConnectivity;
    case 'quantity':
      return attributes.quantity ?? null;
    case 'feature':
      return attributes.feature ?? null;
    case 'connector':
      return attributes.connector ?? null;
    case 'power':
      return attributes.power ?? null;
    case 'length':
      return attributes.length ?? null;
  }
}

function candidateValueFor(
  field: UsaEnrichmentField,
  candidate: UsaProductEnrichmentCandidate | null,
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

function candidateIsSourceAnchored(
  field: UsaEnrichmentField,
  value: string,
  product: UsaSourceProduct,
  sourceIdentity: ExtendedProductIdentity,
): boolean {
  if (field === 'quantity') return false;
  const text = [
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
  if (field === 'condition') {
    const source = normalizeProductCondition(product.condition ?? text);
    const proposed = normalizeProductCondition(value);
    return (
      source.status === 'RESOLVED' &&
      proposed.status === 'RESOLVED' &&
      source.condition === proposed.condition
    );
  }
  if (field !== 'manufacturer') {
    const sourceValue = identityValue(field, sourceIdentity);
    if (sourceValue && normalizeCanonicalText(sourceValue) === normalizeCanonicalText(value))
      return true;
  }
  const normalized = normalizeCanonicalText(text);
  const proposed = normalizeCanonicalText(value);
  return Boolean(proposed && ` ${normalized} `.includes(` ${proposed} `));
}
