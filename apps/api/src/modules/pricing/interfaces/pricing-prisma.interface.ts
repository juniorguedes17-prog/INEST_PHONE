export interface PricingPriceHistoryRecord {
  id: string;
  supplierId: string;
  productId: string;
  costProduct: number | string;
  deliveryTime?: string | null;
  city?: string | null;
  notes?: string | null;
  quoteDate: Date;
  createdAt?: Date;
  supplier?: {
    id: string;
    name: string;
    status?: string | null;
    source?: string | null;
  };
  product?: {
    id: string;
    productDescription?: string | null;
    profitProductId?: number | null;
    productType: string;
    status?: string | null;
    qualityGrade?: string | null;
    category?: { id: string; name: string };
    model?: { id: string; name: string };
    color?: { id: string; name: string } | null;
    storage?: { id: string; displayName: string } | null;
  };
}

export interface PricingSystemConfigurationRecord {
  key: string;
  value: string;
  type: string;
  scope?: string | null;
}

export interface PricingBrazilRadarQuoteRecord {
  id: string;
  productName: string;
  normalizedName: string;
  category?: string | null;
  model?: string | null;
  capacity?: string | null;
  color?: string | null;
  condition?: string | null;
  price: number | string;
  rawLine: string;
  createdAt: Date;
  currentList: {
    updatedAt: Date;
    receivedAt: Date;
    supplierContact: {
      id: string;
      supplierName: string;
      whatsappNumber: string;
      address?: string | null;
    };
  };
}

export interface PricingCatalogProductRecord {
  id: string;
  profitProductId?: number | null;
  productDescription?: string | null;
  normalizedDescription?: string | null;
  productType: string;
}

export interface PricingPrismaClient {
  priceHistory: {
    findMany(args?: unknown): Promise<PricingPriceHistoryRecord[]>;
  };
  supplierCurrentListItem: {
    findUnique(args: unknown): Promise<PricingBrazilRadarQuoteRecord | null>;
  };
  product: {
    findFirst(args: unknown): Promise<PricingCatalogProductRecord | null>;
  };
  systemConfiguration: {
    findMany(args?: unknown): Promise<PricingSystemConfigurationRecord[]>;
    upsert(args: unknown): Promise<PricingSystemConfigurationRecord>;
  };
  auditLog?: {
    create(args: unknown): Promise<unknown>;
  };
}
