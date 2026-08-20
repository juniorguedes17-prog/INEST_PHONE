import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  auditProfitIdentityCatalog,
  deriveCanonicalVariantIdentity,
  deriveExtendedProductIdentity,
  deriveProfitLookupIdentity,
  type ProfitIdentityAuditRecord,
} from './product-identity-extensions';

const novo = (productName: string, color?: string) => ({
  productName,
  quality: 'NOVO',
  color,
});

test('cor diferencia a variante sem alterar a identidade de lucro', () => {
  const orange = deriveExtendedProductIdentity(novo('iPhone 17 Pro 256GB', 'Laranja'));
  const white = deriveExtendedProductIdentity(novo('iPhone 17 Pro 256GB', 'Branco'));

  assert.equal(orange.variant.status, 'valid');
  assert.equal(white.variant.status, 'valid');
  assert.notEqual(orange.variant.key, white.variant.key);
  assert.equal(orange.profit.key, white.profit.key);
});

test('acabamentos comerciais conservadores continuam distintos na variante', () => {
  const black = deriveCanonicalVariantIdentity(novo('iPhone 17 Pro 256GB', 'Black'));
  const midnight = deriveCanonicalVariantIdentity(novo('iPhone 17 Pro 256GB', 'Midnight'));
  const titanium = deriveCanonicalVariantIdentity(novo('iPhone 17 Pro 256GB', 'Black Titanium'));

  assert.notEqual(black.key, midnight.key);
  assert.notEqual(black.key, titanium.key);
  assert.notEqual(midnight.key, titanium.key);
});

test('iPhone base, Pro e Pro Max permanecem distintos das geracoes 11 a 17', () => {
  for (let generation = 11; generation <= 17; generation += 1) {
    const base = deriveProfitLookupIdentity(novo(`iPhone ${generation} 256GB`));
    const pro = deriveProfitLookupIdentity(novo(`iPhone ${generation} Pro 256GB`));
    const proMax = deriveProfitLookupIdentity(novo(`iPhone ${generation} Pro Max 256GB`));

    assert.equal(base.status, 'valid');
    assert.equal(pro.status, 'valid');
    assert.equal(proMax.status, 'valid');
    assert.notEqual(base.key, pro.key);
    assert.notEqual(pro.key, proMax.key);
    assert.notEqual(base.key, proMax.key);
  }
});

test('iPhone protege armazenamento e ignora descritores nao financeiros', () => {
  const plain = deriveProfitLookupIdentity(novo('iPhone 17 Pro 256GB'));
  const external = deriveProfitLookupIdentity(novo('iPhone 17 Pro 256GB eSIM Americano'));
  const larger = deriveProfitLookupIdentity(novo('iPhone 17 Pro 512GB'));
  const proMax = deriveProfitLookupIdentity(novo('iPhone 17 Pro Max 256GB'));

  assert.equal(external.key, plain.key);
  assert.deepEqual(external.ignoredDescriptors, ['esim', 'americano']);
  assert.notEqual(external.key, larger.key);
  assert.notEqual(external.key, proMax.key);
});

test('iPad protege familia, chip, tela e armazenamento', () => {
  const air11 = deriveProfitLookupIdentity(novo('iPad Air M4 11" 128GB'));
  const air13 = deriveProfitLookupIdentity(novo('iPad Air M4 13" 128GB'));
  const pro13 = deriveProfitLookupIdentity(novo('iPad Pro M5 13" 128GB'));
  const air13Larger = deriveProfitLookupIdentity(novo('iPad Air M4 13" 256GB'));

  assert.equal(air11.status, 'valid');
  assert.notEqual(air11.key, air13.key);
  assert.notEqual(air13.key, pro13.key);
  assert.notEqual(air13.key, air13Larger.key);
  assert.equal(deriveProfitLookupIdentity(novo('iPad Air 128GB')).status, 'insufficient_identity');
});

test('iPad 11 deriva apenas a tela invariavel e a variante Wi-Fi base do registry', () => {
  const quote = deriveExtendedProductIdentity(novo('iPad 11 128GB Wi-Fi'));
  const catalog = deriveExtendedProductIdentity(novo('iPad 11 128GB 11"'));
  const cellular = deriveProfitLookupIdentity(novo('iPad 11 128GB Wi-Fi Cellular'));

  assert.equal(quote.canonical.canonicalModelKey, 'ipad-11');
  assert.equal(quote.canonical.canonicalScreen, '11"');
  assert.equal(quote.canonical.canonicalScreenSource, 'model_invariant');
  assert.equal(quote.canonical.canonicalConnectivity, 'Wi-Fi');
  assert.equal(quote.canonical.canonicalConnectivitySource, 'explicit');
  assert.equal(catalog.canonical.canonicalScreenSource, 'explicit');
  assert.equal(catalog.canonical.canonicalConnectivity, 'Wi-Fi');
  assert.equal(catalog.canonical.canonicalConnectivitySource, 'safe_default');
  assert.equal(quote.profit.status, 'valid');
  assert.equal(quote.profit.key, catalog.profit.key);
  assert.notEqual(quote.profit.key, cellular.key);
});

test('MacBook protege familia, chip, tela, RAM e armazenamento', () => {
  const air13 = deriveProfitLookupIdentity(novo('MacBook Air M5 13" 16/512GB'));
  const air15 = deriveProfitLookupIdentity(novo('MacBook Air M5 15" 16/512GB'));
  const pro = deriveProfitLookupIdentity(novo('MacBook Pro M5 Pro 14" 24/1TB'));
  const max = deriveProfitLookupIdentity(novo('MacBook Pro M5 Max 14" 24/1TB'));
  const moreRam = deriveProfitLookupIdentity(novo('MacBook Air M5 13" 24/512GB'));
  const moreStorage = deriveProfitLookupIdentity(novo('MacBook Air M5 13" 16/1TB'));

  assert.equal(air13.status, 'valid');
  assert.notEqual(air13.key, air15.key);
  assert.notEqual(pro.key, max.key);
  assert.notEqual(air13.key, moreRam.key);
  assert.notEqual(air13.key, moreStorage.key);
});

test('MacBook Neo converge unidades equivalentes de tela sem fundir configuracoes', () => {
  const equivalentForms = [
    'Mac Neo 13 8/256',
    'MacBook Neo 13 8/256GB',
    'MacBook Neo 13" 8GB/256GB',
    'MacBook Neo 13-inch 8GB 256GB',
    'MacBook Neo 13 inch 8GB+256GB',
    'MacBook Neo 13 polegadas 8GB/256GB',
  ].map((productName) => deriveExtendedProductIdentity(novo(productName)));

  equivalentForms.forEach(({ canonical, profit }) => {
    assert.equal(profit.status, 'valid');
    assert.equal(canonical.canonicalModelKey, 'macbook-neo-13');
    assert.equal(canonical.canonicalScreen, '13"');
    assert.equal(profit.attributes.ram, '8gb');
    assert.equal(profit.attributes.storage, '256gb');
  });
  assert.equal(new Set(equivalentForms.map(({ profit }) => profit.key)).size, 1);

  const moreRam = deriveProfitLookupIdentity(novo('MacBook Neo 13" 16GB/256GB'));
  const largerStorage = deriveProfitLookupIdentity(novo('MacBook Neo 13" 8GB/512GB'));
  assert.notEqual(equivalentForms[0]?.profit.key, moreRam.key);
  assert.notEqual(equivalentForms[0]?.profit.key, largerStorage.key);
});

test('MacBook Neo A18 Pro preserva chip e armazenamento por configuracao', () => {
  const base256 = deriveExtendedProductIdentity(novo('MacBook Neo A18 Pro 13" 8GB/256GB'));
  const base512 = deriveExtendedProductIdentity(novo('MacBook Neo A18 Pro 13" 8GB/512GB'));
  const equivalent = deriveExtendedProductIdentity(novo('MacBook Neo A18 Pro 13-inch 8GB 256GB'));

  assert.equal(base256.profit.status, 'valid');
  assert.equal(base512.profit.status, 'valid');
  assert.equal(base256.canonical.canonicalChip, 'A18 Pro');
  assert.equal(base256.profit.attributes.chip, 'a18-pro');
  assert.equal(base256.profit.attributes.chipVariant, 'pro');
  assert.equal(base256.profit.attributes.storage, '256gb');
  assert.equal(base512.profit.attributes.storage, '512gb');
  assert.equal(base256.profit.key, equivalent.profit.key);
  assert.notEqual(base256.profit.key, base512.profit.key);
});

test('catalogo saneia iPhone Air e acessorios com nomes deterministas', () => {
  const air256 = deriveProfitLookupIdentity(novo('iPhone 17 Air 256GB'));
  const air512 = deriveProfitLookupIdentity(novo('iPhone 17 Air 512GB'));
  const charger = deriveExtendedProductIdentity(novo('Carregador Apple 20W USB-C'));
  const cable = deriveExtendedProductIdentity(novo('Cabo Apple USB-C'));

  assert.equal(air256.status, 'valid');
  assert.equal(air512.status, 'valid');
  assert.notEqual(air256.key, air512.key);
  assert.equal(charger.profit.status, 'valid');
  assert.equal(charger.canonical.canonicalModelKey, 'apple-charger-20w-usb-c');
  assert.equal(cable.profit.status, 'valid');
  assert.equal(cable.canonical.canonicalModelKey, 'apple-cable-usb-c');
});

test('Apple Watch sem geracao ou tamanho inequivocos permanece fail-closed', () => {
  for (const productName of [
    'Apple Watch SE 11 GPS 42mm',
    'Apple Watch SE 11 GPS 46mm',
    'Apple Watch Ultra 3 2024',
  ]) {
    const identity = deriveProfitLookupIdentity(novo(productName));
    assert.equal(identity.status, 'insufficient_identity');
    assert.equal(identity.key, null);
  }
});

test('caso real MacBook Pro M5 14 16/512 converge com produto_id 14', () => {
  const file = new URL('../../../prisma/data/profit-products.json', import.meta.url);
  const catalog = JSON.parse(readFileSync(file, 'utf8')) as Array<{
    produto_id: number;
    condicao_produto: string;
    produto_descricao: string;
    lucro_liquido: number;
  }>;
  const record = catalog.find((item) => item.produto_id === 14);
  assert.ok(record);

  const quote = deriveProfitLookupIdentity(novo('MacBook Pro M5 14" 16GB/512GB'));
  const product = deriveProfitLookupIdentity({
    productDescription: record.produto_descricao,
    quality: record.condicao_produto,
  });

  assert.equal(quote.status, 'valid');
  assert.equal(quote.key, product.key);
  assert.equal(record.produto_descricao, 'MacBook Pro M5 14 16/512GB');
  assert.equal(record.lucro_liquido, 1300);
});

test('Mac Mini protege chip, RAM, armazenamento e unidades de compute', () => {
  const m2 = deriveProfitLookupIdentity(novo('Mac Mini M2 8/256GB'));
  const m4 = deriveProfitLookupIdentity(novo('Mac Mini M4 16/512GB'));
  const m4Gpu = deriveProfitLookupIdentity(novo('Mac Mini M4 16/512GB GPU 10'));

  assert.equal(m2.status, 'valid');
  assert.equal(m4.status, 'valid');
  assert.notEqual(m2.key, m4.key);
  assert.notEqual(m4.key, m4Gpu.key);
});

test('iMac protege chip, tela, RAM, armazenamento e unidades de compute', () => {
  const equivalentForms = [
    'iMac M4 24" 16GB/256GB',
    'iMAC / M4 / 24" / 16GB+256GB',
    'iMac M4 24-inch 16GB 256GB',
    'iMac M4 24 polegadas 16GB/256GB',
  ].map((productName) => deriveExtendedProductIdentity(novo(productName)));

  equivalentForms.forEach(({ canonical, profit }) => {
    assert.equal(profit.status, 'valid');
    assert.equal(profit.family, 'imac');
    assert.equal(canonical.canonicalModelKey, 'imac-m4-24');
    assert.equal(canonical.canonicalChip, 'M4');
    assert.equal(canonical.canonicalScreen, '24"');
    assert.equal(profit.attributes.ram, '16gb');
    assert.equal(profit.attributes.storage, '256gb');
  });
  assert.equal(new Set(equivalentForms.map(({ profit }) => profit.key)).size, 1);

  const m5 = deriveProfitLookupIdentity(novo('iMac M5 24" 16GB/256GB'));
  const moreRam = deriveProfitLookupIdentity(novo('iMac M4 24" 24GB/256GB'));
  const moreStorage = deriveProfitLookupIdentity(novo('iMac M4 24" 16GB/512GB'));
  const gpuVariant = deriveProfitLookupIdentity(novo('iMac M4 24" 16GB/256GB GPU 10'));
  const missingRam = deriveProfitLookupIdentity(novo('iMac M4 24" 256GB'));

  assert.notEqual(equivalentForms[0]?.profit.key, m5.key);
  assert.notEqual(equivalentForms[0]?.profit.key, moreRam.key);
  assert.notEqual(equivalentForms[0]?.profit.key, moreStorage.key);
  assert.notEqual(equivalentForms[0]?.profit.key, gpuVariant.key);
  assert.equal(missingRam.status, 'insufficient_identity');
  assert.deepEqual(missingRam.missingAttributes, ['ram']);
});

test('Mac Studio protege chip variant, RAM e armazenamento sem exigir tela', () => {
  const base = deriveExtendedProductIdentity(novo('Mac Studio M4 Max 36GB/512GB'));
  const equivalent = deriveExtendedProductIdentity(novo('MAC STUDIO / M4 MAX / 36GB+512GB'));
  const moreRam = deriveProfitLookupIdentity(novo('Mac Studio M4 Max 48GB/512GB'));
  const moreStorage = deriveProfitLookupIdentity(novo('Mac Studio M4 Max 36GB/1TB'));
  const m3Ultra = deriveProfitLookupIdentity(novo('Mac Studio M3 Ultra 36GB/512GB'));
  const m4Ultra = deriveProfitLookupIdentity(novo('Mac Studio M4 Ultra 36GB/512GB'));
  const missingRam = deriveProfitLookupIdentity(novo('Mac Studio M4 Max 512GB'));

  assert.equal(base.profit.status, 'valid');
  assert.equal(base.profit.family, 'mac-studio');
  assert.equal(base.canonical.canonicalModelKey, 'mac-studio-m4-max');
  assert.equal(base.canonical.canonicalChip, 'M4 Max');
  assert.equal(base.canonical.canonicalScreen, null);
  assert.equal(base.profit.attributes.chipVariant, 'max');
  assert.equal(base.profit.key, equivalent.profit.key);
  assert.notEqual(base.profit.key, moreRam.key);
  assert.notEqual(base.profit.key, moreStorage.key);
  assert.notEqual(base.profit.key, m3Ultra.key);
  assert.notEqual(base.profit.key, m4Ultra.key);
  assert.equal(m3Ultra.attributes.chipVariant, 'ultra');
  assert.equal(m4Ultra.attributes.chipVariant, 'ultra');
  assert.equal(missingRam.status, 'insufficient_identity');
  assert.deepEqual(missingRam.missingAttributes, ['ram']);
});

test('Apple Watch protege familia, geracao, tamanho e conectividade', () => {
  const gps = deriveProfitLookupIdentity(novo('Apple Watch Series 11 46mm GPS'));
  const cellular = deriveProfitLookupIdentity(novo('Apple Watch Series 11 46mm GPS + Cellular'));
  const smaller = deriveProfitLookupIdentity(novo('Apple Watch Series 11 42mm GPS'));
  const se = deriveProfitLookupIdentity(novo('Apple Watch SE 3 46mm GPS'));

  assert.equal(gps.status, 'valid');
  assert.notEqual(gps.key, cellular.key);
  assert.notEqual(gps.key, smaller.key);
  assert.equal(se.status, 'insufficient_identity');
});

test('Apple Watch aplica GPS somente como default seguro da variante base', () => {
  const quote = deriveExtendedProductIdentity(novo('Apple Watch SE 3 GPS 40mm S/M'));
  const base = deriveExtendedProductIdentity(novo('Apple Watch SE3 40mm'));
  const cellular = deriveExtendedProductIdentity(novo('Apple Watch SE3 40mm Com Celular'));

  assert.equal(quote.canonical.canonicalConnectivity, 'GPS');
  assert.equal(quote.canonical.canonicalConnectivitySource, 'explicit');
  assert.equal(base.canonical.canonicalConnectivity, 'GPS');
  assert.equal(base.canonical.canonicalConnectivitySource, 'safe_default');
  assert.equal(cellular.canonical.canonicalConnectivity, 'GPS + Cellular');
  assert.equal(cellular.canonical.canonicalConnectivitySource, 'explicit');
  assert.equal(quote.profit.key, base.profit.key);
  assert.notEqual(quote.profit.key, cellular.profit.key);
});

test('AirPods protege geracao e cancelamento de ruido', () => {
  const regular = deriveProfitLookupIdentity(novo('AirPods 4 Regular'));
  const anc = deriveProfitLookupIdentity(novo('AirPods 4 com cancelamento ANC'));
  const pro2 = deriveProfitLookupIdentity(novo('AirPods Pro 2'));
  const pro3 = deriveProfitLookupIdentity(novo('AirPods Pro 3'));

  assert.equal(regular.status, 'valid');
  assert.equal(anc.status, 'valid');
  assert.notEqual(regular.key, anc.key);
  assert.notEqual(pro2.key, pro3.key);
});

test('acessorios protegem modelo, conector, quantidade e variante comercial', () => {
  const pencilPro = deriveProfitLookupIdentity(novo('Apple Pencil Pro'));
  const pencilUsbC = deriveProfitLookupIdentity(novo('Apple Pencil USB-C'));
  const airTagOne = deriveProfitLookupIdentity(novo('AirTag 1 unidade'));
  const airTagFour = deriveProfitLookupIdentity(novo('AirTag 4 unidades'));
  const keyboard = deriveProfitLookupIdentity(novo('Magic Keyboard com teclado numerico'));
  const keyboardCompact = deriveProfitLookupIdentity(novo('Magic Keyboard sem teclado numerico'));

  assert.notEqual(pencilPro.key, pencilUsbC.key);
  assert.notEqual(airTagOne.key, airTagFour.key);
  assert.notEqual(keyboard.key, keyboardCompact.key);
  assert.equal(deriveProfitLookupIdentity(novo('Cabo USB-C 2m')).status, 'insufficient_identity');
});

test('casos adversariais falham fechados quando falta atributo decisivo', () => {
  const cases = [
    'iPhone 17 Pro',
    'iPad Air 128GB',
    'MacBook Air M5 16GB 512GB',
    'Apple Watch Series 11',
    'AirPods 4',
    'Cabo USB-C',
    'Cabo USB-C 2m',
  ];

  cases.forEach((productName) => {
    assert.equal(
      deriveProfitLookupIdentity(novo(productName)).status,
      'insufficient_identity',
      productName,
    );
  });
});

test('texto com familias conflitantes retorna identidade ambigua', () => {
  const identity = deriveProfitLookupIdentity(novo('iPhone 17 Pro 256GB Apple Watch S11 46mm'));
  assert.equal(identity.status, 'ambiguous_identity');
  assert.equal(identity.key, null);
});

test('NOVO, SEMINOVO e CPO possuem identidades financeiras independentes', () => {
  const productName = 'iPhone 17 Pro 256GB';
  const keys = ['NOVO', 'SEMINOVO', 'CPO'].map((quality) =>
    deriveProfitLookupIdentity({ productName, quality }).key,
  );

  assert.equal(new Set(keys).size, 3);
});

test('fixture minima Tala Cell preserva cotacoes por cor e compartilha lucro', () => {
  const colors = ['Azul', 'Preto', 'Lavender', 'Branco'];
  const identities = colors.map((color) =>
    deriveExtendedProductIdentity({
      productName: 'iPhone 17 256GB AS IS NO ACTIVE',
      quality: 'SEMINOVO',
      color,
    }),
  );

  assert.equal(new Set(identities.map((item) => item.profit.key)).size, 1);
  assert.equal(new Set(identities.map((item) => item.variant.key)).size, 4);
});

test('fixture minima Mohamad Nasser separa familias e configuracoes', () => {
  const m2 = deriveProfitLookupIdentity(novo('Mac Mini M2 8/256GB'));
  const m4 = deriveProfitLookupIdentity(novo('Mac Mini M4 16/512GB'));
  const regular = deriveProfitLookupIdentity(novo('AirPods 4 Regular'));
  const anc = deriveProfitLookupIdentity(novo('AirPods 4 ANC'));

  assert.notEqual(m2.key, m4.key);
  assert.notEqual(regular.key, anc.key);
});

test('audita os 129 produtos sem alterar a fixture', () => {
  const file = new URL('../../../prisma/data/profit-products.json', import.meta.url);
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Array<{
    produto_id: number;
    condicao_produto: string;
    produto_descricao: string;
  }>;
  const records: ProfitIdentityAuditRecord[] = raw.map((item) => ({
    productId: item.produto_id,
    productDescription: item.produto_descricao,
    condition: item.condicao_produto,
  }));
  const audit = auditProfitIdentityCatalog(records);

  assert.equal(audit.total, 129);
  assert.equal(audit.valid, 128);
  assert.equal(audit.insufficient, 1);
  assert.equal(audit.ambiguous, 0);
  assert.deepEqual(
    audit.collisions.map(({ key }) => key),
    [
      'apple-watch|model=apple-watch-series-11-42|screen=42mm|condition=novo|connectivity=gps',
      'apple-watch|model=apple-watch-series-11-46|screen=46mm|condition=novo|connectivity=gps',
    ],
  );
});
