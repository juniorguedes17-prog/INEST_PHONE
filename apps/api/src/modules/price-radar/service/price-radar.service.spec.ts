import { describe, expect, it, vi } from 'vitest';
import { AutomatedPriceQuoteRecord } from '../interfaces/price-radar-prisma.interface';
import { PriceRadarRepository } from '../repository/price-radar.repository';
import { PriceRadarService } from './price-radar.service';

function automatedQuote(
  id: string,
  supplierName: string,
  price: number,
  productName = 'iPhone 17 256GB',
): AutomatedPriceQuoteRecord {
  return {
    id,
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
      automatedQuote('a', 'Fornecedor A', 4900),
      automatedQuote('b', 'Fornecedor B', 4750),
      automatedQuote('c', 'Fornecedor C', 4820),
      automatedQuote('unknown', 'Fornecedor D', 900, 'Produto XYZ 512GB'),
    ];
    const repository = {
      listQuotes: vi.fn().mockResolvedValue([]),
      listAutomatedQuotes: vi.fn().mockResolvedValue(automatedRecords),
      listActiveCatalogDescriptions: vi.fn().mockResolvedValue([
        {
          productDescription: 'iPhone 17 256GB',
          normalizedDescription: 'iphone 17 256gb',
          profitCondition: 'NOVO',
        },
      ]),
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
    expect(quotes.find((quote) => quote.id === 'evolution:unknown')).toMatchObject({
      productName: 'Produto XYZ 512GB',
      productDescription: undefined,
      costProduct: 900,
    });
  });
});
