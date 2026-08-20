import { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  classifySupplierListUpdateMode,
  EvolutionWebhookService,
  supplierListItemMergeKey,
} from './evolution-webhook.service';

const webhookSecret = 'this-is-a-test-webhook-secret-with-32-characters';

function catalogProduct(id: string, productDescription: string) {
  return {
    id,
    productDescription,
    productType: 'IPHONE_SEALED',
    profitCondition: 'NOVO',
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

  it('atualiza somente a cor correspondente e preserva as demais ofertas', async () => {
    const { service, transaction } = createService();
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'current-list-id',
      items: [
        currentItem('silver-novo', 'iPhone 17 Pro Max 256GB', 7100, {
          category: 'iPhone',
          model: 'iPhone 17 Pro Max 256GB',
          capacity: '256GB',
          color: 'silver',
          condition: 'NOVO',
        }),
        currentItem('blue-novo', 'iPhone 17 Pro Max 256GB', 7050, {
          category: 'iPhone',
          model: 'iPhone 17 Pro Max 256GB',
          capacity: '256GB',
          color: 'azul',
          condition: 'NOVO',
        }),
      ],
    });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-promo-silver', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'PROMOÇÃO\niPhone 17 Pro Max 256GB\nSilver R$ 6.990' },
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

  it('atualiza NOVO sem substituir CPO ou SEMINOVO', async () => {
    const { service, transaction } = createService();
    transaction.supplierCurrentList.findUnique.mockResolvedValue({
      id: 'current-list-id',
      items: [
        currentItem('novo', 'iPhone 17 Pro Max 256GB', 7100, {
          category: 'iPhone', model: 'iPhone 17 Pro Max 256GB', capacity: '256GB', color: 'silver', condition: 'NOVO',
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
        message: { conversation: 'PROMOÇÃO\niPhone 17 Pro Max 256GB\nSilver R$ 6.990' },
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

  it('preserva itens antigos e substitui somente B em uma atualizacao parcial', async () => {
    const { service, transaction } = createService();
    const existingItems = [
      currentItem('item-a', 'Produto A 128GB', 5000),
      currentItem('item-b', 'Produto B 256GB', 6000, {
        category: null,
        capacity: '256GB',
        color: 'azul',
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
        message: { conversation: 'PROMOÇÃO\nProduto B 256GB\nAzul R$ 5.500' },
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
        message: { conversation: 'OFERTA\nProduto D 512GB\nPreto R$ 8.000' },
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
          }),
          currentItem('item-c', 'Produto C 512GB', 7000, { capacity: '512GB', color: 'preto' }),
        ],
      })
      .mockResolvedValueOnce({
        id: 'current-list-id',
        items: [
          currentItem('item-a', 'Produto A 128GB', 5000),
          currentItem('item-b', 'Produto B 256GB', 5500, {
            capacity: '256GB',
            color: 'azul',
          }),
          currentItem('item-c', 'Produto C 512GB', 7000, { capacity: '512GB', color: 'preto' }),
        ],
      });

    await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-promo-c', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'BAIXOU\nProduto C 512GB\nPreto R$ 6.500' },
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
      items: [currentItem('item-b', 'Produto B 256GB', 6000, { capacity: '256GB', color: 'azul' })],
    });

    const payload = {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-replayed', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'PROMOÇÃO\nProduto B 256GB\nAzul R$ 5.500' },
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
      items: [currentItem('item-b', 'Produto B 256GB', 6000, { capacity: '256GB', color: 'azul' })],
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
          message: { conversation: 'PROMOÇÃO\nProduto B 256GB\nAzul R$ 5.500' },
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
        key: { id: 'message-full-after-partial', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'LISTA COMPLETA\nProduto E 128GB\nPreto R$ 9.000' },
      },
    });

    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          items: {
            deleteMany: {},
            create: [expect.objectContaining({ normalizedName: 'produto e 128gb', price: 9000 })],
          },
        }),
      }),
    );
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
        message: { conversation: 'LISTA COMPLETA\niPhone 17 Pro 256GB\nPreto R$ 6.400' },
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
        message: { conversation: 'LISTA COMPLETA\niPhone 17 Pro 256GB\nPreto R$ 6.400' },
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
        message: { conversation: 'LISTA COMPLETA\niPhone 17 Pro 256GB\nPreto R$ 6.400' },
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
        message: { conversation: 'LISTA COMPLETA\nIPHONES\n17 PRO 256GB\nAZUL R$ 6.400,00' },
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
          conversation: 'LISTA COMPLETA\nProduto A 128GB R$ 1.100\nProduto C 256GB R$ 3.000',
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
        message: { conversation: 'LISTA COMPLETA\niPhone 17 R$ 5.000' },
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
        message: { conversation: 'LISTA COMPLETA\nIPHONES\n17 PRO 256GB\nAZUL R$ 6.400,00' },
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
