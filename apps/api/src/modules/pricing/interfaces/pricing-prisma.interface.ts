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
    isAppleOriginal?: boolean | null;
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
  productId?: string | null;
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
  isAppleOriginal?: boolean | null;
  profitCondition?: string | null;
  category?: { name: string } | null;
  model?: { name: string } | null;
  color?: { name: string } | null;
  storage?: { displayName: string } | null;
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
    findMany(args: unknown): Promise<ProductIdShadowCandidate[]>;
  };
  systemConfiguration: {
    findMany(args?: unknown): Promise<PricingSystemConfigurationRecord[]>;
    upsert(args: unknown): Promise<PricingSystemConfigurationRecord>;
  };
  auditLog?: {
    create(args: unknown): Promise<unknown>;
  };
}
import type { ProductIdShadowCandidate } from '../../evolution-webhook/product-identity-shadow';
