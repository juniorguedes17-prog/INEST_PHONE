import { describe, expect, it } from 'vitest';
import {
  isValidParsedSupplierListSnapshot,
  normalizeProductText,
  parseSupplierListText,
  type SupplierLineRejection,
} from './supplier-list.parser';

describe('supplier list parser', () => {
  it('processa uma lista textual com produto, cor e preco em linhas separadas', () => {
    const items = parseSupplierListText(`
      IPHONES LACRADOS
      17 PRO MAX 256GB
      LARANJA R$ 6.650,00
      AZUL R$ 6.700,00
    `);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      category: 'iPhone',
      capacity: '256GB',
      color: 'laranja',
      condition: 'NOVO',
      price: 6650,
    });
    expect(items[1]?.price).toBe(6700);
  });

  it('mantem os itens identicos e apenas observa rejeicoes sem alterar o resultado', () => {
    const input = 'iPhone 17 Pro 256GB\nAzul R$ 6.650';
    const rejections: Array<{ rawLine: string; reason: string }> = [];
    const headerRejections: Array<{ rawLine: string; reason: string }> = [];

    expect(
      parseSupplierListText(input, { onLineRejected: (rejection) => rejections.push(rejection) }),
    ).toEqual(parseSupplierListText(input));
    expect(rejections).toHaveLength(0);
    expect(
      parseSupplierListText('IPHONES LACRADOS', {
        onLineRejected: (rejection) => headerRejections.push(rejection),
      }),
    ).toEqual([]);
    expect(headerRejections).toHaveLength(0);
  });

  it('observa preco sem contexto e produto sem preco nos branches existentes', () => {
    const rejections: Array<{ rawLine: string; reason: string }> = [];

    expect(
      parseSupplierListText('R$ 6.650\niPhone 17 Pro 256GB', {
        onLineRejected: (rejection) => rejections.push(rejection),
      }),
    ).toEqual([]);
    expect(rejections).toEqual([
      expect.objectContaining({ rawLine: 'R$ 6.650', reason: 'missing_product_context' }),
      expect.objectContaining({ rawLine: 'iPhone 17 Pro 256GB', reason: 'invalid_or_missing_price' }),
    ]);
  });

  it('expõe contexto local sem alterar itens nem a razão da rejeição', () => {
    const input = '\nSEMINOVOS\nR$ 2.100\niPhone 15 128GB\nPRETO R$ 2.100';
    const expectedItems = parseSupplierListText(input);
    const rejections: SupplierLineRejection[] = [];
    const items = parseSupplierListText(input, {
      onLineRejected: (rejection) => rejections.push(rejection),
    });

    expect(items).toEqual(expectedItems);
    expect(rejections).toHaveLength(1);
    expect(rejections[0]).toMatchObject({
      lineIndex: 2,
      rawLine: 'R$ 2.100',
      reason: 'missing_product_context',
      previousLines: ['SEMINOVOS'],
      nextLines: ['iPhone 15 128GB', 'PRETO R$ 2.100'],
      activeProductHeading: null,
      activeCategory: null,
      activeCondition: 'SEMINOVO',
      qualityGrade: null,
      detectedPrice: 2100,
    });
  });

  it('usa null e listas vazias quando o parser ainda nao possui contexto', () => {
    const rejections: SupplierLineRejection[] = [];

    expect(
      parseSupplierListText('R$ 900', {
        onLineRejected: (rejection) => rejections.push(rejection),
      }),
    ).toEqual([]);
    expect(rejections[0]).toMatchObject({
      lineIndex: 0,
      rawLine: 'R$ 900',
      reason: 'missing_product_context',
      previousLines: [],
      nextLines: [],
      activeProductHeading: null,
      activeCategory: null,
      activeCondition: 'NOVO',
      qualityGrade: null,
      detectedPrice: 900,
    });
  });

  it('expõe heading e grade ativos no momento da rejeição', () => {
    const rejections: SupplierLineRejection[] = [];

    expect(
      parseSupplierListText('GRADE A\niPhone 15 128GB', {
        onLineRejected: (rejection) => rejections.push(rejection),
      }),
    ).toEqual([]);
    expect(rejections[0]).toMatchObject({
      lineIndex: 1,
      rawLine: 'iPhone 15 128GB',
      reason: 'invalid_or_missing_price',
      previousLines: ['GRADE A'],
      nextLines: [],
      activeProductHeading: 'iPhone 15 128GB',
      activeCategory: null,
      activeCondition: 'NOVO',
      qualityGrade: 'A',
      detectedPrice: null,
    });
  });

  it('mantem rejeicoes finais sem inferir uma oferta a partir do contexto', () => {
    const rejections: SupplierLineRejection[] = [];
    const items = parseSupplierListText('R$ 6.650\niPhone 17 Pro 256GB', {
      onLineRejected: (rejection) => rejections.push(rejection),
    });

    expect(items).toEqual([]);
    expect(rejections.map(({ reason }) => reason)).toEqual([
      'missing_product_context',
      'invalid_or_missing_price',
    ]);
    expect(rejections.map(({ rawLine }) => rawLine)).toEqual([
      'R$ 6.650',
      'iPhone 17 Pro 256GB',
    ]);
  });

  it('mantem a condicao CPO e nao trata valores brasileiros como texto', () => {
    const items = parseSupplierListText(`
      APARELHOS CPO
      iPhone 16 Pro 256GB CPO
      Preto 💰4.950
    `);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ condition: 'CPO', price: 4950, color: 'preto' });
  });

  it('reconhece SEMI NOVOS no cabecalho e nao usa bateria como evidencia', () => {
    const items = parseSupplierListText(`
      IPHONES SEMI NOVOS - bateria 85% - 100%
      iPhone 16 Pro 256GB
      Preto R$ 4.500
      iPhone 15 128GB
      Azul R$ 3.500
    `);

    expect(items).toHaveLength(2);
    expect(items.every((item) => item.condition === 'SEMINOVO')).toBe(true);
  });

  it('reconhece SEMINOVOS como contexto SEMINOVO', () => {
    const [item] = parseSupplierListText('SEMINOVOS\niPhone 16 128GB\nPreto R$ 3.500');

    expect(item).toMatchObject({ condition: 'SEMINOVO', price: 3500 });
  });

  it('trata SEMINOVOS como nova secao mesmo apos um produto anterior', () => {
    const items = parseSupplierListText(`
      iPhone 15 128GB
      Preto R$ 3.000
      SEMINOVOS
      iPhone 16 128GB
      Azul R$ 4.000
    `);

    expect(items.map((item) => item.condition)).toEqual(['NOVO', 'SEMINOVO']);
  });

  it('permite que uma nova secao NOVO substitua o contexto CPO', () => {
    const items = parseSupplierListText(`
      APARELHOS CPO
      iPhone 14 Pro 256GB
      Preto R$ 3.500
      iPhone 13 128GB
      Azul R$ 2.500
      IPHONES LACRADOS
      iPhone 16 128GB
      Branco R$ 4.000
      iPhone 15 128GB
      Natural R$ 3.200
    `);

    expect(items.map((item) => item.condition)).toEqual(['CPO', 'CPO', 'NOVO', 'NOVO']);
  });

  it('nao deixa CPO vazar apos uma secao explicita de outra condicao', () => {
    const items = parseSupplierListText(`
      APARELHOS CPO
      iPhone 14 Pro 256GB
      Preto R$ 3.500
      IPHONES NOVOS
      iPhone 16 128GB
      Branco R$ 4.000
      iPad 11 128GB
      Azul R$ 2.500
    `);

    expect(items.map((item) => item.condition)).toEqual(['CPO', 'NOVO', 'NOVO']);
  });

  it('preserva CPO em texto descritivo de novo lacrado dentro da secao CPO', () => {
    const items = parseSupplierListText(`
      APARELHOS CPO
      Recondicionado pela apple
      Novo lacrado e com garantia apple
      iPhone 15 Pro 256GB
      Preto R$ 3.500
    `);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ condition: 'CPO', price: 3500 });
  });

  it('preserva a sequencia de contexto SWAP, lacrados e CPO', () => {
    const items = parseSupplierListText(`
      LISTA-SWAP
      iPhone 15 128GB
      Preto R$ 3.000
      IPHONES LACRADOS
      iPhone 16 128GB
      Azul R$ 4.000
      CPO
      iPhone 14 Pro 256GB
      Natural R$ 3.500
    `);

    expect(items.map((item) => item.condition)).toEqual(['SEMINOVO', 'NOVO', 'CPO']);
  });

  it('preserva a sequencia de secoes Apple lacrados e Apple CPO lacrados', () => {
    const items = parseSupplierListText(`
      LISTA APPLE LACRADOS
      iPhone 16 128GB
      Preto R$ 4.000
      LISTA APPLE CPO LACRADOS
      iPhone 15 Pro 256GB
      Natural R$ 3.500
    `);

    expect(items.map((item) => item.condition)).toEqual(['NOVO', 'CPO']);
  });

  it('permite que Apple lacrados abra uma nova secao apos CPO', () => {
    const items = parseSupplierListText(`
      APARELHOS CPO
      iPhone 14 Pro 256GB
      Preto R$ 3.500
      LISTA APPLE LACRADOS
      iPhone 16 128GB
      Azul R$ 4.000
    `);

    expect(items.map((item) => item.condition)).toEqual(['CPO', 'NOVO']);
  });

  it('mantem NOVO quando a linha informa somente bateria', () => {
    const [item] = parseSupplierListText('iPhone 16 128GB\nBateria 100%\nPreto R$ 4.000');

    expect(item).toMatchObject({ condition: 'NOVO', price: 4000 });
  });

  it('reconhece recondicionado pela apple como CPO', () => {
    const [item] = parseSupplierListText(
      'Recondicionado pela Apple iPhone 15 Pro 256GB\nPreto R$ 3.500',
    );

    expect(item).toMatchObject({ condition: 'CPO', price: 3500 });
  });

  it('reconhece SWAP inline como SEMINOVO sem alterar a identidade por downstream', () => {
    const [item] = parseSupplierListText('iPhone 15 256GB SWAP\nPreto R$ 3.000');

    expect(item).toMatchObject({ condition: 'SEMINOVO', price: 3000 });
  });

  it('interpreta produtos Apple compactos com CPO inline sem perder o contexto', () => {
    const rejections: Array<{ rawLine: string; reason: string }> = [];
    const items = parseSupplierListText(
      `
        _________CPO
        📳16 PRO MAX 512 CPO
        ⚓️NATURAL/ 💲5.930
        📳15 PRO 128 CPO
        ⚓️PRETO/ 💲3.850 - 1
      `,
      { onLineRejected: (rejection) => rejections.push(rejection) },
    );

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedName: 'iphone 16 pro max 512gb',
          capacity: '512GB',
          color: 'natural',
          price: 5930,
          condition: 'CPO',
        }),
        expect.objectContaining({
          normalizedName: 'iphone 15 pro 128gb',
          capacity: '128GB',
          color: 'preto',
          price: 3850,
          condition: 'CPO',
        }),
      ]),
    );
    expect(items).toHaveLength(2);
    expect(rejections).not.toContainEqual(
      expect.objectContaining({ reason: 'missing_product_context' }),
    );
  });

  it.each(['CPO', 'LISTA CPO', 'CPO DISPONÍVEL'])(
    'mantem %s como contexto isolado e nao como produto',
    (heading) => {
      expect(parseSupplierListText(heading)).toEqual([]);
    },
  );

  it.each(['LISTA SWAP', 'LISTA-SWAP', 'SWAP'])(
    'trata %s como contexto SEMINOVO e nao como produto',
    (heading) => {
      const items = parseSupplierListText(`${heading}\niPhone 15 Pro 256GB\nNatural R$ 3.800`);

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        productName: 'iPhone 15 Pro 256GB',
        normalizedName: 'iphone 15 pro 256gb',
        capacity: '256GB',
        color: 'natural',
        condition: 'SEMINOVO',
        price: 3800,
      });
      expect(items.some((item) => /lista[- ]swap/i.test(item.productName))).toBe(false);
    },
  );

  it('mantem SEMINOVO para todos os produtos dentro do contexto SWAP', () => {
    const items = parseSupplierListText(`
      LISTA SWAP
      iPhone 15 Pro 256GB
      Natural R$ 3.800
      iPhone 16 Pro Max 256GB
      Desert R$ 4.900
    `);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.condition)).toEqual(['SEMINOVO', 'SEMINOVO']);
    expect(items.map((item) => item.price)).toEqual([3800, 4900]);
  });

  it.each(['GRADE A', 'GRADE A+', 'GRADE AB', 'GRADE B', 'GRADE C'])(
    'nao transforma %s em produto',
    (grade) => {
      expect(parseSupplierListText(grade)).toEqual([]);
    },
  );

  it('preserva grades A e A+ como ofertas SEMINOVO sem contaminarem a identidade do produto', () => {
    const items = parseSupplierListText(`
      GRADE A
      iPhone 15 Pro 256GB
      Natural R$ 3.800
      GRADE A+
      iPhone 16 Pro Max 256GB
      Desert R$ 4.900
    `);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedName: 'iphone 15 pro 256gb',
          condition: 'SEMINOVO',
          qualityGrade: 'A',
          color: 'natural',
          price: 3800,
        }),
        expect.objectContaining({
          normalizedName: 'iphone 16 pro max 256gb',
          condition: 'SEMINOVO',
          qualityGrade: 'A+',
          color: 'desert',
          price: 4900,
        }),
      ]),
    );
    expect(items.every((item) => !/grade\s*[abc]/i.test(item.productName))).toBe(true);
  });

  it('mantem A e A+ como ofertas distintas do mesmo produto', () => {
    const items = parseSupplierListText(`
      iPhone 15 128GB
      Grade A — R$ 2.100
      Grade A+ — R$ 2.200
    `);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.qualityGrade)).toEqual(['A', 'A+']);
    expect(items.map((item) => item.condition)).toEqual(['SEMINOVO', 'SEMINOVO']);
    expect(items.map((item) => item.normalizedName)).toEqual([
      'iphone 15 128gb',
      'iphone 15 128gb',
    ]);
  });

  it('descarta AB, B e C sem descartar as secoes A e A+', () => {
    const items = parseSupplierListText(`
      LISTA SWAP
      GRADE A+
      iPhone 16 Pro Max 256GB
      Natural R$ 4.800
      GRADE AB
      iPhone 15 Pro 256GB
      Blue R$ 3.300
      GRADE B
      iPhone 14 Pro 128GB
      Black R$ 2.500
      GRADE C
      iPhone 13 128GB
      Green R$ 1.800
      GRADE A
      iPhone 15 128GB
      Black R$ 2.400
    `);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.normalizedName)).toEqual([
      'iphone 16 pro max 256gb',
      'iphone 15 128gb',
    ]);
    expect(items.every((item) => item.condition === 'SEMINOVO')).toBe(true);
  });

  it('aplica a grade qualificadora a oferta atual sem contaminar o produto seguinte', () => {
    const items = parseSupplierListText(`
      LISTA SWAP
      iPhone 15 Pro 256GB
      Grade A+ — R$ 3.800
      iPhone 16 Pro Max 256GB
      Grade AB — R$ 3.300
    `);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      normalizedName: 'iphone 15 pro 256gb',
      condition: 'SEMINOVO',
      qualityGrade: 'A+',
      price: 3800,
    });
  });

  it.each([
    ['GRADE A', 'A'],
    ['GRADE A+', 'A+'],
  ])('associa %s isolada a oferta colorida do heading anterior', (grade, expectedGrade) => {
    const [item] = parseSupplierListText(`
      iPhone 14 128GB (J/A)
      ${grade}
      PRETO R$ 1.820
    `);

    expect(item).toMatchObject({
      productName: 'iPhone 14 128GB (J/A)',
      normalizedName: 'iphone 14 128gb j a',
      capacity: '128GB',
      color: 'preto',
      condition: 'SEMINOVO',
      qualityGrade: expectedGrade,
      price: 1820,
    });
  });

  it.each(['GRADE AB', 'GRADE B', 'GRADE C'])(
    'continua descartando %s no formato de grade isolada',
    (grade) => {
      expect(parseSupplierListText(`iPhone 14 128GB (J/A)\n${grade}\nPRETO R$ 1.820`)).toEqual([]);
    },
  );

  it.each(['LOTE NOVO', 'NOVO LOTE', 'NOVO ESTOQUE', 'ESTOQUE NOVO'])(
    'nao promove %s a condicao NOVO',
    (logisticContext) => {
      const swapItems = parseSupplierListText(
        `LISTA SWAP\n${logisticContext}\niPhone 15 128GB\nPreto R$ 3.000`,
      );
      const cpoItems = parseSupplierListText(
        `CPO\n${logisticContext}\niPhone 15 128GB\nPreto R$ 3.000`,
      );

      expect(swapItems[0]).toMatchObject({ condition: 'SEMINOVO', qualityGrade: null });
      expect(cpoItems[0]).toMatchObject({ condition: 'CPO', qualityGrade: null });
    },
  );

  it('preserva NOVO comercial sem grade e aplica Grade A sobre contexto CPO', () => {
    const [newItem] = parseSupplierListText(
      'APARELHOS NOVOS LACRADOS\niPhone 15 128GB\nPreto R$ 3.000',
    );
    const [gradedCpoItem] = parseSupplierListText('CPO\niPhone 15 128GB\nGrade A — R$ 2.100');

    expect(newItem).toMatchObject({ condition: 'NOVO', qualityGrade: null });
    expect(gradedCpoItem).toMatchObject({ condition: 'SEMINOVO', qualityGrade: 'A' });
  });

  it('distingue A+ de AB em qualificadores inline', () => {
    const items = parseSupplierListText(`
      LISTA SWAP
      iPhone 16 Pro Max 256GB (Grade A+)
      Natural R$ 4.800
      iPhone 15 Pro 256GB (Grade AB)
      Blue R$ 3.300
    `);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      productName: 'iPhone 16 Pro Max 256GB',
      normalizedName: 'iphone 16 pro max 256gb',
      condition: 'SEMINOVO',
      color: 'natural',
      price: 4800,
    });
  });

  it.each([
    ['R$ 6.650,00', 6650],
    ['\u{1F4B0}6,150', 6150],
    ['\u{1F4B5}11,800.00', 11800],
    ['7650R$', 7650],
    ['\u{1F4B2}6300,00$R', 6300],
  ])('interpreta o formato de moeda do WhatsApp %s como %d', (priceText, expectedPrice) => {
    const items = parseSupplierListText(`iPhone 17 Pro 256GB\nAzul ${priceText}`);

    expect(items).toHaveLength(1);
    expect(items[0]?.price).toBe(expectedPrice);
  });

  it('preserva os valores por cor de uma lista de fornecedor', () => {
    const items = parseSupplierListText(`
      IPHONE
      17 PRO MAX 256GB
      SILVER R$ 7,150
      LARANJA R$ 7,100
      AZUL R$ 7,100
    `);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: 'silver', price: 7150 }),
        expect.objectContaining({ color: 'laranja', price: 7100 }),
        expect.objectContaining({ color: 'azul', price: 7100 }),
      ]),
    );
  });

  it('deduplica ofertas equivalentes, mas preserva condicoes distintas em todas as familias', () => {
    const duplicate = parseSupplierListText(`
      iPhone 15 128GB
      Preto R$ 3.000
      iPhone 15 128GB
      Preto R$ 3.000
    `);
    const novoAndCpo = parseSupplierListText(`
      IPHONES LACRADOS
      iPhone 15 128GB
      Preto R$ 3.000
      CPO
      iPhone 15 128GB
      Preto R$ 3.000
    `);
    const novoAndSeminovo = parseSupplierListText(`
      IPAD
      iPad 11 128GB
      Azul R$ 2.000
      IPAD
      SEMINOVO
      iPad 11 128GB
      Azul R$ 2.000
    `);
    const cpoAndSeminovo = parseSupplierListText(`
      CPO
      MacBook Air M5 13 16/512GB
      Midnight R$ 7.650
      MACBOOK
      SEMINOVO
      MacBook Air M5 13 16/512GB
      Midnight R$ 7.650
    `);

    expect(duplicate).toHaveLength(1);
    expect(novoAndCpo).toHaveLength(2);
    expect(novoAndCpo.map((item) => item.condition)).toEqual(
      expect.arrayContaining(['NOVO', 'CPO']),
    );
    expect(novoAndSeminovo).toHaveLength(2);
    expect(novoAndSeminovo.map((item) => item.condition)).toEqual(
      expect.arrayContaining(['NOVO', 'SEMINOVO']),
    );
    expect(cpoAndSeminovo).toHaveLength(2);
    expect(cpoAndSeminovo.map((item) => item.condition)).toEqual(
      expect.arrayContaining(['CPO', 'SEMINOVO']),
    );
  });

  it('preserva pontos como milhar quando a lista nao informa centavos', () => {
    const items = parseSupplierListText('iPhone 17 Pro Max 256GB\nSilver R$ 7.200');

    expect(items).toHaveLength(1);
    expect(items[0]?.price).toBe(7200);
  });

  it('nao interpreta a capacidade do produto como preco', () => {
    const items = parseSupplierListText('iPhone 17 Pro 256GB\nAzul');

    expect(items).toHaveLength(0);
  });

  it('normaliza espacos, acentos e unidades sem alterar a capacidade', () => {
    expect(normalizeProductText('MacBook  Air  M5  16 GB / 512GB')).toContain('16gb');
    expect(normalizeProductText('MacBook  Air  M5  16 GB / 512GB')).toContain('512gb');
  });

  it.each([
    [
      'iPhone',
      'IPH 15 128 GB',
      'Preto R$ 3.600',
      { productName: 'iPhone 15 128GB', category: 'iPhone', capacity: '128GB' },
      3600,
    ],
    [
      'MacBook',
      'MACBOOK AIR M5 13 INCH 16 RAM 512 GB',
      'MIDNIGHT R$ 7.650',
      { productName: 'MacBook Air M5 13" 16RAM 512GB', category: 'MacBook', capacity: '512GB' },
      7650,
    ],
    [
      'iPad',
      'IPAD PRO M5 11 IN 256 GB',
      'SILVER R$ 8.200',
      { productName: 'iPad Pro M5 11" 256GB', category: 'iPad', capacity: '256GB' },
      8200,
    ],
    [
      'Apple Watch',
      'APPLE WATCH S11 46 MM GPS CELLULAR',
      'BLACK R$ 2.200',
      { productName: 'Apple Watch S11 46MM GPS Cellular', category: 'Apple Watch', capacity: null },
      2200,
    ],
    [
      'AirPods',
      'AIR PODS 4 ANC',
      'WHITE R$ 1.045',
      { productName: 'AirPods 4 ANC', category: 'Fones', capacity: null },
      1045,
    ],
  ])(
    'normaliza uma cotacao de %s sem alterar o preco',
    (_category, heading, priceLine, expected, price) => {
      const [item] = parseSupplierListText(`${heading}\n${priceLine}`);

      expect(item).toMatchObject({ ...expected, price });
    },
  );

  it.each([
    'AirPods 4',
    'AirPods 4 ANC',
    'AirPods Pro',
    'AirPods Pro 2',
    'AirPods Pro 3',
    'AirPods Max',
  ])('classifica %s como Fones sem perder a identidade', (heading) => {
    const [item] = parseSupplierListText(`${heading}\nWhite R$ 1.000`);

    expect(item).toMatchObject({
      productName: heading,
      normalizedName: heading.toLowerCase(),
      category: 'Fones',
      model: heading,
    });
  });

  it.each([
    ['Apple Pencil Pro', 'Acessorio Apple'],
    ['Apple Watch SE 3 GPS 40mm', 'Apple Watch'],
    ['iPhone 17 Pro 256GB', 'iPhone'],
    ['MacBook Air M5 13 16GB 512GB', 'MacBook'],
    ['iPad Pro M5 11 256GB', 'iPad'],
  ])('nao classifica %s como Fones', (heading, category) => {
    const [item] = parseSupplierListText(`${heading}\nWhite R$ 1.000`);

    expect(item?.category).toBe(category);
  });

  it.each(['Garmin Alpha 300', 'Garmin Forerunner 965', 'Garmin Fenix 8', 'GARMIN Venu 3'])(
    'classifica %s como Garmin por marca explicita',
    (heading) => {
      const [item] = parseSupplierListText(`${heading}\nBlack R$ 1.000`);

      expect(item).toMatchObject({ category: 'Garmin' });
      expect(item?.model?.toLowerCase()).toBe(heading.toLowerCase());
    },
  );

  it('nao classifica uma palavra maior que apenas contenha garmin como Garmin', () => {
    const [item] = parseSupplierListText('Garminia Alpha 300\nBlack R$ 1.000');

    expect(item?.category).not.toBe('Garmin');
  });

  it.each([
    ['Apple Watch Ultra', 'Apple Watch'],
    ['Xiaomi Redmi Pad', 'Eletronicos'],
    ['Tecno Spark', 'Eletronicos'],
  ])('nao classifica %s como Garmin', (heading, category) => {
    const [item] = parseSupplierListText(`${heading}\nBlack R$ 1.000`);

    expect(item?.category).toBe(category);
  });

  it.each(['NOVO', 'CPO', 'SEMINOVO'])('preserva a condicao %s de um Garmin', (condition) => {
    const [item] = parseSupplierListText(`${condition}\nGarmin Alpha 300\nBlack R$ 1.000`);

    expect(item).toMatchObject({ category: 'Garmin', condition });
  });

  it.each([
    ['Xiaomi Redmi Pad', 'Eletronicos'],
    ['Xiaomi Vacuum S40 Pro', 'Eletronicos'],
    ['Realme GT Neo', 'Eletronicos'],
    ['Samsung Galaxy S25', 'Eletronicos'],
    ['Samsung Galaxy Watch 7', 'Eletronicos'],
    ['Tecno Spark', 'Eletronicos'],
    ['JBL Flip 6', 'Eletronicos'],
  ])('classifica %s como Eletronicos', (heading, category) => {
    const [item] = parseSupplierListText(`${heading}\nBlack R$ 1.000`);

    expect(item?.category).toBe(category);
  });

  it('preserva a condicao ao classificar marcas como Eletronicos', () => {
    const [xiaomi] = parseSupplierListText('NOVO\nXiaomi Redmi Pad\nBlack R$ 1.000');
    const [samsung] = parseSupplierListText('SEMINOVOS\nSamsung Galaxy S25\nBlack R$ 2.000');

    expect(xiaomi).toMatchObject({ category: 'Eletronicos', condition: 'NOVO' });
    expect(samsung).toMatchObject({ category: 'Eletronicos', condition: 'SEMINOVO' });
  });

  it('nao transforma produto desconhecido em Eletronicos no parser', () => {
    const [item] = parseSupplierListText('Produto XYZ 512GB\nBlack R$ 900');

    expect(item?.category).toBeNull();
  });

  it('preserva acessorio explicitamente associado a AirPods', () => {
    const [item] = parseSupplierListText('Capa para AirPods 4\nPreto R$ 100');

    expect(item).toMatchObject({
      normalizedName: 'capa para airpods 4',
      category: 'Acessorio Apple',
    });
  });

  it('aceita uma cotacao valida desconhecida sem exigir categoria cadastrada', () => {
    const [item] = parseSupplierListText('Produto XYZ 512GB\nR$ 900');

    expect(item).toMatchObject({
      productName: 'Produto Xyz 512GB',
      category: null,
      capacity: '512GB',
      price: 900,
      rawLine: 'R$ 900',
    });
  });

  it('aceita produto e preco na mesma linha', () => {
    const [item] = parseSupplierListText('iPhone 17 R$ 5.000');

    expect(item).toMatchObject({
      productName: 'iPhone 17',
      category: 'iPhone',
      price: 5000,
    });
  });

  it.each(['ANO 2024', 'Ano: 2025', 'ano - 2026'])(
    'trata %s como contexto sem contaminar o produto seguinte',
    (yearHeader) => {
      const items = parseSupplierListText(`
        MACBOOK LACRADOS
        ${yearHeader}
        MacBook Air M5 13 512GB
        Silver R$ 4.500
      `);

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        productName: 'MacBook Air M5 13 512GB',
        model: 'MacBook Air M5 13 512GB',
        category: 'MacBook',
        condition: 'NOVO',
        color: 'silver',
        price: 4500,
      });
      expect(items.some((item) => /\bano\b/i.test(item.productName))).toBe(false);
      expect(items.some((item) => /\bano\b/i.test(item.model ?? ''))).toBe(false);
    },
  );

  it('nao promove um cabecalho ANO a produto quando a proxima linha contem preco', () => {
    const rejections: Array<{ rawLine: string; reason: string }> = [];
    const items = parseSupplierListText('ANO 2026\nR$ 4.500', {
      onLineRejected: (rejection) => rejections.push(rejection),
    });

    expect(items).toEqual([]);
    expect(rejections).toEqual([
      expect.objectContaining({ rawLine: 'R$ 4.500', reason: 'missing_product_context' }),
    ]);
  });

  it('preserva ano que faz parte de uma descricao de produto', () => {
    const [item] = parseSupplierListText('Apple Watch Ultra 3 2024\nBlack R$ 1.000');

    expect(item).toMatchObject({
      productName: 'Apple Watch Ultra 3 2024',
      model: 'Apple Watch Ultra 3 2024',
      category: 'Apple Watch',
      color: 'black',
      price: 1000,
    });
  });

  it('isola os blocos da Tala Cell e classifica AS IS como seminovo', () => {
    const items = parseSupplierListText(`
      IPHONE 17 256GB 🇺🇸 AS IS
      NO ACTIVE 🔋100
      AZUL 💵4.489
      PRETO 💵4.389
      LAVENDER 💵4.400
      BRANCO 💵4.400

      IPHONE 16 128GB
      PRETO 💵3.350

      Apple Pencil Pro
      R$ 679
      Magic Mouse Branco R$ 480
      Fonte Original R$ 85
      Cabo Original Tipo-C R$ 75
      Cabo Carregador Apple Watch R$ 70
      Fonte Primeira Linha R$ 45
      Cabo Tipo-C Primeira Linha R$ 40
      Capa R$ 15
    `);

    const iphone17 = items.filter((item) => item.normalizedName.includes('iphone 17 256gb as is'));
    expect(iphone17).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ color: 'azul', price: 4489, condition: 'SEMINOVO' }),
        expect.objectContaining({ color: 'preto', price: 4389, condition: 'SEMINOVO' }),
        expect.objectContaining({ color: 'lavender', price: 4400, condition: 'SEMINOVO' }),
        expect.objectContaining({ color: 'branco', price: 4400, condition: 'SEMINOVO' }),
      ]),
    );
    expect(iphone17).toHaveLength(4);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ normalizedName: 'iphone 16 128gb', color: 'preto', price: 3350 }),
        expect.objectContaining({ normalizedName: 'pencil pro', price: 679 }),
        expect.objectContaining({ normalizedName: 'magic mouse', price: 480 }),
        expect.objectContaining({ normalizedName: 'fonte', price: 85 }),
        expect.objectContaining({ normalizedName: 'cabo tipo c', price: 75 }),
        expect.objectContaining({
          normalizedName: 'cabo carregador watch',
          price: 70,
        }),
        expect.objectContaining({ normalizedName: 'fonte primeira linha', price: 45 }),
        expect.objectContaining({ normalizedName: 'cabo tipo c primeira linha', price: 40 }),
        expect.objectContaining({ normalizedName: 'capa', price: 15 }),
      ]),
    );
    expect(iphone17.some((item) => item.price === 3350)).toBe(false);
    expect(isValidParsedSupplierListSnapshot(items)).toBe(true);
  });

  it('mantem atributos Garmin e precos de acessorios fora dos blocos de Mac Mini', () => {
    const items = parseSupplierListText(`
      iPhone 15 128GB R$ 3.600
      iPhone 15 AS IS nunca ativado 128GB R$ 2.750

      Mac MINI M2 8/256
      08C CPU | 10C GPU R$ 3.200
      Mac MINI M4 16/512
      10C CPU | 10C GPU R$ 5.700

      Garmin Fenix 7S PRO Black
      Solar | Sapphire 010-02776-13
      R$ 3.500

      Cabo USB-C / Lightning Original R$ 70
      Cabo USB-C / USB-C Original R$ 70
      Cabo USB-C / Lightning 2M R$ 80
      Cabo USB-C / USB-C 2M R$ 80
      Fonte USB Lacrado 5W R$ 20
      Fonte USB-C 20W R$ 50
      USB-C / Lightning 1ª linha R$ 15
      USB-C / USB-C 1ª linha R$ 20
      AirPods 1ª linha R$ 100
      AirPods Pro 1ª linha R$ 120
    `);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedName: 'iphone 15 128gb',
          price: 3600,
          condition: 'NOVO',
        }),
        expect.objectContaining({ price: 2750, condition: 'SEMINOVO' }),
        expect.objectContaining({ normalizedName: 'mac mini m2 8 256', price: 3200 }),
        expect.objectContaining({ normalizedName: 'mac mini m4 16 512', price: 5700 }),
        expect.objectContaining({
          normalizedName: 'garmin fenix 7s pro',
          color: 'black',
          price: 3500,
        }),
        expect.objectContaining({ normalizedName: 'cabo usb c lightning', price: 70 }),
        expect.objectContaining({ normalizedName: 'cabo usb c lightning 2m', price: 80 }),
        expect.objectContaining({ normalizedName: 'cabo usb c usb c 2m', price: 80 }),
        expect.objectContaining({ normalizedName: 'fonte usb 5w', price: 20 }),
        expect.objectContaining({ normalizedName: 'fonte usb c 20w', price: 50 }),
        expect.objectContaining({ normalizedName: 'usb c lightning 1 linha', price: 15 }),
        expect.objectContaining({ normalizedName: 'airpods 1 linha', price: 100 }),
        expect.objectContaining({ normalizedName: 'airpods pro 1 linha', price: 120 }),
      ]),
    );

    const protectedProducts = items.filter((item) =>
      /^(?:iphone|mac mini|garmin)/.test(item.normalizedName),
    );
    expect(
      protectedProducts.some((item) => [15, 20, 50, 70, 80, 100, 120].includes(item.price)),
    ).toBe(false);
    expect(items.some((item) => item.normalizedName.includes('solar sapphire'))).toBe(false);
    expect(isValidParsedSupplierListSnapshot(items)).toBe(true);
  });

  it.each([
    'AS IS',
    'AS-IS',
    'NO ACTIVE',
    'NOT ACTIVE',
    'NEVER ACTIVATED',
    'NUNCA ATIVADO',
    'NAO ATIVADO',
    'NÃO ATIVADO',
  ])('classifica o alias de condicao %s como seminovo', (conditionAlias) => {
    const [item] = parseSupplierListText(`iPhone 17 256GB ${conditionAlias}\nPRETO R$ 4.389`);

    expect(item).toMatchObject({
      normalizedName: expect.stringContaining('iphone 17 256gb'),
      color: 'preto',
      condition: 'SEMINOVO',
      price: 4389,
    });
  });

  it('abre contexto independente para produto desconhecido entre dois produtos reconhecidos', () => {
    const items = parseSupplierListText(`
      iPhone 15 R$ 3.600
      Equipamento Totalmente Desconhecido XYZ
      R$ 2.000
      iPad 11 R$ 2.500
    `);

    expect(items.map(({ normalizedName, price }) => ({ normalizedName, price }))).toEqual([
      { normalizedName: 'iphone 15', price: 3600 },
      { normalizedName: 'equipamento totalmente desconhecido xyz', price: 2000 },
      { normalizedName: 'ipad 11', price: 2500 },
    ]);
  });

  it('mantem a invariante de que cada preco pode ser extraido da propria rawLine', () => {
    const items = parseSupplierListText(`
      Produto A 128GB
      R$ 1.000
      Produto B 256GB
      PRETO R$ 2.000
    `);

    expect(isValidParsedSupplierListSnapshot(items)).toBe(true);
    expect(isValidParsedSupplierListSnapshot([{ ...items[0]!, price: 999 }, items[1]!])).toBe(
      false,
    );
  });

  it('nao transforma descritores tecnicos, datas ou numeros operacionais em precos ou produtos', () => {
    const items = parseSupplierListText(`
      Produto A 128GB
      Bateria 100
      Garantia 30 dias
      Modelo A3238
      R$ 1.000

      15/08/2026
      R$ 9.999

      Produto C 256GB
      10C CPU | 10C GPU
      16GB RAM
      3 unidades
      R$ 3.000
    `);

    expect(items.map(({ normalizedName, price }) => ({ normalizedName, price }))).toEqual([
      { normalizedName: 'produto a 128gb', price: 1000 },
      { normalizedName: 'produto c 256gb', price: 3000 },
    ]);
  });

  it('interpreta os blocos reais do Bakkour com preco sem marcador monetario', () => {
    const items = parseSupplierListText(`
      MACBOOK NEO 13” 8G 256
      📍indigo       4500,00
      📍amarelo    4450,00
      📍blush          4500,00

      MacBook NEO 13” 8G 512
      📍silver
      📍indigo
      📍amarelo
      💵5240,00
    `);

    expect(items).toHaveLength(6);
    expect(
      items.map(({ normalizedName, color, price }) => ({ normalizedName, color, price })),
    ).toEqual([
      { normalizedName: 'macbook neo 13 8g 256', color: 'indigo', price: 4500 },
      { normalizedName: 'macbook neo 13 8g 256', color: 'amarelo', price: 4450 },
      { normalizedName: 'macbook neo 13 8g 256', color: 'blush', price: 4500 },
      { normalizedName: 'macbook neo 13 8g 512', color: 'silver', price: 5240 },
      { normalizedName: 'macbook neo 13 8g 512', color: 'indigo', price: 5240 },
      { normalizedName: 'macbook neo 13 8g 512', color: 'amarelo', price: 5240 },
    ]);
    expect(isValidParsedSupplierListSnapshot(items)).toBe(true);
  });

  it('interpreta a promocao do Emilio com moeda no sufixo', () => {
    const [item] = parseSupplierListText(`
      PROMOÇÃO
      📱17 PRO MAX 256 AZUL 🇺🇸
      6950,00$R
    `);

    expect(item).toMatchObject({
      category: 'iPhone',
      normalizedName: 'iphone 17 pro max 256gb',
      capacity: '256GB',
      color: 'azul',
      price: 6950,
    });
  });

  it('normaliza cabecalhos compactos de iPhone sem familia ou unidade explicita', () => {
    const items = parseSupplierListText(`
      IPHONES LACRADOS
      17 PRO MAX 512 LL/A
      Azul R$ 7.900
      16 128 HN/A
      Preto R$ 3.500
    `);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          normalizedName: 'iphone 17 pro max 512gb ll a',
          capacity: '512GB',
          color: 'azul',
        }),
        expect.objectContaining({
          normalizedName: 'iphone 16 128gb hn a',
          capacity: '128GB',
          color: 'preto',
        }),
      ]),
    );
  });

  it('interpreta promocoes e reposicoes do BrockTech com agrupamento monetario', () => {
    const promotion = parseSupplierListText(`
      🔥 PROMOÇÕES DO DIA 🔥
      📲 *17 PRO MAX 256gb*
      ⬜️ SILVER (PRATA)
      🔥 *R$ 7.070.00*
      🟦 DEEP BLUE
      🔥 *R$ 7.030.00*
      🟧 COSMIC ORANGE
      🔥 *R$ 7.200.00*
    `);
    const replenishment = parseSupplierListText(`
      🔥 REPOSICAO 🔥
      📲 *17 PRO MAX 256gb*
      🟦 DEEP BLUE
      🔥 *R$ 7.030.00*
      🟧 COSMIC ORANGE
      🔥 *R$ 7.200.00*
      ⬜️ SILVER (PRATA)
      🔥 *R$ 7.070.00*
    `);

    expect(promotion.map(({ color, price }) => ({ color, price }))).toEqual([
      { color: 'silver', price: 7070 },
      { color: 'blue', price: 7030 },
      { color: 'orange', price: 7200 },
    ]);
    expect(replenishment.map(({ color, price }) => ({ color, price }))).toEqual([
      { color: 'blue', price: 7030 },
      { color: 'orange', price: 7200 },
      { color: 'silver', price: 7070 },
    ]);
  });

  it('nao interpreta RAM, bateria ou quantidade como preco contextual', () => {
    const items = parseSupplierListText(`
      MacBook Neo 13” 8G 256
      8G
      Bateria 100
      13 unidades
      R$ 4.500
    `);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ normalizedName: 'macbook neo 13 8g 256', price: 4500 });
  });

  it('nao promove rotulos comerciais, garantia ou informacao operacional a produto', () => {
    const items = parseSupplierListText(`
      AIR PODS MAX
      VAREJO R$ 180,00
      ATACADO R$ 120,00
      QUALIDADE GARANTIDA POR 1 ANO
      03 BATERIAS
      SINAL DE RESERVA R$ 200
    `);

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ normalizedName: 'airpods max', price: 180 }),
        expect.objectContaining({ normalizedName: 'airpods max', price: 120 }),
      ]),
    );
    expect(items).toHaveLength(2);
  });

  it('preserva a familia legada ao reconhecer cabecalho compacto', () => {
    const [item] = parseSupplierListText(`
      IPHONE
      16 PLUS 128GB
      PRETO R$ 3.500
    `);

    expect(item).toMatchObject({
      normalizedName: 'iphone 16 plus 128gb',
      category: 'iPhone',
      color: 'preto',
      price: 3500,
    });
  });

  it('limpa cores pendentes quando um novo produto muda o contexto', () => {
    const items = parseSupplierListText(`
      MacBook Neo 13 8G 256
      SILVER
      MacBook Neo 13 8G 512
      BLUE
      💵5.240
    `);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      normalizedName: 'macbook neo 13 8g 512',
      color: 'blue',
      price: 5240,
    });
  });
});
