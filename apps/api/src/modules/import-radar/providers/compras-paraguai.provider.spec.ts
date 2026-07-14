import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ComprasParaguaiProvider,
  inferProductAttributes,
  parseProductOffers,
  parseSearchResults,
} from './compras-paraguai.provider';

const searchFixture = `
  <article class="promocao-produtos-item">
    <a class="promocao-item-nome truncate" href="/celular-apple-iphone-17-pro-256gb_63989/">
      Celular Apple iPhone 17 Pro 256GB Natural
    </a>
    <img class="lozad" src="https://image.example/iphone.jpg" />
    <div class="price-model"><span>US$ 1.103,00</span></div>
    <div class="promocao-item-preco-text">R$ 5.801,78</div>
    <span class="ver-detalhes">91 OFERTAS</span>
  </article>
`;

const offersFixture = `
  <section id="container-ofertas">
    <article class="promocao-produtos-item">
      <a class="promocao-item-loja" href="/loja/cellshop/">Cellshop</a>
      <div class="promocao-item-preco">US$ 1.100,00</div>
      <span>Ciudad del Este - Em estoque</span>
    </article>
    <article class="promocao-produtos-item">
      <a class="promocao-item-loja" href="/loja/nissei/">Nissei</a>
      <div class="promocao-item-preco">US$ 1.200,00</div>
      <span>Ciudad del Este - Disponivel</span>
    </article>
  </section>
`;

describe('ComprasParaguaiProvider parsers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('normaliza resultados reais por seletores e identificador externo', () => {
    const [product] = parseSearchResults(searchFixture, '2026-07-13T00:00:00.000Z');

    expect(product).toMatchObject({
      id: 'py-63989',
      externalId: '63989',
      name: 'Celular Apple iPhone 17 Pro 256GB Natural',
      category: 'iPhone',
      brand: 'Apple',
      capacity: '256GB',
      color: 'Natural',
      priceUsd: 1103,
      priceBrlSource: 5801.78,
      offerCount: 91,
      origin: 'PY',
    });
  });

  it('normaliza ofertas sem combinar lojas diferentes', () => {
    expect(parseProductOffers(offersFixture)).toEqual([
      expect.objectContaining({ store: 'Cellshop', priceUsd: 1100, city: 'Ciudad del Este' }),
      expect.objectContaining({ store: 'Nissei', priceUsd: 1200, city: 'Ciudad del Este' }),
    ]);
  });

  it('retorna lista vazia quando a fonte nao possui resultados', () => {
    expect(parseSearchResults('<main>Nenhum produto encontrado</main>', '2026-07-13T00:00:00.000Z')).toEqual([]);
  });

  it('identifica familias sem aproximar produtos distintos', () => {
    expect(inferProductAttributes('Notebook Apple MacBook Air M5 15 512GB')).toMatchObject({
      category: 'MacBook',
      brand: 'Apple',
      capacity: '512GB',
    });
  });

  it('retorna falha controlada quando a fonte esta indisponivel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const provider = new ComprasParaguaiProvider();

    await expect(provider.search({ search: 'iPhone 17 Pro' })).rejects.toThrow(
      'O Compras Paraguai esta indisponivel no momento',
    );
  });
});
