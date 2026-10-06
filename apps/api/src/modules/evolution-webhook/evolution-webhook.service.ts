import { Inject, Injectable, Logger, Optional, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, ProductCondition, ProductStatus, ProductType } from '@prisma/client';
import {
  normalizeCanonicalProductIdentity,
  normalizeCanonicalText,
  normalizeProductCondition,
  resolveCatalogModelLookupKey,
} from '@inest/product-identity';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SupplierContactsService } from '../suppliers/service/supplier-contacts.service';
import { normalizeWhatsappNumber } from '../suppliers/validators/supplier-contacts.validators';
import {
  processParsedSupplierItemsShadow,
  resolveCatalogCategorySlug,
  resolveCatalogProductType,
  type ProductIdShadowCandidate,
} from './product-identity-shadow';
import { vm2ShadowResultStore } from './product-identity-shadow-store';
import { applySupplierListConditionPolicy, getSupplierListPolicy } from './supplier-list-policy';
import {
  ProductNormalizationService,
  type ProductNormalizationInput,
  type ProductNormalizationResult,
} from './product-normalization.service';
import {
  hasLotDocumentHeader,
  hasStructuredSupplierDocumentHeading,
  resolveSupplierSnapshotScope,
  type SupplierSnapshotScopeResolution,
} from './supplier-snapshot-scope';
import {
  isValidParsedSupplierListSnapshot,
  parseSupplierListText,
  SupplierLineRejection,
} from './supplier-list.parser';
import { EvolutionMessage, ParsedSupplierListItem } from './evolution-webhook.types';
import { buildProductModelNormalizedName } from '../products/product-model-normalizer';
import { normalizeProfitProductDescription } from '../pricing/providers/google-sheets-profit.provider';

export type SupplierListUpdateMode = 'FULL_SNAPSHOT' | 'PARTIAL_UPDATE' | 'INCONCLUSIVE';

type SupplierListUpdateClassification = {
  mode: SupplierListUpdateMode;
  hasPartialMarker: boolean;
  hasUnsegmentedPartialMarker: boolean;
  hasFullMarker: boolean;
};

type SnapshotWriteItemGroup = 'ALL' | 'PRIMARY' | 'USED';
type SnapshotWriteOperation = 'FULL_SNAPSHOT' | 'PARTIAL_UPDATE';

type SnapshotWriteTarget = {
  scopeKey: 'catalog:used' | 'catalog:primary' | 'catalog:general';
  itemGroup: SnapshotWriteItemGroup;
  operation: SnapshotWriteOperation;
  createWhenMissing?: boolean;
};

type SnapshotWritePlan =
  | { authority: 'NONE'; targets: [] }
  | { authority: 'FULL_SNAPSHOT'; targets: SnapshotWriteTarget[] }
  | { authority: 'PARTIAL_UPDATE'; targets: [SnapshotWriteTarget] };

const PARTIAL_UPDATE_MARKER =
  /\b(?:promo(?:c|ç)(?:[aã]o|ões)|ofertas?|baix(?:ou|amos)|pre[cç]o\s+promocional|s[oó]\s+hoje|acabou\s+de\s+chegar|reposi(?:c|ç)(?:[aã]o|ões)|chegou\s+lacrad[oa]s?|remessas?)\b/i;
const UNSEGMENTED_PARTIAL_UPDATE_MARKER = /[uú]ltimas?\s+pe[cç]as?/i;
const FULL_SNAPSHOT_MARKER =
  /\b(?:lista(?:\s+(?:completa|geral|atual(?:izada)?|unificada|di[aá]ria|de\s+pre[cç]os?))?|tabela\s+(?:completa|geral)|todos?\s+os\s+produtos|apple\s+lacrad[oa]s?|(?:aparelhos?|produtos?)\s+(?:dispon[ií]veis?|lacrad[oa]s?|novos?\s+lacrad[oa]s?|semi[-\s]?novos?)|(?:iphone|iphones|xiaomis?)\s+(?:lacrad[oa]s?|semi[-\s]?novos?|swap\s+americanos?))\b/i;
const GENERAL_REPLACED_SEGMENTED_SCOPES = ['catalog:primary', 'catalog:used'] as const;

type SnapshotReplacementAuthority = 'SAME_SCOPE_ONLY' | 'ALL_SEGMENTED_SCOPES';

export function classifySupplierListUpdateMode(text: string): SupplierListUpdateMode {
  return classifySupplierListUpdate(text).mode;
}

function classifySupplierListUpdate(
  text: string,
  supplierContactId?: string,
  hasValidCommercialSnapshot = false,
): SupplierListUpdateClassification {
  const hasUnsegmentedPartialMarker = UNSEGMENTED_PARTIAL_UPDATE_MARKER.test(text);
  const hasPartialMarker = PARTIAL_UPDATE_MARKER.test(text) || hasUnsegmentedPartialMarker;
  const supplierPolicy = supplierContactId ? getSupplierListPolicy(supplierContactId) : undefined;
  const hasFullMarker =
    FULL_SNAPSHOT_MARKER.test(text) ||
    (supplierPolicy?.requireDocumentHeader !== false && hasLotDocumentHeader(text)) ||
    hasStructuredSupplierDocumentHeading(text) ||
    (supplierPolicy?.requireDocumentHeader === false &&
      hasValidCommercialSnapshot &&
      !hasPartialMarker);

  if (hasPartialMarker && hasFullMarker) {
    return { mode: 'INCONCLUSIVE', hasPartialMarker, hasUnsegmentedPartialMarker, hasFullMarker };
  }
  if (hasPartialMarker) {
    return { mode: 'PARTIAL_UPDATE', hasPartialMarker, hasUnsegmentedPartialMarker, hasFullMarker };
  }
  if (hasFullMarker) {
    return { mode: 'FULL_SNAPSHOT', hasPartialMarker, hasUnsegmentedPartialMarker, hasFullMarker };
  }
  return { mode: 'INCONCLUSIVE', hasPartialMarker, hasUnsegmentedPartialMarker, hasFullMarker };
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

type SupplierCurrentListItemPersistenceData = {
  productId: string | null;
  productName: string;
  normalizedName: string;
  category: string | null;
  model: string | null;
  capacity: string | null;
  color: string | null;
  condition: string | null;
  qualityGrade: string | null;
  price: number;
  availability: string | null;
  rawLine: string;
};

function toSupplierCurrentListItemPersistenceData(
  item: ParsedSupplierListItem | PersistedSupplierListItem,
): SupplierCurrentListItemPersistenceData {
  return {
    productId: ('productId' in item ? item.productId : null) ?? null,
    productName: item.productName,
    normalizedName: item.normalizedName,
    category: item.category,
    model: item.model,
    capacity: item.capacity,
    color: item.color,
    condition: item.condition,
    qualityGrade: item.qualityGrade,
    price: item.price,
    availability: item.availability,
    rawLine: item.rawLine,
  };
}

@Injectable()
export class EvolutionWebhookService {
  private readonly logger = new Logger(EvolutionWebhookService.name);

  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SupplierContactsService) private readonly supplierContacts: SupplierContactsService,
    @Optional()
    @Inject(ProductNormalizationService)
    private readonly productNormalization?: ProductNormalizationService,
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
                create: scopedParsedItems.map(toSupplierCurrentListItemPersistenceData),
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
    const rejections: SupplierLineRejection[] = [];
    const items = this.parseSupplierList(text, message.messageId, (rejection) =>
      rejections.push(rejection),
    );
    if (!isValidParsedSupplierListSnapshot(items)) {
      this.logger.warn(
        `Lista ignorada para fornecedor ${supplier.id}: nenhum item com preco foi localizado.`,
      );
      return { accepted: false, ignored: true, reason: 'invalid_or_empty_snapshot' };
    }
    const policyItems = applySupplierListConditionPolicy(items, supplier.id);
    const updateClassification = classifySupplierListUpdate(text, supplier.id, true);
    const updateMode = updateClassification.mode;
    const supplierPolicy = getSupplierListPolicy(supplier.id);
    const canInheritPartialConditions =
      updateMode === 'PARTIAL_UPDATE' &&
      supplierPolicy.inheritPartialConditionFromCurrentList === true;
    const currentPrimaryList = canInheritPartialConditions
      ? await this.prisma.supplierCurrentList.findUnique({
          where: {
            supplierContactId_snapshotScope: {
              supplierContactId: supplier.id,
              snapshotScope: 'catalog:primary',
            },
          },
          include: { items: true },
        })
      : null;
    const resolvedPolicyItems = canInheritPartialConditions
      ? resolvePartialConditionsFromCurrentList(policyItems, currentPrimaryList?.items ?? [])
      : policyItems;
    const scopeResolution = resolveSupplierSnapshotScope(text, resolvedPolicyItems, supplier.id);
    const writePlan = resolveSnapshotWritePlan(
      updateClassification,
      scopeResolution,
      resolvedPolicyItems,
    );
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
    const aiRecoveryCandidates: ProductNormalizationInput[] = rejections.map((rejection) => ({
      ...rejection,
      sourceText: text,
      originalReason: rejection.reason,
    }));
    const itemsWithResolvedProductId = await this.processParsedSupplierItemsShadow(
      resolvedPolicyItems,
      {
        supplierContactId: supplier.id,
        sourceMessageId: message.messageId,
      },
      catalog,
      (candidate) => aiRecoveryCandidates.push({ ...candidate, sourceText: text }),
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

        for (const target of writePlan.targets) {
          const scopedItems = selectSnapshotWriteItems(
            itemsWithResolvedProductId,
            target.itemGroup,
          );

          if (target.operation === 'PARTIAL_UPDATE') {
            await this.applyPartialSnapshotUpdate(
              transaction,
              supplier.id,
              target.scopeKey,
              scopedItems,
              {
                externalMessageId: message.messageId,
                rawContent: text,
                receivedAt: message.receivedAt,
                createWhenMissing: target.createWhenMissing ?? false,
              },
            );
            continue;
          }

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
              items: { create: scopedItems.map(toSupplierCurrentListItemPersistenceData) },
            },
            update: {
              sourceMessageId: message.messageId,
              sourceType: 'text',
              rawContent: text,
              receivedAt: message.receivedAt,
              items: {
                deleteMany: {},
                create: scopedItems.map(toSupplierCurrentListItemPersistenceData),
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
    if (this.productNormalization) {
      try {
        const recoveryResults = await this.productNormalization.observeCandidates(
          aiRecoveryCandidates,
          catalog,
        );
        if (writePlan.authority !== 'NONE') {
          await this.promoteRecoveredCandidates(
            supplier.id,
            message.messageId,
            writePlan.targets,
            aiRecoveryCandidates,
            recoveryResults,
          );
        }
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            event: 'evolution.ai_recovery.promotion_blocked',
            supplierContactId: supplier.id,
            sourceMessageId: message.messageId,
            reason: 'recovery_failed_closed',
            error: error instanceof Error ? error.message : 'unknown_error',
          }),
        );
      }
    }
    return { accepted: true, supplierId: supplier.id, items: items.length };
  }

  private async promoteRecoveredCandidates(
    supplierContactId: string,
    sourceMessageId: string,
    targets: readonly SnapshotWriteTarget[],
    inputs: readonly ProductNormalizationInput[],
    results: readonly ProductNormalizationResult[],
  ) {
    const promotable = results.flatMap((result, index) => {
      const input = inputs[index];
      if (!input || !this.isSafeRecoveredCandidate(input, result)) return [];
      const candidate = result.candidate!;
      const target = targets.find((value) => this.targetAcceptsCondition(value, candidate.condition));
      return target ? [{ candidate, target }] : [];
    });
    if (promotable.length === 0) return;

    await this.prisma.$transaction(
      async (transaction) => {
        const byScope = new Map<string, typeof promotable>();
        for (const entry of promotable) {
          const scope = entry.target.scopeKey;
          const entries = byScope.get(scope) ?? [];
          entries.push(entry);
          byScope.set(scope, entries);
        }
        for (const [scopeKey, entries] of byScope) {
          if (typeof transaction.$queryRaw !== 'function') {
            throw new Error('recovery_promotion_lock_unavailable');
          }
          await transaction.$queryRaw`
            SELECT pg_advisory_xact_lock(hashtextextended(${`${supplierContactId}:${scopeKey}`}, 0))
          `;
          const currentList = await transaction.supplierCurrentList.findUnique({
            where: {
              supplierContactId_snapshotScope: { supplierContactId, snapshotScope: scopeKey },
            },
            include: { items: true },
          });
          if (!currentList || currentList.sourceMessageId !== sourceMessageId) continue;

          const existingKeys = new Set(currentList.items.map((item) => supplierListItemMergeKey(item)));
          for (const { candidate } of entries) {
            const mergeKey = supplierListItemMergeKey(candidate);
            if (existingKeys.has(mergeKey)) continue;
            const productId = await this.resolveOrCreateRecoveredProduct(transaction, candidate);
            if (!productId) continue;
            await transaction.supplierCurrentListItem.create({
              data: {
                supplierCurrentListId: currentList.id,
                ...toSupplierCurrentListItemPersistenceData({ ...candidate, productId }),
              },
            });
            existingKeys.add(mergeKey);
            this.logger.log(
              JSON.stringify({
                event: 'evolution.ai_recovery.promoted',
                supplierContactId,
                sourceMessageId,
                scopeKey,
                productId,
              }),
            );
          }
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private isSafeRecoveredCandidate(
    input: ProductNormalizationInput,
    result: ProductNormalizationResult,
  ): result is ProductNormalizationResult & { candidate: ParsedSupplierListItem } {
    if (input.originalReason === 'identity_insufficient') return false;
    if (!result.candidate) return false;
    if (
      !(
        (result.normalizationStatus === 'FOUND' &&
          result.identityStatus === 'FOUND' &&
          Boolean(result.resolvedProductId)) ||
        (result.normalizationStatus === 'MISSING' &&
          result.identityStatus === 'MISSING' &&
          result.resolvedProductId === null)
      )
    ) {
      return false;
    }
    if (input.detectedPrice === null || result.candidate.price !== input.detectedPrice) return false;
    if (!result.candidate.condition || result.candidate.condition !== input.activeCondition) return false;
    const sourceEvidence = [
      input.rawLine,
      input.activeProductHeading,
      input.activeCategory,
      ...input.previousLines,
      ...input.nextLines,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('pt-BR');
    const conditionEvidence = [input.sourceText, sourceEvidence].filter(Boolean).join(' ');
    const sourceCondition = normalizeProductCondition(conditionEvidence);
    if (
      sourceCondition.status !== 'RESOLVED' ||
      sourceCondition.condition !== result.candidate.condition
    ) {
      return false;
    }
    const localPriceEvidence = [input.rawLine, ...input.previousLines, ...input.nextLines].join(' ');
    if (!/(?:r\$|us\$|\$|€|£)/i.test(localPriceEvidence)) return false;
    const sourceIdentity = normalizeCanonicalProductIdentity(sourceEvidence);
    const candidateIdentity = normalizeCanonicalProductIdentity({
      productName: result.candidate.productName,
      category: result.candidate.category,
      model: result.candidate.model,
      capacity: result.candidate.capacity,
      color: result.candidate.color,
    });
    const sameRegisteredModel =
      sourceIdentity.canonicalModelMatched &&
      candidateIdentity.canonicalModelMatched &&
      sourceIdentity.canonicalModelKey === candidateIdentity.canonicalModelKey;
    const sameExplicitDynamicModel =
      !sourceIdentity.canonicalModelMatched &&
      !candidateIdentity.canonicalModelMatched &&
      sourceIdentity.canonicalFamilyStatus === 'matched' &&
      sourceIdentity.canonicalFamily === candidateIdentity.canonicalFamily &&
      Boolean(result.candidate.model) &&
      this.containsCanonicalPhrase(sourceEvidence, result.candidate.model!);
    if (!sameRegisteredModel && !sameExplicitDynamicModel) {
      return false;
    }
    if (
      result.candidate.capacity &&
      (!sourceIdentity.canonicalStorage ||
        !candidateIdentity.canonicalStorage ||
        sourceIdentity.canonicalStorage !== candidateIdentity.canonicalStorage)
    ) {
      return false;
    }
    if (
      result.candidate.color &&
      (!sourceIdentity.canonicalColor ||
        !candidateIdentity.canonicalColor ||
        sourceIdentity.canonicalColor !== candidateIdentity.canonicalColor)
    ) {
      return false;
    }
    return true;
  }

  private containsCanonicalPhrase(evidence: string, phrase: string) {
    const normalizedEvidence = normalizeCanonicalText(evidence);
    const normalizedPhrase = normalizeCanonicalText(phrase);
    if (!normalizedEvidence || !normalizedPhrase) return false;
    return (` ${normalizedEvidence} `).includes(` ${normalizedPhrase} `);
  }

  private async resolveOrCreateRecoveredProduct(
    transaction: Prisma.TransactionClient,
    candidate: ParsedSupplierListItem,
  ) {
    const catalog = await this.loadProductShadowCatalogFrom(transaction);
    const [observation] = processParsedSupplierItemsShadow([candidate], catalog);
    if (observation?.productResolution.status === 'FOUND') {
      return observation.productResolution.productId!;
    }
    if (
      !observation ||
      observation.productResolution.status !== 'MISSING' ||
      observation.productResolution.reason !== 'catalog_no_match'
    ) {
      return null;
    }

    const condition = candidate.condition as ProductCondition | null;
    const productType = resolveCatalogProductType(observation.identity.canonical.canonicalFamily, condition);
    const categorySlug = productType && condition ? resolveCatalogCategorySlug(productType, condition) : null;
    const modelName = candidate.model?.trim();
    if (!condition || !productType || !categorySlug || !modelName) return null;

    const category = await transaction.productCategory.findUnique({ where: { slug: categorySlug } });
    if (
      !category ||
      category.deletedAt !== null ||
      category.status !== 'ACTIVE' ||
      category.type !== productType
    ) {
      return null;
    }

    const model = await this.resolveOrCreateRecoveredProductModel(
      transaction,
      category.id,
      modelName,
      productType,
    );
    if (!model) return null;

    const storageId = await this.resolveRecoveredStorageId(
      transaction,
      candidate.capacity,
      observation.identity.canonical.canonicalStorage,
    );
    if (candidate.capacity && !storageId) return null;
    const colorId = await this.resolveRecoveredColorId(
      transaction,
      candidate.color,
      observation.identity.canonical.canonicalColor,
    );
    if (candidate.color && !colorId) return null;

    const productDescription = [modelName, observation.identity.canonical.canonicalStorage]
      .filter(Boolean)
      .join(' ');
    try {
      const created = await transaction.product.create({
        data: {
          categoryId: category.id,
          modelId: model.id,
          colorId,
          storageId,
          productType: productType as ProductType,
          status: ProductStatus.ACTIVE,
          productDescription,
          normalizedDescription: normalizeProfitProductDescription(productDescription),
          profitCondition: condition,
          netProfit: null,
          active: true,
        },
        select: { id: true },
      });
      return created.id;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const refreshedCatalog = await this.loadProductShadowCatalogFrom(transaction);
      const [refreshed] = processParsedSupplierItemsShadow([candidate], refreshedCatalog);
      return refreshed?.productResolution.status === 'FOUND'
        ? (refreshed.productResolution.productId ?? null)
        : null;
    }
  }

  private async resolveOrCreateRecoveredProductModel(
    transaction: Prisma.TransactionClient,
    categoryId: string,
    name: string,
    productType: string,
  ) {
    const normalizedName = buildProductModelNormalizedName({ categoryId, modelName: name });
    const legacyCanonicalName = resolveCatalogModelLookupKey({ productName: name, model: name });
    let model = legacyCanonicalName
      ? await transaction.productModel.findUnique({ where: { normalizedName: legacyCanonicalName } })
      : null;
    if (!model && legacyCanonicalName !== normalizedName) {
      model = await transaction.productModel.findUnique({ where: { normalizedName } });
    }
    if (!model) {
      try {
        model = await transaction.productModel.create({
          data: { categoryId, name, normalizedName, productType: productType as ProductType },
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        model = await transaction.productModel.findUnique({ where: { normalizedName } });
      }
    }
    if (!model || model.categoryId !== categoryId || model.productType !== productType) return null;
    return model;
  }

  private async resolveRecoveredStorageId(
    transaction: Prisma.TransactionClient,
    suppliedCapacity: string | null,
    canonicalStorage: string | null,
  ) {
    if (!suppliedCapacity) return null;
    const match = canonicalStorage?.match(/^(\d+(?:\.\d+)?)(GB|TB)$/i);
    if (!match) return null;
    const storage = await transaction.productStorage.findUnique({
      where: { value_unit: { value: match[1]!, unit: match[2]!.toUpperCase() } },
    });
    return storage?.id ?? null;
  }

  private async resolveRecoveredColorId(
    transaction: Prisma.TransactionClient,
    suppliedColor: string | null,
    canonicalColor: string | null,
  ) {
    if (!suppliedColor) return null;
    if (!canonicalColor) return null;
    const color = await transaction.productColor.findUnique({
      where: { normalizedName: canonicalColor },
    });
    return color?.id ?? null;
  }

  private targetAcceptsCondition(target: SnapshotWriteTarget, condition: string | null) {
    if (!condition) return false;
    if (target.itemGroup === 'PRIMARY') return condition === 'NOVO' || condition === 'CPO';
    if (target.itemGroup === 'USED') return condition === 'SEMINOVO';
    return true;
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
          data: toSupplierCurrentListItemPersistenceData(item),
        });
        continue;
      }

      await transaction.supplierCurrentListItem.create({
        data: {
          ...toSupplierCurrentListItemPersistenceData(item),
          supplierCurrentListId: currentListId,
        },
      });
    }
  }

  private async applyPartialSnapshotUpdate(
    transaction: Prisma.TransactionClient,
    supplierContactId: string,
    snapshotScope: SnapshotWriteTarget['scopeKey'],
    incomingItems: readonly PersistedSupplierListItem[],
    source: {
      externalMessageId: string;
      rawContent: string;
      receivedAt: Date;
      createWhenMissing: boolean;
    },
  ) {
    const currentList = await transaction.supplierCurrentList.findUnique({
      where: {
        supplierContactId_snapshotScope: {
          supplierContactId,
          snapshotScope,
        },
      },
      include: { items: true },
    });

    if (!currentList) {
      if (!source.createWhenMissing) {
        this.logger.debug(
          JSON.stringify({
            event: 'evolution.snapshot_scope.partial_scope_not_found',
            supplierContactId,
            externalMessageId: source.externalMessageId,
            snapshotScope,
          }),
        );
        return;
      }

      await transaction.supplierCurrentList.create({
        data: {
          supplierContactId,
          snapshotScope,
          sourceMessageId: source.externalMessageId,
          sourceType: 'text',
          rawContent: source.rawContent,
          receivedAt: source.receivedAt,
          items: { create: incomingItems.map(toSupplierCurrentListItemPersistenceData) },
        },
      });
      return;
    }

    await transaction.supplierCurrentList.update({
      where: { id: currentList.id },
      data: {
        sourceMessageId: source.externalMessageId,
        sourceType: 'text',
        rawContent: source.rawContent,
        receivedAt: source.receivedAt,
      },
    });
    await this.applyPartialUpdate(transaction, currentList.id, currentList.items, incomingItems);
  }

  private assertValidSecret(providedSecret: string) {
    const enabled = this.config.get<boolean>('app.evolutionWebhookEnabled', false);
    const expectedSecret = this.config.get<string>('app.evolutionWebhookSecret', '');
    if (!enabled || !expectedSecret || !safeEqual(providedSecret, expectedSecret)) {
      throw new UnauthorizedException('Webhook nao autorizado.');
    }
  }

  private parseSupplierList(
    content: string,
    sourceMessageId: string,
    onLineRejected?: (rejection: SupplierLineRejection) => void,
  ) {
    return parseSupplierListText(content, {
      onLineRejected: (rejection) => {
        this.logRejectedSupplierLine(sourceMessageId, rejection);
        onLineRejected?.(rejection);
      },
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
    onIdentityInsufficient?: (candidate: ProductNormalizationInput) => void,
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
      if (productResolution.reason === 'identity_insufficient') {
        onIdentityInsufficient?.({
          originalReason: 'identity_insufficient',
          rawLine: item.rawLine,
          previousLines: [],
          nextLines: [],
          activeProductHeading: item.productName,
          activeCategory: item.category,
          activeCondition: item.condition,
          qualityGrade: item.qualityGrade,
          detectedPrice: item.price,
        });
      }
    }

    return observations.map(({ item, productResolution }) => ({
      ...item,
      productId:
        productResolution.status === 'FOUND' ? (productResolution.productId ?? null) : null,
    }));
  }

  private loadProductShadowCatalog() {
    return this.loadProductShadowCatalogFrom(this.prisma);
  }

  private loadProductShadowCatalogFrom(
    client: Pick<Prisma.TransactionClient, 'product'> | PrismaService,
  ): Promise<ProductIdShadowCandidate[]> {
    return client.product.findMany({
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

function supplierListItemConditionlessMergeKey(item: SupplierListItemForMerge) {
  return [
    `family:${normalizeMergeValue(item.category)}`,
    `variant:${normalizeMergeValue(item.normalizedName)}`,
    `model:${normalizeMergeValue(item.model)}`,
    `capacity:${normalizeMergeValue(item.capacity)}`,
    `color:${normalizeMergeValue(item.color)}`,
    `quality-grade:${normalizeMergeValue(item.qualityGrade)}`,
  ].join('|');
}

function resolvePartialConditionsFromCurrentList(
  incomingItems: readonly ParsedSupplierListItem[],
  existingItems: readonly SupplierListItemForMerge[],
): ParsedSupplierListItem[] {
  const conditionsByOffer = new Map<string, Set<'NOVO' | 'CPO'>>();

  for (const item of existingItems) {
    if (!isPrimaryOfferCondition(item.condition)) continue;
    const key = supplierListItemConditionlessMergeKey(item);
    const conditions = conditionsByOffer.get(key) ?? new Set<'NOVO' | 'CPO'>();
    conditions.add(item.condition);
    conditionsByOffer.set(key, conditions);
  }

  return incomingItems.flatMap((item) => {
    if (item.condition !== null) return [item];

    const conditions = conditionsByOffer.get(supplierListItemConditionlessMergeKey(item));
    if (!conditions || conditions.size !== 1) return [];

    const [condition] = conditions;
    return condition ? [{ ...item, condition }] : [];
  });
}

function isPrimaryOfferCondition(value: string | null): value is 'NOVO' | 'CPO' {
  return value === 'NOVO' || value === 'CPO';
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
  const hasOnlyUnsegmentedItems = conditions.size === 1 && conditions.has(null);
  const resolvedScope = resolution.status === 'RESOLVED' ? resolution.scopeKey : undefined;

  if (updateClassification.mode === 'PARTIAL_UPDATE') {
    if (hasMixedSegments) return { authority: 'NONE', targets: [] };
    if (
      !resolvedScope &&
      updateClassification.hasUnsegmentedPartialMarker &&
      hasOnlyUnsegmentedItems
    ) {
      return {
        authority: 'PARTIAL_UPDATE',
        targets: [{ scopeKey: 'catalog:primary', itemGroup: 'ALL', operation: 'PARTIAL_UPDATE' }],
      };
    }
    if (!resolvedScope) return { authority: 'NONE', targets: [] };
    return {
      authority: 'PARTIAL_UPDATE',
      targets: [{ scopeKey: resolvedScope, itemGroup: 'ALL', operation: 'PARTIAL_UPDATE' }],
    };
  }

  if (
    updateClassification.mode === 'FULL_SNAPSHOT' &&
    hasPrimaryFullSnapshotWithIsolatedUsedItems(resolution, hasPrimaryItems, hasUsedItems)
  ) {
    if (resolution.reason === 'explicit_primary_preamble') {
      return {
        authority: 'FULL_SNAPSHOT',
        targets: [
          { scopeKey: 'catalog:primary', itemGroup: 'PRIMARY', operation: 'FULL_SNAPSHOT' },
          {
            scopeKey: 'catalog:used',
            itemGroup: 'USED',
            operation: 'PARTIAL_UPDATE',
            createWhenMissing: true,
          },
        ],
      };
    }
    return {
      authority: 'PARTIAL_UPDATE',
      targets: [
        {
          scopeKey: 'catalog:used',
          itemGroup: 'USED',
          operation: 'PARTIAL_UPDATE',
          createWhenMissing: true,
        },
      ],
    };
  }

  if (
    updateClassification.mode === 'FULL_SNAPSHOT' &&
    resolution.segmentAuthorities.primary === 'NONE' &&
    resolution.segmentAuthorities.used === 'ISOLATED_EXPLICIT_ITEMS' &&
    hasUsedItems
  ) {
    return {
      authority: 'PARTIAL_UPDATE',
      targets: [
        {
          scopeKey: 'catalog:used',
          itemGroup: 'USED',
          operation: 'PARTIAL_UPDATE',
          createWhenMissing: true,
        },
      ],
    };
  }

  if (
    updateClassification.mode === 'FULL_SNAPSHOT' &&
    hasMixedSnapshotAuthority(resolution, hasPrimaryItems, hasUsedItems)
  ) {
    return {
      authority: 'FULL_SNAPSHOT',
      targets: [
        { scopeKey: 'catalog:primary', itemGroup: 'PRIMARY', operation: 'FULL_SNAPSHOT' },
        { scopeKey: 'catalog:used', itemGroup: 'USED', operation: 'FULL_SNAPSHOT' },
      ],
    };
  }

  if (updateClassification.mode === 'FULL_SNAPSHOT' && resolvedScope) {
    return {
      authority: 'FULL_SNAPSHOT',
      targets: [{ scopeKey: resolvedScope, itemGroup: 'ALL', operation: 'FULL_SNAPSHOT' }],
    };
  }

  if (
    updateClassification.hasFullMarker &&
    hasExplicitMixedSnapshotAuthority(resolution, hasPrimaryItems, hasUsedItems)
  ) {
    return {
      authority: 'FULL_SNAPSHOT',
      targets: [
        { scopeKey: 'catalog:primary', itemGroup: 'PRIMARY', operation: 'FULL_SNAPSHOT' },
        { scopeKey: 'catalog:used', itemGroup: 'USED', operation: 'FULL_SNAPSHOT' },
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
      targets: [{ scopeKey: resolvedScope, itemGroup: 'ALL', operation: 'FULL_SNAPSHOT' }],
    };
  }

  return { authority: 'NONE', targets: [] };
}

function hasPrimaryFullSnapshotWithIsolatedUsedItems(
  resolution: SupplierSnapshotScopeResolution,
  hasPrimaryItems: boolean,
  hasUsedItems: boolean,
) {
  return (
    hasPrimaryItems &&
    hasUsedItems &&
    resolution.segmentAuthorities.primary === 'FULL_SNAPSHOT' &&
    resolution.segmentAuthorities.used === 'ISOLATED_EXPLICIT_ITEMS'
  );
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

function hasMixedSnapshotAuthority(
  resolution: SupplierSnapshotScopeResolution,
  hasPrimaryItems: boolean,
  hasUsedItems: boolean,
) {
  if (!hasPrimaryItems || !hasUsedItems) return false;

  if (hasExplicitMixedSnapshotAuthority(resolution, hasPrimaryItems, hasUsedItems)) {
    return true;
  }

  return (
    resolution.status === 'RESOLVED' &&
    resolution.scopeKey === 'catalog:general' &&
    resolution.reason === 'broad_mixed_document' &&
    ((resolution.evidence.preambleMarkers.includes('primary') &&
      resolution.evidence.sectionMarkers.includes('used')) ||
      (resolution.evidence.preambleMarkers.includes('used') &&
        resolution.evidence.sectionMarkers.includes('primary')))
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

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002',
  );
}
