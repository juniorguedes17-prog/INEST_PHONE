import { describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import type { ManufacturersService } from '../../manufacturers/service/manufacturers.service';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import { UsaEnrichmentInputDecisionService } from './usa-enrichment-input-decision.service';
import type {
  UsaEnrichmentField,
  UsaLunaEnrichmentValidatorService,
  UsaNormalizedProductContext,
} from './usa-luna-enrichment-validator.service';

const sourceProduct: UsaSourceProduct = {
  providerName: 'apple_us',
  sourceProductId: 'apple-us:macbook-air',
  sourceName: 'Apple MacBook Air 13 M5 16GB 512GB Midnight',
  displayName: 'Apple MacBook Air 13 M5 16GB 512GB Midnight',
  source: 'US',
  sourceUrl: 'https://example.test/macbook-air',
  supplier: 'Apple Store USA',
  sourceManufacturer: 'Apple',
  sourceManufacturerProvenance: 'EXPLICIT_SOURCE',
  retailer: 'Apple Store USA',
  category: 'MacBook',
  model: 'MacBook Air',
  capacity: '512GB',
  color: 'Midnight',
  condition: 'NOVO',
  priceUsd: 999,
};

const fields = [
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
] as const satisfies readonly UsaEnrichmentField[];

function context(
  overrides: Partial<UsaNormalizedProductContext> = {},
): UsaNormalizedProductContext {
  const baseFields = Object.fromEntries(
    fields.map((field) => [
      field,
      {
        value: null,
        provenance: null,
        candidateStatus: null,
      },
    ]),
  ) as UsaNormalizedProductContext['fields'];

  return {
    sourceProduct,
    fields: baseFields,
    candidateValues: {},
    candidateFields: [],
    validatedFields: [],
    insufficientFields: [],
    conflictFields: [],
    logisticClassification: {
      classification: 'OTHER',
      sources: ['PRODUCT_IDENTITY_FAMILY'],
    },
    semanticNormalizationStatus: 'CANDIDATE',
    lunaLatencyMs: null,
    lunaErrorCode: null,
    ...overrides,
    commercialName: overrides.commercialName ?? null,
  };
}

function createService(
  contexts: UsaNormalizedProductContext[],
  confirm = vi.fn().mockResolvedValue({ status: 'FOUND' }),
) {
  const validator = {
    enrich: vi.fn().mockImplementation(async () => contexts.shift() ?? context()),
  };
  const manufacturers = { confirm };
  return {
    service: new UsaEnrichmentInputDecisionService(
      validator as unknown as UsaLunaEnrichmentValidatorService,
      manufacturers as unknown as ManufacturersService,
    ),
    validator,
    manufacturers,
  };
}

describe('UsaEnrichmentInputDecisionService', () => {
  it('emits the temporary decision trace without changing the decision', async () => {
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    const { service } = createService([context({ semanticNormalizationStatus: 'TIMEOUT' })]);

    const result = await service.resolve(sourceProduct);

    expect(result.decision).toMatchObject({ status: 'BLOCKED', reason: 'NORMALIZATION_TIMEOUT' });
    expect(debug).toHaveBeenCalledWith({
      event: 'USA_PRICING_TRACE_DECISION',
      provider: 'apple_us',
      sourceProductId: 'apple-us:macbook-air',
      decisionStatus: 'BLOCKED',
      decisionReason: 'NORMALIZATION_TIMEOUT',
      semanticNormalizationStatus: 'TIMEOUT',
      conflictFields: [],
      missingFields: [],
    });
    debug.mockRestore();
  });

  it('returns READY when the current context is sufficient', async () => {
    const manufacturer = { value: 'Apple', provenance: 'SOURCE' as const, candidateStatus: null };
    const result = await createService([
      context({ fields: { ...context().fields, manufacturer } }),
    ]).service.resolve(sourceProduct);

    expect(result.decision).toMatchObject({ status: 'READY', reason: null });
  });

  it('returns NEEDS_INPUT for a missing manufacturer with a Luna candidate', () => {
    const missingManufacturer = {
      value: null,
      provenance: null,
      candidateStatus: 'INSUFFICIENT' as const,
    };
    const result = createService([]).service.decide(
      context({
        fields: { ...context().fields, manufacturer: missingManufacturer },
        candidateValues: { manufacturer: 'Garmin' },
      }),
    );

    expect(result).toMatchObject({
      status: 'NEEDS_INPUT',
      reason: 'MANUFACTURER_MISSING',
      input: { type: 'MANUFACTURER', suggestedValue: 'Garmin' },
    });
  });

  it('persists manufacturer through M5 and reprocesses only the current item', async () => {
    const before = context({
      fields: {
        ...context().fields,
        manufacturer: { value: null, provenance: null, candidateStatus: 'INSUFFICIENT' },
      },
      candidateValues: { manufacturer: 'Garmin' },
    });
    const after = context({
      sourceProduct: { ...sourceProduct, sourceManufacturer: 'Garmin' },
      fields: {
        ...context().fields,
        manufacturer: { value: 'Garmin', provenance: 'SOURCE', candidateStatus: null },
      },
    });
    const { service, validator, manufacturers } = createService([before, after]);

    const result = await service.confirmManufacturer(
      { ...sourceProduct, sourceManufacturer: null, sourceManufacturerProvenance: null },
      { canonicalName: 'Garmin' },
      { id: 'user-1' } as never,
    );

    expect(manufacturers.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalName: 'Garmin',
        alias: 'Garmin',
        userId: 'user-1',
        context: expect.objectContaining({
          origin: 'US',
          sourceProductId: sourceProduct.sourceProductId,
          inputType: 'MANUFACTURER',
        }),
      }),
    );
    expect(validator.enrich).toHaveBeenCalledTimes(2);
    expect(validator.enrich).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceManufacturer: 'Garmin' }),
    );
    expect(result.reprocessed).toBe(true);
    expect(result.persistence).toBe('MANUFACTURER');
  });

  it('reuses a resolved manufacturer without asking again', async () => {
    const manufacturer = { value: 'Garmin', provenance: 'SOURCE' as const, candidateStatus: null };
    const { service, manufacturers } = createService([
      context({
        sourceProduct: { ...sourceProduct, sourceManufacturer: 'Garmin' },
        fields: { ...context().fields, manufacturer },
      }),
    ]);

    const result = await service.resolve({ ...sourceProduct, sourceManufacturer: 'Garmin' });

    expect(result.decision.status).toBe('READY');
    expect(manufacturers.confirm).not.toHaveBeenCalled();
  });

  it('blocks an ambiguous manufacturer instead of selecting the first match', () => {
    const result = createService([]).service.decide(
      context({
        fields: {
          ...context().fields,
          manufacturer: { value: null, provenance: null, candidateStatus: 'CONFLICT' },
        },
        candidateValues: { manufacturer: 'Orbit' },
      }),
    );

    expect(result).toMatchObject({ status: 'BLOCKED', reason: 'MANUFACTURER_AMBIGUOUS' });
  });

  it.each([
    ['TIMEOUT', 'NORMALIZATION_TIMEOUT'],
    ['MODEL_ERROR', 'NORMALIZATION_MODEL_ERROR'],
    ['INVALID_STRUCTURED_OUTPUT', 'NORMALIZATION_INVALID_OUTPUT'],
  ] as const)(
    'fails closed with a precise reason for semantic normalization status %s',
    (status, reason) => {
      const result = createService([]).service.decide(
        context({
          semanticNormalizationStatus: status,
          fields: {
            ...context().fields,
            manufacturer: { value: 'Apple', provenance: 'SOURCE', candidateStatus: null },
            model: { value: 'iPhone 17 Pro', provenance: 'SOURCE', candidateStatus: null },
          },
        }),
      );

      expect(result).toMatchObject({ status: 'BLOCKED', reason });
    },
  );

  it.each(['SKIPPED_DISABLED', 'BUDGET_EXHAUSTED'] as const)(
    'preserves the existing fail-closed reason for semantic normalization status %s',
    (status) => {
      const result = createService([]).service.decide(
        context({
          semanticNormalizationStatus: status,
          fields: {
            ...context().fields,
            manufacturer: { value: 'Apple', provenance: 'SOURCE', candidateStatus: null },
            model: { value: 'iPhone 17 Pro', provenance: 'SOURCE', candidateStatus: null },
          },
        }),
      );

      expect(result).toMatchObject({ status: 'BLOCKED', reason: 'ENRICHMENT_CONFLICT' });
    },
  );

  it('keeps F1 source fields intact while TIMEOUT remains blocked', async () => {
    const timeoutContext = context({
      semanticNormalizationStatus: 'TIMEOUT',
      fields: {
        ...context().fields,
        manufacturer: { value: 'Apple', provenance: 'SOURCE', candidateStatus: null },
        category: { value: 'iPhone', provenance: 'SOURCE', candidateStatus: null },
        model: { value: 'iPhone 17', provenance: 'SOURCE', candidateStatus: null },
        storage: { value: '256GB', provenance: 'SOURCE', candidateStatus: null },
        color: { value: 'Mist Blue', provenance: 'SOURCE', candidateStatus: null },
        condition: { value: 'NOVO', provenance: 'SOURCE', candidateStatus: null },
      },
    });
    const result = await createService([timeoutContext]).service.resolve(sourceProduct);

    expect(result.decision).toMatchObject({ status: 'BLOCKED', reason: 'NORMALIZATION_TIMEOUT' });
    expect(result.context.fields).toMatchObject({
      manufacturer: { value: 'Apple', provenance: 'SOURCE' },
      category: { value: 'iPhone', provenance: 'SOURCE' },
      model: { value: 'iPhone 17', provenance: 'SOURCE' },
      storage: { value: '256GB', provenance: 'SOURCE' },
      color: { value: 'Mist Blue', provenance: 'SOURCE' },
      condition: { value: 'NOVO', provenance: 'SOURCE' },
    });
  });

  it('does not ask about a source-authoritative condition conflict', () => {
    const result = createService([]).service.decide(
      context({
        fields: {
          ...context().fields,
          manufacturer: { value: 'Apple', provenance: 'SOURCE', candidateStatus: null },
          condition: { value: 'NOVO', provenance: 'SOURCE', candidateStatus: 'CONFLICT' },
        },
        conflictFields: ['condition'],
      }),
    );

    expect(result.status).toBe('READY');
  });

  it('blocks a non-source conflict', () => {
    const result = createService([]).service.decide(
      context({
        fields: {
          ...context().fields,
          manufacturer: { value: 'Apple', provenance: 'SOURCE', candidateStatus: null },
          model: { value: null, provenance: null, candidateStatus: 'CONFLICT' },
        },
        conflictFields: ['model'],
      }),
    );

    expect(result).toMatchObject({ status: 'BLOCKED', reason: 'ENRICHMENT_CONFLICT' });
  });

  it('fails closed for an ungrounded runtime attribute without creating persistence', () => {
    const { service, manufacturers } = createService([]);
    const result = service.decide(
      context({
        fields: {
          ...context().fields,
          manufacturer: { value: 'Apple', provenance: 'SOURCE', candidateStatus: null },
          model: { value: null, provenance: null, candidateStatus: 'INSUFFICIENT' },
        },
        insufficientFields: ['model'],
      }),
    );

    expect(result).toMatchObject({
      status: 'BLOCKED',
      reason: 'ENRICHMENT_CONFLICT',
      fields: ['model'],
    });
    expect(manufacturers.confirm).not.toHaveBeenCalled();
  });

  it('blocks missing retailer instead of turning it into human input', () => {
    const result = createService([]).service.decide(
      context({
        sourceProduct: { ...sourceProduct, retailer: null },
        fields: {
          ...context().fields,
          manufacturer: { value: 'Apple', provenance: 'SOURCE', candidateStatus: null },
        },
      }),
    );

    expect(result).toMatchObject({ status: 'BLOCKED', reason: 'RETAILER_UNRESOLVED' });
    expect(result.status).not.toBe('NEEDS_INPUT');
  });

  it('blocks unresolved logistics and does not handle MISSING_WEIGHT', () => {
    const result = createService([]).service.decide(
      context({
        fields: {
          ...context().fields,
          manufacturer: { value: 'Apple', provenance: 'SOURCE', candidateStatus: null },
        },
        logisticClassification: {
          classification: 'UNRESOLVED',
          reason: 'INSUFFICIENT_EVIDENCE',
          sources: [],
        },
      }),
    );

    expect(result).toMatchObject({
      status: 'BLOCKED',
      reason: 'LOGISTIC_CLASSIFICATION_UNRESOLVED',
    });
  });
});
