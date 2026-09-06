import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

interface ShippingWeightDecimal {
  toString(): string;
}

export interface ShippingWeightPersistenceRecord {
  id: string;
  shippingWeightKey: string;
  shippingWeightLbs: ShippingWeightDecimal;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ShippingWeightsPrismaClient {
  shippingWeightRecord: {
    findUnique(args: unknown): Promise<ShippingWeightPersistenceRecord | null>;
    create(args: unknown): Promise<ShippingWeightPersistenceRecord>;
    upsert(args: unknown): Promise<ShippingWeightPersistenceRecord>;
  };
  auditLog?: {
    create(args: unknown): Promise<unknown>;
  };
}

@Injectable()
export class ShippingWeightRepository {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  findByShippingWeightKey(shippingWeightKey: string) {
    return this.prisma.shippingWeightRecord.findUnique({ where: { shippingWeightKey } });
  }

  /** Atomic create used by missing-weight confirmation: it never overwrites. */
  createWeight(input: { shippingWeightKey: string; shippingWeightLbs: string; userId: string }) {
    return this.prisma.shippingWeightRecord.create({
      data: {
        shippingWeightKey: input.shippingWeightKey,
        shippingWeightLbs: input.shippingWeightLbs,
        createdBy: input.userId,
        updatedBy: input.userId,
      },
    });
  }

  /** Prisma upsert is the single atomic write for one unique logistics key. */
  upsertWeight(input: { shippingWeightKey: string; shippingWeightLbs: string; userId: string }) {
    return this.prisma.shippingWeightRecord.upsert({
      where: { shippingWeightKey: input.shippingWeightKey },
      create: {
        shippingWeightKey: input.shippingWeightKey,
        shippingWeightLbs: input.shippingWeightLbs,
        createdBy: input.userId,
        updatedBy: input.userId,
      },
      update: {
        shippingWeightLbs: input.shippingWeightLbs,
        updatedBy: input.userId,
      },
    });
  }

  createAuditLog(data: {
    userId: string;
    operationType: 'CREATE' | 'UPDATE';
    entityId: string;
    oldValue?: unknown;
    newValue: unknown;
    context: Record<string, unknown>;
  }) {
    return this.prisma.auditLog?.create({
      data: { entity: 'shipping_weight_record', ...data },
    });
  }

  private get prisma(): ShippingWeightsPrismaClient {
    return this.prismaService as unknown as ShippingWeightsPrismaClient;
  }
}
