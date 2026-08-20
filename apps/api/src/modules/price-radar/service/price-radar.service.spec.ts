import { describe, expect, it, vi } from 'vitest';
import { AutomatedPriceQuoteRecord } from '../interfaces/price-radar-prisma.interface';
import { PriceRadarRepository } from '../repository/price-radar.repository';
import { PriceRadarService } from './price-radar.service';

function automatedQuote(
  id: string,
  supplierName: string,
  price: number,
  productName = 'iPhone 17 256GB',
  productId: string | null = null,
): AutomatedPriceQuoteRecord {
  return {
    id,
    productId,
    normalizedName: productName.toLowerCase(),
    productName,
    category: productName.startsWith('Produto') ? null : 'iPhone',
    model: productName,
    capacity: productName.includes('512GB') ? '512GB' : '256GB',
    color: 'Azul',
    condition: 'NOVO',
    price,
    availability: null,
    rawLine: `Azul R$ ${price}`,
    createdAt: new Date('2026-08-15T10:00:00.000Z'),
    product: productId ? { id: productId, productDescription: 'iPhone 17 256GB' } : null,
    currentList: {
      updatedAt: new Date('2026-08-15T10:00:00.000Z'),
      receivedAt: new Date('2026-08-15T10:00:00.000Z'),
      supplierContact: {
        id: `contact-${id}`,
        supplierName,
        whatsappNumber: `55119999999${id}`,
        address: 'Sao Paulo, SP',
      },
    },
  };
}

describe('PriceRadarService automated quotes', () => {
  it('retorna todas as cotacoes atuais mesmo quando o produto se repete em fornecedores', async () => {
    const automatedRecords = [
      automatedQuote('a', 'Fornecedor A', 4900, 'iPhone 17 256GB', 'resolved-product-id'),
      automatedQuote('b', 'Fornecedor B', 4750),
      automatedQuote('c', 'Fornecedor C', 4820),
      automatedQuote('unknown', 'Fornecedor D', 900, 'Produto XYZ 512GB'),
    ];
    const repository = {
      listQuotes: vi.fn().mockResolvedValue([]),
      listAutomatedQuotes: vi.fn().mockResolvedValue(automatedRecords),
    };
    const service = new PriceRadarService(repository as unknown as PriceRadarRepository);

    const quotes = await service.list({ sort: 'lowest_price' });

    expect(quotes).toHaveLength(4);
    expect(quotes.filter((quote) => quote.productName === 'iPhone 17 256GB')).toHaveLength(3);
    expect(quotes.map((quote) => quote.supplier.name)).toEqual(
      expect.arrayContaining(['Fornecedor A', 'Fornecedor B', 'Fornecedor C', 'Fornecedor D']),
    );
    expect(quotes.find((quote) => quote.id === 'evolution:a')?.productDescription).toBe(
      'iPhone 17 256GB',
    );
    expect(quotes.find((quote) => quote.id === 'evolution:a')).toMatchObject({
      source: 'BRAZIL_RADAR',
      sourceQuoteId: 'a',
      catalogProductId: 'resolved-product-id',
      productId: 'resolved-product-id',
    });
    expect(quotes.find((quote) => quote.id === 'evolution:unknown')).toMatchObject({
      source: 'BRAZIL_RADAR',
      sourceQuoteId: 'unknown',
      catalogProductId: null,
      productId: null,
      productName: 'Produto XYZ 512GB',
      productDescription: undefined,
      costProduct: 900,
    });
    expect(quotes.find((quote) => quote.id === 'evolution:b')).toMatchObject({
      catalogProductId: null,
      productId: null,
    });
  });

  it('compartilha a carga concorrente entre lista e KPIs equivalentes', async () => {
    const repository = {
      listQuotes: vi.fn().mockResolvedValue([]),
      listAutomatedQuotes: vi.fn().mockResolvedValue([]),
    };
    const service = new PriceRadarService(repository as unknown as PriceRadarRepository);

    const [quotes, kpis] = await Promise.all([
      service.list({ sort: 'lowest_price' }),
      service.kpis({ sort: 'lowest_price' }),
    ]);

    expect(quotes).toEqual([]);
    expect(kpis).toEqual({
      lowestValidPrice: 0,
      averagePrice: 0,
      highestPrice: 0,
      hiddenCount: 0,
    });
    expect(repository.listQuotes).toHaveBeenCalledOnce();
    expect(repository.listAutomatedQuotes).toHaveBeenCalledOnce();
  });
});
