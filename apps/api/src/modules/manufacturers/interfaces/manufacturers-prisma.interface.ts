import type { ManufacturerResolverAlias } from '../manufacturer-resolver';

export interface ManufacturerIdentityRecord {
  id: string;
  manufacturerKey: string;
  canonicalName: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: Date;
  updatedAt: Date;
}

export interface ManufacturersPrismaClient {
  manufacturerIdentity: {
    findMany(args?: unknown): Promise<ManufacturerIdentityRecord[]>;
    findUnique(args: unknown): Promise<ManufacturerIdentityRecord | null>;
    create(args: unknown): Promise<ManufacturerIdentityRecord>;
    update(args: unknown): Promise<ManufacturerIdentityRecord>;
  };
  manufacturerAlias: {
    findMany(args?: unknown): Promise<ManufacturerResolverAlias[]>;
    findUnique(args: unknown): Promise<ManufacturerResolverAlias | null>;
    create(args: unknown): Promise<ManufacturerResolverAlias>;
  };
  auditLog?: {
    create(args: unknown): Promise<unknown>;
  };
}
