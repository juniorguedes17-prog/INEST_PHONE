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
  };
}
