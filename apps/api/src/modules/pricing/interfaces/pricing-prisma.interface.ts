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

export interface PricingPrismaClient {
  priceHistory: {
    findMany(args?: unknown): Promise<PricingPriceHistoryRecord[]>;
  };
  systemConfiguration: {
    findMany(args?: unknown): Promise<PricingSystemConfigurationRecord[]>;
    upsert(args: unknown): Promise<PricingSystemConfigurationRecord>;
  };
  auditLog?: {
    create(args: unknown): Promise<unknown>;
  };
}
