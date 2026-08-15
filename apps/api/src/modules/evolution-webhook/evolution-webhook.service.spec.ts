import { describe, expect, it, vi } from 'vitest';
import { EvolutionWebhookService } from './evolution-webhook.service';

const webhookSecret = 'this-is-a-test-webhook-secret-with-32-characters';

function createService() {
  const transaction = {
    evolutionWebhookReceipt: { create: vi.fn().mockResolvedValue({}) },
    supplierCurrentList: { upsert: vi.fn().mockResolvedValue({}) },
  };
  const prisma = {
    $transaction: vi.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)),
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
    service: new EvolutionWebhookService(config as never, prisma as never, supplierContacts as never),
    prisma,
    transaction,
    supplierContacts,
  };
}

describe('EvolutionWebhookService', () => {
  it('reprocessa a lista atual a partir do texto original quando o formato de moeda mudou', async () => {
    const { service, prisma } = createService();
    prisma.supplierCurrentList.findMany.mockResolvedValue([
      {
        id: 'current-list-id',
        rawContent: 'iPhone 17 Pro 256GB\nAzul \u{1F4B0}6,150',
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

    await service.onModuleInit();

    expect(prisma.supplierCurrentList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'current-list-id' },
        data: expect.objectContaining({
          items: expect.objectContaining({
            update: [
              {
                where: { id: 'current-list-item-id' },
                data: { price: 6150 },
              },
            ],
          }),
        }),
      }),
    );
  });

  it('nunca exclui itens existentes ao reprocessar uma lista', async () => {
    const { service, prisma } = createService();
    prisma.supplierCurrentList.findMany.mockResolvedValue([
      {
        id: 'current-list-id',
        rawContent: 'iPhone 17 Pro 256GB\nAzul \u{1F4B0}6,150',
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

    await service.onModuleInit();

    expect(prisma.supplierCurrentList.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          items: expect.not.objectContaining({ deleteMany: expect.anything() }),
        },
      }),
    );
  });

  it('aceita evento do fornecedor ativo e substitui a lista atual em uma transacao', async () => {
    const { service, transaction, supplierContacts } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'MESSAGES_UPSERT',
      data: {
        key: { id: 'message-1', remoteJid: '5511999999999@s.whatsapp.net', fromMe: false },
        message: { conversation: 'IPHONES\n17 PRO 256GB\nAZUL R$ 6.400,00' },
      },
    });

    expect(result).toEqual({ accepted: true, supplierId: 'supplier-contact-id', items: 1 });
    expect(supplierContacts.findActiveByWhatsappNumber).toHaveBeenCalledWith(
      '5511999999999@s.whatsapp.net',
    );
    expect(transaction.evolutionWebhookReceipt.create).toHaveBeenCalledOnce();
    expect(transaction.supplierCurrentList.upsert).toHaveBeenCalledOnce();
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
        message: { conversation: 'iPhone 17 R$ 5.000' },
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
        message: { conversation: 'IPHONES\n17 PRO 256GB\nAZUL R$ 6.400,00' },
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
