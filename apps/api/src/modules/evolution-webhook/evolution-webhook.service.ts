import { Inject, Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SupplierContactsService } from '../suppliers/service/supplier-contacts.service';
import { processParsedSupplierItemsShadow } from './product-identity-shadow';
import { isValidParsedSupplierListSnapshot, parseSupplierListText } from './supplier-list.parser';
import { EvolutionMessage, ParsedSupplierListItem } from './evolution-webhook.types';

@Injectable()
export class EvolutionWebhookService implements OnModuleInit {
  private readonly logger = new Logger(EvolutionWebhookService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SupplierContactsService) private readonly supplierContacts: SupplierContactsService,
  ) {}

  async onModuleInit() {
    const currentLists = await this.prisma.supplierCurrentList.findMany({
      include: { items: true },
    });
    let updated = 0;

    for (const currentList of currentLists) {
      const parsedItems = parseSupplierListText(currentList.rawContent);
      if (!isValidParsedSupplierListSnapshot(parsedItems)) {
        this.logger.warn(
          `Lista atual preservada: lista=${currentList.id} snapshot invalido ou vazio.`,
        );
        continue;
      }
      this.processParsedSupplierItemsShadow(parsedItems, {
        supplierContactId: currentList.supplierContactId,
        sourceMessageId: currentList.sourceMessageId,
      });

      if (hasEquivalentSnapshot(currentList.items, parsedItems)) continue;

      try {
        await this.prisma.supplierCurrentList.update({
          where: { id: currentList.id },
          data: {
            items: {
              deleteMany: {},
              create: parsedItems,
            },
          },
        });
        updated += 1;
      } catch (error) {
        this.logger.error(`Falha ao reprocessar lista atual: lista=${currentList.id}.`, error);
      }
    }

    if (updated > 0) {
      this.logger.log(
        `Listas atuais reprocessadas: atualizadas=${updated} total=${currentLists.length}.`,
      );
    }
  }

  async receive(secret: string, payload: unknown) {
    this.assertValidSecret(secret);

    const extraction = extractEvolutionMessage(payload);
    const message = extraction.message;
    if (!message) {
      this.logger.log(
        `Webhook Evolution ignorado: evento=${extraction.event ?? 'ausente'} motivo=${extraction.reason}.`,
      );
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
    if (!isValidParsedSupplierListSnapshot(items)) {
      this.logger.warn(
        `Lista ignorada para fornecedor ${supplier.id}: nenhum item com preco foi localizado.`,
      );
      return { accepted: false, ignored: true, reason: 'invalid_or_empty_snapshot' };
    }
    this.processParsedSupplierItemsShadow(items, {
      supplierContactId: supplier.id,
      sourceMessageId: message.messageId,
    });

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

  private processParsedSupplierItemsShadow(
    items: readonly ParsedSupplierListItem[],
    context: { supplierContactId: string; sourceMessageId: string },
  ) {
    for (const { item, identity } of processParsedSupplierItemsShadow(items)) {
      this.logger.debug(
        JSON.stringify({
          event: 'evolution.product_identity.shadow',
          supplierContactId: context.supplierContactId,
          sourceMessageId: context.sourceMessageId,
          rawLine: item.rawLine,
          productName: item.productName,
          canonicalModelKey: identity.canonical.canonicalModelKey || null,
          canonicalCondition: identity.canonical.canonicalCondition,
          canonicalStorage: identity.canonical.canonicalStorage,
          canonicalRam: identity.canonical.canonicalRam,
          canonicalScreen: identity.canonical.canonicalScreen,
          canonicalScreenSource: identity.canonical.canonicalScreenSource,
          canonicalConnectivity: identity.canonical.canonicalConnectivity,
          canonicalConnectivitySource: identity.canonical.canonicalConnectivitySource,
          canonicalColor: identity.canonical.canonicalColor,
          identityStatus: identity.variant.status,
          profitStatus: identity.profit.status,
          missingAttributes: identity.profit.missingAttributes,
        }),
      );
    }
  }
}

function extractEvolutionMessage(payload: unknown): EvolutionExtraction {
  if (!isRecord(payload)) return { message: null, event: null, reason: 'payload_not_object' };

  const records = getPayloadRecords(payload);
  const event = getEvent(records);
  if (!event) return { message: null, event: null, reason: 'missing_event' };
  if (event !== 'messages.upsert') {
    return { message: null, event, reason: 'non_message_event' };
  }

  const data = records.find((record) => isRecord(record.key));
  const key = data && isRecord(data.key) ? data.key : null;
  const messageId = typeof key?.id === 'string' ? key.id : null;
  if (!messageId) return { message: null, event, reason: 'missing_message_id' };
  if (!data) return { message: null, event, reason: 'missing_message_id' };

  const remoteJid = getRemoteJid(records, key);
  if (!remoteJid) return { message: null, event, reason: 'missing_remote_jid' };

  const senderJid = getSenderJid(records, key, remoteJid);
  if (!senderJid) return { message: null, event, reason: 'missing_sender_jid' };

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
    event,
    reason: null,
  };
}

function getPayloadRecords(payload: Record<string, unknown>) {
  const records: Record<string, unknown>[] = [payload];

  for (let index = 0; index < records.length && index < 12; index += 1) {
    const record = records[index];
    if (!record) continue;

    for (const wrapper of [record.data, record.payload, record.body, record.messages]) {
      if (isRecord(wrapper) && !records.includes(wrapper)) {
        records.push(wrapper);
      }
      if (Array.isArray(wrapper)) {
        for (const item of wrapper) {
          if (isRecord(item) && !records.includes(item)) {
            records.push(item);
          }
        }
      }
    }
  }

  return records;
}

function getEvent(records: Record<string, unknown>[]) {
  for (const record of records) {
    const event = getString(record.event) ?? getString(record.eventType) ?? getString(record.type);
    if (event) return event.toLowerCase().replace(/_/g, '.');
  }
  return '';
}

function getRemoteJid(records: Record<string, unknown>[], key: Record<string, unknown> | null) {
  const candidates = [
    key?.remoteJid,
    key?.remoteJidAlt,
    ...records.flatMap((record) => [record.remoteJid, record.remoteJidAlt]),
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
  records: Record<string, unknown>[],
  key: Record<string, unknown> | null,
  remoteJid: string,
) {
  const recordValues = records.flatMap((record) => [
    record.participant,
    record.participantAlt,
    record.participantPn,
    record.sender,
    record.senderPn,
    record.remoteJidAlt,
  ]);
  const candidates = isGroupWhatsappJid(remoteJid)
    ? [key?.participant, key?.participantAlt, key?.participantPn, ...recordValues]
    : [remoteJid, key?.remoteJidAlt, ...recordValues];

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
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0,
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

function hasEquivalentSnapshot(
  storedItems: Array<{
    productName: string;
    normalizedName: string;
    category: string | null;
    model: string | null;
    capacity: string | null;
    color: string | null;
    condition: string | null;
    price: { toString(): string };
    availability: string | null;
    rawLine: string;
  }>,
  parsedItems: ReturnType<typeof parseSupplierListText>,
) {
  const storedSnapshot = storedItems.map(snapshotKey).sort();
  const parsedSnapshot = parsedItems.map(snapshotKey).sort();
  return (
    storedSnapshot.length === parsedSnapshot.length &&
    storedSnapshot.every((value, index) => value === parsedSnapshot[index])
  );
}

function snapshotKey(item: {
  productName: string;
  normalizedName: string;
  category: string | null;
  model: string | null;
  capacity: string | null;
  color: string | null;
  condition: string | null;
  price: number | { toString(): string };
  availability: string | null;
  rawLine: string;
}) {
  return JSON.stringify([
    item.productName,
    item.normalizedName,
    item.category,
    item.model,
    item.capacity,
    item.color,
    item.condition,
    Number(item.price.toString()),
    item.availability,
    normalizedRawLine(item.rawLine),
  ]);
}

function normalizedRawLine(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

interface EvolutionExtraction {
  message: EvolutionMessage | null;
  event: string | null;
  reason:
    | 'payload_not_object'
    | 'missing_event'
    | 'non_message_event'
    | 'missing_message_id'
    | 'missing_remote_jid'
    | 'missing_sender_jid'
    | null;
}
