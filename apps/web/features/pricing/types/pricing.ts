export interface PricingItem {
  productId: string;
  quoteId: string;
  productName: string;
  category: string;
  model: string;
  color: string;
  capacity: string;
  productType: string;
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
  payload: {
    productId: string;
    productName: string;
    color: string;
    capacity: string;
    salePrice: number;
    offerPrice: number;
    deliveryTime: string;
    warranty: string;
  };
}

export interface TemporaryImportPricingRequest {
  productId: string;
  productName: string;
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
  product: {
    id: string;
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
  desiredNetProfit: number;
  margin: number;
  salePrice: number;
  offerPrice: number;
  profit: {
    source: string;
    condition: 'NOVO' | 'SEMINOVO' | 'CPO';
    productDescription: string;
    recordId: string;
    updatedAt: string;
  };
  offerDraft: OfferDraft;
}

export const TEMPORARY_IMPORT_PRICING_STORAGE_KEY = 'inest.temporary-import-pricing';
