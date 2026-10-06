import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  classifySupplierListUpdateMode,
  EvolutionWebhookService,
  supplierListItemMergeKey,
} from './evolution-webhook.service';
import { isValidParsedSupplierListSnapshot, parseSupplierListText } from './supplier-list.parser';
import { resolveSupplierSnapshotScope } from './supplier-snapshot-scope';
import { mohamadNasserList20260926 } from './__fixtures__/mohamad-nasser-2026-09-26';
import {
  applySupplierListConditionPolicy,
  BROCKTECH_SUPPLIER_CONTACT_IDS,
  MOHAMAD_NASSER_SUPPLIER_CONTACT_ID,
  PRONINE_ATACADO_SUPPLIER_CONTACT_ID,
  TARGET_SUPPLIER_CONTACT_ID,
  X_ATACADO_SECONDARY_SUPPLIER_CONTACT_ID,
  X_ATACADO_SUPPLIER_CONTACT_ID,
} from './supplier-list-policy';

const webhookSecret = 'this-is-a-test-webhook-secret-with-32-characters';

const lotDocumentFixtures = [
  {
    id: '7046',
    rawText: `Lote 7046 MAO
*ENVIO DE CURITIBA 30/09*

20 x iPhone 17 256GB.
Cores: 8 Preto, 6 Branco, 6 Lavanda.*R$ 4600*

12 x iPhone 17 Pro 256GB.
Cores: 3 Laranja, 6 Prata, 3 Azul.*R$ 6200*

15 x iPhone 17 Pro Max 256GB.
Cores: 4 Laranja, 7 Prata, 4 Azul.*R$ 6900*

8 x AirPods 4(ANC). *R$ 800*

10 x AirPods Pro 3. *R$ 1100*

6 x Apple Watch Ultra 3.
Cores: 3 Preto, 3 Natural. *R$ 4000*

5 x MacBook Air 2026 16GB 512GB.
Cores: 3 Midnight, 2 Prata. *R$ 7000*

2 x MacBook Air 2026 24GB 1TB.
Cores: 1 Midnight, 1 Prata. *R$9000*

2 x MacBook Pro 2026 M5 Pro 24GB 1TB.
Cores: 2 Preto. *R$ 13000*

*Envio de Curitiba 30/09*`,
    parsedItems: 18,
  },
  {
    id: '4041',
    rawText: `Lote 4041 CVC
*ENVIO DE CURITIBA 29/09*

10 x iPhone 17 256GB.
Cores: 6 Preto, 3 Branco, 1 Lavanda. *R$ 4600*

7 x iPhone 17 Pro 256GB.
Cores: 1 Laranja, 3 Prata, 2 Azul. *R$ 6200*

7 x iPhone 17 Pro 512GB.
Cores: 2 Laranja, 2 Prata, 3 Azul.*R$ 6800*

7 x iPhone 17 Pro Max 256GB.
Cores: 2 Laranja, 3 Prata, 2 Azul.*R$ 6900*

5 x iPhone 17 Pro Max 512GB.
Cores: 2 Laranja, 1 Prata, 2 Azul.*R$ 8000*

1 x iPhone 17 Pro Max 1TB.
Cores: 1 Azul.*R$ 9000*

10 x AirPods Pro 3 *R$ 1100*

3 x AirPods Max 2. *R$ 2800*
Cores: 1 Preto, 1 Estelar, 1 Azul.

9 x Apple Watch Séries 11 46mm.
Cores: 5 Preto, 4 Gold Rose. *R$ 2000*

8 x iPads 11º Geração 128GB.
Cores: 4 Prata, 4 Azul. *R$ 2450*

4 x MacBook Air M5 16GB 512GB.
Cores: 1 Preto, 2 Azul, 1 Prata. *R$ 7000*

2 x MacBook Pro 2026 M5 24GB 1TB.
Cor: Preto *R$ 13000*

*Envio de Curitiba 29/09*`,
    parsedItems: 26,
  },
] as const;

const pronineFixtures = [
  {
    id: 'linha-18',
    rawText: `LINHA 18
CHEGADA ENTRE 30/09 - 10/10

IPHONE 18 PRO
256GB - R$8.900,00
512GB - R$10.000,00
1TB - R$12.200,00
TODAS AS CORES

IPHONE 18 PRO MAX
256GB - R$9.400,00
512GB - R$10.700,00
1TB - R$12.900,00
2TB - R$15.600,00
TODAS AS CORES`,
    parsedItems: 7,
  },
  {
    id: 'pronta-entrega',
    rawText: `PRONTA ENTREGA SAO PAULO

17 PRO MAX 256
SILVER - R$7000,00
LARANJA - R$6.900,00
AZUL - R$6.900,00`,
    parsedItems: 3,
  },
] as const;

const xAtacadoFixtures = [
  {
    id: 'iphone',
    rawText: `iPhone 17 Pro Max 256GB — LL/A
Blue — R$ 6.669
Silver — R$ 6.669
Orange — R$ 6.669`,
    parsedItems: 3,
  },
  {
    id: 'ipad',
    rawText: `iPad 11 128GB
Azul — R$ 2.550
Pink — R$ 2.530
Yellow — R$ 2.425`,
    parsedItems: 3,
  },
] as const;

const xAtacadoSupplierContactIds = [
  X_ATACADO_SUPPLIER_CONTACT_ID,
  X_ATACADO_SECONDARY_SUPPLIER_CONTACT_ID,
] as const;

const BROCKTECH_SUPPLIER_CONTACT_ID = BROCKTECH_SUPPLIER_CONTACT_IDS[0];

const brockTechPromotionP2 = `🔥 PROMOÇÕES DO DIA 🔥

📲 *📲 18 PRO MAX 256*

⬛️ BLACK
🔥 *R$ 9.650.00*

⬜️ SILVER
🔥 *R$ 9.800.00*

🟦 AZUL/GLACIER
🔥 *R$ 9.890.00*

BURGUNDY
🔥 *R$ 11.000.00*`;

const brockTechPromotionP3 = `🔥 PROMOÇÕES DO DIA 🔥

📲 *📲 18 PRO MAX 256*

⬛️ BLACK
🔥 *R$ 9.500.00*

⬜️ SILVER
🔥 *R$ 9.800.00*

🟦 AZUL/GLACIER
🔥 *R$ 9.700.00*`;

const pointCellFullList20260929 = `🗓️ Atualizado 29/09/2026
📍 PointCellSP – Lista de Preços
🔴 ATENÇÃO:
*Compras via Correios* (SEDEX/PAC) são por conta e risco do cliente.
*Nota Fiscal:* Acrescenta 5% sobre o valor do produto.
*Garantia:* Todos os produtos Apple lacrados, com 1 ano de garantia direto pela Apple.
⚠️ *Problemas são tratados diretamente com a Apple, ok?*
⸻⸻
~~~~~~~~~~~~~~~~~~~~~~~~~~~~
••••••🎧 *Fones & Acessórios*••••••

📲iPad 11 128gb.  Wi-Fi.
✅silver 2740 R$
✅azul  2680 R$
✅pink  2680 R$

⌚️  Apple Watch S11 42 mm
✅ jet black   R$ 1980
✅rose gold   R$ 1970
✅space grey  R$ 1990

⌚️apple Watch s11 46 mm
✅jet black. 2190 R$
✅space gray 2170R$
----------
⌚️✅ garmin   forerunner  165
✅  preto    R$  1250

--------
✅🎧air pods  3   R$ 540

✅🎧airpods 4  R$ 700

✅air pods pro 3.  1280 R$

✅🎧airpods 4 ANC  R$  1000

🎧✅AIRPODS MAX 2
✅ AZUL R$ 2800

✅AIRTAG 1 PACK   R$  150

••••••••••📲IPHONES 📲••••••••••

📲iphone 18 pro max 512 Gb.   13000R$
✅preto

📲iphone 18 pro max 256 Gb.  🇺🇸
✅preto 9300 R$
✅silver 9300 R$
✅azul   9400  R$
✅bordô 11000   R$

📲iphone 17 pro max 1 tb.   9600R$
✅Laranja

📲iphone 17 pro Max 2tb.  11200R$
✅laranja

📲iPhone 17 pro Max 512 GB.
✅laranja  R$8700

📲iphone 17 pro max  256 Gb. 🇺🇸
✅laranja 6850 R$
✅silver  7100  R$
✅azul 6850   R$

📲iphone 17 pro 256 GB
✅laranja  R$ 6600
✅silver   R$ 6800
✅azul R$ 6750

📲iphone 17 pro 1tb     9000R$
✅silver

📲iphone 17  256 GB
✅preto  R$ 5200
✅branco R$ 5250
✅lilas    R$  5250
✅azul  R$  5180

📲iphone 16 128 GB
✅verde  R$ 4100
✅rosa  R$  4250
✅azul  R$   4150
✅preto R$ 4200
✅branco R$  4250

📲iphone 15  128 GB
✅preto   R$ 3500

~~~~~~~~~~~~~~~~~~~~~~~~
•••🔌 *Carregadores & Cabos*🔌•••

🔌•Tomada Tipo-C Original 100R$
   Cabo Tipo-C para Tipo-C – 50R$
   Cabo Tipo-C Padrão – 50R$
    Cabo UsbC.   Padrão - 50 R$
⸻
📌 *Hoje só temos o que está na lista!*
A
💬 Obrigado e boas vendas!j`;

const pointCellLastPieces20260929 = `ultimas pecas do dia bora

IPHONE 18 PROMAX 256GB
PRETO AMERICANO R$ 9050

IPHONE 18 PROMAX 256GB
AZUL AMERICANO R$ 9100

IPHONE 18 PROMAX 256GB SILVER AMERICANO R$ 9100`;

const POINT_CELL_SUPPLIER_CONTACT_ID = '4a9f56fc-5b6c-2e74-1af7-05c310292acf';

function catalogProduct(
  id: string,
  productDescription: string,
  profitCondition = 'NOVO',
  productType = 'IPHONE_SEALED',
) {
  return {
    id,
    productDescription,
    productType,
    profitCondition,
    variantAttributes: null,
    category: null,
    model: null,
    color: null,
    storage: { displayName: '256GB', value: '256', unit: 'GB' },
  };
}

function dynamicCatalogProduct(id = 'product-99-ultra') {
  return {
    id,
    productDescription: 'iPhone 99 Ultra 256GB',
    productType: 'IPHONE_SEALED',
    profitCondition: 'NOVO',
    variantAttributes: null,
    category: { name: 'iPhone Lacrado' },
    model: { name: 'iPhone 99 Ultra' },
    color: { name: 'Azul' },
    storage: { displayName: '256 GB', value: '256', unit: 'GB' },
  };
}

function createService(
  catalog: unknown[] = [],
  productNormalization?: unknown,
  supplierContactId = 'supplier-contact-id',
) {
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    product: {
      findMany: vi.fn().mockResolvedValue(catalog),
      create: vi.fn().mockResolvedValue({ id: 'created-product-id' }),
    },
    productCategory: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'category-iphone',
        slug: 'iphone-lacrado',
        type: 'IPHONE_SEALED',
        status: 'ACTIVE',
        deletedAt: null,
      }),
    },
    productModel: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'model-iphone-19',
        categoryId: 'category-iphone',
        productType: 'IPHONE_SEALED',
      }),
      create: vi.fn().mockResolvedValue({
        id: 'model-iphone-19',
        categoryId: 'category-iphone',
        productType: 'IPHONE_SEALED',
      }),
    },
    productColor: { findUnique: vi.fn().mockResolvedValue({ id: 'color-azul' }) },
    productStorage: { findUnique: vi.fn().mockResolvedValue({ id: 'storage-256' }) },
    evolutionWebhookReceipt: { create: vi.fn().mockResolvedValue({}) },
    supplierCurrentList: {
      upsert: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    supplierCurrentListItem: {
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
  };
  const prisma = {
    product: { findMany: vi.fn().mockResolvedValue(catalog) },
    $transaction: vi.fn((callback: (client: typeof transaction) => unknown) =>
      callback(transaction),
    ),
    supplierCurrentList: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'app.evolutionWebhookEnabled') return true;
      if (key === 'app.evolutionWebhookSecret') return webhookSecret;
      return undefined;
    }),
  };
  const supplierContacts = {
    findActiveByWhatsappNumber: vi.fn().mockResolvedValue({ id: supplierContactId }),
  };

  return {
    service: new EvolutionWebhookService(
      config as never,
      prisma as never,
      supplierContacts as never,
      productNormalization as never,
    ),
    prisma,
    transaction,
    supplierContacts,
  };
}

function currentItem(
  id: string,
  normalizedName: string,
  price: number,
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    id,
    productId: null,
    productName: normalizedName,
    normalizedName: normalizedName.toLowerCase(),
    category: null,
    model: normalizedName,
    capacity: null,
    color: null,
    condition: 'NOVO',
    qualityGrade: null,
    price,
    availability: null,
    rawLine: `${normalizedName} R$ ${price}`,
    ...overrides,
  };
}

function persistedItem(
  id: string,
  item: ReturnType<typeof parseSupplierListText>[number],
  condition: 'NOVO' | 'CPO' | 'SEMINOVO',
  price: number,
) {
  return { ...item, id, productId: null, condition, price };
}

function expectPersistencePayloadWithoutConditionProvenance(payload: unknown) {
  expect(payload).not.toHaveProperty('conditionProvenance');
}

describe('EvolutionWebhookService', () => {
  it.each([
    ['BAIXOU\nProduto B 256GB\nAzul R$ 5.500', 'PARTIAL_UPDATE'],
    ['LISTA COMPLETA\nProduto B 256GB\nAzul R$ 5.500', 'FULL_SNAPSHOT'],
    ['🔥 APARELHOS DISPONÍVEIS EM LOJA 🔥\nProduto B 256GB\nAzul R$ 5.500', 'FULL_SNAPSHOT'],
    ['*IPHONES LACRADOS*\nProduto B 256GB\nAzul R$ 5.500', 'FULL_SNAPSHOT'],
    ['LISTA UNIFICADA\nProduto B 256GB\nAzul R$ 5.500', 'FULL_SNAPSHOT'],
    ['PROMOÇÃO - LISTA COMPLETA\nProduto B 256GB\nAzul R$ 5.500', 'INCONCLUSIVE'],
    ['PROMOÇÃO - APARELHOS DISPONÍVEIS EM LOJA\nProduto B 256GB\nAzul R$ 5.500', 'INCONCLUSIVE'],
    ['PROMOÇÕES DO DIA\nProduto B 256GB\nAzul R$ 5.500', 'PARTIAL_UPDATE'],
    ['REPOSIÇÃO CHEGOU\nProduto B 256GB\nAzul R$ 5.500', 'PARTIAL_UPDATE'],
    ['CHEGOU LACRADO\nProduto B 256GB\nAzul R$ 5.500', 'PARTIAL_UPDATE'],
    ['OFERTA\nProduto B 256GB\nAzul R$ 5.500', 'PARTIAL_UPDATE'],
    ['Últimas peças do dia\nProduto B 256GB\nAzul R$ 5.500', 'PARTIAL_UPDATE'],
    ['Produto B 256GB\nAzul R$ 5.500', 'INCONCLUSIVE'],
    ['Produto A 128GB\nAzul R$ 5.500\nProduto B 256GB\nPreto R$ 6.000', 'INCONCLUSIVE'],
  ])('classifica mensagens de atualização (%s)', (text, expected) => {
    expect(classifySupplierListUpdateMode(text)).toBe(expected);
  });

  it('persiste primary e mescla somente a excecao usada de heading lacrado universal', async () => {
    const rawText = `APARELHOS LACRADOS
iPhone 17 Pro 256GB
Preto R$ 6.000
MacBook Air M5 16GB/512GB OPEN BOX
Prata R$ 7.000`;
    const { service, transaction } = createService([], undefined, 'neutral-supplier');

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'universal-primary-with-open-box',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: rawText },
      },
    });

    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          supplierContactId: 'neutral-supplier',
          snapshotScope: 'catalog:primary',
          items: { create: [expect.objectContaining({ condition: 'NOVO' })] },
        }),
      }),
    );
    expect(transaction.supplierCurrentList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          snapshotScope: 'catalog:used',
          items: { create: [expect.objectContaining({ condition: 'SEMINOVO' })] },
        }),
      }),
    );
  });

  it('mescla somente seminovos quando garantia Apple nao prova condicao primaria', async () => {
    const rawText = `APARELHOS GARANTIA APPLE
iPhone 17 Pro 512GB
Preto R$ 7.000
IPHONE SEMINOVOS
iPhone 16 Pro 256GB
Azul R$ 5.000`;
    const { service, transaction } = createService([], undefined, 'neutral-supplier');

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'universal-warranty-used',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: rawText },
      },
    });

    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          snapshotScope: 'catalog:used',
          items: { create: [expect.objectContaining({ condition: 'SEMINOVO' })] },
        }),
      }),
    );
  });

  it('substitui ambos os segmentos quando headings usados e primarios cobrem o documento', async () => {
    const rawText = `MACBOOK SEMINOVOS
MacBook Pro M3 16GB/512GB
Prata R$ 6.000
IPADS SEMINOVOS
iPad Air M2 128GB
Azul R$ 3.500
DIVERSOS NOVOS
DJI Mini 4 Pro R$ 4.000
DJI Mini 4 Pro OPEN BOX R$ 3.500`;
    const { service, transaction } = createService([], undefined, 'neutral-supplier');

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'universal-mixed-segments',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: rawText },
      },
    });

    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledTimes(2);
    const writes = transaction.supplierCurrentList.upsert.mock.calls.map(([value]) => value);
    expect(writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          create: expect.objectContaining({ snapshotScope: 'catalog:primary' }),
        }),
        expect.objectContaining({
          create: expect.objectContaining({ snapshotScope: 'catalog:used' }),
        }),
      ]),
    );
  });

  it('persiste a lista completa real da Point Cell como FULL_SNAPSHOT legítimo', async () => {
    const parsed = parseSupplierListText(pointCellFullList20260929);
    expect(parsed).toHaveLength(44);
    expect(isValidParsedSupplierListSnapshot(parsed)).toBe(true);

    const { service, transaction } = createService([], undefined, POINT_CELL_SUPPLIER_CONTACT_ID);
    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'point-cell-full-20260929-1131',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: pointCellFullList20260929 },
      },
    });

    expect(result).toEqual({
      accepted: true,
      supplierId: POINT_CELL_SUPPLIER_CONTACT_ID,
      items: 44,
    });
    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ snapshotScope: 'catalog:primary' }),
        update: expect.objectContaining({ items: expect.objectContaining({ deleteMany: {} }) }),
      }),
    );
    const write = transaction.supplierCurrentList.upsert.mock.calls[0]?.[0];
    for (const item of [...write.create.items.create, ...write.update.items.create]) {
      expectPersistencePayloadWithoutConditionProvenance(item);
    }
  });

  it('preserva provenance de policy para o escopo, mas não a envia ao Prisma no FULL_SNAPSHOT', async () => {
    const fixture = lotDocumentFixtures[0];
    const parsed = parseSupplierListText(fixture.rawText);
    const policyItems = applySupplierListConditionPolicy(parsed, TARGET_SUPPLIER_CONTACT_ID);
    expect(policyItems).toHaveLength(fixture.parsedItems);
    expect(policyItems.every((item) => item.conditionProvenance === 'POLICY_DEFAULT')).toBe(true);

    const { service, transaction } = createService([], undefined, TARGET_SUPPLIER_CONTACT_ID);
    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'persisted-policy-default-full',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: fixture.rawText },
      },
    });

    const write = transaction.supplierCurrentList.upsert.mock.calls[0]?.[0];
    expect(write).toBeDefined();
    for (const item of [...write.create.items.create, ...write.update.items.create]) {
      expectPersistencePayloadWithoutConditionProvenance(item);
    }
  });

  it('mescla as últimas peças não segmentadas no catalog:primary sem substituir a lista existente', async () => {
    const incoming = parseSupplierListText(pointCellLastPieces20260929);
    expect(incoming).toHaveLength(3);
    expect(incoming.every((item) => item.condition === null)).toBe(true);

    const [black, blue] = incoming;
    const preserved = currentItem('preserved-item', 'iPhone 17 256GB', 5200, {
      category: 'iPhone',
      model: 'iPhone 17 256GB',
      capacity: '256GB',
      color: 'preto',
      condition: null,
    });
    const currentList = {
      id: 'point-cell-primary-list',
      items: [
        { ...black!, id: 'point-black', productId: null, price: 9300 },
        { ...blue!, id: 'point-blue', productId: null, price: 9400 },
        preserved,
      ],
    };
    const { service, transaction } = createService([], undefined, POINT_CELL_SUPPLIER_CONTACT_ID);
    transaction.supplierCurrentList.findUnique.mockResolvedValue(currentList);

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'point-cell-last-pieces-20260929-1623',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: pointCellLastPieces20260929 },
      },
    });

    expect(result).toEqual({
      accepted: true,
      supplierId: POINT_CELL_SUPPLIER_CONTACT_ID,
      items: 3,
    });
    expect(transaction.supplierCurrentList.findUnique).toHaveBeenCalledWith({
      where: {
        supplierContactId_snapshotScope: {
          supplierContactId: POINT_CELL_SUPPLIER_CONTACT_ID,
          snapshotScope: 'catalog:primary',
        },
      },
      include: { items: true },
    });
    expect(transaction.supplierCurrentList.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'point-cell-primary-list' } }),
    );
    expect(transaction.supplierCurrentListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'point-black' },
        data: expect.objectContaining({ price: 9050 }),
      }),
    );
    expect(transaction.supplierCurrentListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'point-blue' },
        data: expect.objectContaining({ price: 9100 }),
      }),
    );
    expect(transaction.supplierCurrentListItem.create).toHaveBeenCalledOnce();
    for (const [{ data }] of transaction.supplierCurrentListItem.update.mock.calls) {
      expectPersistencePayloadWithoutConditionProvenance(data);
    }
    for (const [{ data }] of transaction.supplierCurrentListItem.create.mock.calls) {
      expectPersistencePayloadWithoutConditionProvenance(data);
    }
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.deleteMany).not.toHaveBeenCalled();
    expect(preserved).toEqual(expect.objectContaining({ price: 5200 }));
  });

  it('não cria nem substitui catálogo quando últimas peças não segmentadas não têm lista primary prévia', async () => {
    const { service, transaction } = createService([], undefined, POINT_CELL_SUPPLIER_CONTACT_ID);

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'point-cell-last-pieces-without-primary-20260929-1623',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: pointCellLastPieces20260929 },
      },
    });

    expect(transaction.evolutionWebhookReceipt.create).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.create).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.deleteMany).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
  });

  it.each(lotDocumentFixtures)(
    'persiste a lista real $id pela policy explicita do contato',
    async ({ id, rawText, parsedItems }) => {
      const parsed = parseSupplierListText(rawText);
      expect(parsed).toHaveLength(parsedItems);
      expect(isValidParsedSupplierListSnapshot(parsed)).toBe(true);
      const policyItems = applySupplierListConditionPolicy(parsed, TARGET_SUPPLIER_CONTACT_ID);
      expect(policyItems.every((item) => item.condition === 'NOVO')).toBe(true);
      expect(
        resolveSupplierSnapshotScope(rawText, policyItems, TARGET_SUPPLIER_CONTACT_ID),
      ).toMatchObject({
        status: 'RESOLVED',
        scopeKey: 'catalog:primary',
        reason: 'supplier_policy_content',
      });

      const { service, transaction, supplierContacts } = createService(
        [],
        undefined,
        TARGET_SUPPLIER_CONTACT_ID,
      );
      const result = await service.receive(webhookSecret, {
        event: 'MESSAGES_UPSERT',
        data: {
          key: {
            id: `message-lot-${id}`,
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: false,
          },
          message: { conversation: rawText },
        },
      });

      expect(result).toEqual({
        accepted: true,
        supplierId: TARGET_SUPPLIER_CONTACT_ID,
        items: parsedItems,
      });
      expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledOnce();
      expect(supplierContacts.findActiveByWhatsappNumber).toHaveBeenCalledOnce();
      expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            supplierContactId: TARGET_SUPPLIER_CONTACT_ID,
            snapshotScope: 'catalog:primary',
            items: {
              create: expect.arrayContaining([expect.objectContaining({ condition: 'NOVO' })]),
            },
          }),
        }),
      );
    },
  );

  it('contem a lista mista governada de Mohamad no used sem substituir primary', async () => {
    const parsed = parseSupplierListText(mohamadNasserList20260926);
    expect(parsed).toHaveLength(123);
    expect(isValidParsedSupplierListSnapshot(parsed)).toBe(true);
    expect(parsed.filter((item) => item.condition === null)).toHaveLength(30);
    expect(parsed.filter((item) => item.condition === 'CPO')).toHaveLength(4);
    expect(parsed.filter((item) => item.condition === 'SEMINOVO')).toHaveLength(1);
    expect(parsed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productName: 'iPhone 14 (256G)',
          normalizedName: 'iphone 14 256g',
          condition: 'CPO',
          conditionProvenance: 'EXPLICIT_PRODUCT',
          price: 3200,
        }),
        expect.objectContaining({
          productName: 'iPhone 15 (128GB)',
          normalizedName: 'iphone 15 128gb',
          condition: 'SEMINOVO',
          conditionProvenance: 'EXPLICIT_PRODUCT',
          price: 2650,
        }),
      ]),
    );

    const policyItems = applySupplierListConditionPolicy(
      parsed,
      MOHAMAD_NASSER_SUPPLIER_CONTACT_ID,
    );
    expect(policyItems).toHaveLength(123);
    expect(policyItems.filter((item) => item.condition === null)).toHaveLength(0);
    expect(policyItems.filter((item) => item.condition === 'NOVO')).toHaveLength(118);
    expect(policyItems.filter((item) => item.condition === 'CPO')).toHaveLength(4);
    expect(policyItems.filter((item) => item.condition === 'SEMINOVO')).toHaveLength(1);
    expect(
      policyItems.filter((item) => item.conditionProvenance === 'POLICY_DEFAULT'),
    ).toHaveLength(30);
    expect(resolveSupplierSnapshotScope(mohamadNasserList20260926, parsed)).toMatchObject({
      status: 'UNKNOWN',
      reason: 'insufficient_document_evidence',
    });
    const { service: defaultService, transaction: defaultTransaction } = createService();
    await defaultService.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-mohamad-nasser-default-policy-20260926',
          remoteJid: '5511994430333@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: mohamadNasserList20260926 },
      },
    });
    expect(defaultTransaction.supplierCurrentList.upsert).not.toHaveBeenCalled();

    expect(
      resolveSupplierSnapshotScope(
        mohamadNasserList20260926,
        policyItems,
        MOHAMAD_NASSER_SUPPLIER_CONTACT_ID,
      ),
    ).toMatchObject({
      status: 'RESOLVED',
      scopeKey: 'catalog:primary',
      reason: 'supplier_policy_content',
      evidence: {
        conditionProvenances: expect.arrayContaining(['EXPLICIT_PRODUCT', 'POLICY_DEFAULT']),
      },
      segmentAuthorities: {
        primary: 'FULL_SNAPSHOT',
        used: 'ISOLATED_EXPLICIT_ITEMS',
      },
    });

    const { service, transaction } = createService(
      [],
      undefined,
      MOHAMAD_NASSER_SUPPLIER_CONTACT_ID,
    );
    const primaryItems = Array.from({ length: 1000 }, (_, index) =>
      currentItem(`primary-${index}`, `Primary ${index}`, 1000 + index),
    );
    transaction.supplierCurrentList.findUnique.mockImplementation(async ({ where }) => {
      const scope = where.supplierContactId_snapshotScope.snapshotScope;
      if (scope === 'catalog:primary') return { id: 'mohamad-primary-list', items: primaryItems };
      return null;
    });
    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-mohamad-nasser-20260926',
          remoteJid: '5511994430333@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: mohamadNasserList20260926 },
      },
    });

    expect(result).toEqual({
      accepted: true,
      supplierId: MOHAMAD_NASSER_SUPPLIER_CONTACT_ID,
      items: 123,
    });
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.findUnique).toHaveBeenCalledWith({
      where: {
        supplierContactId_snapshotScope: {
          supplierContactId: MOHAMAD_NASSER_SUPPLIER_CONTACT_ID,
          snapshotScope: 'catalog:used',
        },
      },
      include: { items: true },
    });
    expect(primaryItems).toHaveLength(1000);
    expect(transaction.supplierCurrentList.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          snapshotScope: 'catalog:used',
          items: { create: [expect.objectContaining({ condition: 'SEMINOVO' })] },
        }),
      }),
    );
    const usedCreate =
      transaction.supplierCurrentList.create.mock.calls[0]?.[0].data.items.create[0];
    expect(usedCreate.condition).toBe('SEMINOVO');
    expectPersistencePayloadWithoutConditionProvenance(usedCreate);
    expect(transaction.supplierCurrentList.deleteMany).not.toHaveBeenCalled();
  });

  it('preserva o primary existente de 1.000 itens e mescla somente o seminovo explícito no used', async () => {
    const policyItems = applySupplierListConditionPolicy(
      parseSupplierListText(mohamadNasserList20260926),
      MOHAMAD_NASSER_SUPPLIER_CONTACT_ID,
    );
    const incomingUsed = policyItems.find((item) => item.condition === 'SEMINOVO');
    expect(incomingUsed).toBeDefined();

    const { service, transaction } = createService(
      [],
      undefined,
      MOHAMAD_NASSER_SUPPLIER_CONTACT_ID,
    );
    const primaryItems = Array.from({ length: 1000 }, (_, index) =>
      currentItem(`primary-${index}`, `Primary ${index}`, 1000 + index),
    );
    const usedList = {
      id: 'mohamad-used-list',
      items: [
        { ...incomingUsed!, id: 'used-iphone-15', productId: null, price: 2700 },
        currentItem('preserved-used-item', 'iPhone 14 128GB', 2300, {
          condition: 'SEMINOVO',
          color: 'azul',
        }),
      ],
    };
    transaction.supplierCurrentList.findUnique.mockImplementation(async ({ where }) => {
      const scope = where.supplierContactId_snapshotScope.snapshotScope;
      if (scope === 'catalog:used') return usedList;
      return { id: 'mohamad-primary-list', items: primaryItems };
    });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-mohamad-nasser-existing-used-20260926',
          remoteJid: '5511994430333@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: mohamadNasserList20260926 },
      },
    });

    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.findUnique).not.toHaveBeenCalledWith({
      where: {
        supplierContactId_snapshotScope: {
          supplierContactId: MOHAMAD_NASSER_SUPPLIER_CONTACT_ID,
          snapshotScope: 'catalog:primary',
        },
      },
      include: { items: true },
    });
    expect(primaryItems).toHaveLength(1000);
    expect(transaction.supplierCurrentList.create).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'used-iphone-15' },
        data: expect.objectContaining({ condition: 'SEMINOVO', price: 2650 }),
      }),
    );
    const usedUpdate = transaction.supplierCurrentListItem.update.mock.calls[0]?.[0].data;
    expectPersistencePayloadWithoutConditionProvenance(usedUpdate);
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.deleteMany).not.toHaveBeenCalled();
  });

  it('reverte o merge used isolado quando a operacao falha', async () => {
    const { service, prisma, transaction } = createService(
      [],
      undefined,
      MOHAMAD_NASSER_SUPPLIER_CONTACT_ID,
    );
    const state = { usedCreated: false };
    transaction.supplierCurrentList.findUnique.mockResolvedValue({ id: 'used-list', items: [] });
    transaction.supplierCurrentListItem.create.mockImplementation(async () => {
      state.usedCreated = true;
      throw new Error('isolated used merge failed');
    });
    prisma.$transaction.mockImplementation(async (callback) => {
      const before = { ...state };
      try {
        return await callback(transaction);
      } catch (error) {
        Object.assign(state, before);
        throw error;
      }
    });

    await expect(
      service.receive(webhookSecret, {
        event: 'MESSAGES_UPSERT',
        data: {
          key: {
            id: 'message-mohamad-nasser-rollback-20260926',
            remoteJid: '5511994430333@s.whatsapp.net',
            fromMe: false,
          },
          message: { conversation: mohamadNasserList20260926 },
        },
      }),
    ).rejects.toThrow('isolated used merge failed');

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.create).toHaveBeenCalledOnce();
    expect(state).toEqual({ usedCreated: false });
  });

  it('mantem o receipt Mohamad idempotente para o merge used isolado', async () => {
    const { service, transaction } = createService(
      [],
      undefined,
      MOHAMAD_NASSER_SUPPLIER_CONTACT_ID,
    );
    const payload = {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-mohamad-nasser-duplicate-20260926',
          remoteJid: '5511994430333@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: mohamadNasserList20260926 },
      },
    };

    await service.receive(webhookSecret, payload);
    transaction.evolutionWebhookReceipt.create.mockRejectedValueOnce({ code: 'P2002' });

    await expect(service.receive(webhookSecret, payload)).resolves.toEqual({
      accepted: true,
      duplicate: true,
    });
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.create).toHaveBeenCalledOnce();
  });

  it.each(pronineFixtures)(
    'persiste a lista ProNine $id sem depender de marcador documental',
    async ({ id, rawText, parsedItems }) => {
      const { service, transaction } = createService(
        [],
        undefined,
        PRONINE_ATACADO_SUPPLIER_CONTACT_ID,
      );

      const result = await service.receive(webhookSecret, {
        event: 'MESSAGES_UPSERT',
        data: {
          key: {
            id: `message-pronine-${id}`,
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: false,
          },
          message: { conversation: rawText },
        },
      });

      expect(result).toEqual({
        accepted: true,
        supplierId: PRONINE_ATACADO_SUPPLIER_CONTACT_ID,
        items: parsedItems,
      });
      expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            supplierContactId: PRONINE_ATACADO_SUPPLIER_CONTACT_ID,
            snapshotScope: 'catalog:primary',
            items: {
              create: expect.arrayContaining([expect.objectContaining({ condition: 'NOVO' })]),
            },
          }),
        }),
      );
    },
  );

  it.each(['CHEGOU MAIS', ''])('aceita lista ProNine válida com cabeçalho %s', async (header) => {
    const [, ...bodyLines] = pronineFixtures[1].rawText.split('\n');
    const rawText = [header, ...bodyLines].filter(Boolean).join('\n');
    const { service, transaction } = createService(
      [],
      undefined,
      PRONINE_ATACADO_SUPPLIER_CONTACT_ID,
    );

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: `message-pronine-header-${header || 'none'}`,
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: rawText },
      },
    });

    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ snapshotScope: 'catalog:primary' }),
      }),
    );
  });

  it('preserva SEMINOVO explícito da lista ProNine', async () => {
    const { service, transaction } = createService(
      [],
      undefined,
      PRONINE_ATACADO_SUPPLIER_CONTACT_ID,
    );
    const rawText = `SEMI NOVOS PRONTA ENTREGA SAO PAULO

APARELHOS 100% ORIGINAIS - AMERICANOS GRADE A
GARANTIA 60 DIAS

IPHONE 16 PLUS 128 - R$3.480,00
AZUL - 96%-95%
PRETO - 93%`;

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-pronine-used',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: rawText },
      },
    });

    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          snapshotScope: 'catalog:used',
          items: { create: [expect.objectContaining({ condition: 'SEMINOVO' })] },
        }),
      }),
    );
  });

  it.each([
    '17 PRO MAX 256 SILVER ESGOTADOS',
    'que tem pedido para pagar DA LINHA 18 pode me chamar no PV AGORA',
  ])('preserva fail-closed para mensagem ProNine não comercial: %s', async (rawText) => {
    const { service, transaction } = createService(
      [],
      undefined,
      PRONINE_ATACADO_SUPPLIER_CONTACT_ID,
    );

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: `message-pronine-invalid-${rawText.length}`,
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: rawText },
      },
    });

    expect(result).toEqual({ accepted: false, ignored: true, reason: 'invalid_or_empty_snapshot' });
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
  });

  it.each(xAtacadoSupplierContactIds)(
    'persiste as ofertas de iPhone e iPad do contato X Atacado %s',
    async (supplierContactId) => {
      for (const fixture of xAtacadoFixtures) {
        const { service, transaction } = createService([], undefined, supplierContactId);

        const result = await service.receive(webhookSecret, {
          event: 'MESSAGES_UPSERT',
          data: {
            key: {
              id: `message-x-atacado-${supplierContactId}-${fixture.id}`,
              remoteJid: '5511999999999@s.whatsapp.net',
              fromMe: false,
            },
            message: { conversation: fixture.rawText },
          },
        });

        expect(result).toEqual({
          accepted: true,
          supplierId: supplierContactId,
          items: fixture.parsedItems,
        });
        expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            create: expect.objectContaining({
              supplierContactId,
              snapshotScope: 'catalog:primary',
              items: {
                create: expect.arrayContaining([expect.objectContaining({ condition: 'NOVO' })]),
              },
            }),
          }),
        );
      }
    },
  );

  it.each(xAtacadoSupplierContactIds)(
    'aceita oferta X Atacado com cabeçalho arbitrário e sem cabeçalho para %s',
    async (supplierContactId) => {
      for (const [headerMode, header] of [
        ['arbitrary', 'Resumo comercial'],
        ['none', ''],
      ] as const) {
        const { service, transaction } = createService([], undefined, supplierContactId);
        const rawText = [header, xAtacadoFixtures[0].rawText].filter(Boolean).join('\n');

        const result = await service.receive(webhookSecret, {
          event: 'MESSAGES_UPSERT',
          data: {
            key: {
              id: `message-x-atacado-${supplierContactId}-${headerMode}`,
              remoteJid: '5511999999999@s.whatsapp.net',
              fromMe: false,
            },
            message: { conversation: rawText },
          },
        });

        expect(result).toEqual({
          accepted: true,
          supplierId: supplierContactId,
          items: xAtacadoFixtures[0].parsedItems,
        });
        expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledOnce();
      }
    },
  );

  it.each(xAtacadoSupplierContactIds)(
    'preserva fail-closed para mensagens X Atacado sem snapshot comercial: %s',
    async (supplierContactId) => {
      for (const rawText of [
        '17 PRO MAX 256 SILVER ESGOTADOS',
        'Aviso logístico: prazo de envio atualizado.',
      ]) {
        const { service, transaction } = createService([], undefined, supplierContactId);
        const result = await service.receive(webhookSecret, {
          event: 'MESSAGES_UPSERT',
          data: {
            key: {
              id: `message-x-atacado-invalid-${supplierContactId}-${rawText.length}`,
              remoteJid: '5511999999999@s.whatsapp.net',
              fromMe: false,
            },
            message: { conversation: rawText },
          },
        });

        expect(result).toEqual({
          accepted: false,
          ignored: true,
          reason: 'invalid_or_empty_snapshot',
        });
        expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
      }
    },
  );

  it.each(xAtacadoSupplierContactIds)(
    'preserva condição explícita acima do default NOVO para X Atacado: %s',
    async (supplierContactId) => {
      const { service, transaction } = createService([], undefined, supplierContactId);
      const rawText = 'SWAP\niPhone 17 Pro Max 256GB\nBlue R$ 6.669';

      await service.receive(webhookSecret, {
        event: 'MESSAGES_UPSERT',
        data: {
          key: {
            id: `message-x-atacado-used-${supplierContactId}`,
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: false,
          },
          message: { conversation: rawText },
        },
      });

      expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            snapshotScope: 'catalog:used',
            items: { create: [expect.objectContaining({ condition: 'SEMINOVO' })] },
          }),
        }),
      );
    },
  );

  it.each(['arbitrary_header', 'no_header'])(
    'aceita lista comercial valida com %s para o contato governado',
    async (headerMode) => {
      const [, , ...bodyLines] = lotDocumentFixtures[0].rawText.split('\n');
      const body = bodyLines.join('\n');
      const rawText =
        headerMode === 'arbitrary_header' ? `Resumo semanal de estoque\n${body}` : body;
      const { service, transaction, supplierContacts } = createService(
        [],
        undefined,
        TARGET_SUPPLIER_CONTACT_ID,
      );

      const result = await service.receive(webhookSecret, {
        event: 'MESSAGES_UPSERT',
        data: {
          key: {
            id: `message-${headerMode}`,
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: false,
          },
          message: { conversation: rawText },
        },
      });

      expect(result).toEqual({
        accepted: true,
        supplierId: TARGET_SUPPLIER_CONTACT_ID,
        items: lotDocumentFixtures[0].parsedItems,
      });
      expect(supplierContacts.findActiveByWhatsappNumber).toHaveBeenCalledOnce();
      expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledOnce();
      expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ snapshotScope: 'catalog:primary' }),
        }),
      );
    },
  );

  it('preserva fail-closed de contato nao governado sem marcador documental', async () => {
    const [, , ...bodyLines] = lotDocumentFixtures[0].rawText.split('\n');
    const { service, transaction } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-other-supplier-no-header',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: bodyLines.join('\n') },
      },
    });

    expect(result).toMatchObject({ accepted: true, supplierId: 'supplier-contact-id' });
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
  });

  it('rejeita mensagem comum do contato governado sem lista comercial valida', async () => {
    const { service, transaction } = createService([], undefined, TARGET_SUPPLIER_CONTACT_ID);
    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-common-text',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'Bom dia! Aviso administrativo: envio previsto para amanhã.' },
      },
    });

    expect(result).toEqual({ accepted: false, ignored: true, reason: 'invalid_or_empty_snapshot' });
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
  });

  it('preserva condição explicita reconhecida acima do default NOVO', async () => {
    const { service, transaction } = createService([], undefined, TARGET_SUPPLIER_CONTACT_ID);
    const rawText = 'SWAP\niPhone 17 256GB SEMINOVO\nPreto R$ 4.600';
    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-explicit-used-condition',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: rawText },
      },
    });

    expect(result).toMatchObject({ accepted: true });
    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          snapshotScope: 'catalog:used',
          items: { create: [expect.objectContaining({ condition: 'SEMINOVO' })] },
        }),
      }),
    );
  });

  it.each([
    ['Lote 9821 ABC', 'iPhone 17 256GB\nPreto R$ 4.600\nAirPods Pro 3\nR$ 1.100'],
    ['Lote 55 XYZ', 'iPhone 17 Pro 256GB\nAzul R$ 6.200\niPad 11 128GB\nPrata R$ 2.450'],
  ])('persiste cabecalho de lote com identificador dinamico: %s', async (header, offers) => {
    const rawText = `${header}\n${offers}`;
    const { service, transaction } = createService();

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: `message-${header.replace(/\s+/g, '-').toLowerCase()}`,
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: rawText },
      },
    });

    expect(classifySupplierListUpdateMode(rawText)).toBe('FULL_SNAPSHOT');
    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ snapshotScope: 'catalog:general' }),
      }),
    );
  });

  it.each([
    'Temos lote disponível hoje',
    'Último lote de iPhone disponível',
    'Lote promocional',
    'Chegou lote novo, me chama',
    'iPhone 17 256GB\nEsse lote está disponível\nPreto R$ 4.600',
  ])('nao concede autoridade completa a texto comercial com lote: %s', (text) => {
    expect(classifySupplierListUpdateMode(`${text}\nPreto R$ 4.600`)).toBe('INCONCLUSIVE');
  });

  it('nao persiste cabecalho de lote sem snapshot valido', async () => {
    const { service, transaction } = createService();
    const rawText = 'Lote 9999 ABC';

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-lot-invalid',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: rawText },
      },
    });

    expect(classifySupplierListUpdateMode(rawText)).toBe('FULL_SNAPSHOT');
    expect(result).toEqual({ accepted: false, ignored: true, reason: 'invalid_or_empty_snapshot' });
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
  });

  it('preserva snapshot existente quando a intenção da mensagem é inconclusiva', async () => {
    const { service, transaction } = createService();
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'current-list-id',
      items: [currentItem('item-a', 'Produto A 128GB', 5000)],
    });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-inconclusive-short',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'iPhone B 256GB\nSilver R$ 5.500' },
      },
    });

    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.findUnique).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
  });

  it('mantem o resultado produtivo quando a observacao shadow e habilitada', async () => {
    const withoutRecovery = createService();
    const recovery = { observeCandidates: vi.fn().mockResolvedValue([]) };
    const withRecovery = createService([], recovery);
    const payload = {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-shadow-only',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'IPHONES SEMINOVOS\niPhone 15 128GB\nPreto R$ 2.100' },
      },
    };

    const resultWithout = await withoutRecovery.service.receive(webhookSecret, payload);
    const resultWith = await withRecovery.service.receive(webhookSecret, payload);

    expect(resultWith).toEqual(resultWithout);
    expect(recovery.observeCandidates).toHaveBeenCalledTimes(1);
    expect(withRecovery.transaction.supplierCurrentList.upsert).toHaveBeenCalledTimes(1);
  });

  it('promove somente candidato FOUND de linha rejeitada e apenas por create aditivo', async () => {
    const { service, transaction } = createService([
      catalogProduct('product-1', 'iPhone 17 Pro 256GB'),
    ]);
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'primary-list',
      sourceMessageId: 'message-recovery',
      items: [],
    });
    const candidate = {
      productName: 'iPhone 17 Pro 256GB',
      normalizedName: 'iphone 17 pro 256gb',
      category: 'iPhone',
      model: 'iPhone 17 Pro',
      capacity: '256GB',
      color: 'azul',
      condition: 'NOVO',
      qualityGrade: null,
      price: 6900,
      availability: null,
      rawLine: 'iPhone 17 Pro 256GB azul R$ 6900',
    };
    await (service as any).promoteRecoveredCandidates(
      'supplier-contact-id',
      'message-recovery',
      [{ scopeKey: 'catalog:primary', itemGroup: 'PRIMARY', operation: 'PARTIAL_UPDATE' }],
      [
        {
          originalReason: 'missing_product_context',
          sourceText: 'IPHONES NOVOS',
          rawLine: candidate.rawLine,
          previousLines: [],
          nextLines: [],
          activeProductHeading: candidate.productName,
          activeCategory: candidate.category,
          activeCondition: 'NOVO',
          qualityGrade: null,
          detectedPrice: 6900,
        },
      ],
      [
        {
          normalizationStatus: 'FOUND',
          identityStatus: 'FOUND',
          resolvedProductId: 'product-1',
          candidate,
        },
      ],
    );

    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentListItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        supplierCurrentListId: 'primary-list',
        productId: 'product-1',
        price: 6900,
      }),
    });
    const recoveredCreate = transaction.supplierCurrentListItem.create.mock.calls[0]?.[0].data;
    expectPersistencePayloadWithoutConditionProvenance(recoveredCreate);
    expect(transaction.supplierCurrentListItem.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
  });

  it('bloqueia promocao quando o snapshot ficou mais recente ou a chave ja existe', async () => {
    const { service, transaction } = createService();
    const candidate = {
      productName: 'iPhone 17 Pro 256GB',
      normalizedName: 'iphone 17 pro 256gb',
      category: 'iPhone',
      model: 'iPhone 17 Pro',
      capacity: '256GB',
      color: 'azul',
      condition: 'NOVO',
      qualityGrade: null,
      price: 6900,
      availability: null,
      rawLine: 'iPhone 17 Pro 256GB azul R$ 6900',
    };
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'primary-list',
      sourceMessageId: 'newer-message',
      items: [currentItem('existing', candidate.normalizedName, 6800, candidate)],
    });
    const input = {
      originalReason: 'missing_product_context',
      sourceText: 'IPHONES NOVOS',
      rawLine: candidate.rawLine,
      previousLines: [],
      nextLines: [],
      activeProductHeading: candidate.productName,
      activeCategory: candidate.category,
      activeCondition: 'NOVO',
      qualityGrade: null,
      detectedPrice: 6900,
    };
    await (service as any).promoteRecoveredCandidates(
      'supplier-contact-id',
      'old-message',
      [{ scopeKey: 'catalog:primary', itemGroup: 'PRIMARY', operation: 'PARTIAL_UPDATE' }],
      [input],
      [
        {
          normalizationStatus: 'FOUND',
          identityStatus: 'FOUND',
          resolvedProductId: 'product-1',
          candidate,
        },
      ],
    );
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
  });

  it('aceita somente equivalencias de proveniencia resolvidas deterministicamente', async () => {
    const { service, transaction } = createService();
    const candidate = {
      productName: 'iPhone 17 Pro 256GB',
      normalizedName: 'iphone 17 pro 256gb',
      category: 'iPhone',
      model: 'iPhone 17 Pro',
      capacity: '256GB',
      color: 'azul',
      condition: 'NOVO',
      qualityGrade: null,
      price: 6900,
      availability: null,
      rawLine: 'iPhone 17 Pro 256GB blue R$ 6900',
    };
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'primary-list',
      sourceMessageId: 'message-recovery',
      items: [],
    });
    const promote = (rawLine: string, overrides: Partial<typeof candidate> = {}) =>
      (service as any).promoteRecoveredCandidates(
        'supplier-contact-id',
        'message-recovery',
        [{ scopeKey: 'catalog:primary', itemGroup: 'PRIMARY', operation: 'PARTIAL_UPDATE' }],
        [
          {
            originalReason: 'missing_product_context',
            sourceText: 'IPHONES NOVOS',
            rawLine,
            previousLines: [],
            nextLines: [],
            activeProductHeading: rawLine.replace(/ R\$.*/, ''),
            activeCategory: 'iPhone',
            activeCondition: 'NOVO',
            qualityGrade: null,
            detectedPrice: 6900,
          },
        ],
        [
          {
            normalizationStatus: 'FOUND',
            identityStatus: 'FOUND',
            resolvedProductId: 'product-1',
            candidate: { ...candidate, ...overrides },
          },
        ],
      );

    await promote(candidate.rawLine);
    expect(transaction.supplierCurrentListItem.create).toHaveBeenCalledTimes(1);

    transaction.supplierCurrentListItem.create.mockClear();
    await promote('iPhone 17 Pro 256G AZ R$ 6900');
    await promote('iPhone 17 Pro 128GB azul R$ 6900');
    await promote('iPhone 17 Pro 256GB preto R$ 6900');
    await promote('iPhone 17 Pro 256GB R$ 6900');
    await promote('iPhone 18 Pro 256GB azul R$ 6900');
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
  });

  it('cadastra de forma canônica e acrescenta o Product Luna desconhecido sem reescrever a lista', async () => {
    const { service, transaction } = createService();
    const candidate = {
      productName: 'iPhone 99 Ultra 256GB',
      normalizedName: 'iphone 99 ultra 256gb',
      category: 'iPhone',
      model: 'iPhone 99 Ultra',
      capacity: '256GB',
      color: 'azul',
      condition: 'NOVO',
      qualityGrade: null,
      price: 6900,
      availability: null,
      rawLine: 'iPhone 99 Ultra 256GB azul R$ 6900',
    };
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'primary-list',
      sourceMessageId: 'message-recovery',
      items: [currentItem('existing', 'iPhone 17 128GB', 5000)],
    });
    transaction.productModel.findUnique.mockResolvedValue(null);

    await (service as any).promoteRecoveredCandidates(
      'supplier-contact-id',
      'message-recovery',
      [{ scopeKey: 'catalog:primary', itemGroup: 'PRIMARY', operation: 'PARTIAL_UPDATE' }],
      [
        {
          originalReason: 'missing_product_context',
          sourceText: 'IPHONES NOVOS',
          rawLine: candidate.rawLine,
          previousLines: [],
          nextLines: [],
          activeProductHeading: candidate.productName,
          activeCategory: candidate.category,
          activeCondition: 'NOVO',
          qualityGrade: null,
          detectedPrice: 6900,
        },
      ],
      [
        {
          normalizationStatus: 'MISSING',
          identityStatus: 'MISSING',
          resolvedProductId: null,
          candidate,
        },
      ],
    );

    expect(transaction.productModel.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryId: 'category-iphone',
        name: 'iPhone 99 Ultra',
        productType: 'IPHONE_SEALED',
      }),
    });
    expect(transaction.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        categoryId: 'category-iphone',
        modelId: 'model-iphone-19',
        colorId: 'color-azul',
        storageId: 'storage-256',
        productType: 'IPHONE_SEALED',
        profitCondition: 'NOVO',
        netProfit: null,
      }),
      select: { id: true },
    });
    expect(transaction.supplierCurrentListItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'created-product-id',
        supplierCurrentListId: 'primary-list',
      }),
    });
    expect(transaction.supplierCurrentList.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.deleteMany).not.toHaveBeenCalled();
  });

  it('reutiliza o Product dinâmico, falha fechado em ambiguidade e converge após conflito concorrente', async () => {
    const { service, transaction } = createService([dynamicCatalogProduct()]);
    const candidate = {
      productName: 'iPhone 99 Ultra 256GB',
      normalizedName: 'iphone 99 ultra 256gb',
      category: 'iPhone',
      model: 'iPhone 99 Ultra',
      capacity: '256GB',
      color: 'azul',
      condition: 'NOVO',
      qualityGrade: null,
      price: 6900,
      availability: null,
      rawLine: 'iPhone 99 Ultra 256GB azul R$ 6900',
    };
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'primary-list',
      sourceMessageId: 'message-recovery',
      items: [],
    });
    const input = [
      {
        originalReason: 'missing_product_context',
        sourceText: 'IPHONES NOVOS',
        rawLine: candidate.rawLine,
        previousLines: [],
        nextLines: [],
        activeProductHeading: candidate.productName,
        activeCategory: candidate.category,
        activeCondition: 'NOVO',
        qualityGrade: null,
        detectedPrice: 6900,
      },
    ];
    const result = [
      {
        normalizationStatus: 'MISSING',
        identityStatus: 'MISSING',
        resolvedProductId: null,
        candidate,
      },
    ];

    await (service as any).promoteRecoveredCandidates(
      'supplier-contact-id',
      'message-recovery',
      [{ scopeKey: 'catalog:primary', itemGroup: 'PRIMARY', operation: 'PARTIAL_UPDATE' }],
      input,
      result,
    );
    expect(transaction.product.create).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ productId: 'product-99-ultra' }),
    });

    transaction.supplierCurrentListItem.create.mockClear();
    transaction.product.findMany.mockResolvedValue([
      dynamicCatalogProduct(),
      { ...dynamicCatalogProduct(), id: 'duplicate-product' },
    ]);
    await (service as any).promoteRecoveredCandidates(
      'supplier-contact-id',
      'message-recovery',
      [{ scopeKey: 'catalog:primary', itemGroup: 'PRIMARY', operation: 'PARTIAL_UPDATE' }],
      input,
      result,
    );
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
    expect(transaction.product.create).not.toHaveBeenCalled();

    transaction.product.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([dynamicCatalogProduct('concurrent-product')]);
    transaction.product.create.mockRejectedValueOnce(
      Object.assign(new Error('unique'), { code: 'P2002' }),
    );
    await (service as any).promoteRecoveredCandidates(
      'supplier-contact-id',
      'message-recovery',
      [{ scopeKey: 'catalog:primary', itemGroup: 'PRIMARY', operation: 'PARTIAL_UPDATE' }],
      input,
      result,
    );
    expect(transaction.supplierCurrentListItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ productId: 'concurrent-product' }),
    });
  });

  it('mantem dimensoes estruturais distintas na chave de merge', () => {
    const base = currentItem('item', 'iPad 11 128GB', 2500, {
      category: 'iPad',
      model: 'iPad 11 128GB',
      capacity: '128GB',
      color: 'azul',
    });

    expect(supplierListItemMergeKey(base)).not.toBe(
      supplierListItemMergeKey({ ...base, capacity: '256GB' }),
    );
    expect(supplierListItemMergeKey(base)).not.toBe(
      supplierListItemMergeKey({ ...base, color: 'preto' }),
    );
    expect(supplierListItemMergeKey(base)).not.toBe(
      supplierListItemMergeKey({ ...base, condition: 'CPO' }),
    );
    expect(supplierListItemMergeKey(base)).not.toBe(
      supplierListItemMergeKey({ ...base, qualityGrade: 'A' }),
    );
    expect(supplierListItemMergeKey(base)).not.toBe(
      supplierListItemMergeKey({
        ...base,
        normalizedName: 'iPad 11 128GB Wi-Fi + Cellular',
        model: 'iPad 11 128GB Wi-Fi + Cellular',
      }),
    );
  });

  it('mantem a identidade de oferta por familia sem depender de productId', () => {
    const families = [
      {
        category: 'iPhone',
        normalizedName: 'iPhone 17 Pro 256GB',
        model: 'iPhone 17 Pro',
        capacity: '256GB',
      },
      {
        category: 'iPad',
        normalizedName: 'iPad 11 A16 128GB Wi-Fi',
        model: 'iPad 11',
        capacity: '128GB',
      },
      {
        category: 'MacBook',
        normalizedName: 'MacBook Neo 13 8GB 512GB',
        model: 'MacBook Neo 13',
        capacity: '512GB',
      },
      {
        category: 'Apple Watch',
        normalizedName: 'Apple Watch S11 42MM GPS',
        model: 'Apple Watch S11',
        capacity: null,
      },
    ];

    for (const family of families) {
      const base = currentItem('item', family.normalizedName, 5000, {
        ...family,
        color: 'silver',
        condition: 'NOVO',
        productId: null,
      });

      expect(supplierListItemMergeKey(base)).not.toBe(
        supplierListItemMergeKey({ ...base, color: 'azul' }),
      );
      expect(supplierListItemMergeKey(base)).not.toBe(
        supplierListItemMergeKey({ ...base, condition: 'CPO' }),
      );
    }
  });

  it('atualiza somente a cor correspondente no scope used', async () => {
    const { service, transaction } = createService();
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'current-list-id',
      items: [
        currentItem('silver-novo', 'iPhone 17 Pro Max 256GB', 7100, {
          category: 'iPhone',
          model: 'iPhone 17 Pro Max 256GB',
          capacity: '256GB',
          color: 'silver',
          condition: 'SEMINOVO',
        }),
        currentItem('blue-novo', 'iPhone 17 Pro Max 256GB', 7050, {
          category: 'iPhone',
          model: 'iPhone 17 Pro Max 256GB',
          capacity: '256GB',
          color: 'azul',
          condition: 'SEMINOVO',
        }),
      ],
    });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-promo-silver',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'PROMOÇÃO SWAP\niPhone 17 Pro Max 256GB\nSilver R$ 6.990' },
      },
    });

    expect(transaction.supplierCurrentListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'silver-novo' },
        data: expect.objectContaining({ price: 6990 }),
      }),
    );
    expect(transaction.supplierCurrentListItem.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'blue-novo' } }),
    );
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
  });

  it('persiste A e A+ como ofertas distintas do mesmo Product em FULL', async () => {
    const { service, transaction } = createService([
      catalogProduct('used-product-id', 'iPhone 15 256GB', 'SEMINOVO', 'IPHONE_USED'),
    ]);

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-full-graded',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: {
          conversation: 'LISTA SWAP\niPhone 15 256GB\nGrade A — R$ 2.100\nGrade A+ — R$ 2.200',
        },
      },
    });

    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          items: {
            create: [
              expect.objectContaining({
                condition: 'SEMINOVO',
                qualityGrade: 'A',
                productId: 'used-product-id',
              }),
              expect.objectContaining({
                condition: 'SEMINOVO',
                qualityGrade: 'A+',
                productId: 'used-product-id',
              }),
            ],
          },
        }),
      }),
    );
  });

  it('atualiza A e A+ isoladamente em PARTIAL_UPDATE', async () => {
    const { service, transaction } = createService();
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'used-list-id',
      items: [
        currentItem('grade-a', 'iPhone 15 128GB', 2100, {
          category: 'iPhone',
          capacity: '128GB',
          condition: 'SEMINOVO',
          qualityGrade: 'A',
        }),
        currentItem('grade-a-plus', 'iPhone 15 128GB', 2200, {
          category: 'iPhone',
          capacity: '128GB',
          condition: 'SEMINOVO',
          qualityGrade: 'A+',
        }),
      ],
    });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-partial-grade-a',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'PROMOÇÃO SWAP\niPhone 15 128GB\nGrade A — R$ 2.050' },
      },
    });
    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-partial-grade-a-plus',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'PROMOÇÃO SWAP\niPhone 15 128GB\nGrade A+ — R$ 2.150' },
      },
    });

    expect(transaction.supplierCurrentListItem.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'grade-a' },
        data: expect.objectContaining({ price: 2050, qualityGrade: 'A' }),
      }),
    );
    expect(transaction.supplierCurrentListItem.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'grade-a-plus' },
        data: expect.objectContaining({ price: 2150, qualityGrade: 'A+' }),
      }),
    );
  });

  it('nao casa oferta graduada com item legado sem grade em PARTIAL_UPDATE', async () => {
    const { service, transaction } = createService();
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'used-list-id',
      items: [
        currentItem('legacy-item', 'iPhone 15 128GB', 2100, {
          category: 'iPhone',
          capacity: '128GB',
          condition: 'SEMINOVO',
          qualityGrade: null,
        }),
      ],
    });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-partial-graded-legacy',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'PROMOÇÃO SWAP\niPhone 15 128GB\nGrade A — R$ 2.050' },
      },
    });

    expect(transaction.supplierCurrentListItem.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ qualityGrade: 'A', supplierCurrentListId: 'used-list-id' }),
      }),
    );
  });

  it('localiza atualizacoes parciais no scope resolved do fornecedor', async () => {
    const { service, transaction } = createService();
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'current-list-id',
      items: [
        currentItem('item-b', 'Produto B 256GB', 6000, {
          capacity: '256GB',
          color: 'azul',
          condition: 'SEMINOVO',
        }),
      ],
    });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-used-partial',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'PROMOÇÃO SWAP\nProduto B 256GB\nAzul R$ 5.500' },
      },
    });

    expect(transaction.supplierCurrentList.findUnique).toHaveBeenCalledWith({
      where: {
        supplierContactId_snapshotScope: {
          supplierContactId: 'supplier-contact-id',
          snapshotScope: 'catalog:used',
        },
      },
      include: { items: true },
    });
    expect(transaction.supplierCurrentListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-b' },
        data: expect.objectContaining({ price: 5500 }),
      }),
    );
  });

  it('atualiza somente o snapshot used existente e sua proveniencia', async () => {
    const { service, transaction } = createService();
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'used-list-id',
      sourceMessageId: 'used-full-message',
      items: [
        currentItem('used-u1', 'iPhone 14 128GB', 2800, {
          category: 'iPhone',
          model: 'iPhone 14',
          capacity: '128GB',
          color: 'preto',
          condition: 'SEMINOVO',
        }),
        currentItem('used-u2', 'iPhone 15 128GB', 3000, {
          category: 'iPhone',
          model: 'iPhone 15 128GB',
          capacity: '128GB',
          color: 'azul',
          condition: 'SEMINOVO',
        }),
      ],
    });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'used-partial-message',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'PROMOÇÃO SWAP\niPhone 15 128GB\nAzul R$ 2.900' },
      },
    });

    expect(transaction.supplierCurrentList.findUnique).toHaveBeenCalledWith({
      where: {
        supplierContactId_snapshotScope: {
          supplierContactId: 'supplier-contact-id',
          snapshotScope: 'catalog:used',
        },
      },
      include: { items: true },
    });
    expect(transaction.supplierCurrentList.update).toHaveBeenCalledWith({
      where: { id: 'used-list-id' },
      data: expect.objectContaining({
        sourceMessageId: 'used-partial-message',
        rawContent: 'PROMOÇÃO SWAP\niPhone 15 128GB\nAzul R$ 2.900',
      }),
    });
    expect(transaction.supplierCurrentList.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'primary-list-id' } }),
    );
    expect(transaction.supplierCurrentListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'used-u2' },
        data: expect.objectContaining({ price: 2900 }),
      }),
    );
    expect(transaction.supplierCurrentListItem.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'used-u1' } }),
    );
  });

  it('nao cria snapshot nem usa legacy quando o scope parcial resolvido nao existe', async () => {
    const { service, transaction } = createService();
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    transaction.supplierCurrentList.findUnique.mockResolvedValue(null);

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'missing-used-partial',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'PROMOÇÃO SWAP\niPhone 15 128GB\nAzul R$ 2.900' },
      },
    });

    expect(debug).toHaveBeenCalledWith(
      expect.stringContaining('evolution.snapshot_scope.partial_scope_not_found'),
    );
    expect(transaction.supplierCurrentList.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          supplierContactId_snapshotScope: {
            supplierContactId: 'supplier-contact-id',
            snapshotScope: 'catalog:used',
          },
        },
      }),
    );
    expect(transaction.supplierCurrentList.create).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
    debug.mockRestore();
  });

  it('isola partial used entre fornecedores distintos', async () => {
    const { service, transaction, supplierContacts } = createService();
    supplierContacts.findActiveByWhatsappNumber
      .mockResolvedValueOnce({ id: 'supplier-a' })
      .mockResolvedValueOnce({ id: 'supplier-b' });
    transaction.supplierCurrentList.findUnique
      .mockResolvedValueOnce({
        id: 'used-list-a',
        items: [
          currentItem('used-item-a', 'Produto B 256GB', 6000, {
            capacity: '256GB',
            color: 'azul',
            condition: 'SEMINOVO',
          }),
        ],
      })
      .mockResolvedValueOnce({
        id: 'used-list-b',
        items: [
          currentItem('used-item-b', 'Produto B 256GB', 6100, {
            capacity: '256GB',
            color: 'azul',
            condition: 'SEMINOVO',
          }),
        ],
      });

    for (const [id, remoteJid] of [
      ['partial-supplier-a', '5511999999999@s.whatsapp.net'],
      ['partial-supplier-b', '5511988888888@s.whatsapp.net'],
    ]) {
      await service.receive(webhookSecret, {
        event: 'MESSAGES_UPSERT',
        data: {
          key: { id, remoteJid, fromMe: false },
          message: { conversation: 'PROMOÇÃO SWAP\nProduto B 256GB\nAzul R$ 5.500' },
        },
      });
    }

    expect(
      transaction.supplierCurrentList.findUnique.mock.calls.map(([call]) => call.where),
    ).toEqual([
      {
        supplierContactId_snapshotScope: {
          supplierContactId: 'supplier-a',
          snapshotScope: 'catalog:used',
        },
      },
      {
        supplierContactId_snapshotScope: {
          supplierContactId: 'supplier-b',
          snapshotScope: 'catalog:used',
        },
      },
    ]);
    expect(transaction.supplierCurrentList.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ where: { id: 'used-list-a' } }),
    );
    expect(transaction.supplierCurrentList.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ where: { id: 'used-list-b' } }),
    );
  });

  it.each([
    ['UNKNOWN', 'PROMOÇÃO\niPhone 15 128GB\nAzul R$ 2.900'],
    ['AMBIGUOUS', 'PROMOÇÃO SWAP LACRADOS\niPhone 15 128GB\nAzul R$ 2.900'],
  ])('preserva todos os snapshots para partial %s', async (_status, conversation) => {
    const { service, transaction } = createService();

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: `partial-${_status.toLowerCase()}`,
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation },
      },
    });

    expect(transaction.evolutionWebhookReceipt.create).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.findUnique).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.create).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
  });

  it('persiste FULL resolvido no escopo used', async () => {
    const { service, transaction } = createService();
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-scope-shadow',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'IPHONE SWAP AMERICANOS\niPhone 16 128GB\nPreto R$ 3.500' },
      },
    });

    expect(debug).toHaveBeenCalledWith(
      expect.stringContaining('"event":"evolution.snapshot_scope.shadow"'),
    );
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('"scopeKey":"catalog:used"'));
    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          supplierContactId_snapshotScope: {
            supplierContactId: 'supplier-contact-id',
            snapshotScope: 'catalog:used',
          },
        },
        create: expect.objectContaining({ snapshotScope: 'catalog:used' }),
      }),
    );

    debug.mockRestore();
  });

  it('mantem NOVO e CPO juntos em um unico FULL catalog:primary', async () => {
    const { service, transaction } = createService();

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-primary-new-cpo',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: {
          conversation: `IPHONES LACRADOS
iPhone 16 128GB
Preto R$ 4.000
CPO
iPhone 15 128GB
Azul R$ 3.000`,
        },
      },
    });

    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledOnce();
    const write = transaction.supplierCurrentList.upsert.mock.calls[0]?.[0];
    expect(write.create.snapshotScope).toBe('catalog:primary');
    expect(write.create.items.create.map((item: { condition: string }) => item.condition)).toEqual([
      'NOVO',
      'CPO',
    ]);
    expect(transaction.supplierCurrentList.deleteMany).not.toHaveBeenCalled();
  });

  it('preserva PARTIAL primary resolvido no scope existente', async () => {
    const { service, transaction } = createService();
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'primary-list-id',
      items: [currentItem('primary-item', 'iPhone 16 128GB', 4000, { color: 'preto' })],
    });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-primary-partial',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'PROMOCAO SEALED\niPhone 16 128GB\nPreto R$ 3.900' },
      },
    });

    expect(transaction.supplierCurrentList.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          supplierContactId_snapshotScope: {
            supplierContactId: 'supplier-contact-id',
            snapshotScope: 'catalog:primary',
          },
        },
      }),
    );
    expect(transaction.supplierCurrentList.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'primary-list-id' } }),
    );
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
  });

  it('isola FULL primary e used, substituindo somente o scope recebido', async () => {
    const { service, transaction } = createService();

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-primary-v1', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'LISTA APPLE LACRADOS\niPhone 16 128GB\nPreto R$ 4.000' },
      },
    });
    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-used-v1', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'IPHONE SWAP AMERICANOS\niPhone 15 128GB\nAzul R$ 3.000' },
      },
    });
    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-used-v2', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'IPHONE SWAP AMERICANOS\niPhone 15 128GB\nAzul R$ 2.900' },
      },
    });

    const writes = transaction.supplierCurrentList.upsert.mock.calls.map(([call]) => call);
    expect(writes.map((write) => write.where)).toEqual([
      {
        supplierContactId_snapshotScope: {
          supplierContactId: 'supplier-contact-id',
          snapshotScope: 'catalog:primary',
        },
      },
      {
        supplierContactId_snapshotScope: {
          supplierContactId: 'supplier-contact-id',
          snapshotScope: 'catalog:used',
        },
      },
      {
        supplierContactId_snapshotScope: {
          supplierContactId: 'supplier-contact-id',
          snapshotScope: 'catalog:used',
        },
      },
    ]);
    expect(writes[0]).toMatchObject({
      create: { sourceMessageId: 'message-primary-v1', snapshotScope: 'catalog:primary' },
      update: { attachments: { deleteMany: {} }, items: { deleteMany: {} } },
    });
    expect(writes[1]).toMatchObject({
      create: { sourceMessageId: 'message-used-v1', snapshotScope: 'catalog:used' },
      update: { attachments: { deleteMany: {} }, items: { deleteMany: {} } },
    });
    expect(writes[2]).toMatchObject({
      create: { sourceMessageId: 'message-used-v2', snapshotScope: 'catalog:used' },
      update: { attachments: { deleteMany: {} }, items: { deleteMany: {} } },
    });
  });

  it('substitui catalog:general somente pelo mesmo scope', async () => {
    const { service, transaction } = createService();
    const first = {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-general-v1', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: {
          conversation:
            'LISTA UNIFICADA\niPhone 16 128GB\nPreto R$ 4.000\nMacBook Neo 13 8/256\nPrata R$ 5.000',
        },
      },
    };

    await service.receive(webhookSecret, first);
    await service.receive(webhookSecret, {
      ...first,
      data: {
        ...first.data,
        key: { ...first.data.key, id: 'message-general-v2' },
        message: {
          conversation:
            'LISTA UNIFICADA\niPhone 16 128GB\nPreto R$ 3.900\nMacBook Neo 13 8/256\nPrata R$ 4.900',
        },
      },
    });

    expect(transaction.supplierCurrentList.upsert.mock.calls.map(([call]) => call.where)).toEqual([
      {
        supplierContactId_snapshotScope: {
          supplierContactId: 'supplier-contact-id',
          snapshotScope: 'catalog:general',
        },
      },
      {
        supplierContactId_snapshotScope: {
          supplierContactId: 'supplier-contact-id',
          snapshotScope: 'catalog:general',
        },
      },
    ]);
  });

  it('consolida primary e used em general completo sem apagar legacy ou escopo futuro', async () => {
    const { service, transaction } = createService();
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-general-complete',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: {
          conversation: `LISTA GERAL
iPhone 16 128GB NOVO
Preto R$ 4.000
iPhone 15 128GB CPO
Azul R$ 3.000
SEMINOVOS
iPhone 14 128GB
Verde R$ 2.500`,
        },
      },
    });

    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          supplierContactId_snapshotScope: {
            supplierContactId: 'supplier-contact-id',
            snapshotScope: 'catalog:general',
          },
        },
        create: expect.objectContaining({
          snapshotScope: 'catalog:general',
          sourceMessageId: 'message-general-complete',
        }),
      }),
    );
    expect(transaction.supplierCurrentList.deleteMany).toHaveBeenCalledWith({
      where: {
        supplierContactId: 'supplier-contact-id',
        snapshotScope: { in: ['catalog:primary', 'catalog:used'] },
      },
    });
    expect(debug).toHaveBeenCalledWith(
      expect.stringContaining('"event":"evolution.snapshot_transition"'),
    );
    expect(debug).toHaveBeenCalledWith(
      expect.stringContaining('"removedScopes":["catalog:primary","catalog:used"]'),
    );
    debug.mockRestore();
  });

  it('isola a consolidacao geral entre fornecedores distintos', async () => {
    const { service, transaction, supplierContacts } = createService();
    supplierContacts.findActiveByWhatsappNumber
      .mockResolvedValueOnce({ id: 'supplier-a' })
      .mockResolvedValueOnce({ id: 'supplier-b' });
    const conversation = `LISTA GERAL
iPhone 16 128GB NOVO
Preto R$ 4.000
iPhone 15 128GB CPO
Azul R$ 3.000
SEMINOVOS
iPhone 14 128GB
Verde R$ 2.500`;

    for (const [id, remoteJid] of [
      ['message-general-supplier-a', '5511999999999@s.whatsapp.net'],
      ['message-general-supplier-b', '5511988888888@s.whatsapp.net'],
    ]) {
      await service.receive(webhookSecret, {
        event: 'MESSAGES_UPSERT',
        data: { key: { id, remoteJid, fromMe: false }, message: { conversation } },
      });
    }

    expect(
      transaction.supplierCurrentList.deleteMany.mock.calls.map(([call]) => call.where),
    ).toEqual([
      {
        supplierContactId: 'supplier-a',
        snapshotScope: { in: ['catalog:primary', 'catalog:used'] },
      },
      {
        supplierContactId: 'supplier-b',
        snapshotScope: { in: ['catalog:primary', 'catalog:used'] },
      },
    ]);
  });

  it('preserva general quando chegam snapshots segmentados', async () => {
    const { service, transaction } = createService();

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-general-to-used',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'IPHONE SWAP AMERICANOS\niPhone 15 128GB\nAzul R$ 3.000' },
      },
    });
    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-general-to-primary',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'LISTA APPLE LACRADOS\niPhone 16 128GB\nPreto R$ 4.000' },
      },
    });

    expect(transaction.supplierCurrentList.upsert.mock.calls.map(([call]) => call.where)).toEqual([
      {
        supplierContactId_snapshotScope: {
          supplierContactId: 'supplier-contact-id',
          snapshotScope: 'catalog:used',
        },
      },
      {
        supplierContactId_snapshotScope: {
          supplierContactId: 'supplier-contact-id',
          snapshotScope: 'catalog:primary',
        },
      },
    ]);
    expect(transaction.supplierCurrentList.deleteMany).not.toHaveBeenCalled();
  });

  it('reverte o general e preserva segmentados quando o cleanup falha', async () => {
    const { service, prisma, transaction } = createService();
    const state = { upsertedGeneral: false, deletedSegmented: false };
    transaction.supplierCurrentList.upsert.mockImplementation(async () => {
      state.upsertedGeneral = true;
      return {};
    });
    transaction.supplierCurrentList.deleteMany.mockImplementation(async () => {
      state.deletedSegmented = true;
      throw new Error('general cleanup failed');
    });
    prisma.$transaction.mockImplementation(async (callback) => {
      const before = { ...state };
      try {
        return await callback(transaction);
      } catch (error) {
        Object.assign(state, before);
        throw error;
      }
    });

    await expect(
      service.receive(webhookSecret, {
        event: 'MESSAGES_UPSERT',
        data: {
          key: {
            id: 'message-general-rollback',
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: false,
          },
          message: {
            conversation: `LISTA GERAL
iPhone 16 128GB NOVO
Preto R$ 4.000
iPhone 15 128GB CPO
Azul R$ 3.000
SEMINOVOS
iPhone 14 128GB
Verde R$ 2.500`,
          },
        },
      }),
    ).rejects.toThrow('general cleanup failed');

    expect(state).toEqual({ upsertedGeneral: false, deletedSegmented: false });
  });

  it.each([
    ['UNKNOWN', 'LISTA COMPLETA\nProduto A 128GB\nPreto R$ 1.100'],
    [
      'AMBIGUOUS',
      'LISTA COMPLETA\nSEMINOVOS AMERICANOS\nIPHONES LACRADOS\niPhone 16 128GB\nPreto R$ 4.000',
    ],
  ])('preserva todos os snapshots para FULL %s', async (_status, conversation) => {
    const { service, transaction } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: `message-full-${_status.toLowerCase()}`,
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation },
      },
    });

    expect(result).toEqual({ accepted: true, supplierId: 'supplier-contact-id', items: 1 });
    expect(transaction.evolutionWebhookReceipt.create).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.findUnique).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
  });

  it('roteia FULL mista explicitamente autorizada para primary e used na mesma transacao', async () => {
    const { service, prisma, transaction } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-explicit-mixed-full',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: {
          conversation: `LISTA COMPLETA
SEMINOVOS
IPHONES LACRADOS
iPhone 16 128GB
Preto R$ 4.000
CPO
iPhone 15 128GB
Azul R$ 3.000
SEMINOVOS
iPhone 14 128GB
Verde R$ 2.500`,
        },
      },
    });

    expect(result).toEqual({ accepted: true, supplierId: 'supplier-contact-id', items: 3 });
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(transaction.evolutionWebhookReceipt.create).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledTimes(2);

    const writes = transaction.supplierCurrentList.upsert.mock.calls.map(([call]) => call);
    expect(writes.map((write) => write.create.snapshotScope)).toEqual([
      'catalog:primary',
      'catalog:used',
    ]);
    expect(
      writes[0].create.items.create.map((item: { condition: string }) => item.condition),
    ).toEqual(['NOVO', 'CPO']);
    expect(
      writes[1].create.items.create.map((item: { condition: string }) => item.condition),
    ).toEqual(['SEMINOVO']);
    expect(transaction.supplierCurrentList.deleteMany).not.toHaveBeenCalled();
  });

  it('roteia lista mista com preambulo primary e secao SWAP apos oferta com moeda no sufixo', async () => {
    const { service, transaction } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-mixed-primary-preamble',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: {
          conversation: `APPLE LACRADO ORIGINAL
iPhone 16 128GB
Preto 4.000,00 R$
iPhone 16 Pro Max 512GB (CPO)
Branco 6.500,00 R$
iPad Smart Keyboard (A2480)
Branco 1.100,00 R$
SWAP
iPhone 14 128GB
Preto 1.800,00 R$`,
        },
      },
    });

    expect(result).toEqual({ accepted: true, supplierId: 'supplier-contact-id', items: 4 });
    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledTimes(2);
    const writes = transaction.supplierCurrentList.upsert.mock.calls.map(([call]) => call);
    expect(writes.map((write) => write.create.snapshotScope)).toEqual([
      'catalog:primary',
      'catalog:used',
    ]);
    expect(
      writes[0].create.items.create.map((item: { condition: string }) => item.condition),
    ).toEqual(['NOVO', 'CPO', 'NOVO']);
    expect(
      writes[1].create.items.create.map((item: { condition: string }) => item.condition),
    ).toEqual(['SEMINOVO']);
  });

  it('roteia lista mista explicita com marcadores promocionais sem liberar inconclusive generico', async () => {
    const { service, transaction } = createService();

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-explicit-mixed-inconclusive',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: {
          conversation: `PROMOCAO - LISTA COMPLETA
SEMINOVOS
IPHONES LACRADOS
iPhone 16 128GB
Preto R$ 4.000
CPO
iPhone 15 128GB
Azul R$ 3.000
SEMINOVOS
iPhone 14 128GB
Verde R$ 2.500`,
        },
      },
    });

    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledTimes(2);
    expect(
      transaction.supplierCurrentList.upsert.mock.calls.map(([call]) => call.create.snapshotScope),
    ).toEqual(['catalog:primary', 'catalog:used']);
  });

  it('reverte todos os scopes da lista mista quando um dos writes falha', async () => {
    const { service, prisma, transaction } = createService();
    const state = { scopes: [] as string[] };
    transaction.supplierCurrentList.upsert.mockImplementation(async ({ create }) => {
      state.scopes.push(create.snapshotScope);
      if (create.snapshotScope === 'catalog:used') throw new Error('used write failed');
      return {};
    });
    prisma.$transaction.mockImplementation(async (callback) => {
      const before = [...state.scopes];
      try {
        return await callback(transaction);
      } catch (error) {
        state.scopes = before;
        throw error;
      }
    });

    await expect(
      service.receive(webhookSecret, {
        event: 'MESSAGES_UPSERT',
        data: {
          key: {
            id: 'message-explicit-mixed-rollback',
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: false,
          },
          message: {
            conversation: `LISTA COMPLETA
SEMINOVOS
IPHONES LACRADOS
iPhone 16 128GB
Preto R$ 4.000
SEMINOVOS
iPhone 14 128GB
Verde R$ 2.500`,
          },
        },
      }),
    ).rejects.toThrow('used write failed');

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledTimes(2);
    expect(state.scopes).toEqual([]);
  });

  it('persiste INCONCLUSIVE resolvido por preambulo used explicito somente em catalog:used', async () => {
    const { service, transaction } = createService();

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-explicit-used-inconclusive',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: {
          conversation: 'PROMOCAO\nIPHONE SWAP AMERICANOS\niPhone 15 128GB\nPreto R$ 2.500',
        },
      },
    });

    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          snapshotScope: 'catalog:used',
          items: {
            create: [expect.objectContaining({ condition: 'SEMINOVO' })],
          },
        }),
      }),
    );
    expect(transaction.supplierCurrentList.deleteMany).not.toHaveBeenCalled();
  });

  it('nao libera INCONCLUSIVE primary resolvido como FULL', async () => {
    const { service, transaction } = createService();

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-primary-inconclusive',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: {
          conversation: 'PROMOCAO\nIPHONES LACRADOS\niPhone 16 128GB\nPreto R$ 3.900',
        },
      },
    });

    expect(transaction.evolutionWebhookReceipt.create).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.findUnique).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
  });

  it('mantem fail-closed para lista mista sem marcadores documentais explicitos', async () => {
    const { service, transaction } = createService();

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-mixed-without-authority',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: {
          conversation: `Produto A 128GB NOVO
Preto R$ 4.000
Produto B 128GB SEMINOVO
Azul R$ 2.500`,
        },
      },
    });

    expect(transaction.evolutionWebhookReceipt.create).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.findUnique).not.toHaveBeenCalled();
  });

  it('mantem PARTIAL misto em fail-closed mesmo com itens dos dois segmentos', async () => {
    const { service, transaction } = createService();
    const conversation = `PROMOCAO
SEMINOVOS
iPhone 14 128GB
Verde R$ 2.500
NOVO
MacBook Air M5 13 16/512GB
Prata R$ 7.500`;

    expect(classifySupplierListUpdateMode(conversation)).toBe('PARTIAL_UPDATE');
    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-mixed-partial',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation },
      },
    });

    expect(transaction.evolutionWebhookReceipt.create).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.findUnique).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
  });

  it('mantem a idempotencia do receipt para FULL resolvido', async () => {
    const { service, transaction } = createService();
    const payload = {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-used-duplicate',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'IPHONE SWAP AMERICANOS\niPhone 16 128GB\nPreto R$ 3.500' },
      },
    };

    await service.receive(webhookSecret, payload);
    transaction.evolutionWebhookReceipt.create.mockRejectedValueOnce({ code: 'P2002' });

    await expect(service.receive(webhookSecret, payload)).resolves.toEqual({
      accepted: true,
      duplicate: true,
    });
    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledOnce();
  });

  it('atualiza a promocao parcial BrockTech P2 e P3 pela condition NOVO persistida', async () => {
    const { service, prisma, transaction } = createService(
      [],
      undefined,
      BROCKTECH_SUPPLIER_CONTACT_ID,
    );
    const p2Items = parseSupplierListText(brockTechPromotionP2);
    const p3Items = parseSupplierListText(brockTechPromotionP3);

    expect(p2Items.map(({ color, condition, price }) => ({ color, condition, price }))).toEqual([
      { color: 'black', condition: null, price: 9650 },
      { color: 'silver', condition: null, price: 9800 },
      { color: 'azul', condition: null, price: 9890 },
      { color: null, condition: null, price: 11000 },
    ]);
    expect(p3Items.map(({ color, condition, price }) => ({ color, condition, price }))).toEqual([
      { color: 'black', condition: null, price: 9500 },
      { color: 'silver', condition: null, price: 9800 },
      { color: 'azul', condition: null, price: 9700 },
    ]);

    const persistedItems = p2Items.map((item, index) => ({
      ...persistedItem(
        `brock-${item.color ?? index}`,
        item,
        'NOVO',
        [9800, 9900, 9950, 11100][index] ?? 0,
      ),
      color: index === 3 ? 'burgundy' : item.color,
    }));
    const currentList = { id: 'brock-primary-list', items: persistedItems };
    prisma.supplierCurrentList.findUnique.mockImplementation(async () => currentList);
    transaction.supplierCurrentList.findUnique.mockImplementation(async () => currentList);
    transaction.supplierCurrentListItem.update.mockImplementation(async ({ where, data }) => {
      const index = persistedItems.findIndex((item) => item.id === where.id);
      if (index >= 0) persistedItems[index] = { ...persistedItems[index], ...data };
      return {};
    });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'brock-p2', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: brockTechPromotionP2 },
      },
    });
    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'brock-p3', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: brockTechPromotionP3 },
      },
    });

    expect(
      persistedItems.map(({ color, condition, price }) => ({ color, condition, price })),
    ).toEqual([
      { color: 'black', condition: 'NOVO', price: 9500 },
      { color: 'silver', condition: 'NOVO', price: 9800 },
      { color: 'azul', condition: 'NOVO', price: 9700 },
      { color: 'burgundy', condition: 'NOVO', price: 11100 },
    ]);
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
  });

  it('herda CPO da oferta BrockTech unica e não atualiza match ambiguo ou desconhecido', async () => {
    const payload = 'PROMOÇÕES DO DIA\nMacBook Neo 8/512GB\nSilver R$ 4.550';
    const [incoming] = parseSupplierListText(payload);
    expect(incoming).toMatchObject({ condition: null, color: 'silver', price: 4550 });

    const cpo = persistedItem('neo-cpo', incoming!, 'CPO', 4600);
    const cpoService = createService([], undefined, BROCKTECH_SUPPLIER_CONTACT_ID);
    const cpoList = { id: 'brock-primary-list', items: [cpo] };
    cpoService.prisma.supplierCurrentList.findUnique.mockResolvedValue(cpoList);
    cpoService.transaction.supplierCurrentList.findUnique.mockResolvedValue(cpoList);

    await cpoService.service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'brock-cpo', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: payload },
      },
    });

    expect(cpoService.transaction.supplierCurrentListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'neo-cpo' },
        data: expect.objectContaining({ condition: 'CPO', price: 4550 }),
      }),
    );

    const ambiguousService = createService([], undefined, BROCKTECH_SUPPLIER_CONTACT_ID);
    ambiguousService.prisma.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'brock-primary-list',
      items: [cpo, { ...cpo, id: 'neo-novo', condition: 'NOVO' }],
    });
    await ambiguousService.service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'brock-ambiguous', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: payload },
      },
    });

    const unknownService = createService([], undefined, BROCKTECH_SUPPLIER_CONTACT_ID);
    unknownService.prisma.supplierCurrentList.findUnique.mockResolvedValue(null);
    await unknownService.service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'brock-unknown', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: payload },
      },
    });

    for (const candidate of [ambiguousService, unknownService]) {
      expect(candidate.transaction.supplierCurrentList.update).not.toHaveBeenCalled();
      expect(candidate.transaction.supplierCurrentListItem.update).not.toHaveBeenCalled();
      expect(candidate.transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['NOVO', 'NOVO', 'catalog:primary'],
    ['CPO', 'CPO', 'catalog:primary'],
    ['SWAP', 'SEMINOVO', 'catalog:used'],
  ] as const)('preserva a condition explícita BrockTech %s', async (heading, condition, scope) => {
    const { service, transaction } = createService([], undefined, BROCKTECH_SUPPLIER_CONTACT_ID);
    const payload = `PROMOÇÕES DO DIA\n${heading}\niPhone 18 Pro Max 256GB\nBlack R$ 9.500`;
    const [incoming] = parseSupplierListText(payload);
    const matchingItem = persistedItem('explicit-condition', incoming!, condition, 9800);
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: `${scope}-list`,
      items: [matchingItem],
    });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: `brock-explicit-${condition}`,
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: payload },
      },
    });

    expect(transaction.supplierCurrentListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'explicit-condition' },
        data: expect.objectContaining({ condition, price: 9500 }),
      }),
    );
  });

  it('atualiza SEMINOVO sem substituir CPO ou NOVO', async () => {
    const { service, transaction } = createService();
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'current-list-id',
      items: [
        currentItem('novo', 'iPhone 17 Pro Max 256GB', 7100, {
          category: 'iPhone',
          model: 'iPhone 17 Pro Max 256GB',
          capacity: '256GB',
          color: 'silver',
          condition: 'SEMINOVO',
        }),
        currentItem('cpo', 'iPhone 17 Pro Max 256GB CPO', 6500, {
          category: 'iPhone',
          model: 'iPhone 17 Pro Max 256GB',
          capacity: '256GB',
          color: 'silver',
          condition: 'CPO',
        }),
        currentItem('seminovo', 'iPhone 17 Pro Max 256GB Seminovo', 6200, {
          category: 'iPhone',
          model: 'iPhone 17 Pro Max 256GB',
          capacity: '256GB',
          color: 'silver',
          condition: 'SEMINOVO',
        }),
      ],
    });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-promo-novo', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'PROMOÇÃO SWAP\niPhone 17 Pro Max 256GB\nSilver R$ 6.990' },
      },
    });

    expect(transaction.supplierCurrentListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'novo' },
        data: expect.objectContaining({ price: 6990 }),
      }),
    );
    expect(transaction.supplierCurrentListItem.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'cpo' } }),
    );
    expect(transaction.supplierCurrentListItem.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'seminovo' } }),
    );
  });

  it('preserva itens antigos e substitui somente B em uma atualizacao partial used', async () => {
    const { service, transaction } = createService();
    const existingItems = [
      currentItem('item-a', 'Produto A 128GB', 5000),
      currentItem('item-b', 'Produto B 256GB', 6000, {
        category: null,
        capacity: '256GB',
        color: 'azul',
        condition: 'SEMINOVO',
      }),
      currentItem('item-c', 'Produto C 512GB', 7000),
    ];
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'current-list-id',
      items: existingItems,
    });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-promo-b', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'PROMOÇÃO SWAP\nProduto B 256GB\nAzul R$ 5.500' },
      },
    });

    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-b' },
        data: expect.objectContaining({ price: 5500, productId: null }),
      }),
    );
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
  });

  it('adiciona produto novo em atualizacao parcial sem apagar os anteriores', async () => {
    const { service, transaction } = createService();
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'current-list-id',
      items: [currentItem('item-a', 'Produto A 128GB', 5000)],
    });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-promo-d', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'OFERTA SWAP\nProduto D 512GB\nPreto R$ 8.000' },
      },
    });

    expect(transaction.supplierCurrentListItem.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          normalizedName: 'produto d 512gb',
          price: 8000,
          productId: null,
          supplierCurrentListId: 'current-list-id',
        }),
      }),
    );
  });

  it('aplica uma segunda atualizacao parcial somente em C', async () => {
    const { service, transaction } = createService();
    transaction.supplierCurrentList.findUnique
      .mockResolvedValueOnce({
        id: 'current-list-id',
        items: [
          currentItem('item-a', 'Produto A 128GB', 5000),
          currentItem('item-b', 'Produto B 256GB', 5500, {
            capacity: '256GB',
            color: 'azul',
            condition: 'SEMINOVO',
          }),
          currentItem('item-c', 'Produto C 512GB', 7000, {
            capacity: '512GB',
            color: 'preto',
            condition: 'SEMINOVO',
          }),
        ],
      })
      .mockResolvedValueOnce({
        id: 'current-list-id',
        items: [
          currentItem('item-a', 'Produto A 128GB', 5000),
          currentItem('item-b', 'Produto B 256GB', 5500, {
            capacity: '256GB',
            color: 'azul',
            condition: 'SEMINOVO',
          }),
          currentItem('item-c', 'Produto C 512GB', 7000, {
            capacity: '512GB',
            color: 'preto',
            condition: 'SEMINOVO',
          }),
        ],
      });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-promo-c', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'BAIXOU SWAP\nProduto C 512GB\nPreto R$ 6.500' },
      },
    });

    expect(transaction.supplierCurrentListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'item-c' },
        data: expect.objectContaining({ price: 6500 }),
      }),
    );
  });

  it('ignora o replay da mesma externalMessageId sem reaplicar o merge', async () => {
    const { service, transaction } = createService();
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'current-list-id',
      items: [
        currentItem('item-b', 'Produto B 256GB', 6000, {
          capacity: '256GB',
          color: 'azul',
          condition: 'SEMINOVO',
        }),
      ],
    });

    const payload = {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-replayed', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'PROMOÇÃO SWAP\nProduto B 256GB\nAzul R$ 5.500' },
      },
    };

    await service.receive(webhookSecret, payload);
    transaction.evolutionWebhookReceipt.create.mockRejectedValueOnce({ code: 'P2002' });

    const replayResult = await service.receive(webhookSecret, payload);

    expect(replayResult).toEqual({ accepted: true, duplicate: true });
    expect(transaction.supplierCurrentList.findUnique).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentListItem.update).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
  });

  it('reverte o partial update inteiro quando uma operacao intermediaria falha', async () => {
    const { service, prisma, transaction } = createService();
    let state = { rawContent: 'LISTA COMPLETA\nProduto B 256GB\nAzul R$ 6.000', price: 6000 };
    const stateBefore = { ...state };

    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'current-list-id',
      items: [
        currentItem('item-b', 'Produto B 256GB', 6000, {
          capacity: '256GB',
          color: 'azul',
          condition: 'SEMINOVO',
        }),
      ],
    });
    transaction.supplierCurrentList.update.mockImplementation(async ({ data }) => {
      state = { ...state, rawContent: data.rawContent };
      return {};
    });
    transaction.supplierCurrentListItem.update.mockRejectedValueOnce(
      new Error('partial update failed'),
    );
    prisma.$transaction.mockImplementation(async (callback) => {
      const transactionStateBefore = { ...state };
      try {
        return await callback(transaction as never);
      } catch (error) {
        state = transactionStateBefore;
        throw error;
      }
    });

    await expect(
      service.receive(webhookSecret, {
        event: 'MESSAGES_UPSERT',
        data: {
          key: {
            id: 'message-partial-failure',
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: false,
          },
          message: { conversation: 'PROMOÇÃO SWAP\nProduto B 256GB\nAzul R$ 5.500' },
        },
      }),
    ).rejects.toThrow('partial update failed');

    expect(state).toEqual(stateBefore);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.update).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentListItem.update).toHaveBeenCalledOnce();
  });

  it('permite que um novo FULL substitua o snapshot apos atualizacoes parciais', async () => {
    const { service, transaction } = createService();

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-full-after-partial',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'LISTA APPLE LACRADOS\nProduto E 128GB\nPreto R$ 9.000' },
      },
    });

    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          supplierContactId_snapshotScope: {
            supplierContactId: 'supplier-contact-id',
            snapshotScope: 'catalog:primary',
          },
        },
        create: expect.objectContaining({ snapshotScope: 'catalog:primary' }),
        update: expect.objectContaining({
          items: {
            deleteMany: {},
            create: [expect.objectContaining({ normalizedName: 'produto e 128gb', price: 9000 })],
          },
        }),
      }),
    );
  });

  it('mantem o mesmo selector de scope em snapshots completos sucessivos', async () => {
    const { service, transaction } = createService();
    const first = {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-legacy-full-1',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'LISTA APPLE LACRADOS\nProduto A 128GB\nPreto R$ 1.100' },
      },
    };
    const second = {
      ...first,
      data: {
        ...first.data,
        key: { ...first.data.key, id: 'message-legacy-full-2' },
        message: { conversation: 'LISTA APPLE LACRADOS\nProduto A 128GB\nPreto R$ 1.050' },
      },
    };

    await service.receive(webhookSecret, first);
    await service.receive(webhookSecret, second);

    for (const [call] of transaction.supplierCurrentList.upsert.mock.calls) {
      expect(call.where).toEqual({
        supplierContactId_snapshotScope: {
          supplierContactId: 'supplier-contact-id',
          snapshotScope: 'catalog:primary',
        },
      });
      expect(call.create.snapshotScope).toBe('catalog:primary');
      expect(call.update.items.deleteMany).toEqual({});
    }
  });

  it('isola fornecedores distintos no mesmo scope resolvido', async () => {
    const { service, transaction, supplierContacts } = createService();
    supplierContacts.findActiveByWhatsappNumber
      .mockResolvedValueOnce({ id: 'supplier-a' })
      .mockResolvedValueOnce({ id: 'supplier-b' });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-supplier-a', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'IPHONE SWAP AMERICANOS\nProduto A 128GB\nPreto R$ 1.100' },
      },
    });
    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-supplier-b', remoteJid: '5511988888888@s.whatsapp.net', fromMe: false },
        message: { conversation: 'IPHONE SWAP AMERICANOS\nProduto B 256GB\nAzul R$ 5.500' },
      },
    });

    expect(transaction.supplierCurrentList.upsert.mock.calls.map(([call]) => call.where)).toEqual([
      {
        supplierContactId_snapshotScope: {
          supplierContactId: 'supplier-a',
          snapshotScope: 'catalog:used',
        },
      },
      {
        supplierContactId_snapshotScope: {
          supplierContactId: 'supplier-b',
          snapshotScope: 'catalog:used',
        },
      },
    ]);
  });

  it('preserva o snapshot quando a classificacao e inconclusiva', async () => {
    const { service, transaction } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-inconclusive',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: {
          conversation: 'PROMOÇÃO - LISTA COMPLETA\nProduto B 256GB\nAzul R$ 5.500',
        },
      },
    });

    expect(result).toEqual({ accepted: true, supplierId: 'supplier-contact-id', items: 1 });
    expect(transaction.evolutionWebhookReceipt.create).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.findUnique).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
  });

  it('persiste productId nulo quando a observacao shadow nao encontra um Product mestre', async () => {
    const { service, transaction } = createService();
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-shadow', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'LISTA APPLE LACRADOS\niPhone 17 Pro 256GB\nPreto R$ 6.400' },
      },
    });

    const persistedItems =
      transaction.supplierCurrentList.upsert.mock.calls[0]?.[0].create.items.create;
    expect(persistedItems).toEqual([
      expect.objectContaining({ price: 6400, rawLine: 'Preto R$ 6.400', productId: null }),
    ]);
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('evolution.product_id.shadow'));
    debug.mockRestore();
  });

  it('observa linha rejeitada sem criar receipt ou lista', async () => {
    const { service, transaction } = createService();
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-rejected-line',
          remoteJid: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'iPhone 17 Pro 256GB' },
      },
    });

    expect(result).toEqual({ accepted: false, ignored: true, reason: 'invalid_or_empty_snapshot' });
    expect(warn).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'evolution.supplier_line_rejected',
        sourceMessageId: 'message-rejected-line',
        rawLine: 'iPhone 17 Pro 256GB',
        reason: 'invalid_or_missing_price',
      }),
    );
    expect(transaction.evolutionWebhookReceipt.create).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('persiste o Product.id somente quando a observacao shadow retorna FOUND', async () => {
    const { service, transaction } = createService([
      catalogProduct('product-17-pro-256', 'iPhone 17 Pro 256GB'),
    ]);

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-found', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'LISTA APPLE LACRADOS\niPhone 17 Pro 256GB\nPreto R$ 6.400' },
      },
    });

    expect(transaction.supplierCurrentList.upsert.mock.calls[0]?.[0].create.items.create).toEqual([
      expect.objectContaining({ productId: 'product-17-pro-256' }),
    ]);
  });

  it('persiste productId nulo quando a observacao shadow retorna AMBIGUOUS', async () => {
    const { service, transaction } = createService([
      catalogProduct('product-17-pro-256-a', 'iPhone 17 Pro 256GB'),
      catalogProduct('product-17-pro-256-b', 'iPhone 17 Pro 256GB'),
    ]);

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-ambiguous', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'LISTA APPLE LACRADOS\niPhone 17 Pro 256GB\nPreto R$ 6.400' },
      },
    });

    expect(transaction.supplierCurrentList.upsert.mock.calls[0]?.[0].create.items.create).toEqual([
      expect.objectContaining({ productId: null }),
    ]);
  });

  it('registra o sender quando o fornecedor ativo nao e encontrado', async () => {
    const { service, transaction, supplierContacts } = createService();
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    supplierContacts.findActiveByWhatsappNumber.mockResolvedValue(null);

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-supplier-not-found',
          remoteJid: '13153886169@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'iPhone 17 Pro 256GB\nPreto R$ 6.400' },
      },
    });

    expect(result).toEqual({ accepted: false, ignored: true });
    expect(warn).toHaveBeenCalledWith(
      JSON.stringify({
        event: 'evolution.supplier_not_found',
        externalMessageId: 'message-supplier-not-found',
        senderJid: '13153886169@s.whatsapp.net',
        normalizedWhatsappNumber: '13153886169',
        reason: 'supplier_not_found',
      }),
    );
    expect(transaction.evolutionWebhookReceipt.create).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('atualiza condition implicita para nao resolvida durante o repair', async () => {
    const { service, prisma } = createService();
    const debug = vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    prisma.supplierCurrentList.findMany.mockResolvedValue([
      {
        id: 'current-list-id',
        supplierContactId: 'supplier-contact-id',
        sourceMessageId: 'message-repair-shadow',
        rawContent: 'LISTA COMPLETA\niPhone 17 Pro 256GB\nAzul R$ 6.150',
        items: [
          {
            productName: 'iPhone 17 Pro 256GB',
            normalizedName: 'iphone 17 pro 256gb',
            category: 'iPhone',
            model: 'iPhone 17 Pro 256GB',
            capacity: '256GB',
            color: 'azul',
            condition: 'NOVO',
            price: { toString: () => '6150' },
            availability: null,
            rawLine: 'Azul R$ 6.150',
          },
        ],
      },
    ]);

    await service.repairCurrentLists();

    expect(prisma.supplierCurrentList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'current-list-id' },
        data: expect.objectContaining({
          items: {
            deleteMany: {},
            create: [expect.objectContaining({ condition: null })],
          },
        }),
      }),
    );
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('evolution.product_id.shadow'));
    debug.mockRestore();
  });
  it('reprocessa a lista atual a partir do texto original quando o formato de moeda mudou', async () => {
    const { service, prisma } = createService();
    prisma.supplierCurrentList.findMany.mockResolvedValue([
      {
        id: 'current-list-id',
        rawContent: 'LISTA COMPLETA\niPhone 17 Pro 256GB\nAzul \u{1F4B0}6,150',
        items: [
          {
            id: 'current-list-item-id',
            productName: 'iPhone 17 Pro 256GB',
            normalizedName: 'iphone 17 pro 256gb',
            category: 'iPhone',
            model: 'iPhone 17 Pro 256GB',
            capacity: '256GB',
            color: 'azul',
            condition: 'NOVO',
            price: { toString: () => '6.15' },
            availability: null,
            rawLine: 'Azul \u{1F4B0}6,150',
          },
        ],
      },
    ]);

    await service.repairCurrentLists();

    expect(prisma.supplierCurrentList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'current-list-id' },
        data: expect.objectContaining({
          items: {
            deleteMany: {},
            create: [expect.objectContaining({ price: 6150 })],
          },
        }),
      }),
    );
  });

  it('remove itens stale e substitui o reparo pelo snapshot atual do parser', async () => {
    const { service, prisma } = createService();
    prisma.supplierCurrentList.findMany.mockResolvedValue([
      {
        id: 'current-list-id',
        rawContent: 'LISTA COMPLETA\niPhone 17 Pro 256GB\nAzul \u{1F4B0}6,150',
        items: [
          {
            id: 'current-list-item-id',
            productName: 'iPhone 17 Pro 256GB',
            normalizedName: 'iphone 17 pro 256gb',
            category: 'iPhone',
            model: 'iPhone 17 Pro 256GB',
            capacity: '256GB',
            color: 'azul',
            condition: 'NOVO',
            price: { toString: () => '6.15' },
            availability: null,
            rawLine: 'Azul \u{1F4B0}6,150',
          },
          {
            id: 'preserved-item-id',
            productName: 'Produto preservado',
            normalizedName: 'produto preservado',
            category: 'Acessorio Apple',
            model: 'Produto preservado',
            capacity: null,
            color: null,
            condition: 'NOVO',
            price: { toString: () => '100' },
            availability: null,
            rawLine: 'Linha que o parser nao reconhece',
          },
        ],
      },
    ]);

    await service.repairCurrentLists();

    expect(prisma.supplierCurrentList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          items: {
            deleteMany: {},
            create: [
              expect.objectContaining({
                normalizedName: 'iphone 17 pro 256gb',
                price: 6150,
              }),
            ],
          },
        },
      }),
    );
  });

  it('mantem os grupos primary e used isolados ao reparar rawContent multi-scope', async () => {
    const { service, prisma } = createService();
    const rawContent = `LISTA COMPLETA
SEMINOVOS
IPHONES LACRADOS
iPhone 16 128GB
Preto R$ 4.000
CPO
iPhone 15 128GB
Azul R$ 3.000
SEMINOVOS
iPhone 14 128GB
Verde R$ 2.500`;
    prisma.supplierCurrentList.findMany.mockResolvedValue([
      {
        id: 'primary-list-id',
        supplierContactId: 'supplier-contact-id',
        snapshotScope: 'catalog:primary',
        sourceMessageId: 'message-mixed-repair',
        rawContent,
        items: [currentItem('stale-primary', 'Produto antigo primary', 1000)],
      },
      {
        id: 'used-list-id',
        supplierContactId: 'supplier-contact-id',
        snapshotScope: 'catalog:used',
        sourceMessageId: 'message-mixed-repair',
        rawContent,
        items: [currentItem('stale-used', 'Produto antigo used', 900, { condition: 'SEMINOVO' })],
      },
    ]);

    await service.repairCurrentLists();

    expect(prisma.supplierCurrentList.update).toHaveBeenCalledTimes(2);
    const updates = prisma.supplierCurrentList.update.mock.calls.map(([call]) => call);
    expect(
      updates[0].data.items.create.map((item: { condition: string }) => item.condition),
    ).toEqual(['NOVO', 'CPO']);
    expect(
      updates[1].data.items.create.map((item: { condition: string }) => item.condition),
    ).toEqual(['SEMINOVO']);
  });

  it('atualiza snapshots legados com condition implicita durante o repair', async () => {
    const { service, prisma } = createService();
    prisma.supplierCurrentList.findMany.mockResolvedValue([
      {
        id: 'current-list-id',
        rawContent: 'LISTA COMPLETA\niPhone 17 Pro 256GB\nAzul R$ 6.150',
        items: [
          {
            id: 'current-list-item-id',
            productName: 'iPhone 17 Pro 256GB',
            normalizedName: 'iphone 17 pro 256gb',
            category: 'iPhone',
            model: 'iPhone 17 Pro 256GB',
            capacity: '256GB',
            color: 'azul',
            condition: 'NOVO',
            price: { toString: () => '6150' },
            availability: null,
            rawLine: 'Azul R$ 6.150',
          },
        ],
      },
    ]);

    await service.repairCurrentLists();
    await service.repairCurrentLists();

    expect(prisma.supplierCurrentList.update).toHaveBeenCalledTimes(2);
    expect(prisma.supplierCurrentList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: {
            deleteMany: {},
            create: [expect.objectContaining({ condition: null })],
          },
        }),
      }),
    );
  });

  it('preserva a lista atual quando o rawContent nao produz snapshot valido', async () => {
    const { service, prisma } = createService();
    prisma.supplierCurrentList.findMany.mockResolvedValue([
      {
        id: 'current-list-id',
        rawContent: 'Bom dia, lista em breve.',
        items: [
          {
            id: 'current-list-item-id',
            productName: 'Produto valido',
            normalizedName: 'produto valido',
            category: null,
            model: 'Produto valido',
            capacity: null,
            color: null,
            condition: 'NOVO',
            price: { toString: () => '1000' },
            availability: null,
            rawLine: 'Produto valido R$ 1.000',
          },
        ],
      },
    ]);

    await service.repairCurrentLists();

    expect(prisma.supplierCurrentList.update).not.toHaveBeenCalled();
  });

  it('aceita evento do fornecedor ativo e substitui a lista atual em uma transacao', async () => {
    const { service, transaction, supplierContacts } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-1', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'LISTA APPLE LACRADOS\nIPHONES\n17 PRO 256GB\nAZUL R$ 6.400,00' },
      },
    });

    expect(result).toEqual({ accepted: true, supplierId: 'supplier-contact-id', items: 1 });
    expect(supplierContacts.findActiveByWhatsappNumber).toHaveBeenCalledWith(
      '5511999999999@s.whatsapp.net',
    );
    expect(transaction.evolutionWebhookReceipt.create).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          items: expect.objectContaining({ deleteMany: {} }),
        }),
      }),
    );
  });

  it('publica somente os itens da nova mensagem no snapshot atual do fornecedor', async () => {
    const { service, transaction } = createService();

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-snapshot', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: {
          conversation: 'LISTA APPLE LACRADOS\nProduto A 128GB R$ 1.100\nProduto C 256GB R$ 3.000',
        },
      },
    });

    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          items: {
            deleteMany: {},
            create: [
              expect.objectContaining({ normalizedName: 'produto a 128gb', price: 1100 }),
              expect.objectContaining({ normalizedName: 'produto c 256gb', price: 3000 }),
            ],
          },
        }),
      }),
    );
  });

  it('preserva o snapshot atual quando a nova mensagem nao produz lista valida', async () => {
    const { service, transaction } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-invalid', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'Bom dia, nova lista em breve.' },
      },
    });

    expect(result).toEqual({
      accepted: false,
      ignored: true,
      reason: 'invalid_or_empty_snapshot',
    });
    expect(transaction.evolutionWebhookReceipt.create).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
  });

  it('aceita mensagem de grupo somente pelo participante fornecedor cadastrado', async () => {
    const { service, transaction, supplierContacts } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'messages.upsert',
      data: {
        key: {
          id: 'message-2',
          remoteJid: '12345@g.us',
          participant: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'LISTA APPLE LACRADOS\niPhone 17 R$ 5.000' },
      },
    });

    expect(result).toEqual({ accepted: true, supplierId: 'supplier-contact-id', items: 1 });
    expect(supplierContacts.findActiveByWhatsappNumber).toHaveBeenCalledWith(
      '5511999999999@s.whatsapp.net',
    );
    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledOnce();
  });

  it('aceita o telefone alternativo da Evolution para mensagens de comunidade', async () => {
    const { service, transaction, supplierContacts } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      senderPn: '5511999999999',
      data: {
        key: { id: 'message-3', remoteJid: '12345@g.us', fromMe: false },
        message: { conversation: 'LISTA APPLE LACRADOS\nIPHONES\n17 PRO 256GB\nAZUL R$ 6.400,00' },
      },
    });

    expect(result).toEqual({ accepted: true, supplierId: 'supplier-contact-id', items: 1 });
    expect(supplierContacts.findActiveByWhatsappNumber).toHaveBeenCalledWith(
      '5511999999999@s.whatsapp.net',
    );
    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledOnce();
  });

  it('aceita o envelope aninhado entregue pela Evolution em algumas mensagens de comunidade', async () => {
    const { service, supplierContacts } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        data: {
          key: {
            id: 'message-nested',
            remoteJid: '120363351894379336@g.us',
            participantAlt: '5511918442204@s.whatsapp.net',
            fromMe: false,
          },
          message: { conversation: 'IPHONES\n17 PRO 256GB\nAZUL R$ 6.400,00' },
        },
      },
    });

    expect(result).toEqual({ accepted: true, supplierId: 'supplier-contact-id', items: 1 });
    expect(supplierContacts.findActiveByWhatsappNumber).toHaveBeenCalledWith(
      '5511918442204@s.whatsapp.net',
    );
  });

  it('aceita o envelope em lista entregue pela Evolution', async () => {
    const { service, supplierContacts } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: [
        {
          key: {
            id: 'message-array',
            remoteJid: '5511999999999@s.whatsapp.net',
            fromMe: false,
          },
          message: { conversation: 'IPHONES\n17 PRO 256GB\nAZUL R$ 6.400,00' },
        },
      ],
    });

    expect(result).toEqual({ accepted: true, supplierId: 'supplier-contact-id', items: 1 });
    expect(supplierContacts.findActiveByWhatsappNumber).toHaveBeenCalledWith(
      '5511999999999@s.whatsapp.net',
    );
  });

  it('aceita o participante alternativo quando o grupo usa identificador LID', async () => {
    const { service, supplierContacts } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        remoteJid: '12345@g.us',
        key: {
          id: 'message-3b',
          remoteJid: '123456789@lid',
          participantPn: '5511999999999',
          fromMe: false,
        },
        message: { conversation: 'IPHONES\n17 PRO 256GB\nAZUL R$ 6.400,00' },
      },
    });

    expect(result).toEqual({ accepted: true, supplierId: 'supplier-contact-id', items: 1 });
    expect(supplierContacts.findActiveByWhatsappNumber).toHaveBeenCalledWith(
      '5511999999999@s.whatsapp.net',
    );
  });

  it('aceita o envelope de grupo encaminhado pela Evolution com participantAlt', async () => {
    const { service, supplierContacts } = createService();

    const result = await service.receive(webhookSecret, {
      payload: {
        event: 'messages.upsert',
        data: {
          key: {
            id: 'message-evolution-group',
            remoteJid: '120363350166332222@g.us',
            participant: '238259603030262@lid',
            participantAlt: '595987119077@s.whatsapp.net',
            fromMe: false,
          },
          message: {
            imageMessage: { caption: 'iPhone 17 Pro Max 256GB R$ 7.099,99' },
          },
        },
      },
    });

    expect(result).toEqual({ accepted: true, supplierId: 'supplier-contact-id', items: 1 });
    expect(supplierContacts.findActiveByWhatsappNumber).toHaveBeenCalledWith(
      '595987119077@s.whatsapp.net',
    );
  });

  it('ignora eventos que nao sao mensagens antes de exigir uma chave de mensagem', async () => {
    const { service, supplierContacts, transaction } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'CONNECTION_UPDATE',
      data: { state: 'open' },
    });

    expect(result).toEqual({ accepted: false, ignored: true });
    expect(supplierContacts.findActiveByWhatsappNumber).not.toHaveBeenCalled();
    expect(transaction.evolutionWebhookReceipt.create).not.toHaveBeenCalled();
  });

  it('aceita remoteJid alternativo fora da chave da mensagem', async () => {
    const { service, supplierContacts } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        remoteJidAlt: '5511999999999@s.whatsapp.net',
        key: { id: 'message-3c', remoteJid: '123456789@lid', fromMe: false },
        message: { conversation: 'IPHONES\n17 PRO 256GB\nAZUL R$ 6.400,00' },
      },
    });

    expect(result).toEqual({ accepted: true, supplierId: 'supplier-contact-id', items: 1 });
    expect(supplierContacts.findActiveByWhatsappNumber).toHaveBeenCalledWith(
      '5511999999999@s.whatsapp.net',
    );
  });

  it('usa o remoteJid alternativo quando a mensagem direta chega em modo LID', async () => {
    const { service, supplierContacts } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: {
          id: 'message-4',
          remoteJid: '123456789@lid',
          remoteJidAlt: '5511999999999@s.whatsapp.net',
          fromMe: false,
        },
        message: { conversation: 'IPHONES\n17 PRO 256GB\nAZUL R$ 6.400,00' },
      },
    });

    expect(result).toEqual({ accepted: true, supplierId: 'supplier-contact-id', items: 1 });
    expect(supplierContacts.findActiveByWhatsappNumber).toHaveBeenCalledWith(
      '5511999999999@s.whatsapp.net',
    );
  });

  it('ignora mensagem de grupo sem participante identificavel', async () => {
    const { service, transaction } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'messages.upsert',
      data: {
        key: { id: 'message-5', remoteJid: '12345@g.us', fromMe: false },
        message: { conversation: 'iPhone 17 R$ 5.000' },
      },
    });

    expect(result).toEqual({ accepted: false, ignored: true });
    expect(transaction.evolutionWebhookReceipt.create).not.toHaveBeenCalled();
  });

  it('rejeita segredo incorreto antes de consultar o fornecedor', async () => {
    const { service, supplierContacts } = createService();

    await expect(service.receive('invalid-secret', {})).rejects.toThrow('Webhook nao autorizado');
    expect(supplierContacts.findActiveByWhatsappNumber).not.toHaveBeenCalled();
  });
});
