import { describe, expect, it, vi } from 'vitest';
import { WORK_SNAPSHOT_SCOPES, WorkSnapshotService } from './work-snapshot.service';

type StoredSnapshot = {
  id: string;
  userId: string;
  scope: string;
  payload: unknown;
};

function createService() {
  const snapshots = new Map<string, StoredSnapshot>();
  const key = (userId: string, scope: string) => `${userId}:${scope}`;
  const prisma = {
    workSnapshot: {
      findUnique: vi.fn(async ({ where }) => {
        const composite = where.userId_scope;
        return snapshots.get(key(composite.userId, composite.scope)) ?? null;
      }),
      upsert: vi.fn(async ({ where, create, update }) => {
        const composite = where.userId_scope;
        const snapshotKey = key(composite.userId, composite.scope);
        const previous = snapshots.get(snapshotKey);
        const next: StoredSnapshot = previous
          ? { ...previous, payload: update.payload }
          : { id: `${create.userId}-${create.scope}`, ...create };

        snapshots.set(snapshotKey, next);
        return next;
      }),
    },
  };

  return {
    prisma,
    service: new WorkSnapshotService(prisma as never),
  };
}

describe('WorkSnapshotService', () => {
  it('returns null when the authenticated user has no snapshot for the scope', async () => {
    const { service } = createService();

    await expect(
      service.get('user-a', WORK_SNAPSHOT_SCOPES.PRICING_BRAZIL_RADAR),
    ).resolves.toBeNull();
  });

  it('replaces A with B atomically for the same authenticated user and scope', async () => {
    const { prisma, service } = createService();
    const scope = WORK_SNAPSHOT_SCOPES.PRICING_BRAZIL_RADAR;

    await service.replace('user-a', scope, { items: ['A'], failedCount: 0 });
    await service.replace('user-a', scope, { items: ['B'], failedCount: 1 });

    await expect(service.get('user-a', scope)).resolves.toEqual({
      items: ['B'],
      failedCount: 1,
    });
    expect(prisma.workSnapshot.upsert).toHaveBeenCalledTimes(2);
    expect(prisma.workSnapshot.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { userId_scope: { userId: 'user-a', scope } },
        update: { payload: { items: ['B'], failedCount: 1 } },
      }),
    );
  });

  it('isolates snapshots by user and scope', async () => {
    const { service } = createService();

    await service.replace('user-a', WORK_SNAPSHOT_SCOPES.PRICING_BRAZIL_RADAR, {
      items: ['pricing-a'],
      failedCount: 0,
    });
    await service.replace('user-a', WORK_SNAPSHOT_SCOPES.OFFERS_PRICING, {
      drafts: ['offers-a'],
      failedCount: 0,
    });
    await service.replace('user-b', WORK_SNAPSHOT_SCOPES.PRICING_BRAZIL_RADAR, {
      items: ['pricing-b'],
      failedCount: 0,
    });

    await expect(service.get('user-a', WORK_SNAPSHOT_SCOPES.PRICING_BRAZIL_RADAR)).resolves.toEqual(
      { items: ['pricing-a'], failedCount: 0 },
    );
    await expect(service.get('user-a', WORK_SNAPSHOT_SCOPES.OFFERS_PRICING)).resolves.toEqual({
      drafts: ['offers-a'],
      failedCount: 0,
    });
    await expect(service.get('user-b', WORK_SNAPSHOT_SCOPES.PRICING_BRAZIL_RADAR)).resolves.toEqual(
      { items: ['pricing-b'], failedCount: 0 },
    );
  });

  it('keeps A available when the write for B fails', async () => {
    const { prisma, service } = createService();
    const scope = WORK_SNAPSHOT_SCOPES.OFFERS_PRICING;

    await service.replace('user-a', scope, { drafts: ['A'], failedCount: 0 });
    prisma.workSnapshot.upsert.mockRejectedValueOnce(new Error('Falha de persistência.'));

    await expect(
      service.replace('user-a', scope, { drafts: ['B'], failedCount: 0 }),
    ).rejects.toThrow('Falha de persistência.');
    await expect(service.get('user-a', scope)).resolves.toEqual({
      drafts: ['A'],
      failedCount: 0,
    });
  });
});
