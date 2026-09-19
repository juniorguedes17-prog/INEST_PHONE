import { describe, expect, it } from 'vitest';
import { supplierSnapshotScopeCases } from './__fixtures__/snapshot-scope.cases';
import {
  extractSupplierDocumentBoundary,
  resolveSupplierSnapshotScope,
} from './supplier-snapshot-scope';
import { parseSupplierListText } from './supplier-list.parser';

describe('supplier snapshot scope shadow', () => {
  it.each(supplierSnapshotScopeCases)('[SCOPE] $id', ({ rawText, expected }) => {
    const resolution = resolveSupplierSnapshotScope(rawText, parseSupplierListText(rawText));
    expect(resolution).toMatchObject(expected);
  });

  it('mantem SWAP posterior como marcador de secao, nao de preambulo', () => {
    const boundary = extractSupplierDocumentBoundary(`LISTA GERAL
iPhone 17 256GB
Preto R$ 4.800
IPHONE SWAP
iPhone 15 128GB
Azul R$ 3.000`);

    expect(boundary.preambleLines.join('\n')).not.toContain('SWAP');
    expect(boundary.sectionLines.join('\n')).toContain('SWAP');
  });

  it.each([
    ['Lote 9821 ABC', 'iPhone 17 256GB\nPreto R$ 4.600\nAirPods Pro 3\nR$ 1.100'],
    ['Lote 55 XYZ', 'iPhone 17 Pro 256GB\nAzul R$ 6.200\niPad 11 128GB\nPrata R$ 2.450'],
  ])('resolve cabecalho documental dinamico %s', (header, offers) => {
    const rawText = `${header}\n${offers}`;

    expect(resolveSupplierSnapshotScope(rawText, parseSupplierListText(rawText))).toMatchObject({
      status: 'RESOLVED',
      scopeKey: 'catalog:general',
      reason: 'general_document_marker',
      evidence: { preambleMarkers: ['general'] },
    });
  });

  it.each([
    'Temos lote disponível hoje',
    'Último lote de iPhone disponível',
    'Lote promocional',
    'Chegou lote novo, me chama',
    'iPhone 17 256GB\nEsse lote está disponível\nPreto R$ 4.600',
  ])('nao considera texto comercial com lote como cabecalho documental: %s', (header) => {
    const rawText = `${header}\niPhone 17 256GB\nPreto R$ 4.600`;

    expect(resolveSupplierSnapshotScope(rawText, parseSupplierListText(rawText))).toMatchObject({
      status: 'UNKNOWN',
      reason: 'insufficient_document_evidence',
    });
  });
});
