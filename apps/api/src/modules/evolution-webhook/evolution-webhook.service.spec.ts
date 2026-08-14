import { describe, expect, it, vi } from 'vitest';
import { EvolutionWebhookService } from './evolution-webhook.service';

const webhookSecret = 'this-is-a-test-webhook-secret-with-32-characters';

function createService() {
  const transaction = {
    evolutionWebhookReceipt: { create: vi.fn().mockResolvedValue({}) },
    supplierCurrentList: { upsert: vi.fn().mockResolvedValue({}) },
  };
  const prisma = { $transaction: vi.fn((callback: (client: typeof transaction) => unknown) => callback(transaction)) };
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
    transaction,
    supplierContacts,
  };
}

describe('EvolutionWebhookService', () => {
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

  it('ignora mensagens de grupo e nao toca na lista do fornecedor', async () => {
    const { service, transaction } = createService();

    const result = await service.receive(webhookSecret, {
      event: 'messages.upsert',
      data: {
        key: { id: 'message-2', remoteJid: '12345@g.us', fromMe: false },
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
