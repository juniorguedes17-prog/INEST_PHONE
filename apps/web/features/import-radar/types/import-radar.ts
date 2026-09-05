export interface ImportProduct {
  id: string;
  name: string;
  store: string;
  category: string;
  priceUsd: number;
  priceBrl: number;
  productUrl: string;
  imageUrl?: string;
  provider: string;
  dollarQuote: number;
  brand?: string;
  sourceManufacturer?: string | null;
  sourceManufacturerProvenance?: 'EXPLICIT_SOURCE';
  model?: string;
  capacity?: string;
  color?: string;
  city?: string;
  priceBrlSource?: number;
  availability?: string;
  storeUrl?: string;
  consultedAt?: string;
  origin?: 'PY' | 'US' | 'MOCK';
  externalId?: string;
  minimumPriceUsd?: number;
  averagePriceUsd?: number;
  maximumPriceUsd?: number;
  storeCount?: number;
  offerCount?: number;
  condition?: 'NOVO' | 'SEMINOVO' | 'CPO';
}

export interface ImportSearchResponse {
  provider: string;
  dollarQuote: number;
  results: ImportProduct[];
}

export interface ImportCalculation {
  product: ImportProduct;
  catalogProductId: string | null;
  condition: 'NOVO' | 'SEMINOVO' | 'CPO' | null;
  sourceCommercialIdentity: {
    sourceProductId: string;
    sourceName: string;
    displayName: string;
    source: string;
    sourceUrl: string;
    supplier: string;
    sourceManufacturer: string | null;
    sourceManufacturerProvenance: 'EXPLICIT_SOURCE' | null;
  };
  financialClassification: 'APPLE' | 'NON_APPLE' | 'UNRESOLVED';
  pricingEligibility: {
    status: 'ELIGIBLE' | 'BLOCKED';
    reason:
      | 'classification_unresolved'
      | 'condition_unresolved'
      | 'financial_identity_insufficient'
      | 'financial_identity_ambiguous'
      | null;
  };
  productResolution: {
    status: 'FOUND' | 'MISSING' | 'AMBIGUOUS';
    productId?: string;
    candidateCount: number;
    reason?:
      | 'identity_insufficient'
      | 'catalog_no_match'
      | 'multiple_catalog_candidates'
      | 'condition_unresolved';
  };
  matchedProductType: string;
  dollarQuote: number;
  breakdown: {
    convertedPrice: number;
    cdeExit: number;
    redirectCost: number;
    brazilDispatch: number;
    invoiceTax: number;
    correiosLabel: number;
  };
  total: number;
}

export interface ImportRadarFilters {
  search: string;
  category: string;
  provider: string;
}
