import { Inject, Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/service/settings.service';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import {
  resolveUsaRetailerTaxTreatment,
  type UsaTaxTreatment,
} from '../usa-retailer-tax-treatment';
import type { UsaRedirectorSelection } from '../usa-cost.contract';
import type {
  ShippingWeightComposition,
  ShippingWeightResolution,
} from '../shipping-weights/shipping-weight.contract';
import { ResolveShippingWeightDto } from '../shipping-weights/shipping-weight-registration.dto';
import { ShippingWeightRegistrationService } from '../shipping-weights/shipping-weight-registration.service';
import {
  UsaEnrichmentInputDecisionService,
  type UsaEnrichmentDecision,
} from './usa-enrichment-input-decision.service';

export type UsaCostPreflightStatus = 'READY_FOR_COST' | 'NEEDS_INPUT' | 'BLOCKED';

export type UsaCostPreflightReason =
  | 'SOURCE_PRODUCT_INVALID'
  | 'MANUFACTURER_MISSING'
  | 'ENRICHMENT_CONFLICT'
  | 'RETAILER_UNRESOLVED'
  | 'LOGISTIC_CLASSIFICATION_UNRESOLVED'
  | 'USD_BRL_QUOTE_NOT_CONFIGURED'
  | 'REDIRECTOR_UNSUPPORTED'
  | 'SHIPPING_MODE_UNSUPPORTED'
  | 'QUANTITY_UNRESOLVED'
  | 'MISSING_WEIGHT'
  | 'KEY_INSUFFICIENT'
  | 'KEY_AMBIGUOUS'
  | 'SETTINGS_UNAVAILABLE';

export type UsaCostPreflightResult =
  | {
      status: 'READY_FOR_COST';
      redirector: UsaRedirectorSelection;
      taxTreatment: Exclude<UsaTaxTreatment, 'UNRESOLVED'>;
      logisticClassification: 'CELULAR' | 'OTHER' | null;
      shippingWeightLbs: number | null;
    }
  | {
      status: 'NEEDS_INPUT';
      reason: 'MANUFACTURER_MISSING' | 'MISSING_WEIGHT';
      input: {
        type: 'MANUFACTURER' | 'WEIGHT';
        field: 'manufacturer' | 'shippingWeightLbs';
        suggestedValue?: string;
      };
      redirector: UsaRedirectorSelection;
    }
  | {
      status: 'BLOCKED';
      reason: Exclude<UsaCostPreflightReason, 'MANUFACTURER_MISSING' | 'MISSING_WEIGHT'>;
      redirector: UsaRedirectorSelection | null;
    };

@Injectable()
export class UsaCostPreflightService {
  constructor(
    @Inject(UsaEnrichmentInputDecisionService)
    private readonly enrichmentDecisions: UsaEnrichmentInputDecisionService,
    @Inject(ShippingWeightRegistrationService)
    private readonly shippingWeights: ShippingWeightRegistrationService,
    @Inject(SettingsService)
    private readonly settings: SettingsService,
  ) {}

  async preflight(input: {
    sourceProduct: UsaSourceProduct;
    redirector: UsaRedirectorSelection;
    composition: ShippingWeightComposition;
  }): Promise<UsaCostPreflightResult> {
    if (!isValidSourceProduct(input.sourceProduct)) {
      return { status: 'BLOCKED', reason: 'SOURCE_PRODUCT_INVALID', redirector: null };
    }
    if (!isSupportedRedirector(input.redirector)) {
      return { status: 'BLOCKED', reason: 'REDIRECTOR_UNSUPPORTED', redirector: null };
    }

    const semantic = await this.enrichmentDecisions.resolve(input.sourceProduct);
    const semanticGate = this.consumeSemanticDecision(semantic.decision, input.redirector);
    if (semanticGate) return semanticGate;

    const settings = await this.settings.getSettings();
    const usaImport = settings.usaImport;
    const quote = usaImport?.usdBrlQuote;
    if (!usaImport) {
      return { status: 'BLOCKED', reason: 'SETTINGS_UNAVAILABLE', redirector: input.redirector };
    }
    if (typeof quote !== 'number' || !Number.isFinite(quote) || quote <= 0) {
      return {
        status: 'BLOCKED',
        reason: 'USD_BRL_QUOTE_NOT_CONFIGURED',
        redirector: input.redirector,
      };
    }

    const taxTreatment = resolveUsaRetailerTaxTreatment({
      redirector: input.redirector.redirector,
      retailerEvidence: input.sourceProduct.retailer
        ? [
            {
              retailer: input.sourceProduct.retailer,
              provenance: 'SOURCE_STORE',
              isTrustedRetailer: true,
            },
          ]
        : [],
    });
    if (taxTreatment.taxTreatment === 'UNRESOLVED') {
      return {
        status: 'BLOCKED',
        reason: 'RETAILER_UNRESOLVED',
        redirector: input.redirector,
      };
    }

    const semanticContext = semantic.context;
    const logisticClassification = semanticContext.logisticClassification.classification;
    if (
      input.redirector.redirector === 'REI_DO_IMPORTADO' &&
      logisticClassification === 'UNRESOLVED'
    ) {
      return {
        status: 'BLOCKED',
        reason: 'LOGISTIC_CLASSIFICATION_UNRESOLVED',
        redirector: input.redirector,
      };
    }

    if (input.redirector.redirector === 'REI_DO_IMPORTADO') {
      const settingsReason = validateReiSettings(settings.usaImport.reiDoImportado);
      if (settingsReason) {
        return { status: 'BLOCKED', reason: settingsReason, redirector: input.redirector };
      }
      if (logisticClassification === 'CELULAR') {
        if (!isPositiveInteger(semanticContext.fields.quantity.value)) {
          return {
            status: 'BLOCKED',
            reason: 'QUANTITY_UNRESOLVED',
            redirector: input.redirector,
          };
        }
        return {
          status: 'READY_FOR_COST',
          redirector: input.redirector,
          taxTreatment: taxTreatment.taxTreatment,
          logisticClassification,
          shippingWeightLbs: null,
        };
      }
    } else {
      if (input.redirector.shippingMode !== 'EXPRESS') {
        return {
          status: 'BLOCKED',
          reason: 'SHIPPING_MODE_UNSUPPORTED',
          redirector: input.redirector,
        };
      }
      const settingsReason = validateRedSettings(settings.usaImport.redDelaware);
      if (settingsReason) {
        return { status: 'BLOCKED', reason: settingsReason, redirector: input.redirector };
      }
    }

    const weight = await this.resolveWeight(input.sourceProduct, input.composition);
    return toWeightPreflightResult(
      weight,
      input.redirector,
      taxTreatment.taxTreatment,
      logisticClassification,
    );
  }

  private async resolveWeight(
    sourceProduct: UsaSourceProduct,
    composition: ShippingWeightComposition,
  ): Promise<ShippingWeightResolution> {
    const dto = {
      sourceProduct: { ...sourceProduct, origin: sourceProduct.source },
      composition,
    } as unknown as ResolveShippingWeightDto;
    return this.shippingWeights.resolve(dto) as Promise<ShippingWeightResolution>;
  }

  private consumeSemanticDecision(
    decision: UsaEnrichmentDecision,
    redirector: UsaRedirectorSelection,
  ): UsaCostPreflightResult | null {
    if (decision.status === 'NEEDS_INPUT') {
      return {
        status: 'NEEDS_INPUT',
        reason: 'MANUFACTURER_MISSING',
        input: {
          type: 'MANUFACTURER',
          field: 'manufacturer',
          suggestedValue: decision.input.suggestedValue,
        },
        redirector,
      };
    }
    if (decision.status === 'READY') return null;
    if (
      decision.reason === 'LOGISTIC_CLASSIFICATION_UNRESOLVED' &&
      redirector.redirector === 'RED_DELAWARE'
    ) {
      return null;
    }
    return {
      status: 'BLOCKED',
      reason: mapSemanticReason(decision.reason),
      redirector,
    };
  }
}

function toWeightPreflightResult(
  resolution: ShippingWeightResolution,
  redirector: UsaRedirectorSelection,
  taxTreatment: Exclude<UsaTaxTreatment, 'UNRESOLVED'>,
  logisticClassification: 'CELULAR' | 'OTHER' | 'UNRESOLVED',
): UsaCostPreflightResult {
  if (resolution.status === 'WEIGHT_FOUND') {
    return {
      status: 'READY_FOR_COST',
      redirector,
      taxTreatment,
      logisticClassification:
        logisticClassification === 'UNRESOLVED' ? null : logisticClassification,
      shippingWeightLbs: resolution.shippingWeightLbs,
    };
  }
  if (resolution.status === 'MISSING_WEIGHT') {
    return {
      status: 'NEEDS_INPUT',
      reason: 'MISSING_WEIGHT',
      input: { type: 'WEIGHT', field: 'shippingWeightLbs' },
      redirector,
    };
  }
  return {
    status: 'BLOCKED',
    reason: resolution.status === 'KEY_INSUFFICIENT' ? 'KEY_INSUFFICIENT' : 'KEY_AMBIGUOUS',
    redirector,
  };
}

function mapSemanticReason(reason: Exclude<UsaEnrichmentDecision['reason'], null>) {
  switch (reason) {
    case 'MANUFACTURER_AMBIGUOUS':
      return 'ENRICHMENT_CONFLICT' as const;
    case 'ENRICHMENT_CONFLICT':
      return 'ENRICHMENT_CONFLICT' as const;
    case 'RETAILER_UNRESOLVED':
      return 'RETAILER_UNRESOLVED' as const;
    case 'LOGISTIC_CLASSIFICATION_UNRESOLVED':
      return 'LOGISTIC_CLASSIFICATION_UNRESOLVED' as const;
    case 'MANUFACTURER_MISSING':
      return 'ENRICHMENT_CONFLICT' as const;
  }
}

function isValidSourceProduct(product: UsaSourceProduct) {
  return (
    product.source === 'US' &&
    Boolean(product.providerName.trim()) &&
    Boolean(product.sourceProductId.trim()) &&
    Boolean(product.sourceName.trim()) &&
    Number.isFinite(product.priceUsd) &&
    product.priceUsd > 0
  );
}

function isSupportedRedirector(value: UsaRedirectorSelection): value is UsaRedirectorSelection {
  return value?.redirector === 'REI_DO_IMPORTADO' || value?.redirector === 'RED_DELAWARE';
}

function isPositiveInteger(value: string | null) {
  const parsed = Number(value);
  return Boolean(value) && Number.isInteger(parsed) && parsed >= 1;
}

function validateRedSettings(settings: { firstLbUsd: number; additionalLbUsd: number }) {
  return Number.isFinite(settings.firstLbUsd) &&
    settings.firstLbUsd >= 0 &&
    Number.isFinite(settings.additionalLbUsd) &&
    settings.additionalLbUsd >= 0
    ? null
    : ('SETTINGS_UNAVAILABLE' as const);
}

function validateReiSettings(settings: {
  phoneShippingUsd: number;
  otherProductsShippingUsdPerHalfKg: number;
  insurancePercent: number;
  usTaxPercent: number;
  airFreightDiscountPercent: number;
}) {
  const rates = [
    settings.phoneShippingUsd,
    settings.otherProductsShippingUsdPerHalfKg,
    settings.insurancePercent,
    settings.usTaxPercent,
    settings.airFreightDiscountPercent,
  ];
  return rates.every(Number.isFinite) &&
    settings.phoneShippingUsd >= 0 &&
    settings.otherProductsShippingUsdPerHalfKg >= 0 &&
    rates.slice(2).every((value) => value >= 0 && value <= 100)
    ? null
    : ('SETTINGS_UNAVAILABLE' as const);
}
