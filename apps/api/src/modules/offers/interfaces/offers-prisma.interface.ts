export interface CommercialTemplateRecord {
  id: string;
  name: string;
  productType: string;
  content: string;
  variables?: unknown;
  status: string;
}

export interface OfferRecord {
  id: string;
  commercialTemplateId: string;
  pricingId?: string | null;
  message: string;
  status: string;
  salePrice: number | string;
  offerPrice: number | string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  createdBy?: string | null;
  commercialTemplate?: CommercialTemplateRecord;
  items?: Array<{
    id: string;
    productId: string;
    salePrice: number | string;
    offerPrice: number | string;
  }>;
}

export interface OffersPrismaClient {
  commercialTemplate: {
    findMany(args?: unknown): Promise<CommercialTemplateRecord[]>;
    findFirst(args?: unknown): Promise<CommercialTemplateRecord | null>;
    upsert(args: unknown): Promise<CommercialTemplateRecord>;
  };
  offer: {
    findMany(args?: unknown): Promise<OfferRecord[]>;
    findUnique(args: unknown): Promise<OfferRecord | null>;
    create(args: unknown): Promise<OfferRecord>;
    update(args: unknown): Promise<OfferRecord>;
  };
  auditLog?: {
    create(args: unknown): Promise<unknown>;
  };
}
