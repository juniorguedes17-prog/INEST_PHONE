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

  it('creates an external USA offer without calling catalog Pricing', async () => {
    const repository = {
      ensureOfficialTemplates: vi.fn(),
      findTemplateByProductType: vi.fn().mockResolvedValue({
        id: 'template-1',
        name: 'Template',
        productType: 'IPHONE_SEALED',
        content: '{{produto}} {{preco_oferta}}',
      }),
      createOffer: vi.fn().mockResolvedValue({
        id: 'offer-us',
        message: 'Apple iPhone R$ 2.699,90',
        status: 'GENERATED',
        salePrice: 2677.09,
        offerPrice: 2699.9,
        createdAt: new Date('2026-09-06T12:00:00.000Z'),
        commercialTemplate: { id: 'template-1', name: 'Template', productType: 'IPHONE_SEALED' },
        items: [
          {
            id: 'item-us',
            productId: null,
            externalOrigin: 'US',
            externalProvider: 'amazon_us',
            externalSourceProductId: 'B0EXTERNAL',
            externalSourceName: 'Apple iPhone',
            externalSourceUrl: 'https://www.amazon.com/dp/B0EXTERNAL',
            externalRetailer: 'Amazon',
            salePrice: 2677.09,
            offerPrice: 2699.9,
          },
        ],
      }),
      createAuditLog: vi.fn(),
    };
    const pricing = { findOne: vi.fn() };
    const settings = {
      getSettings: vi.fn().mockResolvedValue({
        offers: { defaultDeadline: '5 dias', defaultWarranty: '90 dias' },
      }),
    };
    const service = new OffersService(
      repository as unknown as OffersRepository,
      pricing as unknown as PricingService,
      settings as unknown as SettingsService,
    );

    await expect(
      service.generate(
        {
          externalIdentity: {
            origin: 'US',
            provider: 'amazon_us',
            sourceProductId: 'B0EXTERNAL',
            sourceName: 'Apple iPhone',
            sourceUrl: 'https://www.amazon.com/dp/B0EXTERNAL',
            retailer: 'Amazon',
          },
          salePrice: 2677.09,
          offerPrice: 2699.9,
        },
        { id: 'user-1' } as never,
      ),
    ).resolves.toMatchObject({
      productId: null,
      externalIdentity: {
        origin: 'US',
        provider: 'amazon_us',
        sourceProductId: 'B0EXTERNAL',
      },
    });

    expect(pricing.findOne).not.toHaveBeenCalled();
    expect(repository.createOffer).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: expect.objectContaining({ kind: 'EXTERNAL' }),
        salePrice: 2677.09,
        offerPrice: 2699.9,
      }),
    );
  });

  it('rejects an external item without its complete identity', async () => {
    const service = new OffersService(
      { ensureOfficialTemplates: vi.fn() } as unknown as OffersRepository,
      {} as PricingService,
      {} as SettingsService,
    );

    await expect(
      service.generate(
        {
          externalIdentity: { origin: 'US', provider: 'amazon_us', sourceProductId: ' ' },
          salePrice: 100,
          offerPrice: 110,
        },
        { id: 'user-1' } as never,
      ),
    ).rejects.toThrow('origin, provider e sourceProductId');
  });
});
