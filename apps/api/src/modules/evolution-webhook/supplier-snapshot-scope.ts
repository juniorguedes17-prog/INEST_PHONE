import type {
  ParsedSupplierListItem,
  SupplierConditionProvenance,
} from './evolution-webhook.types';
import { getSupplierListPolicy } from './supplier-list-policy';

export type SupplierSnapshotScopeKey = 'catalog:used' | 'catalog:primary' | 'catalog:general';
export type SupplierSnapshotScopeStatus = 'RESOLVED' | 'AMBIGUOUS' | 'UNKNOWN';
export type SupplierSnapshotSegmentAuthority = 'FULL_SNAPSHOT' | 'ISOLATED_EXPLICIT_ITEMS' | 'NONE';
export type SupplierSnapshotScopeReason =
  | 'explicit_used_preamble'
  | 'explicit_primary_preamble'
  | 'general_document_marker'
  | 'supplier_policy_content'
  | 'broad_mixed_document'
  | 'conflicting_document_evidence'
  | 'insufficient_document_evidence';

export interface SupplierDocumentBoundary {
  preambleLines: string[];
  sectionLines: string[];
  firstOfferLineIndex: number | null;
}

export interface SupplierDocumentIdentity {
  kind: 'catalog';
  segment: 'used' | 'primary' | 'general';
}

export interface SupplierSnapshotScopeEvidence {
  preambleMarkers: string[];
  sectionMarkers: string[];
  conditions: string[];
  conditionProvenances: SupplierConditionProvenance[];
  categoryCount: number;
}

export interface SupplierSnapshotSegmentAuthorities {
  primary: SupplierSnapshotSegmentAuthority;
  used: SupplierSnapshotSegmentAuthority;
}

export interface SupplierSnapshotScopeResolution {
  status: SupplierSnapshotScopeStatus;
  scopeKey?: SupplierSnapshotScopeKey;
  identity?: SupplierDocumentIdentity;
  reason: SupplierSnapshotScopeReason;
  evidence: SupplierSnapshotScopeEvidence;
  segmentAuthorities: SupplierSnapshotSegmentAuthorities;
}

const USED_MARKER = /\b(?:lista[-\s]*)?swap\b|\bsemi\s*novos?\b|\bseminovos?\b/i;
const PRIMARY_MARKER = /\b(?:lacrad[oa]s?|aparelhos\s+novos?|iphones?\s+novos?|sealed)\b/i;
const GENERAL_MARKER =
  /\b(?:lista\s+(?:unificada|geral|diaria|de\s+precos|atualizada|completa)|tabela\s+de\s+precos|atualizacao)\b/i;
const OFFER_MARKER = /(?:r\$|\$r|\$)\s*\d|\d[\d.,\s]*\s*(?:r\$|\$r)(?=\s|$)/i;
const LOT_DOCUMENT_HEADER = /^lote\s+\d+(?:\s+\S(?:.*\S)?)?$/i;
const STRUCTURED_PRIMARY_HEADINGS = new Set(['aparelhos lacrados', 'diversos novos']);
const STRUCTURED_WARRANTY_DOCUMENT_HEADINGS = new Set(['aparelhos garantia apple']);
const STRUCTURED_USED_HEADING = /^(?:iphones?|macbooks?|ipads?)\s+seminovos?$/i;

export function hasLotDocumentHeader(rawText: string) {
  const firstLine = rawText.split(/\r?\n/).map(cleanLine).find(Boolean);
  return Boolean(firstLine && LOT_DOCUMENT_HEADER.test(firstLine));
}

/**
 * Recognizes only complete, standalone list headings. This is deliberately
 * narrower than a keyword search: a product line or a warranty note must not
 * acquire document authority merely because it contains "novo" or "lacrado".
 */
export function hasStructuredSupplierDocumentHeading(rawText: string) {
  return rawText.split(/\r?\n/).map(normalizeHeading).some(isStructuredDocumentHeading);
}

export function extractSupplierDocumentBoundary(rawText: string): SupplierDocumentBoundary {
  const lines = rawText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const firstOfferLineIndex = lines.findIndex((line) => OFFER_MARKER.test(line));

  if (firstOfferLineIndex === -1) {
    return { preambleLines: lines, sectionLines: [], firstOfferLineIndex: null };
  }

  return {
    // The first offer line can carry an inline document marker, such as
    // "SWAP - iPhone 15 Pro ... R$ ...".
    preambleLines: lines.slice(0, firstOfferLineIndex + 1),
    sectionLines: lines.slice(firstOfferLineIndex + 1),
    firstOfferLineIndex,
  };
}

export function resolveSupplierSnapshotScope(
  rawText: string,
  items: readonly ParsedSupplierListItem[],
  supplierContactId?: string,
): SupplierSnapshotScopeResolution {
  const supplierPolicy = supplierContactId ? getSupplierListPolicy(supplierContactId) : null;
  const boundary = extractSupplierDocumentBoundary(rawText);
  const preambleText = boundary.preambleLines.join('\n');
  const sectionText = boundary.sectionLines.join('\n');
  const hasStructuredDocumentPreamble = hasStructuredSupplierDocumentHeading(preambleText);
  const preambleMarkers = markersIn(
    preambleText,
    supplierPolicy?.requireDocumentHeader !== false && hasLotDocumentHeader(rawText),
  );
  const sectionMarkers = markersIn(sectionText);
  const conditions = [...new Set(items.map((item) => item.condition).filter(isKnownCondition))];
  const conditionProvenances = [
    ...new Set(items.map((item) => item.conditionProvenance).filter(isConditionProvenance)),
  ];
  const categoryCount = new Set(items.map((item) => item.category).filter(Boolean)).size;
  const evidence: SupplierSnapshotScopeEvidence = {
    preambleMarkers,
    sectionMarkers,
    conditions,
    conditionProvenances,
    categoryCount,
  };
  const hasUsedPreamble = preambleMarkers.includes('used');
  const hasPrimaryPreamble = preambleMarkers.includes('primary');
  const hasGeneralPreamble = preambleMarkers.includes('general');
  const allUsed =
    conditions.length > 0 && conditions.every((condition) => condition === 'SEMINOVO');
  const hasUsedItems = conditions.includes('SEMINOVO');
  const hasPrimaryItems =
    conditions.some((condition) => condition === 'NOVO' || condition === 'CPO') ||
    (hasPrimarySegmentBeforeUsedSection(rawText) &&
      !hasStructuredWarrantyDocumentHeading(preambleText));
  const hasOnlyExplicitUsedItems =
    hasUsedItems &&
    items
      .filter((item) => item.condition === 'SEMINOVO')
      .every((item) => item.conditionProvenance === 'EXPLICIT_PRODUCT');
  const isBroadMixedDocument = categoryCount >= 2 && hasUsedItems && hasPrimaryItems;

  if (hasUsedPreamble && hasPrimaryPreamble) return ambiguous(evidence);
  if (hasUsedPreamble) {
    if (allUsed) return resolved('used', 'explicit_used_preamble', evidence);
    if (isBroadMixedDocument && sectionMarkers.includes('primary')) {
      return resolved('general', 'broad_mixed_document', evidence);
    }
    return ambiguous(evidence);
  }

  if (hasPrimaryPreamble) {
    if (!hasUsedItems) return resolved('primary', 'explicit_primary_preamble', evidence);
    if (hasOnlyExplicitUsedItems) {
      return resolvedPrimaryWithIsolatedUsedItems(evidence);
    }
    if (isBroadMixedDocument && sectionMarkers.includes('used')) {
      return resolved('general', 'broad_mixed_document', evidence);
    }
    return ambiguous(evidence);
  }

  // A conditionless warranty section is not a primary segment. It can still
  // prove that the following explicit used section belongs to a structured
  // document, so only that used segment is safe to merge.
  if (
    hasStructuredDocumentPreamble &&
    sectionMarkers.includes('used') &&
    hasUsedItems &&
    !hasPrimaryItems
  ) {
    return resolvedDocumentWithIsolatedUsedItems(evidence);
  }

  if (
    hasGeneralPreamble &&
    !hasUsedPreamble &&
    !hasPrimaryPreamble &&
    isBroadDocument(items, categoryCount)
  ) {
    return resolved('general', 'general_document_marker', evidence);
  }

  if (isBroadMixedDocument && sectionMarkers.includes('used')) {
    return resolved('general', 'broad_mixed_document', evidence);
  }

  if (
    supplierPolicy?.requireDocumentHeader === false &&
    items.length > 0 &&
    items.every((item) => isKnownCondition(item.condition))
  ) {
    if (conditions.every((condition) => condition === 'SEMINOVO')) {
      return resolved('used', 'supplier_policy_content', evidence);
    }
    if (conditions.every((condition) => condition === 'NOVO' || condition === 'CPO')) {
      return resolved('primary', 'supplier_policy_content', evidence);
    }
    if (hasPrimaryItems && hasOnlyExplicitUsedItems) {
      return {
        status: 'RESOLVED',
        scopeKey: 'catalog:primary',
        identity: { kind: 'catalog', segment: 'primary' },
        reason: 'supplier_policy_content',
        evidence,
        segmentAuthorities: {
          primary: 'FULL_SNAPSHOT',
          used: 'ISOLATED_EXPLICIT_ITEMS',
        },
      };
    }
  }

  return {
    status: 'UNKNOWN',
    reason: 'insufficient_document_evidence',
    evidence,
    segmentAuthorities: noSegmentAuthorities(),
  };
}

function resolved(
  segment: SupplierDocumentIdentity['segment'],
  reason: SupplierSnapshotScopeReason,
  evidence: SupplierSnapshotScopeEvidence,
): SupplierSnapshotScopeResolution {
  return {
    status: 'RESOLVED',
    scopeKey: `catalog:${segment}`,
    identity: { kind: 'catalog', segment },
    reason,
    evidence,
    segmentAuthorities: segmentAuthoritiesFor(segment, reason),
  };
}

function resolvedPrimaryWithIsolatedUsedItems(
  evidence: SupplierSnapshotScopeEvidence,
): SupplierSnapshotScopeResolution {
  return {
    status: 'RESOLVED',
    scopeKey: 'catalog:primary',
    identity: { kind: 'catalog', segment: 'primary' },
    reason: 'explicit_primary_preamble',
    evidence,
    segmentAuthorities: {
      primary: 'FULL_SNAPSHOT',
      used: 'ISOLATED_EXPLICIT_ITEMS',
    },
  };
}

function resolvedDocumentWithIsolatedUsedItems(
  evidence: SupplierSnapshotScopeEvidence,
): SupplierSnapshotScopeResolution {
  return {
    status: 'RESOLVED',
    scopeKey: 'catalog:general',
    identity: { kind: 'catalog', segment: 'general' },
    reason: 'general_document_marker',
    evidence,
    segmentAuthorities: {
      primary: 'NONE',
      used: 'ISOLATED_EXPLICIT_ITEMS',
    },
  };
}

function ambiguous(evidence: SupplierSnapshotScopeEvidence): SupplierSnapshotScopeResolution {
  return {
    status: 'AMBIGUOUS',
    reason: 'conflicting_document_evidence',
    evidence,
    segmentAuthorities: noSegmentAuthorities(),
  };
}

function segmentAuthoritiesFor(
  segment: SupplierDocumentIdentity['segment'],
  reason: SupplierSnapshotScopeReason,
): SupplierSnapshotSegmentAuthorities {
  if (segment === 'primary') return { primary: 'FULL_SNAPSHOT', used: 'NONE' };
  if (segment === 'used') return { primary: 'NONE', used: 'FULL_SNAPSHOT' };
  if (reason === 'broad_mixed_document') {
    return { primary: 'FULL_SNAPSHOT', used: 'FULL_SNAPSHOT' };
  }
  return noSegmentAuthorities();
}

function noSegmentAuthorities(): SupplierSnapshotSegmentAuthorities {
  return { primary: 'NONE', used: 'NONE' };
}

function isBroadDocument(items: readonly ParsedSupplierListItem[], categoryCount: number) {
  const conditions = new Set(items.map((item) => item.condition).filter(isKnownCondition));
  return items.length >= 2 && (categoryCount >= 2 || conditions.size >= 2);
}

function markersIn(text: string, hasLotHeader = false) {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const markers: string[] = [];
  if (USED_MARKER.test(normalized)) markers.push('used');
  if (PRIMARY_MARKER.test(normalized) || hasStructuredPrimaryHeading(normalized)) {
    markers.push('primary');
  }
  if (
    GENERAL_MARKER.test(normalized) ||
    hasLotHeader ||
    normalized.split(/\r?\n/).map(normalizeHeading).some(isStructuredDocumentHeading)
  ) {
    markers.push('general');
  }
  return markers;
}

function hasStructuredPrimaryHeading(text: string) {
  return text
    .split(/\r?\n/)
    .map(normalizeHeading)
    .some((line) => STRUCTURED_PRIMARY_HEADINGS.has(line));
}

function hasStructuredWarrantyDocumentHeading(text: string) {
  return text
    .split(/\r?\n/)
    .map(normalizeHeading)
    .some((line) => STRUCTURED_WARRANTY_DOCUMENT_HEADINGS.has(line));
}

function isStructuredDocumentHeading(value: string) {
  return (
    STRUCTURED_PRIMARY_HEADINGS.has(value) ||
    STRUCTURED_WARRANTY_DOCUMENT_HEADINGS.has(value) ||
    STRUCTURED_USED_HEADING.test(value)
  );
}

function normalizeHeading(value: string) {
  return cleanLine(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F]/gu, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}

function hasPrimarySegmentBeforeUsedSection(rawText: string) {
  const lines = rawText.split(/\r?\n/).map(cleanLine).filter(Boolean);
  const firstUsedSectionIndex = lines.findIndex((line) => USED_MARKER.test(line));
  return (
    firstUsedSectionIndex > 0 &&
    lines.slice(0, firstUsedSectionIndex).some((line) => OFFER_MARKER.test(line))
  );
}

function cleanLine(value: string) {
  return value.replace(/[*_~]/g, '').trim();
}

function isKnownCondition(value: string | null): value is 'NOVO' | 'CPO' | 'SEMINOVO' {
  return value === 'NOVO' || value === 'CPO' || value === 'SEMINOVO';
}

function isConditionProvenance(
  value: SupplierConditionProvenance | null | undefined,
): value is SupplierConditionProvenance {
  return Boolean(value);
}
