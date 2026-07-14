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
}

export interface ImportSearchResponse {
  provider: string;
  dollarQuote: number;
  results: ImportProduct[];
}

export interface ImportCalculation {
  product: ImportProduct;
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
