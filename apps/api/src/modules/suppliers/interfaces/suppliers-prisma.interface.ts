export interface SupplierRecord {
  id: string;
  name: string;
  contact?: string | null;
  phone?: string | null;
  source?: string | null;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export interface SuppliersPrismaClient {
  supplier: {
    findMany(args?: unknown): Promise<SupplierRecord[]>;
    findUnique(args: unknown): Promise<SupplierRecord | null>;
    create(args: unknown): Promise<SupplierRecord>;
    update(args: unknown): Promise<SupplierRecord>;
  };
  auditLog?: {
    create(args: unknown): Promise<unknown>;
  };
}
