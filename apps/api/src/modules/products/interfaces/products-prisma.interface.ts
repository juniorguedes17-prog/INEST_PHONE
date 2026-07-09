export interface ProductRecord {
  id: string;
  categoryId: string;
  modelId: string;
  colorId?: string | null;
  storageId?: string | null;
  productType: string;
  status: string;
  qualityGrade?: string | null;
  criticalNotes?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  category?: { id: string; name: string; type: string };
  model?: { id: string; name: string };
  color?: { id: string; name: string } | null;
  storage?: { id: string; displayName: string } | null;
}

export interface ProductsPrismaClient {
  product: {
    findMany(args?: unknown): Promise<ProductRecord[]>;
    findUnique(args: unknown): Promise<ProductRecord | null>;
    create(args: unknown): Promise<ProductRecord>;
    update(args: unknown): Promise<ProductRecord>;
  };
  productCategory: {
    findMany(
      args?: unknown,
    ): Promise<Array<{ id: string; name: string; slug: string; type: string }>>;
    findUnique(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  productModel: {
    findMany(
      args?: unknown,
    ): Promise<Array<{ id: string; categoryId: string; name: string; productType: string }>>;
    findUnique(args: unknown): Promise<{ id: string; categoryId: string } | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  productColor: {
    findMany(args?: unknown): Promise<Array<{ id: string; name: string; normalizedName: string }>>;
    findUnique(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  productStorage: {
    findMany(
      args?: unknown,
    ): Promise<Array<{ id: string; value: string; unit?: string | null; displayName: string }>>;
    findUnique(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  auditLog?: { create(args: unknown): Promise<unknown> };
}
