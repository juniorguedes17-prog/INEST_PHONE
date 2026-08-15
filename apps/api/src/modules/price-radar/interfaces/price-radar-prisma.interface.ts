export interface PriceQuoteRecord {
  id: string;
  supplierId: string;
  productId: string;
  costProduct: number | string;
  deliveryTime?: string | null;
  city?: string | null;
  contact?: string | null;
  notes?: string | null;
  quoteDate: Date;
  createdAt?: Date;
  supplier?: {
    id: string;
    name: string;
    contact?: string | null;
    phone?: string | null;
    source?: string | null;
  };
  product?: {
    id: string;
    productDescription?: string | null;
    productType: string;
    qualityGrade?: string | null;
    category?: { id: string; name: string };
    model?: { id: string; name: string };
    color?: { id: string; name: string } | null;
    storage?: { id: string; displayName: string } | null;
  };
}

export interface AutomatedPriceQuoteRecord {
  id: string;
  normalizedName: string;
  productName: string;
  category: string | null;
  model: string | null;
  capacity: string | null;
  color: string | null;
  condition: string | null;
  price: number | string;
  availability: string | null;
  rawLine: string;
  createdAt: Date;
  currentList: {
    updatedAt: Date;
    receivedAt: Date;
    supplierContact: {
      id: string;
      supplierName: string;
      whatsappNumber: string;
      address: string | null;
    };
  };
}

export interface PriceRadarPrismaClient {
  priceHistory: {
    findMany(args?: unknown): Promise<PriceQuoteRecord[]>;
    findUnique(args: unknown): Promise<PriceQuoteRecord | null>;
    create(args: unknown): Promise<PriceQuoteRecord>;
    update(args: unknown): Promise<PriceQuoteRecord>;
  };
  product: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
  };
  supplier: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
  };
  importBatch: {
    create(args: unknown): Promise<{ id: string }>;
  };
  auditLog?: {
    create(args: unknown): Promise<unknown>;
  };
  supplierCurrentListItem: {
    findMany(args: unknown): Promise<AutomatedPriceQuoteRecord[]>;
  };
}
