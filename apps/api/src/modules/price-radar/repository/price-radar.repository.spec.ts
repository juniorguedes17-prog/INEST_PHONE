import { describe, expect, it, vi } from 'vitest';
import { PriceRadarRepository } from './price-radar.repository';

function listAutomatedQuotesAt(now: string) {
  const findMany = vi.fn().mockResolvedValue([]);
  const repository = new PriceRadarRepository({
    supplierCurrentListItem: { findMany },
  } as never);

  return repository.listAutomatedQuotes({}, new Date(now)).then(() => findMany.mock.calls[0]?.[0]);
}

describe('PriceRadarRepository automated list freshness', () => {
  it('nao aplica vigencia de lista automatica ao PriceHistory', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const repository = new PriceRadarRepository({ priceHistory: { findMany } } as never);

    await repository.listQuotes({});

    expect(findMany.mock.calls[0]?.[0].where.currentList).toBeUndefined();
  });

  it('oculta lista automatica com exatamente 24 horas em uma terca-feira', async () => {
    const args = await listAutomatedQuotesAt('2026-08-18T15:00:00.000Z');

    expect(args.where.currentList).toMatchObject({
      receivedAt: { gt: new Date('2026-08-17T15:00:00.000Z') },
    });
  });

  it('mantem lista automatica com menos de 24 horas', async () => {
    const args = await listAutomatedQuotesAt('2026-08-18T15:00:00.000Z');
    const cutoff = args.where.currentList.receivedAt.gt as Date;

    expect(new Date('2026-08-17T15:00:00.001Z') > cutoff).toBe(true);
  });

  it('mantem no domingo as listas recebidas no sabado', async () => {
    const args = await listAutomatedQuotesAt('2026-08-16T18:00:00.000Z');

    expect(args.where.currentList.OR).toEqual(
      expect.arrayContaining([
        {
          receivedAt: {
            gte: new Date('2026-08-15T03:00:00.000Z'),
            lt: new Date('2026-08-16T03:00:00.000Z'),
          },
        },
      ]),
    );
  });

  it('mantem na segunda-feira as listas recebidas no sabado', async () => {
    const args = await listAutomatedQuotesAt('2026-08-17T15:00:00.000Z');

    expect(args.where.currentList.OR).toEqual(
      expect.arrayContaining([
        {
          receivedAt: {
            gte: new Date('2026-08-15T03:00:00.000Z'),
            lt: new Date('2026-08-16T03:00:00.000Z'),
          },
        },
      ]),
    );
  });

  it('aplica a janela normal a uma nova FULL recebida na segunda-feira', async () => {
    const args = await listAutomatedQuotesAt('2026-08-17T15:00:00.000Z');
    const normalWindow = args.where.currentList.OR[0].receivedAt.gt as Date;

    expect(new Date('2026-08-17T14:00:00.000Z') > normalWindow).toBe(true);
  });

  it('preserva a filtragem por contato ativo e os scopes sem agrupamento adicional', async () => {
    const args = await listAutomatedQuotesAt('2026-08-18T15:00:00.000Z');

    expect(args.where.currentList.supplierContact).toEqual({ isActive: true });
    expect(args.where.currentList.snapshotScope).toBeUndefined();
  });
});
