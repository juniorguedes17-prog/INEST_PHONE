export interface SupplierContactRecord {
  id: string;
  supplierName: string;
  whatsappNumber: string;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierContactsPrismaClient {
  supplierContact: {
    findFirst(args: unknown): Promise<SupplierContactRecord | null>;
    findMany(args: unknown): Promise<SupplierContactRecord[]>;
    findUnique(args: unknown): Promise<SupplierContactRecord | null>;
    create(args: unknown): Promise<SupplierContactRecord>;
    update(args: unknown): Promise<SupplierContactRecord>;
  };
}
