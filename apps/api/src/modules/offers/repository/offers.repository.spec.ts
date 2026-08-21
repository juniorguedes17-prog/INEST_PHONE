import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../prisma/prisma.service';
import { OffersRepository } from './offers.repository';

describe('OffersRepository', () => {
  it('lists only non-deleted offers and includes the first item Product summary', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new OffersRepository({ offer: { findMany } } as unknown as PrismaService);

    await repository.listOffers();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { deletedAt: null },
        include: expect.objectContaining({
          items: expect.objectContaining({
            include: expect.objectContaining({
              product: expect.objectContaining({
                select: expect.objectContaining({ productDescription: true }),
              }),
            }),
          }),
        }),
      }),
    );
  });
});
