import { describe, expect, it } from 'vitest';
import type { SourceCommercialIdentity } from './interfaces/source-commercial-identity.interface';
import {
  createUsaCostCalculationResult,
  type FinalCost,
  type UsaRedirectorSelection,
} from './usa-cost.contract';

const sourceCommercialIdentity: SourceCommercialIdentity<'US'> = {
  sourceProductId: 'us-product-123',
  sourceName: 'Source product name',
  displayName: 'Display product name',
  source: 'US',
  sourceUrl: 'https://source.example/products/123',
  supplier: 'Source supplier',
  sourceManufacturer: null,
  sourceManufacturerProvenance: null,
};

describe('USA cost contracts', () => {
  it('keeps Red Delaware and Rei do Importado as distinct strategy selections', () => {
    const redDelaware: UsaRedirectorSelection = {
      redirector: 'RED_DELAWARE',
      shippingMode: 'EXPRESS',
    };
    const reiDoImportado: UsaRedirectorSelection = {
      redirector: 'REI_DO_IMPORTADO',
    };

    expect(redDelaware).toEqual({ redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' });
    expect(reiDoImportado).toEqual({ redirector: 'REI_DO_IMPORTADO' });
  });

  it('projects finalCost in BRL without deriving it from the strategy breakdown', () => {
    const finalCost: FinalCost = { currency: 'BRL', amountBrl: 7821.34 };
    const breakdown = { calculatorOwnedComponent: 999 };

    const result = createUsaCostCalculationResult({
      sourceCommercialIdentity,
      redirector: { redirector: 'RED_DELAWARE', shippingMode: 'EXPRESS' },
      productPriceUsd: 1199,
      finalCost,
      breakdown,
    });

    expect(result.sourceProductId).toBe(sourceCommercialIdentity.sourceProductId);
    expect(result.finalCost).toBe(finalCost);
    expect(result.finalCost).toEqual({ currency: 'BRL', amountBrl: 7821.34 });
    expect(result.breakdown).toBe(breakdown);
  });

  it('accepts a strategy-owned breakdown without defining financial components or defaults', () => {
    const result = createUsaCostCalculationResult({
      sourceCommercialIdentity,
      redirector: { redirector: 'REI_DO_IMPORTADO' },
      productPriceUsd: 450,
      finalCost: { currency: 'BRL', amountBrl: 3000 },
      breakdown: { futureCalculatorValue: 'owned-by-calculator' },
    });

    expect(result.breakdown).toEqual({ futureCalculatorValue: 'owned-by-calculator' });
    expect(Object.keys(result.breakdown)).not.toContain('cdeExit');
    expect(Object.keys(result.breakdown)).not.toContain('redirectCost');
  });
});
