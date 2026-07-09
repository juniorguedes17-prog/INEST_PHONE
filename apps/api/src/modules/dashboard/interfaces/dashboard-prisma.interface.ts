export interface DashboardProductRecord {
  id: string;
  productType: string;
  status: string;
  category?: { id: string; name: string } | null;
  model?: { id: string; name: string } | null;
  color?: { id: string; name: string } | null;
  storage?: { id: string; displayName: string } | null;
}

export interface DashboardSupplierRecord {
  id: string;
  name: string;
  status: string;
}

export interface DashboardPriceHistoryRecord {
  id: string;
  productId: string;
  supplierId: string;
  costProduct: number | string;
  notes?: string | null;
  quoteDate: Date;
  createdAt?: Date;
  product?: DashboardProductRecord;
  supplier?: DashboardSupplierRecord;
}

export interface DashboardOfferRecord {
  id: string;
  status: string;
  offerPrice: number | string;
  salePrice: number | string;
  message: string;
  createdAt: Date;
  deletedAt?: Date | null;
  items?: Array<{ productId: string }>;
}

export interface DashboardSaleRecord {
  id: string;
  grossRevenue: number | string;
  netRevenue: number | string;
  netProfit: number | string;
  totalAmount: number | string;
  status: string;
  saleDate: Date;
  deletedAt?: Date | null;
  items?: Array<{
    productId: string;
    quantity: number;
    salePrice: number | string;
    netProfit: number | string;
    product?: DashboardProductRecord;
  }>;
}

export interface DashboardAuditLogRecord {
  id: string;
  userId?: string | null;
  operationType: string;
  entity: string;
  entityId?: string | null;
  context?: unknown;
  newValue?: unknown;
  createdAt: Date;
}

export interface DashboardPrismaClient {
  product: {
    findMany(args?: unknown): Promise<DashboardProductRecord[]>;
  };
  supplier: {
    findMany(args?: unknown): Promise<DashboardSupplierRecord[]>;
  };
  priceHistory: {
    findMany(args?: unknown): Promise<DashboardPriceHistoryRecord[]>;
  };
  offer: {
    findMany(args?: unknown): Promise<DashboardOfferRecord[]>;
  };
  sale: {
    findMany(args?: unknown): Promise<DashboardSaleRecord[]>;
  };
  auditLog?: {
    findMany(args?: unknown): Promise<DashboardAuditLogRecord[]>;
    create(args: unknown): Promise<unknown>;
  };
}
