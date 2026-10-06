import { describe, expect, it } from 'vitest';
import { supplierSnapshotScopeCases } from './__fixtures__/snapshot-scope.cases';
import {
  extractSupplierDocumentBoundary,
  hasStructuredSupplierDocumentHeading,
  resolveSupplierSnapshotScope,
} from './supplier-snapshot-scope';
import { parseSupplierListText } from './supplier-list.parser';

describe('supplier snapshot scope shadow', () => {
  it.each(supplierSnapshotScopeCases)('[SCOPE] $id', ({ rawText, expected }) => {
    const resolution = resolveSupplierSnapshotScope(rawText, parseSupplierListText(rawText));
    expect(resolution).toMatchObject(expected);
  });

  it('reconhece headings universais completos sem vinculo a supplierContactId', () => {
    expect(
      hasStructuredSupplierDocumentHeading(`
        APARELHOS LACRADOS
        iPhone 17 Pro 256GB
        Preto R$ 6.000
      `),
    ).toBe(true);
    expect(hasStructuredSupplierDocumentHeading('iPhone 17 lacrado R$ 6.000')).toBe(false);
    expect(hasStructuredSupplierDocumentHeading('Garantia Apple para todos os produtos')).toBe(
      false,
    );
  });

  it('autoriza primary e isola a excecao explicita seminova de heading lacrado', () => {
    const rawText = `APARELHOS LACRADOS
iPhone 17 Pro 256GB
Preto R$ 6.000
MacBook Air M5 16GB/512GB OPEN BOX
Prata R$ 7.000`;
    const resolution = resolveSupplierSnapshotScope(rawText, parseSupplierListText(rawText));

    expect(resolution).toMatchObject({
      status: 'RESOLVED',
      scopeKey: 'catalog:primary',
      reason: 'explicit_primary_preamble',
      segmentAuthorities: { primary: 'FULL_SNAPSHOT', used: 'ISOLATED_EXPLICIT_ITEMS' },
    });
  });

  it('autoriza somente o segmento usado apos heading documental de garantia', () => {
    const rawText = `APARELHOS GARANTIA APPLE
iPhone 17 Pro 512GB
Preto R$ 7.000
IPHONE SEMINOVOS
iPhone 16 Pro 256GB
Azul R$ 5.000`;
    const items = parseSupplierListText(rawText);
    const resolution = resolveSupplierSnapshotScope(rawText, items);

    expect(items.map((item) => item.condition)).toEqual([null, 'SEMINOVO']);
    expect(resolution).toMatchObject({
      status: 'RESOLVED',
      scopeKey: 'catalog:general',
      reason: 'general_document_marker',
      segmentAuthorities: { primary: 'NONE', used: 'ISOLATED_EXPLICIT_ITEMS' },
    });
  });

  it('autoriza snapshots completos para secoes estruturais usadas e primarias', () => {
    const rawText = `MACBOOK SEMINOVOS
MacBook Pro M3 16GB/512GB
Prata R$ 6.000
IPADS SEMINOVOS
iPad Air M2 128GB
Azul R$ 3.500
DIVERSOS NOVOS
DJI Mini 4 Pro R$ 4.000`;
    const resolution = resolveSupplierSnapshotScope(rawText, parseSupplierListText(rawText));

    expect(resolution).toMatchObject({
      status: 'RESOLVED',
      scopeKey: 'catalog:general',
      reason: 'broad_mixed_document',
      segmentAuthorities: { primary: 'FULL_SNAPSHOT', used: 'FULL_SNAPSHOT' },
    });
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

  it('transporta provenance de contexto de secao sem alterar o scope', () => {
    const rawText = `LISTA SWAP
iPhone 15 128GB
Preto R$ 3.000`;

    expect(resolveSupplierSnapshotScope(rawText, parseSupplierListText(rawText))).toMatchObject({
      status: 'RESOLVED',
      scopeKey: 'catalog:used',
      reason: 'explicit_used_preamble',
      evidence: { conditionProvenances: ['SECTION_CONTEXT'] },
    });
  });

  it('autoriza primary pela policy sem transformar seminovo explícito isolado em snapshot used', () => {
    const items = [
      ...parseSupplierListText(`iPhone 16 128GB\nPreto R$ 4.000`).map((item) => ({
        ...item,
        condition: 'NOVO' as const,
        conditionProvenance: 'POLICY_DEFAULT' as const,
      })),
      ...parseSupplierListText(`iPhone 15 AS IS 128GB\nBlack R$ 2.500`),
    ];

    expect(
      resolveSupplierSnapshotScope(
        'Produtos disponíveis no estoque\niPhone 16 128GB\nPreto R$ 4.000\niPhone 15 AS IS 128GB\nBlack R$ 2.500',
        items,
        'd8782850-f5de-14cc-1406-ae1a0ee70b06',
      ),
    ).toMatchObject({
      status: 'RESOLVED',
      scopeKey: 'catalog:primary',
      reason: 'supplier_policy_content',
      segmentAuthorities: {
        primary: 'FULL_SNAPSHOT',
        used: 'ISOLATED_EXPLICIT_ITEMS',
      },
    });
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
