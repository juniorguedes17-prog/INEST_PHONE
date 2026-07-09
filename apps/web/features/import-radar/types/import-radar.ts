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
