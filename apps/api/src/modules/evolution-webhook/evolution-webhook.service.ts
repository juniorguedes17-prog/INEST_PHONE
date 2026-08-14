import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SupplierContactsService } from '../suppliers/service/supplier-contacts.service';
import { parseSupplierListText } from './supplier-list.parser';
import { EvolutionMessage } from './evolution-webhook.types';

@Injectable()
export class EvolutionWebhookService {
  private readonly logger = new Logger(EvolutionWebhookService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SupplierContactsService) private readonly supplierContacts: SupplierContactsService,
  ) {}

  async receive(secret: string, payload: unknown) {
    this.assertValidSecret(secret);

    const extraction = extractEvolutionMessage(payload);
    const message = extraction.message;
    if (!message) {
      this.logger.warn(`Mensagem ignorada: evento Evolution invalido (${extraction.reason}).`);
      return { accepted: false, ignored: true };
    }

    if (message.event !== 'messages.upsert') {
      this.logger.warn('Mensagem ignorada: evento Evolution nao e messages.upsert.');
      return { accepted: false, ignored: true };
    }

    if (message.fromMe) {
      this.logger.warn('Mensagem ignorada: enviada pela propria instancia.');
      return { accepted: false, ignored: true };
    }

    if (message.text === null) {
      this.logger.warn('Mensagem ignorada: sem texto ou legenda processavel.');
      return { accepted: false, ignored: true };
    }

    if (!isSupplierWhatsappJid(message.senderJid)) {
      this.logger.warn('Mensagem ignorada: remetente do grupo nao pode ser identificado.');
      return { accepted: false, ignored: true };
    }

    const supplier = await this.supplierContacts.findActiveByWhatsappNumber(message.senderJid);
    if (!supplier) {
      this.logger.warn('Mensagem ignorada: remetente nao corresponde a um fornecedor ativo.');
      return { accepted: false, ignored: true };
    }

    const text = message.text;
    const items = parseSupplierListText(text);
    if (items.length === 0) {
      this.logger.warn(`Lista ignorada para fornecedor ${supplier.id}: nenhum item com preco foi localizado.`);
      return { accepted: false, ignored: true, reason: 'no_price_items' };
    }

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.evolutionWebhookReceipt.create({
          data: {
            externalMessageId: message.messageId,
            event: message.event,
            supplierContactId: supplier.id,
          },
        });

        await transaction.supplierCurrentList.upsert({
          where: { supplierContactId: supplier.id },
          create: {
            supplierContactId: supplier.id,
            sourceMessageId: message.messageId,
            sourceType: 'text',
            rawContent: text,
            receivedAt: message.receivedAt,
            items: { create: items },
          },
          update: {
            sourceMessageId: message.messageId,
            sourceType: 'text',
            rawContent: text,
            receivedAt: message.receivedAt,
            items: {
              deleteMany: {},
              create: items,
            },
            attachments: { deleteMany: {} },
          },
        });
      });
    } catch (error) {
      if (isDuplicateReceiptError(error)) {
        return { accepted: true, duplicate: true };
      }
      throw error;
    }

    this.logger.log(`Lista atualizada: fornecedor=${supplier.id} itens=${items.length}`);
    return { accepted: true, supplierId: supplier.id, items: items.length };
  }

  private assertValidSecret(providedSecret: string) {
    const enabled = this.config.get<boolean>('app.evolutionWebhookEnabled', false);
    const expectedSecret = this.config.get<string>('app.evolutionWebhookSecret', '');
    if (!enabled || !expectedSecret || !safeEqual(providedSecret, expectedSecret)) {
      throw new UnauthorizedException('Webhook nao autorizado.');
    }
  }
}

function extractEvolutionMessage(payload: unknown): EvolutionExtraction {
  if (!isRecord(payload)) return { message: null, reason: 'payload_not_object' };

  const event =
    typeof payload.event === 'string' ? payload.event.toLowerCase().replace(/_/g, '.') : '';
  const data = isRecord(payload.data) ? payload.data : payload;
  const key = isRecord(data.key) ? data.key : null;
  const messageId = typeof key?.id === 'string' ? key.id : null;
  const remoteJid = getRemoteJid(payload, data, key);
  if (!event) return { message: null, reason: 'missing_event' };
  if (!messageId) return { message: null, reason: 'missing_message_id' };
  if (!remoteJid) return { message: null, reason: 'missing_remote_jid' };

  const senderJid = getSenderJid(payload, data, key, remoteJid);
  if (!senderJid) return { message: null, reason: 'missing_sender_jid' };

  return {
    message: {
      event,
      messageId,
      remoteJid,
      senderJid,
      fromMe: key?.fromMe === true,
      text: getText(data.message),
      receivedAt: new Date(),
    },
    reason: null,
  };
}

function getRemoteJid(
  payload: Record<string, unknown>,
  data: Record<string, unknown>,
  key: Record<string, unknown> | null,
) {
  const candidates = [
    key?.remoteJid,
    data.remoteJid,
    payload.remoteJid,
    key?.remoteJidAlt,
    data.remoteJidAlt,
    payload.remoteJidAlt,
  ]
    .map(getString)
    .filter((value): value is string => value !== null);

  return (
    candidates.find(isGroupWhatsappJid) ??
    candidates.find((value) => value.endsWith('@s.whatsapp.net')) ??
    candidates[0] ??
    null
  );
}

function getSenderJid(
  payload: Record<string, unknown>,
  data: Record<string, unknown>,
  key: Record<string, unknown> | null,
  remoteJid: string,
) {
  const candidates = isGroupWhatsappJid(remoteJid)
    ? [
        key?.participant,
        key?.participantAlt,
        key?.participantPn,
        data.participant,
        data.participantAlt,
        data.participantPn,
        data.sender,
        data.senderPn,
        payload.sender,
        payload.senderPn,
        payload.participant,
        payload.participantAlt,
        payload.participantPn,
      ]
    : [
        remoteJid,
        key?.remoteJidAlt,
        data.remoteJidAlt,
        payload.remoteJidAlt,
        data.sender,
        data.senderPn,
        payload.sender,
        payload.senderPn,
      ];

  for (const candidate of candidates) {
    const jid = toWhatsappJid(candidate);
    if (jid) return jid;
  }
  return null;
}

function toWhatsappJid(value: unknown) {
  const jid = getString(value);
  if (!jid) return null;
  if (jid.endsWith('@s.whatsapp.net')) return jid;
  if (jid.includes('@')) return null;

  const phone = jid.replace(/\D/g, '');
  return phone.length >= 8 && phone.length <= 15 ? `${phone}@s.whatsapp.net` : null;
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function getText(message: unknown): string | null {
  if (!isRecord(message)) return null;
  const candidates = [
    message.conversation,
    isRecord(message.extendedTextMessage) ? message.extendedTextMessage.text : undefined,
    isRecord(message.imageMessage) ? message.imageMessage.caption : undefined,
    isRecord(message.documentMessage) ? message.documentMessage.caption : undefined,
  ];
  const text = candidates.find(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0,
  );
  return text?.trim() ?? null;
}

function isSupplierWhatsappJid(remoteJid: string) {
  return remoteJid.endsWith('@s.whatsapp.net') && !remoteJid.startsWith('status@');
}

function isGroupWhatsappJid(remoteJid: string) {
  return remoteJid.endsWith('@g.us');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isDuplicateReceiptError(error: unknown) {
  return isRecord(error) && error.code === 'P2002';
}

interface EvolutionExtraction {
  message: EvolutionMessage | null;
  reason:
    | 'payload_not_object'
    | 'missing_event'
    | 'missing_message_id'
    | 'missing_remote_jid'
    | 'missing_sender_jid'
    | null;
}
