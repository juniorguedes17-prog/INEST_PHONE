import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { WORK_SNAPSHOT_SCOPES } from '../../work-snapshots/work-snapshot.service';
import { OffersWorkSnapshotService } from './offers-work-snapshot.service';

const draft = {
  targetModule: 'pricing',
  route: '/pricing',
  createdAt: '2026-08-21T16:30:00.000Z',
  source: 'pricing' as const,
  payload: {
    productName: 'iPhone 17 Pro Max 256GB',
    color: 'Azul',
    capacity: '256GB',
    salePrice: 6999,
    offerPrice: 7099,
    deliveryTime: 'Imediata',
    warranty: '12 meses',
  },
};

describe('OffersWorkSnapshotService', () => {
  it('replaces only the offers work snapshot and never touches commercial offers', async () => {
    const snapshots = { replace: vi.fn().mockResolvedValue(undefined) };
    const service = new OffersWorkSnapshotService(snapshots as never);

    await expect(
      service.replace({ drafts: [draft], failedCount: 0 }, { id: 'user-a' } as never),
    ).resolves.toEqual({ drafts: [draft], failedCount: 0 });
    expect(snapshots.replace).toHaveBeenCalledWith('user-a', WORK_SNAPSHOT_SCOPES.OFFERS_PRICING, {
      drafts: [draft],
      failedCount: 0,
    });
  });

  it('does not replace a previous work snapshot with an empty batch', async () => {
    const snapshots = { replace: vi.fn() };
    const service = new OffersWorkSnapshotService(snapshots as never);

    await expect(
      service.replace({ drafts: [], failedCount: 1 }, { id: 'user-a' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(snapshots.replace).not.toHaveBeenCalled();
  });

  it('returns a draft timestamp exactly as persisted', async () => {
    const stored = { drafts: [draft], failedCount: 0 };
    const snapshots = { get: vi.fn().mockResolvedValue(stored) };
    const service = new OffersWorkSnapshotService(snapshots as never);

    await expect(service.get({ id: 'user-a' } as never)).resolves.toEqual(stored);
    expect(snapshots.get).toHaveBeenCalledWith('user-a', WORK_SNAPSHOT_SCOPES.OFFERS_PRICING);
  });
});
