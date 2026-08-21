import { describe, expect, it, vi } from 'vitest';
import { PricingService } from '../../pricing/service/pricing.service';
import { SettingsService } from '../../settings/service/settings.service';
import { OffersRepository } from '../repository/offers.repository';
import { OffersService } from './offers.service';

describe('OffersService', () => {
  it('adds the optional Product summary without changing existing offer fields', async () => {
    const repository = {
      listOffers: vi.fn().mockResolvedValue([
        {
          id: 'offer-1',
          message: 'Oferta',
          status: 'GENERATED',
          salePrice: 6999,
          offerPrice: 7099,
          createdAt: new Date('2026-08-21T12:00:00.000Z'),
          commercialTemplate: {
            id: 'template-1',
            name: 'Template',
            productType: 'IPHONE_SEALED',
            status: 'ACTIVE',
          },
          items: [
            {
              id: 'item-1',
              productId: 'product-1',
              salePrice: 6999,
              offerPrice: 7099,
              product: {
                id: 'product-1',
                productDescription: 'iPhone 17 Pro Max 256GB',
                model: { name: 'iPhone 17 Pro Max' },
                color: { name: 'Azul' },
              },
            },
          ],
        },
      ]),
    };
    const service = new OffersService(
      repository as unknown as OffersRepository,
      {} as PricingService,
      {} as SettingsService,
    );

    await expect(service.list()).resolves.toEqual([
      expect.objectContaining({
        id: 'offer-1',
        salePrice: 6999,
        offerPrice: 7099,
        productId: 'product-1',
        product: {
          id: 'product-1',
          name: 'iPhone 17 Pro Max 256GB',
          model: 'iPhone 17 Pro Max',
          color: 'Azul',
        },
      }),
    ]);
  });
});
