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
});
