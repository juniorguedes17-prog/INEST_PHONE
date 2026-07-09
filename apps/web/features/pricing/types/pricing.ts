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
  desiredNetProfit: number;
  margin: number;
  salePrice: number;
  offerPrice: number;
  lastUpdatedAt: string;
  profitSource: string;
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
