import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ComprasParaguaiProvider,
  inferProductAttributes,
  parseProductOffers,
  parseSearchResults,
  parseSourceManufacturer,
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
      <a class="promocao-item-nome" href="/apple-macbook-air-m5-16gb-512gb-starlight__5369225/">
        Apple MacBook Air M5 16GB 512GB Starlight
      </a>
      <a class="promocao-item-loja" href="/loja/super-games/">Super Games</a>
      <div class="promocao-item-preco">US$ 1.350,00</div>
      <span>Ciudad del Este - Em estoque</span>
    </article>
    <article class="promocao-produtos-item">
      <a class="promocao-item-nome" href="/apple-macbook-air-m5-16gb-512gb-silver-new__5512689/">
        Apple MacBook Air M5 16GB 512GB Silver New
      </a>
      <a class="promocao-item-loja" href="/loja/lg-importados/">LG Importados</a>
      <div class="promocao-item-preco">US$ 1.500,00</div>
      <span>Ciudad del Este - Disponivel</span>
    </article>
  </section>
`;

function offerFixture(input: {
  id: string;
  name: string;
  price: string;
  store?: string;
  slug?: string;
}) {
  const store = input.store ?? 'Cellshop';
  const slug = input.slug ?? 'produto';
  return `
    <article class="promocao-produtos-item">
      <a class="promocao-item-nome" href="/${slug}__${input.id}/">${input.name}</a>
      <a class="promocao-item-loja" href="/loja/${store.toLowerCase()}/">${store}</a>
      <div class="promocao-item-preco">US$ ${input.price}</div>
      <span>Ciudad del Este - Em estoque</span>
    </article>
  `;
}

function htmlResponse(body: string) {
  return { ok: true, status: 200, text: async () => body };
}

const detailWithManufacturerFixture = `
  <table><tr><th>Marca</th><td>Canon</td></tr></table>
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

  it.each([
    {
      name: 'prioriza title de imagem sem texto explicito',
      image:
        '<img class="lozad" src="/Static/Images/Loading-Images.Svg" data-src="https://example.com/iphone.webp" alt="iPhone 15 128gb Pink Swap A+" title="iPhone 15 128gb Pink Swap A+" />',
      expected: 'iPhone 15 128gb Pink Swap A+',
    },
    {
      name: 'usa alt quando title esta ausente',
      image: '<img class="lozad" alt="iPhone 15 128gb Pink Swap A+" />',
      expected: 'iPhone 15 128gb Pink Swap A+',
    },
    {
      name: 'usa title quando alt esta ausente',
      image: '<img class="lozad" title="iPhone 15 128gb Pink Swap A+" />',
      expected: 'iPhone 15 128gb Pink Swap A+',
    },
    {
      name: 'decodifica entidades HTML no atributo',
      image: '<img class="lozad" title="iPhone 15&nbsp;128gb Pink &amp; Swap A+" />',
      expected: 'iPhone 15 128gb Pink & Swap A+',
    },
  ])('$name', ({ image, expected }) => {
    const [product] = parseSearchResults(
      `
        <article class="promocao-produtos-item">
          <a class="promocao-item-nome" href="/iphone-15__150/">${image}</a>
          <div class="price-model">US$ 500,00</div>
        </article>
      `,
      '2026-09-10T00:00:00.000Z',
    );

    expect(product?.name).toBe(expected);
    expect(product?.name).not.toContain('<img');
  });

  it('prioriza texto explicito e nunca usa markup como fallback de nome', () => {
    const [product] = parseSearchResults(
      `
        <article class="promocao-produtos-item">
          <a class="promocao-item-nome" href="/iphone-15__151/">iPhone 15 128gb Pink Swap A+<img class="lozad" /></a>
          <div class="price-model">US$ 500,00</div>
        </article>
      `,
      '2026-09-10T00:00:00.000Z',
    );

    expect(product?.name).toBe('iPhone 15 128gb Pink Swap A+');
  });

  it('preserva condition explicita da descricao para o calculo', () => {
    const [product] = parseSearchResults(
      searchFixture.replace('Natural', 'CPO Natural'),
      '2026-07-13T00:00:00.000Z',
    );

    expect(product).toMatchObject({ condition: 'CPO' });
  });

  it('preserva identidade, URL e condition New da mesma oferta', () => {
    expect(parseProductOffers(offersFixture)[1]).toMatchObject({
      id: 'py-5512689',
      externalId: '5512689',
      name: 'Apple MacBook Air M5 16GB 512GB Silver New',
      store: 'LG Importados',
      priceUsd: 1500,
      productUrl:
        'https://www.comprasparaguai.com.br/apple-macbook-air-m5-16gb-512gb-silver-new__5512689/',
      condition: 'NOVO',
    });
  });

  it('extrai title de imagem no detalhe e limpa markup auxiliar do fornecedor', () => {
    const [offer] = parseProductOffers(`
      <article class="promocao-produtos-item">
        <a class="promocao-item-nome" href="/iphone-15__152/"><img class="lozad" title="iPhone 15 128gb Pink Swap A+" /></a>
        <a class="promocao-item-loja" href="/loja/cellshop/">&nbsp;<i class="fa fa-external-link"></i> Cellshop</a>
        <div class="promocao-item-preco">US$ 500,00</div>
      </article>
    `);

    expect(offer).toMatchObject({
      name: 'iPhone 15 128gb Pink Swap A+',
      store: 'Cellshop',
    });
  });

  it('mantem a menor oferta sem condition e nao copia New da oferta mais cara', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(htmlResponse(searchFixture.replace('Natural', 'New Natural')))
      .mockResolvedValueOnce(htmlResponse(offersFixture));
    vi.stubGlobal('fetch', fetchMock);

    const [product] = await new ComprasParaguaiProvider().search({ search: 'MacBook Air M5' });

    expect(product).toMatchObject({
      id: 'py-5369225',
      externalId: '5369225',
      name: 'Apple MacBook Air M5 16GB 512GB Starlight',
      store: 'Super Games',
      priceUsd: 1350,
      productUrl:
        'https://www.comprasparaguai.com.br/apple-macbook-air-m5-16gb-512gb-starlight__5369225/',
    });
    expect(product?.condition).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('preserva todos os campos quando a oferta New e a menor selecionada', async () => {
    const selectedOffer = offerFixture({
      id: '8001',
      name: 'Camera Canon EOS New',
      price: '700,00',
      store: 'Adorama',
      slug: 'camera-canon-eos-new',
    });
    const higherOffer = offerFixture({
      id: '8002',
      name: 'Camera Canon EOS',
      price: '800,00',
      store: 'Cellshop',
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(htmlResponse(searchFixture))
      .mockResolvedValueOnce(htmlResponse(`<section>${selectedOffer}${higherOffer}</section>`));
    vi.stubGlobal('fetch', fetchMock);

    const [product] = await new ComprasParaguaiProvider().search({ search: 'Canon EOS' });

    expect(product).toMatchObject({
      id: 'py-8001',
      externalId: '8001',
      name: 'Camera Canon EOS New',
      sourceEvidence: 'Camera Canon EOS New',
      store: 'Adorama',
      priceUsd: 700,
      productUrl: 'https://www.comprasparaguai.com.br/camera-canon-eos-new__8001/',
      condition: 'NOVO',
    });
  });

  it.each([
    ['Used', 'SEMINOVO'],
    ['Refurbished', 'SEMINOVO'],
    ['CPO', 'CPO'],
  ] as const)('reutiliza o normalizador existente para %s', (marker, expected) => {
    const [offer] = parseProductOffers(
      offerFixture({ id: '7001', name: `Camera Sony Alpha ${marker}`, price: '900,00' }),
    );

    expect(offer?.condition).toBe(expected);
  });

  it('mantem condition ausente quando a evidencia da oferta e conflitante', () => {
    const [offer] = parseProductOffers(
      offerFixture({ id: '7002', name: 'Camera Fujifilm New Used', price: '850,00' }),
    );

    expect(offer?.condition).toBeUndefined();
  });

  it('aplica a mesma identidade de oferta a outra marca e categoria', () => {
    const [offer] = parseProductOffers(
      offerFixture({
        id: '4778989',
        name: 'Samsung Galaxy A36 5G Dual 256GB Awesome Lavender',
        price: '299,00',
        store: 'Nissei',
        slug: 'samsung-galaxy-a36-awesome-lavender',
      }),
    );

    expect(offer).toMatchObject({
      id: 'py-4778989',
      externalId: '4778989',
      name: 'Samsung Galaxy A36 5G Dual 256GB Awesome Lavender',
      store: 'Nissei',
      priceUsd: 299,
      productUrl:
        'https://www.comprasparaguai.com.br/samsung-galaxy-a36-awesome-lavender__4778989/',
    });
    expect(offer?.condition).toBeUndefined();
  });

  it('extrai somente a Marca sem promover o titulo a fabricante authoritative', () => {
    expect(parseSourceManufacturer(detailWithManufacturerFixture)).toBe('Canon');
    expect(parseSourceManufacturer(searchFixture)).toBeUndefined();
    expect(parseSourceManufacturer('<dl><dt>Marca</dt><dd>Apple</dd></dl>')).toBe('Apple');
  });

  it('retorna lista vazia quando a fonte nao possui resultados', () => {
    expect(
      parseSearchResults('<main>Nenhum produto encontrado</main>', '2026-07-13T00:00:00.000Z'),
    ).toEqual([]);
  });

  it('identifica familias sem aproximar produtos distintos', () => {
    expect(inferProductAttributes('Notebook Apple MacBook Air M5 15 512GB')).toMatchObject({
      category: 'MacBook',
      brand: 'Apple',
      capacity: '512GB',
    });
  });

  it('preserva chip, tela e memoria do MacBook para a consulta exata de lucro', () => {
    expect(inferProductAttributes('Notebook Apple MacBook Air M5 13 16GB 512GB')).toMatchObject({
      category: 'MacBook',
      model: 'MacBook Air M5 13 16GB/512GB',
      capacity: '16GB/512GB',
    });
  });

  it('preserva a configuracao do MacBook Neo para a consulta de lucro', () => {
    expect(
      inferProductAttributes(
        'Notebook Apple MacBook Neo 2026 Apple A18 Pro Memoria 8GB SSD 256GB 13"',
      ),
    ).toMatchObject({
      category: 'MacBook',
      model: 'MacBook Neo A18 Pro 13 8GB/256GB',
      capacity: '8GB/256GB',
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
