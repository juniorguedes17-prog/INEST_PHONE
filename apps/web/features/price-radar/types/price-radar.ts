export interface PriceRadarSupplier {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
  source?: string;
  whatsappLink?: string | null;
}

export interface PriceQuoteItem {
  id: string;
  productId: string;
  supplierId: string;
  productName: string;
  category: string;
  model: string;
  color: string;
  capacity: string;
  productType: string;
  quality: string;
  supplier: PriceRadarSupplier;
  city: string;
  deliveryTime: string;
  contact: string;
  notes: string;
  costProduct: number;
  quoteDate: string;
  updatedAt: string;
  status: 'valid' | 'hidden';
  valid: boolean;
  inconsistencies: string[];
}

export interface PriceRadarKpis {
  lowestValidPrice: number;
  averagePrice: number;
  highestPrice: number;
  hiddenCount: number;
}

export interface PriceRadarFilters {
  search: string;
  productId: string;
  supplierId: string;
  city: string;
  quality: string;
  deliveryTime: string;
  status: string;
  sort: string;
}

export interface PriceQuoteFormPayload {
  productId: string;
  supplierId: string;
  costProduct: number;
  deliveryTime?: string;
  city?: string;
  contact?: string;
  quality?: string;
  notes?: string;
  quoteDate?: string;
}

export interface CsvImportResult {
  importBatchId: string;
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  inconsistencies: Array<{ row: number; message: string }>;
}
