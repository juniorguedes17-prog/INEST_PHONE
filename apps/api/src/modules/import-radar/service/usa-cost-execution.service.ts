import { Inject, Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/service/settings.service';
import * as redDelawareCalculator from '../calculators/red-delaware-cost.calculator';
import * as reiDoImportadoCalculator from '../calculators/rei-do-importado-cost.calculator';
import type { UsaRedirectorSelection, UsaCostCalculationResult } from '../usa-cost.contract';
import { createUsaCostCalculationResult } from '../usa-cost.contract';
import type { ShippingWeightComposition } from '../shipping-weights/shipping-weight.contract';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import { UsaCostPreflightService, type UsaCostPreflightResult } from './usa-cost-preflight.service';

type UsaCalculatorBreakdown =
  | redDelawareCalculator.RedDelawareCostBreakdown
  | reiDoImportadoCalculator.ReiDoImportadoCostBreakdown;

export interface UsaCostExecutionInput {
  sourceProduct: UsaSourceProduct;
  redirector: UsaRedirectorSelection;
  composition: ShippingWeightComposition;
  runtimeShippingWeightLbs?: number;
}

export type UsaCostExecutionResult =
  | {
      preflight: Exclude<UsaCostPreflightResult, { status: 'READY_FOR_COST' }>;
      calculation: null;
    }
  | {
      preflight: Extract<UsaCostPreflightResult, { status: 'READY_FOR_COST' }>;
      calculation: UsaCostCalculationResult<UsaCalculatorBreakdown>;
    };

/**
 * Connects the approved USA preflight to exactly one existing pure calculator.
 * It owns neither semantic decisions nor cost arithmetic.
 */
@Injectable()
export class UsaCostExecutionService {
  private readonly logger = new Logger(UsaCostExecutionService.name);

  constructor(
    @Inject(UsaCostPreflightService)
    private readonly preflightService: UsaCostPreflightService,
    @Inject(SettingsService)
    private readonly settingsService: SettingsService,
  ) {}

  async execute(input: UsaCostExecutionInput): Promise<UsaCostExecutionResult> {
    const preflight = await this.preflightService.preflight(input);
    if (preflight.status !== 'READY_FOR_COST') {
      this.logExecution(input.sourceProduct, preflight, null, null);
      return { preflight, calculation: null };
    }

    // Preflight is the authority that allows this read and has already
    // validated configuration availability. This service does not supply a
    // quote, rate, weight, quantity, TAX, or other fallback.
    const usaImport = (await this.settingsService.getSettings()).usaImport;
    const calculation = this.calculate(input.sourceProduct, preflight, usaImport);

    this.logExecution(
      input.sourceProduct,
      preflight,
      preflight.redirector.redirector,
      calculation.finalCost.amountBrl,
    );
    return { preflight, calculation };
  }

  private calculate(
    sourceProduct: UsaSourceProduct,
    preflight: Extract<UsaCostPreflightResult, { status: 'READY_FOR_COST' }>,
    usaImport: Awaited<ReturnType<SettingsService['getSettings']>>['usaImport'],
  ): UsaCostCalculationResult<UsaCalculatorBreakdown> {
    if (preflight.redirector.redirector === 'RED_DELAWARE') {
      const calculation = redDelawareCalculator.calculateRedDelawareExpressCost({
        productPriceUsd: sourceProduct.priceUsd,
        usdBrlQuote: usaImport.usdBrlQuote,
        shippingWeightLbs: preflight.shippingWeightLbs,
        firstLbUsd: usaImport.redDelaware.firstLbUsd,
        additionalLbUsd: usaImport.redDelaware.additionalLbUsd,
        shippingMode: preflight.redirector.shippingMode,
      });
      return createUsaCostCalculationResult({
        sourceCommercialIdentity: sourceProduct,
        redirector: preflight.redirector,
        productPriceUsd: sourceProduct.priceUsd,
        finalCost: calculation.finalCost,
        breakdown: calculation.breakdown,
      });
    }

    const calculation = reiDoImportadoCalculator.calculateReiDoImportadoCost({
      productPriceUsd: sourceProduct.priceUsd,
      usdBrlQuote: usaImport.usdBrlQuote,
      shippingWeightLbs: preflight.shippingWeightLbs,
      logisticsClassification: preflight.logisticClassification as 'CELULAR' | 'OTHER',
      quantity: preflight.quantity,
      taxTreatment: preflight.taxTreatment,
      ...usaImport.reiDoImportado,
    });
    return createUsaCostCalculationResult({
      sourceCommercialIdentity: sourceProduct,
      redirector: preflight.redirector,
      productPriceUsd: sourceProduct.priceUsd,
      finalCost: calculation.finalCost,
      breakdown: calculation.breakdown,
    });
  }

  private logExecution(
    sourceProduct: UsaSourceProduct,
    preflight: UsaCostPreflightResult,
    calculator: UsaRedirectorSelection['redirector'] | null,
    finalCostAmountBrl: number | null,
  ) {
    this.logger.debug({
      event: 'import_radar.usa_cost.execution',
      provider: sourceProduct.providerName,
      sourceProductId: sourceProduct.sourceProductId,
      redirector: preflight.redirector?.redirector ?? null,
      preflightState: preflight.status,
      calculator,
      finalCostAmountBrl,
    });
  }
}
