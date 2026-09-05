import type { ParsedSupplierListItem } from './evolution-webhook.types';

export type SupplierSnapshotScopeKey = 'catalog:used' | 'catalog:primary' | 'catalog:general';
export type SupplierSnapshotScopeStatus = 'RESOLVED' | 'AMBIGUOUS' | 'UNKNOWN';
export type SupplierSnapshotScopeReason =
  | 'explicit_used_preamble'
  | 'explicit_primary_preamble'
  | 'general_document_marker'
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
  categoryCount: number;
}

export interface SupplierSnapshotScopeResolution {
  status: SupplierSnapshotScopeStatus;
  scopeKey?: SupplierSnapshotScopeKey;
  identity?: SupplierDocumentIdentity;
  reason: SupplierSnapshotScopeReason;
  evidence: SupplierSnapshotScopeEvidence;
}

const USED_MARKER = /\b(?:lista[-\s]*)?swap\b|\bsemi\s*novos?\b|\bseminovos?\b/i;
const PRIMARY_MARKER = /\b(?:lacrad[oa]s?|aparelhos\s+novos?|iphones?\s+novos?|sealed)\b/i;
const GENERAL_MARKER =
  /\b(?:lista\s+(?:unificada|geral|diaria|de\s+precos|atualizada|completa)|tabela\s+de\s+precos|atualizacao)\b/i;
const OFFER_MARKER = /(?:r\$|\$r|\$)\s*\d/i;

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
): SupplierSnapshotScopeResolution {
  const boundary = extractSupplierDocumentBoundary(rawText);
  const preambleText = boundary.preambleLines.join('\n');
  const sectionText = boundary.sectionLines.join('\n');
  const preambleMarkers = markersIn(preambleText);
  const sectionMarkers = markersIn(sectionText);
  const conditions = [...new Set(items.map((item) => item.condition).filter(isKnownCondition))];
  const categoryCount = new Set(items.map((item) => item.category).filter(Boolean)).size;
  const evidence: SupplierSnapshotScopeEvidence = {
    preambleMarkers,
    sectionMarkers,
    conditions,
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
    hasPrimarySegmentBeforeUsedSection(rawText);
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
    return ambiguous(evidence);
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

  return { status: 'UNKNOWN', reason: 'insufficient_document_evidence', evidence };
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
  };
}

function ambiguous(evidence: SupplierSnapshotScopeEvidence): SupplierSnapshotScopeResolution {
  return { status: 'AMBIGUOUS', reason: 'conflicting_document_evidence', evidence };
}

function isBroadDocument(items: readonly ParsedSupplierListItem[], categoryCount: number) {
  const conditions = new Set(items.map((item) => item.condition).filter(isKnownCondition));
  return items.length >= 2 && (categoryCount >= 2 || conditions.size >= 2);
}

function markersIn(text: string) {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const markers: string[] = [];
  if (USED_MARKER.test(normalized)) markers.push('used');
  if (PRIMARY_MARKER.test(normalized)) markers.push('primary');
  if (GENERAL_MARKER.test(normalized)) markers.push('general');
  return markers;
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
