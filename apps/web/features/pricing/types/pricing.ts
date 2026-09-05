export interface PricingItem {
  productId: string;
  quoteId: string;
  productName: string;
  category: string;
  model: string;
  color: string;
  capacity: string;
  productType: string;
  isAppleOriginal: boolean | null;
  status: string;
  supplier: {
    id: string;
    name: string;
    source?: string;
  };
  deliveryTime: string;
  costProduct: number;
  fixedCost: number;
  freight: number;
  paymentFee: number;
  desiredNetProfit: number | null;
  margin: number | null;
  salePrice: number | null;
  offerPrice: number | null;
  lastUpdatedAt: string;
  profitSource: string;
  profitCondition: 'NOVO' | 'SEMINOVO' | 'CPO';
  profitProductDescription: string;
  profitRecordId: string | null;
  profitUpdatedAt: string;
  calculationStatus: 'ready' | 'missing_profit' | 'duplicate_profit';
  calculationError: string | null;
  googleSheetsReady: boolean;
}

export interface PricingFilters {
  productId?: string;
  search: string;
  category: string;
  model: string;
  color: string;
  capacity: string;
  productType: string;
  status: string;
  minPrice: string;
  maxPrice: string;
  sort: string;
}

export interface OfferDraft {
  targetModule: string;
  route: string;
  createdAt?: string;
  productType?: string;
  source?: 'pricing' | 'temporary-import' | 'radar-quote';
  payload: {
    productId: string | null;
    sourceQuoteId?: string;
    productName: string;
    color: string;
    capacity: string;
    salePrice: number;
    offerPrice: number;
    deliveryTime: string;
    warranty: string;
  };
}

export interface BrazilRadarQuotePricingRequest {
  sourceQuoteId: string;
}

export interface BrazilRadarQuotePricing {
  temporary: true;
  origin: 'BR';
  source: 'BRAZIL_RADAR';
  sourceQuoteId: string;
  catalogProductId: string | null;
  financialClassification: 'APPLE' | 'NON_APPLE' | 'UNRESOLVED';
  pricingEligibility: {
    status: 'ELIGIBLE' | 'BLOCKED';
    reason: 'classification_unresolved' | null;
  };
  product: {
    id: string | null;
    name: string;
    category: string;
    model: string;
    capacity: string;
    color: string;
    supplier: string;
    city: string;
    condition: 'NOVO' | 'SEMINOVO' | 'CPO';
    isAppleOriginal: boolean | null;
  };
  costProduct: number;
  pricingCosts: {
    fixedCost: number;
    freight: number;
    paymentFee: number;
    offerIncrement: number;
  };
  desiredNetProfit: number | null;
  margin: number | null;
  salePrice: number | null;
  offerPrice: number | null;
  profit: {
    source: string;
    condition: 'NOVO' | 'SEMINOVO' | 'CPO';
    productDescription: string;
    recordId: string | null;
    updatedAt: string;
  };
  calculationStatus:
    | 'ready'
    | 'missing_profit'
    | 'insufficient_identity'
    | 'ambiguous_identity'
    | 'collision'
    | 'classification_unresolved';
  calculationError: string | null;
  offerDraft: OfferDraft | null;
}

export interface BrazilRadarPricingBatchStorage {
  items: BrazilRadarQuotePricing[];
  failedCount: number;
}

export interface OfferDraftBatchStorage {
  drafts: OfferDraft[];
  failedCount: number;
}

export type PricingOfferTarget =
  | { id: string; kind: 'catalog'; productId: string }
  | { id: string; kind: 'brazil-radar'; item: BrazilRadarQuotePricing };

export interface TemporaryImportPricingRequest {
  sourceProductId: string;
  catalogProductId?: string | null;
  productName: string;
  displayName?: string;
  category: string;
  supplier: string;
  store: string;
  productUrl: string;
  priceUsd: number;
  dollarQuote: number;
  convertedPrice: number;
  cdeExit: number;
  redirectCost: number;
  brazilDispatch: number;
  invoiceTax: number;
  correiosLabel: number;
  totalCost: number;
  brand?: string;
  sourceManufacturer?: string | null;
  sourceManufacturerProvenance?: 'EXPLICIT_SOURCE';
  model?: string;
  capacity?: string;
  color?: string;
  city?: string;
  condition?: 'NOVO' | 'SEMINOVO' | 'CPO';
  matchedProductType?: string;
}

export interface TemporaryImportPricing {
  temporary: true;
  origin: 'PY';
  financialClassification: 'APPLE' | 'NON_APPLE';
  calculationStatus:
    | 'ready'
    | 'missing_profit'
    | 'condition_unresolved'
    | 'insufficient_identity'
    | 'ambiguous_identity'
    | 'collision';
  calculationError: string | null;
  catalogProductId: string | null;
  recalculationRequest: TemporaryImportPricingRequest;
  product: {
    id: string | null;
    name: string;
    category: string;
    brand: string;
    model: string;
    capacity: string;
    color: string;
    supplier: string;
    store: string;
    city: string;
    productUrl: string;
    priceUsd: number;
    isAppleOriginal: boolean | null;
  };
  importCosts: {
    dollarQuote: number;
    convertedPrice: number;
    cdeExit: number;
    redirectCost: number;
    brazilDispatch: number;
    invoiceTax: number;
    correiosLabel: number;
    totalCost: number;
  };
  pricingCosts: {
    fixedCost: number;
    freight: number;
    paymentFee: number;
    offerIncrement: number;
  };
  desiredNetProfit: number | null;
  margin: number | null;
  salePrice: number | null;
  offerPrice: number | null;
  profit: {
    source: string;
    condition: 'NOVO' | 'SEMINOVO' | 'CPO' | null;
    productDescription: string;
    recordId: string | null;
    updatedAt: string;
  };
  offerDraft: OfferDraft | null;
}

export const TEMPORARY_IMPORT_PRICING_STORAGE_KEY = 'inest.temporary-import-pricing';
