import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { WORK_SNAPSHOT_SCOPES } from '../../work-snapshots/work-snapshot.service';
import { PricingWorkSnapshotService } from './pricing-work-snapshot.service';

describe('PricingWorkSnapshotService', () => {
  it('persists only valid Radar calculations and reports failures without altering the calculation', async () => {
    const pricing = {
      calculateBrazilRadarQuote: vi.fn(async ({ sourceQuoteId }) => {
        if (sourceQuoteId === 'invalid') throw new Error('Cotacao indisponivel.');
        return { sourceQuoteId, salePrice: 5999 };
      }),
    };
    const snapshots = { replace: vi.fn().mockResolvedValue(undefined) };
    const service = new PricingWorkSnapshotService(pricing as never, snapshots as never);

    await expect(
      service.replaceFromRadar({ sourceQuoteIds: ['valid', 'invalid'] }, { id: 'user-a' } as never),
    ).resolves.toEqual({
      items: [{ sourceQuoteId: 'valid', salePrice: 5999 }],
      failedCount: 1,
    });
    expect(snapshots.replace).toHaveBeenCalledWith(
      'user-a',
      WORK_SNAPSHOT_SCOPES.PRICING_BRAZIL_RADAR,
      { items: [{ sourceQuoteId: 'valid', salePrice: 5999 }], failedCount: 1 },
    );
  });

  it('does not calculate a duplicated Radar source quote twice', async () => {
    const pricing = {
      calculateBrazilRadarQuote: vi
        .fn()
        .mockResolvedValue({ sourceQuoteId: 'valid', salePrice: 5999 }),
    };
    const snapshots = { replace: vi.fn().mockResolvedValue(undefined) };
    const service = new PricingWorkSnapshotService(pricing as never, snapshots as never);

    await service.replaceFromRadar({ sourceQuoteIds: ['valid', 'valid'] }, {
      id: 'user-a',
    } as never);

    expect(pricing.calculateBrazilRadarQuote).toHaveBeenCalledTimes(1);
  });

  it('preserves the prior snapshot when every selected Radar quote is invalid', async () => {
    const pricing = {
      calculateBrazilRadarQuote: vi.fn().mockRejectedValue(new Error('Cotacao indisponivel.')),
    };
    const snapshots = { replace: vi.fn() };
    const service = new PricingWorkSnapshotService(pricing as never, snapshots as never);

    await expect(
      service.replaceFromRadar({ sourceQuoteIds: ['invalid'] }, { id: 'user-a' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(snapshots.replace).not.toHaveBeenCalled();
  });
});
