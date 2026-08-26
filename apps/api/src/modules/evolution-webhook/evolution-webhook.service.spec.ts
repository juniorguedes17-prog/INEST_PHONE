import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  classifySupplierListUpdateMode,
  EvolutionWebhookService,
  supplierListItemMergeKey,
} from './evolution-webhook.service';

const webhookSecret = 'this-is-a-test-webhook-secret-with-32-characters';

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

function createService(catalog: unknown[] = []) {
  const transaction = {
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
    findActiveByWhatsappNumber: vi.fn().mockResolvedValue({ id: 'supplier-contact-id' }),
  };

  return {
    service: new EvolutionWebhookService(
      config as never,
      prisma as never,
      supplierContacts as never,
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
    ['Produto B 256GB\nAzul R$ 5.500', 'INCONCLUSIVE'],
    ['Produto A 128GB\nAzul R$ 5.500\nProduto B 256GB\nPreto R$ 6.000', 'INCONCLUSIVE'],
  ])('classifica mensagens de atualização (%s)', (text, expected) => {
    expect(classifySupplierListUpdateMode(text)).toBe(expected);
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
        key: { id: 'message-inconclusive-short', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'iPhone B 256GB\nSilver R$ 5.500' },
      },
    });

    expect(transaction.supplierCurrentList.upsert).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.findUnique).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentList.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.update).not.toHaveBeenCalled();
    expect(transaction.supplierCurrentListItem.create).not.toHaveBeenCalled();
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
      { category: 'iPhone', normalizedName: 'iPhone 17 Pro 256GB', model: 'iPhone 17 Pro', capacity: '256GB' },
      { category: 'iPad', normalizedName: 'iPad 11 A16 128GB Wi-Fi', model: 'iPad 11', capacity: '128GB' },
      { category: 'MacBook', normalizedName: 'MacBook Neo 13 8GB 512GB', model: 'MacBook Neo 13', capacity: '512GB' },
      { category: 'Apple Watch', normalizedName: 'Apple Watch S11 42MM GPS', model: 'Apple Watch S11', capacity: null },
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
        key: { id: 'message-promo-silver', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
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
      items: [currentItem('item-b', 'Produto B 256GB', 6000, { capacity: '256GB', color: 'azul', condition: 'SEMINOVO' })],
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
      expect.objectContaining({ where: { id: 'item-b' }, data: expect.objectContaining({ price: 5500 }) }),
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
        key: { id: 'used-partial-message', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
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
      expect.objectContaining({ where: { id: 'used-u2' }, data: expect.objectContaining({ price: 2900 }) }),
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
        key: { id: 'missing-used-partial', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
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

    expect(transaction.supplierCurrentList.findUnique.mock.calls.map(([call]) => call.where)).toEqual([
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
    [
      'AMBIGUOUS',
      'PROMOÇÃO SWAP LACRADOS\niPhone 15 128GB\nAzul R$ 2.900',
    ],
  ])('preserva todos os snapshots para partial %s', async (_status, conversation) => {
    const { service, transaction } = createService();

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: `partial-${_status.toLowerCase()}`, remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
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
        key: { id: 'message-general-complete', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
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
    expect(debug).toHaveBeenCalledWith(expect.stringContaining('"removedScopes":["catalog:primary","catalog:used"]'));
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

    expect(transaction.supplierCurrentList.deleteMany.mock.calls.map(([call]) => call.where)).toEqual([
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
        key: { id: 'message-general-to-used', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'IPHONE SWAP AMERICANOS\niPhone 15 128GB\nAzul R$ 3.000' },
      },
    });
    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-general-to-primary', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
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
          key: { id: 'message-general-rollback', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
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
    expect(writes[0].create.items.create.map((item: { condition: string }) => item.condition)).toEqual([
      'NOVO',
      'CPO',
    ]);
    expect(writes[1].create.items.create.map((item: { condition: string }) => item.condition)).toEqual([
      'SEMINOVO',
    ]);
    expect(transaction.supplierCurrentList.deleteMany).not.toHaveBeenCalled();
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
          category: 'iPhone', model: 'iPhone 17 Pro Max 256GB', capacity: '256GB', color: 'silver', condition: 'CPO',
        }),
        currentItem('seminovo', 'iPhone 17 Pro Max 256GB Seminovo', 6200, {
          category: 'iPhone', model: 'iPhone 17 Pro Max 256GB', capacity: '256GB', color: 'silver', condition: 'SEMINOVO',
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
      expect.objectContaining({ where: { id: 'novo' }, data: expect.objectContaining({ price: 6990 }) }),
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
          currentItem('item-c', 'Produto C 512GB', 7000, { capacity: '512GB', color: 'preto', condition: 'SEMINOVO' }),
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
          currentItem('item-c', 'Produto C 512GB', 7000, { capacity: '512GB', color: 'preto', condition: 'SEMINOVO' }),
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
      items: [currentItem('item-b', 'Produto B 256GB', 6000, { capacity: '256GB', color: 'azul', condition: 'SEMINOVO' })],
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
      items: [currentItem('item-b', 'Produto B 256GB', 6000, { capacity: '256GB', color: 'azul', condition: 'SEMINOVO' })],
    });
    transaction.supplierCurrentList.update.mockImplementation(async ({ data }) => {
      state = { ...state, rawContent: data.rawContent };
      return {};
    });
    transaction.supplierCurrentListItem.update.mockRejectedValueOnce(new Error('partial update failed'));
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
          key: { id: 'message-partial-failure', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
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
        key: { id: 'message-inconclusive', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
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
        key: { id: 'message-rejected-line', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
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
        key: { id: 'message-supplier-not-found', remoteJid: '13153886169@s.whatsapp.net', fromMe: false },
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

  it('executa a mesma observacao shadow durante o repair sem regravar snapshot equivalente', async () => {
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

    expect(prisma.supplierCurrentList.update).not.toHaveBeenCalled();
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
        items: [
          currentItem('stale-used', 'Produto antigo used', 900, { condition: 'SEMINOVO' }),
        ],
      },
    ]);

    await service.repairCurrentLists();

    expect(prisma.supplierCurrentList.update).toHaveBeenCalledTimes(2);
    const updates = prisma.supplierCurrentList.update.mock.calls.map(([call]) => call);
    expect(updates[0].data.items.create.map((item: { condition: string }) => item.condition)).toEqual([
      'NOVO',
      'CPO',
    ]);
    expect(updates[1].data.items.create.map((item: { condition: string }) => item.condition)).toEqual([
      'SEMINOVO',
    ]);
  });

  it('nao regrava um snapshot equivalente durante o repair', async () => {
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

    expect(prisma.supplierCurrentList.update).not.toHaveBeenCalled();
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
