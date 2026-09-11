import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { ManufacturersService } from '../../manufacturers/service/manufacturers.service';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import {
  UsaLunaEnrichmentValidatorService,
  type UsaEnrichmentField,
  type UsaNormalizedProductContext,
} from './usa-luna-enrichment-validator.service';

export type UsaEnrichmentDecisionStatus = 'READY' | 'NEEDS_INPUT' | 'BLOCKED';
export type UsaEnrichmentInputType = 'MANUFACTURER';

export type UsaEnrichmentDecisionReason =
  | 'SOURCE_CONFIGURATION_REQUIRED'
  | 'MANUFACTURER_MISSING'
  | 'MANUFACTURER_AMBIGUOUS'
  | 'NORMALIZATION_TIMEOUT'
  | 'NORMALIZATION_MODEL_ERROR'
  | 'NORMALIZATION_INVALID_OUTPUT'
  | 'ENRICHMENT_CONFLICT'
  | 'LOGISTIC_CLASSIFICATION_UNRESOLVED'
  | 'RETAILER_UNRESOLVED';

type UsaNormalizationFailureReason =
  'NORMALIZATION_TIMEOUT' | 'NORMALIZATION_MODEL_ERROR' | 'NORMALIZATION_INVALID_OUTPUT';

export interface UsaEnrichmentDecisionContext {
  provider: string;
  sourceProductId: string;
  source: 'US';
}

export type UsaEnrichmentDecision =
  | {
      status: 'READY';
      reason: null;
      context: UsaEnrichmentDecisionContext;
    }
  | {
      status: 'NEEDS_INPUT';
      reason: 'MANUFACTURER_MISSING';
      input: {
        type: 'MANUFACTURER';
        field: 'manufacturer';
        suggestedValue: string;
      };
      context: UsaEnrichmentDecisionContext;
    }
  | {
      status: 'BLOCKED';
      reason: Exclude<UsaEnrichmentDecisionReason, 'MANUFACTURER_MISSING'>;
      fields?: UsaEnrichmentField[];
      context: UsaEnrichmentDecisionContext;
    };

export interface UsaManufacturerConfirmation {
  canonicalName: string;
  alias?: string | null;
}

/**
 * Converts only actionable USA enrichment gaps into decisions. It delegates
 * manufacturer persistence to the existing M5 authority and keeps all other
 * confirmations runtime-only or blocked until a dedicated authority exists.
 */
@Injectable()
export class UsaEnrichmentInputDecisionService {
  constructor(
    @Inject(UsaLunaEnrichmentValidatorService)
    private readonly validator: UsaLunaEnrichmentValidatorService,
    @Inject(ManufacturersService)
    private readonly manufacturers: ManufacturersService,
  ) {}

  async resolve(product: UsaSourceProduct) {
    assertUsaSourceProduct(product);
    const context = await this.validator.enrich(product);
    return { decision: this.decide(context), context };
  }

  decide(context: UsaNormalizedProductContext): UsaEnrichmentDecision {
    const decisionContext = toDecisionContext(context);
    if (context.sourceProduct.offerKind === 'FAMILY_STARTING_AT') {
      return {
        status: 'BLOCKED',
        reason: 'SOURCE_CONFIGURATION_REQUIRED',
        context: decisionContext,
      };
    }
    if (context.semanticNormalizationStatus !== 'CANDIDATE') {
      return {
        status: 'BLOCKED',
        reason:
          normalizationFailureReason(context.semanticNormalizationStatus) ?? 'ENRICHMENT_CONFLICT',
        context: decisionContext,
      };
    }
    const manufacturer = context.fields.manufacturer;
    const candidateManufacturer = context.candidateValues.manufacturer;

    if (manufacturer.value) {
      return this.finishOrBlock(context, decisionContext);
    }

    if (manufacturer.candidateStatus === 'CONFLICT') {
      return {
        status: 'BLOCKED',
        reason: 'MANUFACTURER_AMBIGUOUS',
        fields: ['manufacturer'],
        context: decisionContext,
      };
    }

    if (manufacturer.candidateStatus === 'INSUFFICIENT' && candidateManufacturer) {
      return {
        status: 'NEEDS_INPUT',
        reason: 'MANUFACTURER_MISSING',
        input: {
          type: 'MANUFACTURER',
          field: 'manufacturer',
          suggestedValue: candidateManufacturer,
        },
        context: decisionContext,
      };
    }

    return this.finishOrBlock(context, decisionContext);
  }

  async confirmManufacturer(
    product: UsaSourceProduct,
    confirmation: UsaManufacturerConfirmation,
    user: AuthenticatedUser,
  ) {
    assertUsaSourceProduct(product);
    const before = await this.validator.enrich(product);
    const beforeDecision = this.decide(before);
    if (beforeDecision.status !== 'NEEDS_INPUT' || beforeDecision.input.type !== 'MANUFACTURER') {
      throw new BadRequestException('Este item nao esta aguardando confirmacao de fabricante.');
    }

    const canonicalName = confirmation.canonicalName?.trim();
    if (!canonicalName) {
      throw new BadRequestException('Fabricante canonico e obrigatorio.');
    }

    await this.manufacturers.confirm({
      canonicalName,
      alias: confirmation.alias?.trim() || beforeDecision.input.suggestedValue,
      userId: user.id,
      context: {
        origin: product.source,
        provider: product.providerName,
        sourceProductId: product.sourceProductId,
        sourceName: product.sourceName,
        sourceManufacturer: product.sourceManufacturer,
        inputType: 'MANUFACTURER',
      },
    });

    const reprocessedProduct: UsaSourceProduct = {
      ...product,
      sourceManufacturer: canonicalName,
      sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
    };
    const context = await this.validator.enrich(reprocessedProduct);
    return {
      reprocessed: true as const,
      persistence: 'MANUFACTURER' as const,
      decision: this.decide(context),
      context,
    };
  }

  private finishOrBlock(
    context: UsaNormalizedProductContext,
    decisionContext: UsaEnrichmentDecisionContext,
  ): UsaEnrichmentDecision {
    const nonSourceConflicts = context.conflictFields.filter(
      (field) => context.fields[field].provenance !== 'SOURCE',
    );
    if (nonSourceConflicts.length > 0) {
      return {
        status: 'BLOCKED',
        reason: 'ENRICHMENT_CONFLICT',
        fields: nonSourceConflicts,
        context: decisionContext,
      };
    }

    const ungroundedFields = context.insufficientFields.filter((field) => field !== 'manufacturer');
    if (ungroundedFields.length > 0) {
      return {
        status: 'BLOCKED',
        reason: 'ENRICHMENT_CONFLICT',
        fields: ungroundedFields,
        context: decisionContext,
      };
    }

    if (context.logisticClassification.classification === 'UNRESOLVED') {
      return {
        status: 'BLOCKED',
        reason: 'LOGISTIC_CLASSIFICATION_UNRESOLVED',
        context: decisionContext,
      };
    }

    if (!context.sourceProduct.retailer?.trim()) {
      return {
        status: 'BLOCKED',
        reason: 'RETAILER_UNRESOLVED',
        context: decisionContext,
      };
    }

    return { status: 'READY', reason: null, context: decisionContext };
  }
}

function normalizationFailureReason(
  status: UsaNormalizedProductContext['semanticNormalizationStatus'],
): UsaNormalizationFailureReason | null {
  switch (status) {
    case 'TIMEOUT':
      return 'NORMALIZATION_TIMEOUT';
    case 'MODEL_ERROR':
      return 'NORMALIZATION_MODEL_ERROR';
    case 'INVALID_STRUCTURED_OUTPUT':
      return 'NORMALIZATION_INVALID_OUTPUT';
    default:
      return null;
  }
}

function toDecisionContext(context: UsaNormalizedProductContext): UsaEnrichmentDecisionContext {
  return {
    provider: context.sourceProduct.providerName,
    sourceProductId: context.sourceProduct.sourceProductId,
    source: 'US',
  };
}

function assertUsaSourceProduct(product: UsaSourceProduct) {
  if (
    product.source !== 'US' ||
    !product.providerName.trim() ||
    !product.sourceProductId.trim() ||
    !product.sourceName.trim() ||
    !Number.isFinite(product.priceUsd) ||
    product.priceUsd <= 0
  ) {
    throw new BadRequestException('Source Product USA invalido para decisao de enriquecimento.');
  }
}
