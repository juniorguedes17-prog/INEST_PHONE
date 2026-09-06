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

  it('persists a USA external item without a catalog Product', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'offer-us' });
    const repository = new OffersRepository({ offer: { create } } as unknown as PrismaService);

    await repository.createOffer({
      identity: {
        externalIdentity: {
          origin: 'US',
          provider: 'amazon_us',
          sourceProductId: 'B0EXTERNAL',
          sourceName: 'Apple iPhone',
          sourceUrl: 'https://www.amazon.com/dp/B0EXTERNAL',
          retailer: 'Amazon',
        },
      },
      commercialTemplateId: 'template-1',
      message: 'Oferta externa',
      salePrice: 2677.09,
      offerPrice: 2699.9,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: expect.objectContaining({
              externalOrigin: 'US',
              externalProvider: 'amazon_us',
              externalSourceProductId: 'B0EXTERNAL',
            }),
          },
        }),
      }),
    );
  });

  it('preserves a canonical Product when external context is also present', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'offer-catalog' });
    const repository = new OffersRepository({ offer: { create } } as unknown as PrismaService);

    await repository.createOffer({
      identity: {
        productId: 'catalog-product-id',
        externalIdentity: {
          origin: 'US',
          provider: 'amazon_us',
          sourceProductId: 'B0EXTERNAL',
        },
      },
      commercialTemplateId: 'template-1',
      message: 'Oferta canonica',
      salePrice: 100,
      offerPrice: 110,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: { create: expect.objectContaining({ productId: 'catalog-product-id' }) },
        }),
      }),
    );
  });

  it('duplicates an external item with the same deterministic provenance', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'offer-copy' });
    const repository = new OffersRepository({ offer: { create } } as unknown as PrismaService);

    await repository.duplicateOffer({
      id: 'offer-us',
      commercialTemplateId: 'template-1',
      message: 'Oferta externa',
      status: 'GENERATED',
      salePrice: 100,
      offerPrice: 110,
      createdAt: new Date(),
      updatedAt: new Date(),
      items: [
        {
          id: 'item-us',
          productId: null,
          externalOrigin: 'US',
          externalProvider: 'upcitemdb_us',
          externalSourceProductId: 'upc:canon:t7',
          externalSourceName: 'Canon EOS Rebel T7',
          salePrice: 100,
          offerPrice: 110,
        },
      ],
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            create: expect.objectContaining({
              externalOrigin: 'US',
              externalProvider: 'upcitemdb_us',
              externalSourceProductId: 'upc:canon:t7',
            }),
          },
        }),
      }),
    );
  });
});
