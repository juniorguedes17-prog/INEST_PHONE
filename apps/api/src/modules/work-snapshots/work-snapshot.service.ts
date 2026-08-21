import { Injectable } from '@nestjs/common';
import { Prisma, WorkSnapshot } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const WORK_SNAPSHOT_SCOPES = {
  PRICING_BRAZIL_RADAR: 'PRICING_BRAZIL_RADAR',
  OFFERS_PRICING: 'OFFERS_PRICING',
} as const;

export type WorkSnapshotScope = (typeof WORK_SNAPSHOT_SCOPES)[keyof typeof WORK_SNAPSHOT_SCOPES];

@Injectable()
export class WorkSnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  async get<T>(userId: string, scope: WorkSnapshotScope): Promise<T | null> {
    const snapshot = await this.prisma.workSnapshot.findUnique({
      where: { userId_scope: { userId, scope } },
    });

    return snapshot ? (snapshot.payload as T) : null;
  }

  async replace<T extends Prisma.InputJsonValue>(
    userId: string,
    scope: WorkSnapshotScope,
    payload: T,
  ): Promise<WorkSnapshot> {
    return this.prisma.workSnapshot.upsert({
      where: { userId_scope: { userId, scope } },
      update: { payload },
      create: { userId, scope, payload },
    });
  }
}
