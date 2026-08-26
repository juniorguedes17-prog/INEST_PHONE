import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProductStatus } from '@prisma/client';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SupplierContactsService } from '../suppliers/service/supplier-contacts.service';
import { normalizeWhatsappNumber } from '../suppliers/validators/supplier-contacts.validators';
import { processParsedSupplierItemsShadow } from './product-identity-shadow';
import { vm2ShadowResultStore } from './product-identity-shadow-store';
import {
  resolveSupplierSnapshotScope,
  type SupplierSnapshotScopeResolution,
} from './supplier-snapshot-scope';
import {
  isValidParsedSupplierListSnapshot,
  parseSupplierListText,
  SupplierLineRejection,
} from './supplier-list.parser';
import { EvolutionMessage, ParsedSupplierListItem } from './evolution-webhook.types';

export type SupplierListUpdateMode = 'FULL_SNAPSHOT' | 'PARTIAL_UPDATE' | 'INCONCLUSIVE';

type SupplierListUpdateClassification = {
  mode: SupplierListUpdateMode;
  hasPartialMarker: boolean;
  hasFullMarker: boolean;
};

type SnapshotWriteItemGroup = 'ALL' | 'PRIMARY' | 'USED';

type SnapshotWriteTarget = {
  scopeKey: 'catalog:used' | 'catalog:primary' | 'catalog:general';
  itemGroup: SnapshotWriteItemGroup;
};

type SnapshotWritePlan =
  | { authority: 'NONE'; targets: [] }
  | { authority: 'FULL_SNAPSHOT'; targets: SnapshotWriteTarget[] }
  | { authority: 'PARTIAL_UPDATE'; targets: [SnapshotWriteTarget] };

const PARTIAL_UPDATE_MARKER =
  /\b(?:promo(?:c|ç)(?:[aã]o|ões)|ofertas?|baix(?:ou|amos)|pre[cç]o\s+promocional|s[oó]\s+hoje|acabou\s+de\s+chegar|reposi(?:c|ç)(?:[aã]o|ões)|chegou\s+lacrad[oa]s?|remessas?)\b/i;
const FULL_SNAPSHOT_MARKER =
  /\b(?:lista(?:\s+(?:completa|geral|atual(?:izada)?|unificada|di[aá]ria|de\s+pre[cç]os?))?|tabela\s+(?:completa|geral)|todos?\s+os\s+produtos|(?:aparelhos?|produtos?)\s+(?:dispon[ií]veis?|lacrad[oa]s?|novos?\s+lacrad[oa]s?|semi[-\s]?novos?)|(?:iphone|iphones|xiaomis?)\s+(?:lacrad[oa]s?|semi[-\s]?novos?|swap\s+americanos?))\b/i;
const GENERAL_REPLACED_SEGMENTED_SCOPES = ['catalog:primary', 'catalog:used'] as const;

type SnapshotReplacementAuthority = 'SAME_SCOPE_ONLY' | 'ALL_SEGMENTED_SCOPES';

export function classifySupplierListUpdateMode(text: string): SupplierListUpdateMode {
  return classifySupplierListUpdate(text).mode;
}

function classifySupplierListUpdate(text: string): SupplierListUpdateClassification {
  const hasPartialMarker = PARTIAL_UPDATE_MARKER.test(text);
  const hasFullMarker = FULL_SNAPSHOT_MARKER.test(text);

  if (hasPartialMarker && hasFullMarker) {
    return { mode: 'INCONCLUSIVE', hasPartialMarker, hasFullMarker };
  }
  if (hasPartialMarker) return { mode: 'PARTIAL_UPDATE', hasPartialMarker, hasFullMarker };
  if (hasFullMarker) return { mode: 'FULL_SNAPSHOT', hasPartialMarker, hasFullMarker };
  return { mode: 'INCONCLUSIVE', hasPartialMarker, hasFullMarker };
}

type SupplierListItemForMerge = {
  id?: string;
  productId?: string | null;
  productName: string;
  normalizedName: string;
  category: string | null;
  model: string | null;
  capacity: string | null;
  color: string | null;
  condition: string | null;
  qualityGrade: string | null;
  price: number | { toString(): string };
  availability: string | null;
  rawLine: string;
};

type PersistedSupplierListItem = ParsedSupplierListItem & { productId: string | null };

@Injectable()
export class EvolutionWebhookService {
  private readonly logger = new Logger(EvolutionWebhookService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SupplierContactsService) private readonly supplierContacts: SupplierContactsService,
  ) {}

  async repairCurrentLists() {
    const currentLists = await this.prisma.supplierCurrentList.findMany({
      include: { items: true },
    });
    const catalog = await this.loadProductShadowCatalog();
    let updated = 0;

    for (const currentList of currentLists) {
      const updateClassification = classifySupplierListUpdate(currentList.rawContent);
      const updateMode = updateClassification.mode;
      if (updateMode === 'INCONCLUSIVE') {
        this.logger.warn(`Lista atual preservada: lista=${currentList.id} modo inconclusivo.`);
        continue;
      }
      const parsedItems = this.parseSupplierList(
        currentList.rawContent,
        currentList.sourceMessageId,
      );
      if (!isValidParsedSupplierListSnapshot(parsedItems)) {
        this.logger.warn(
          `Lista atual preservada: lista=${currentList.id} snapshot invalido ou vazio.`,
        );
        continue;
      }
      const repairScopeResolution = resolveSupplierSnapshotScope(
        currentList.rawContent,
        parsedItems,
      );
      const repairWritePlan = resolveSnapshotWritePlan(
        updateClassification,
        repairScopeResolution,
        parsedItems,
      );
      const repairTarget =
        repairWritePlan.authority === 'FULL_SNAPSHOT' && repairWritePlan.targets.length > 1
          ? repairWritePlan.targets.find((target) => target.scopeKey === currentList.snapshotScope)
          : null;
      if (repairWritePlan.authority === 'FULL_SNAPSHOT' && repairWritePlan.targets.length > 1) {
        if (!repairTarget) {
          this.logger.warn(
            `Lista atual preservada: lista=${currentList.id} sem alvo no plano multi-scope.`,
          );
          continue;
        }
      }
      const scopedParsedItems = repairTarget
        ? selectSnapshotWriteItems(parsedItems, repairTarget.itemGroup)
        : parsedItems;
      const parsedItemsWithResolvedProductId = await this.processParsedSupplierItemsShadow(
        scopedParsedItems,
        {
          supplierContactId: currentList.supplierContactId,
          sourceMessageId: currentList.sourceMessageId,
        },
        catalog,
      );

      if (hasEquivalentSnapshot(currentList.items, scopedParsedItems)) continue;

      try {
        if (updateMode === 'FULL_SNAPSHOT') {
          await this.prisma.supplierCurrentList.update({
            where: { id: currentList.id },
            data: {
              items: {
                deleteMany: {},
                create: scopedParsedItems,
              },
            },
          });
        } else {
          await this.prisma.$transaction(async (transaction) => {
            await transaction.supplierCurrentList.update({
              where: { id: currentList.id },
              data: {
                sourceMessageId: currentList.sourceMessageId,
                sourceType: 'text',
                rawContent: currentList.rawContent,
                receivedAt: currentList.receivedAt,
              },
            });
            await this.applyPartialUpdate(
              transaction,
              currentList.id,
              currentList.items,
              parsedItemsWithResolvedProductId,
            );
          });
        }
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
      this.logger.warn(
        JSON.stringify({
          event: 'evolution.supplier_not_found',
          externalMessageId: message.messageId,
          senderJid: message.senderJid,
          normalizedWhatsappNumber: normalizeWhatsappNumber(message.senderJid),
          reason: 'supplier_not_found',
        }),
      );
      this.logger.warn('Mensagem ignorada: remetente nao corresponde a um fornecedor ativo.');
      return { accepted: false, ignored: true };
    }

    const text = message.text;
    const items = this.parseSupplierList(text, message.messageId);
    if (!isValidParsedSupplierListSnapshot(items)) {
      this.logger.warn(
        `Lista ignorada para fornecedor ${supplier.id}: nenhum item com preco foi localizado.`,
      );
      return { accepted: false, ignored: true, reason: 'invalid_or_empty_snapshot' };
    }
    const updateClassification = classifySupplierListUpdate(text);
    const updateMode = updateClassification.mode;
    const scopeResolution = resolveSupplierSnapshotScope(text, items);
    const writePlan = resolveSnapshotWritePlan(updateClassification, scopeResolution, items);
    const fullSnapshotScope =
      writePlan.authority === 'FULL_SNAPSHOT' && writePlan.targets.length === 1
        ? (writePlan.targets[0]?.scopeKey ?? null)
        : null;
    const replacementAuthority = fullSnapshotReplacementAuthority(
      updateMode,
      fullSnapshotScope,
      scopeResolution,
    );
    this.logger.debug(
      JSON.stringify({
        event: 'evolution.snapshot_scope.shadow',
        supplierContactId: supplier.id,
        externalMessageId: message.messageId,
        updateMode,
        status: scopeResolution.status,
        scopeKey: scopeResolution.scopeKey ?? null,
        reason: scopeResolution.reason,
        evidence: scopeResolution.evidence,
      }),
    );
    const catalog = await this.loadProductShadowCatalog();
    const itemsWithResolvedProductId = await this.processParsedSupplierItemsShadow(
      items,
      {
        supplierContactId: supplier.id,
        sourceMessageId: message.messageId,
      },
      catalog,
    );

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.evolutionWebhookReceipt.create({
          data: {
            externalMessageId: message.messageId,
            event: message.event,
            supplierContactId: supplier.id,
          },
        });

        if (writePlan.authority === 'NONE') return;

        if (writePlan.authority === 'PARTIAL_UPDATE') {
          const partialSnapshotScope = writePlan.targets[0].scopeKey;

          const currentList = await transaction.supplierCurrentList.findUnique({
            where: {
              supplierContactId_snapshotScope: {
                supplierContactId: supplier.id,
                snapshotScope: partialSnapshotScope,
              },
            },
            include: { items: true },
          });

          if (!currentList) {
            this.logger.debug(
              JSON.stringify({
                event: 'evolution.snapshot_scope.partial_scope_not_found',
                supplierContactId: supplier.id,
                externalMessageId: message.messageId,
                snapshotScope: partialSnapshotScope,
              }),
            );
            return;
          }

          await transaction.supplierCurrentList.update({
            where: { id: currentList.id },
            data: {
              sourceMessageId: message.messageId,
              sourceType: 'text',
              rawContent: text,
              receivedAt: message.receivedAt,
            },
          });
          await this.applyPartialUpdate(
            transaction,
            currentList.id,
            currentList.items,
            itemsWithResolvedProductId,
          );
          return;
        }

        for (const target of writePlan.targets) {
          const scopedItems = selectSnapshotWriteItems(
            itemsWithResolvedProductId,
            target.itemGroup,
          );
          await transaction.supplierCurrentList.upsert({
            where: {
              supplierContactId_snapshotScope: {
                supplierContactId: supplier.id,
                snapshotScope: target.scopeKey,
              },
            },
            create: {
              supplierContactId: supplier.id,
              snapshotScope: target.scopeKey,
              sourceMessageId: message.messageId,
              sourceType: 'text',
              rawContent: text,
              receivedAt: message.receivedAt,
              items: { create: scopedItems },
            },
            update: {
              sourceMessageId: message.messageId,
              sourceType: 'text',
              rawContent: text,
              receivedAt: message.receivedAt,
              items: {
                deleteMany: {},
                create: scopedItems,
              },
              attachments: { deleteMany: {} },
            },
          });
        }

        if (replacementAuthority === 'ALL_SEGMENTED_SCOPES') {
          const deleted = await transaction.supplierCurrentList.deleteMany({
            where: {
              supplierContactId: supplier.id,
              snapshotScope: { in: [...GENERAL_REPLACED_SEGMENTED_SCOPES] },
            },
          });
          this.logger.debug(
            JSON.stringify({
              event: 'evolution.snapshot_transition',
              supplierContactId: supplier.id,
              sourceMessageId: message.messageId,
              incomingScope: fullSnapshotScope,
              replacementAuthority,
              removedScopes: GENERAL_REPLACED_SEGMENTED_SCOPES,
              removedCount: deleted.count,
            }),
          );
        }
      });
    } catch (error) {
      if (isDuplicateReceiptError(error)) {
        return { accepted: true, duplicate: true };
      }
      throw error;
    }

    this.logger.log(
      writePlan.authority === 'NONE'
        ? `Lista preservada: fornecedor=${supplier.id} itens=${items.length} modo inconclusivo.`
        : `Lista atualizada: fornecedor=${supplier.id} itens=${items.length}`,
    );
    return { accepted: true, supplierId: supplier.id, items: items.length };
  }

  private async applyPartialUpdate(
    transaction: Prisma.TransactionClient,
    currentListId: string,
    existingItems: readonly SupplierListItemForMerge[],
    incomingItems: readonly PersistedSupplierListItem[],
  ) {
    const existingByKey = new Map(
      existingItems
        .filter((item): item is SupplierListItemForMerge & { id: string } => Boolean(item.id))
        .map((item) => [supplierListItemMergeKey(item), item]),
    );

    for (const item of incomingItems) {
      const existingItem = existingByKey.get(supplierListItemMergeKey(item));
      if (existingItem) {
        await transaction.supplierCurrentListItem.update({
          where: { id: existingItem.id },
          data: item,
        });
        continue;
      }

      await transaction.supplierCurrentListItem.create({
        data: {
          ...item,
          supplierCurrentListId: currentListId,
        },
      });
    }
  }

  private assertValidSecret(providedSecret: string) {
    const enabled = this.config.get<boolean>('app.evolutionWebhookEnabled', false);
    const expectedSecret = this.config.get<string>('app.evolutionWebhookSecret', '');
    if (!enabled || !expectedSecret || !safeEqual(providedSecret, expectedSecret)) {
      throw new UnauthorizedException('Webhook nao autorizado.');
    }
  }

  private parseSupplierList(content: string, sourceMessageId: string) {
    return parseSupplierListText(content, {
      onLineRejected: (rejection) => this.logRejectedSupplierLine(sourceMessageId, rejection),
    });
  }

  private logRejectedSupplierLine(sourceMessageId: string, rejection: SupplierLineRejection) {
    this.logger.warn(
      JSON.stringify({
        event: 'evolution.supplier_line_rejected',
        sourceMessageId,
        rawLine: rejection.rawLine,
        reason: rejection.reason,
      }),
    );
  }

  private async processParsedSupplierItemsShadow(
    items: readonly ParsedSupplierListItem[],
    context: { supplierContactId: string; sourceMessageId: string },
    catalog: Awaited<ReturnType<EvolutionWebhookService['loadProductShadowCatalog']>>,
  ) {
    const observations = processParsedSupplierItemsShadow(items, catalog);
    vm2ShadowResultStore.record(observations);

    for (const { item, identity, productResolution } of observations) {
      this.logger.debug(
        JSON.stringify({
          event: 'evolution.product_id.shadow',
          supplier: context.supplierContactId,
          sourceMessageId: context.sourceMessageId,
          rawDescription: item.productName,
          canonicalModelKey: identity.canonical.canonicalModelKey || null,
          vm2Status: productResolution.status,
          resolvedProductId: productResolution.productId ?? null,
          persistedProductId:
            productResolution.status === 'FOUND' ? (productResolution.productId ?? null) : null,
          candidateCount: productResolution.candidateCount,
          reason: productResolution.reason ?? null,
        }),
      );
    }

    return observations.map(({ item, productResolution }) => ({
      ...item,
      productId:
        productResolution.status === 'FOUND' ? (productResolution.productId ?? null) : null,
    }));
  }

  private loadProductShadowCatalog() {
    return this.prisma.product.findMany({
      where: { active: true, status: ProductStatus.ACTIVE, deletedAt: null },
      select: {
        id: true,
        productDescription: true,
        productType: true,
        profitCondition: true,
        variantAttributes: true,
        category: { select: { name: true } },
        model: { select: { name: true } },
        color: { select: { name: true } },
        storage: { select: { displayName: true, value: true, unit: true } },
      },
    });
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
    qualityGrade: string | null;
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
  qualityGrade: string | null;
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
    item.qualityGrade,
    Number(item.price.toString()),
    item.availability,
    normalizedRawLine(item.rawLine),
  ]);
}

function normalizedRawLine(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
}

export function supplierListItemMergeKey(item: SupplierListItemForMerge) {
  // The current list is already scoped to one SupplierContact. Keep the
  // remaining offer identity family-aware and independent from productId.
  return [
    `family:${normalizeMergeValue(item.category)}`,
    `variant:${normalizeMergeValue(item.normalizedName)}`,
    `model:${normalizeMergeValue(item.model)}`,
    `capacity:${normalizeMergeValue(item.capacity)}`,
    `color:${normalizeMergeValue(item.color)}`,
    `condition:${normalizeMergeValue(item.condition)}`,
    `quality-grade:${normalizeMergeValue(item.qualityGrade)}`,
  ].join('|');
}

function normalizeMergeValue(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR') ?? '';
}

function resolveSnapshotWritePlan(
  updateClassification: SupplierListUpdateClassification,
  resolution: SupplierSnapshotScopeResolution,
  items: readonly ParsedSupplierListItem[],
): SnapshotWritePlan {
  const conditions = new Set(items.map((item) => item.condition));
  const hasPrimaryItems = conditions.has('NOVO') || conditions.has('CPO');
  const hasUsedItems = conditions.has('SEMINOVO');
  const hasMixedSegments = hasPrimaryItems && hasUsedItems;
  const resolvedScope = resolution.status === 'RESOLVED' ? resolution.scopeKey : undefined;

  if (updateClassification.mode === 'PARTIAL_UPDATE') {
    if (!resolvedScope || hasMixedSegments) return { authority: 'NONE', targets: [] };
    return {
      authority: 'PARTIAL_UPDATE',
      targets: [{ scopeKey: resolvedScope, itemGroup: 'ALL' }],
    };
  }

  if (updateClassification.mode === 'FULL_SNAPSHOT' && resolvedScope) {
    return {
      authority: 'FULL_SNAPSHOT',
      targets: [{ scopeKey: resolvedScope, itemGroup: 'ALL' }],
    };
  }

  if (
    updateClassification.hasFullMarker &&
    hasExplicitMixedSnapshotAuthority(resolution, hasPrimaryItems, hasUsedItems)
  ) {
    return {
      authority: 'FULL_SNAPSHOT',
      targets: [
        { scopeKey: 'catalog:primary', itemGroup: 'PRIMARY' },
        { scopeKey: 'catalog:used', itemGroup: 'USED' },
      ],
    };
  }

  if (
    updateClassification.mode === 'INCONCLUSIVE' &&
    updateClassification.hasFullMarker &&
    resolvedScope &&
    hasExplicitUsedSnapshotAuthority(resolution)
  ) {
    return {
      authority: 'FULL_SNAPSHOT',
      targets: [{ scopeKey: resolvedScope, itemGroup: 'ALL' }],
    };
  }

  return { authority: 'NONE', targets: [] };
}

function hasExplicitMixedSnapshotAuthority(
  resolution: SupplierSnapshotScopeResolution,
  hasPrimaryItems: boolean,
  hasUsedItems: boolean,
) {
  return (
    resolution.status === 'AMBIGUOUS' &&
    resolution.reason === 'conflicting_document_evidence' &&
    resolution.evidence.preambleMarkers.includes('primary') &&
    resolution.evidence.preambleMarkers.includes('used') &&
    hasPrimaryItems &&
    hasUsedItems
  );
}

function hasExplicitUsedSnapshotAuthority(resolution: SupplierSnapshotScopeResolution) {
  return resolution.scopeKey === 'catalog:used' && resolution.reason === 'explicit_used_preamble';
}

function selectSnapshotWriteItems<T extends Pick<ParsedSupplierListItem, 'condition'>>(
  items: readonly T[],
  itemGroup: SnapshotWriteItemGroup,
): T[] {
  if (itemGroup === 'PRIMARY') {
    return items.filter((item) => item.condition === 'NOVO' || item.condition === 'CPO');
  }
  if (itemGroup === 'USED') {
    return items.filter((item) => item.condition === 'SEMINOVO');
  }
  return [...items];
}

function fullSnapshotReplacementAuthority(
  updateMode: SupplierListUpdateMode,
  scopeKey: string | null,
  resolution: SupplierSnapshotScopeResolution,
): SnapshotReplacementAuthority {
  if (
    updateMode === 'FULL_SNAPSHOT' &&
    scopeKey === 'catalog:general' &&
    hasCompleteGeneralCoverage(resolution)
  ) {
    return 'ALL_SEGMENTED_SCOPES';
  }
  return 'SAME_SCOPE_ONLY';
}

function hasCompleteGeneralCoverage(resolution: SupplierSnapshotScopeResolution) {
  const conditions = new Set(resolution.evidence.conditions);
  return conditions.has('NOVO') && conditions.has('CPO') && conditions.has('SEMINOVO');
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
