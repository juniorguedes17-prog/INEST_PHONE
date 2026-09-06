import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { OfferDraftDto } from '../../offers/dto/offers.dto';
import { OffersService } from '../../offers/service/offers.service';
import type { ManufacturerResolution } from '../../manufacturers/manufacturer-resolver';
import { PricingService } from '../../pricing/service/pricing.service';
import type {
  UsaFinalCostPricingResult,
  UsaPricingCalculationStatus,
} from '../../pricing/usa-final-cost-pricing.contract';
import type { ProfitCondition } from '../../pricing/interfaces/profit-sheet.interface';
import type { UsaCostExecutionInput, UsaCostExecutionResult } from './usa-cost-execution.service';
import { UsaCostExecutionService } from './usa-cost-execution.service';

export interface UsaPricedOfferInput extends UsaCostExecutionInput {
  /** Existing resolved condition supplied by the USA normalized context. */
  condition: ProfitCondition | null;
  /** Optional canonical Product authority; USA source products remain external by default. */
  catalogProductId?: string | null;
  /** Existing deterministic manufacturer decision, when already available. */
  manufacturerResolution?: ManufacturerResolution | null;
  user: AuthenticatedUser;
}

export type UsaPricedOfferResult =
  | {
      status: 'NEEDS_INPUT' | 'BLOCKED';
      reason: string;
      costExecution: UsaCostExecutionResult;
      pricing: null | UsaFinalCostPricingResult;
      offerDraft: null;
      offer: null;
    }
  | {
      status: 'READY';
      reason: null;
      costExecution: Extract<UsaCostExecutionResult, { calculation: NonNullable<unknown> }>;
      pricing: UsaFinalCostPricingResult;
      offerDraft: OfferDraftDto;
      offer: Awaited<ReturnType<OffersService['persistPricedOfferDraft']>>;
    };

type ReadyUsaFinalCostPricingResult = Omit<
  UsaFinalCostPricingResult,
  'salePrice' | 'offerPrice'
> & {
  salePrice: number;
  offerPrice: number;
};

/**
 * Thin P7B composition: P7A remains the cost authority, Pricing remains the
 * commercial authority, and Offers persists their already-approved snapshot.
 */
@Injectable()
export class UsaPricedOfferService {
  private readonly logger = new Logger(UsaPricedOfferService.name);

  constructor(
    @Inject(UsaCostExecutionService)
    private readonly costExecution: UsaCostExecutionService,
    @Inject(PricingService)
    private readonly pricingService: PricingService,
    @Inject(OffersService)
    private readonly offersService: OffersService,
  ) {}

  async execute(input: UsaPricedOfferInput): Promise<UsaPricedOfferResult> {
    const costExecution = await this.costExecution.execute(input);
    if (!costExecution.calculation) {
      return {
        status: costExecution.preflight.status,
        reason: costExecution.preflight.reason,
        costExecution,
        pricing: null,
        offerDraft: null,
        offer: null,
      };
    }

    const pricing = await this.pricingService.calculateUsaFinalCost({
      sourceProduct: input.sourceProduct,
      finalCost: costExecution.calculation.finalCost,
      condition: input.condition,
      catalogProductId: input.catalogProductId,
      manufacturerResolution: input.manufacturerResolution,
    });
    if (!isPricingReady(pricing)) {
      this.log(input, costExecution, pricing.calculationStatus, null);
      return {
        status: 'BLOCKED',
        reason: pricing.calculationStatus,
        costExecution,
        pricing,
        offerDraft: null,
        offer: null,
      };
    }

    const offerDraft = createOfferDraft(input, pricing);
    const offer = await this.offersService.persistPricedOfferDraft(offerDraft, input.user);
    this.log(input, costExecution, pricing.calculationStatus, offer.id);
    return {
      status: 'READY',
      reason: null,
      costExecution,
      pricing,
      offerDraft,
      offer,
    };
  }

  private log(
    input: UsaPricedOfferInput,
    costExecution: UsaCostExecutionResult,
    pricingStatus: UsaPricingCalculationStatus,
    offerId: string | null,
  ) {
    this.logger.debug({
      event: 'import_radar.usa_priced_offer.persist',
      provider: input.sourceProduct.providerName,
      sourceProductId: input.sourceProduct.sourceProductId,
      redirector: input.redirector.redirector,
      preflightState: costExecution.preflight.status,
      pricingStatus,
      finalCostAmountBrl: costExecution.calculation?.finalCost.amountBrl ?? null,
      offerId,
    });
  }
}

function isPricingReady(
  pricing: UsaFinalCostPricingResult,
): pricing is ReadyUsaFinalCostPricingResult {
  return (
    pricing.calculationStatus === 'ready' &&
    typeof pricing.salePrice === 'number' &&
    typeof pricing.offerPrice === 'number'
  );
}

function createOfferDraft(
  input: UsaPricedOfferInput,
  pricing: ReadyUsaFinalCostPricingResult,
): OfferDraftDto {
  const productId = pricing.catalogProductId;
  return {
    targetModule: 'offers',
    route: '/offers',
    createdAt: new Date().toISOString(),
    source: 'pricing',
    payload: {
      productId,
      ...(productId
        ? {}
        : {
            externalIdentity: {
              origin: 'US',
              provider: input.sourceProduct.providerName,
              sourceProductId: input.sourceProduct.sourceProductId,
              sourceName: input.sourceProduct.sourceName,
              sourceUrl: input.sourceProduct.sourceUrl || undefined,
              retailer: input.sourceProduct.retailer ?? undefined,
            },
          }),
      productName: input.sourceProduct.displayName || input.sourceProduct.sourceName,
      color: input.sourceProduct.color ?? '',
      capacity: input.sourceProduct.capacity ?? '',
      salePrice: pricing.salePrice,
      offerPrice: pricing.offerPrice,
      deliveryTime: '',
      warranty: '',
    },
  };
}
