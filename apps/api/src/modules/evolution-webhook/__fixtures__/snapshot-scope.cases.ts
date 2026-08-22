import type {
  SupplierSnapshotScopeKey,
  SupplierSnapshotScopeReason,
  SupplierSnapshotScopeStatus,
} from '../supplier-snapshot-scope';

export interface SupplierSnapshotScopeCase {
  id: string;
  rawText: string;
  expected: {
    status: SupplierSnapshotScopeStatus;
    scopeKey?: SupplierSnapshotScopeKey;
    reason: SupplierSnapshotScopeReason;
  };
}

export const supplierSnapshotScopeCases: readonly SupplierSnapshotScopeCase[] = [
  {
    id: 'scope-used-standalone-001',
    rawText: `LISTA SEMINOVOS AMERICANOS ATUALIZADA
SWAP SEMINOVOS AMERICANOS
iPhone 16 128GB
Preto R$ 3.500
iPhone 15 128GB
Azul R$ 3.000`,
    expected: { status: 'RESOLVED', scopeKey: 'catalog:used', reason: 'explicit_used_preamble' },
  },
  {
    id: 'scope-used-standalone-002',
    rawText: `IPHONE SWAP AMERICANOS
17 Pro 256GB
Preto R$ 5.000
16 Pro 128GB
Azul R$ 3.900`,
    expected: { status: 'RESOLVED', scopeKey: 'catalog:used', reason: 'explicit_used_preamble' },
  },
  {
    id: 'scope-primary-lacrados-cpo-001',
    rawText: `LISTA APPLE LACRADOS
iPhone 17 256GB
Preto R$ 4.800
CPO
iPhone 16 Pro 256GB
Azul R$ 4.100`,
    expected: {
      status: 'RESOLVED',
      scopeKey: 'catalog:primary',
      reason: 'explicit_primary_preamble',
    },
  },
  {
    id: 'scope-general-unified-001',
    rawText: `LISTA UNIFICADA
iPhone 17 256GB
Preto R$ 4.800
CPO
iPad 11 128GB
Azul R$ 2.500`,
    expected: {
      status: 'RESOLVED',
      scopeKey: 'catalog:general',
      reason: 'general_document_marker',
    },
  },
  {
    id: 'scope-general-swap-section-001',
    rawText: `LISTA GERAL
iPhone 17 256GB
Azul R$ 4.800
LISTA-SWAP
iPhone 15 128GB
Preto R$ 3.000
CPO
iPad 11 128GB
Azul R$ 2.500`,
    expected: {
      status: 'RESOLVED',
      scopeKey: 'catalog:general',
      reason: 'general_document_marker',
    },
  },
  {
    id: 'scope-general-used-preamble-with-later-primary-001',
    rawText: `LISTA-SWAP
iPhone 15 128GB
Preto R$ 3.000
IPHONES LACRADOS
iPhone 17 256GB
Azul R$ 4.800
CPO
iPad 11 128GB
Azul R$ 2.500
MacBook Air M5 16GB 512GB
Prata R$ 8.000`,
    expected: {
      status: 'RESOLVED',
      scopeKey: 'catalog:general',
      reason: 'broad_mixed_document',
    },
  },
  {
    id: 'scope-general-internal-swap-001',
    rawText: `LISTA DE PREÇOS
Garmin Alpha 300
Preto R$ 3.500
MacBook Air M5 16GB 512GB
Prata R$ 8.000
IPHONE SWAP
iPhone 15 128GB
Azul R$ 3.000`,
    expected: {
      status: 'RESOLVED',
      scopeKey: 'catalog:general',
      reason: 'general_document_marker',
    },
  },
  {
    id: 'scope-general-mixed-sections-001',
    rawText: `CATALOGO ATUALIZADO
MacBook Air M5 16GB 512GB
Prata R$ 8.000
iPad 11 128GB
Azul R$ 2.500
SEMI NOVO AMERICANO
iPhone 15 128GB
Preto R$ 3.000`,
    expected: { status: 'RESOLVED', scopeKey: 'catalog:general', reason: 'broad_mixed_document' },
  },
  {
    id: 'scope-general-multifamily-001',
    rawText: `LISTA IPHONE IPHONE CPO APPLEWATCH IPADS MACBOOKS E ACESSORIOS LACRADOS
LISTA UNIFICADA
iPhone 17 256GB
Preto R$ 4.800
Apple Watch Series 11 46mm
Preto R$ 2.500
iPad 11 128GB
Azul R$ 2.500`,
    expected: {
      status: 'RESOLVED',
      scopeKey: 'catalog:primary',
      reason: 'explicit_primary_preamble',
    },
  },
  {
    id: 'scope-general-daily-001',
    rawText: `LISTA DIARIA
APARELHOS NOVOS LACRADOS
iPhone 17 256GB
Preto R$ 4.800
CPO
iPad 11 128GB
Azul R$ 2.500
MacBook Air M5 16GB 512GB
Prata R$ 8.000`,
    expected: {
      status: 'RESOLVED',
      scopeKey: 'catalog:primary',
      reason: 'explicit_primary_preamble',
    },
  },
  {
    id: 'scope-general-title-family-does-not-scope-001',
    rawText: `ATUALIZACAO IPHONE
iPhone 17 256GB
Preto R$ 4.800
Apple Watch Series 11 46mm
Preto R$ 2.500
iPad 11 128GB
Azul R$ 2.500`,
    expected: {
      status: 'RESOLVED',
      scopeKey: 'catalog:general',
      reason: 'general_document_marker',
    },
  },
  {
    id: 'scope-conflicting-used-preamble-001',
    rawText: `SEMINOVOS AMERICANOS
IPHONES LACRADOS
iPhone 17 256GB
Preto R$ 4.800`,
    expected: { status: 'AMBIGUOUS', reason: 'conflicting_document_evidence' },
  },
  {
    id: 'scope-unknown-insufficient-001',
    rawText: `OFERTA DISPONIVEL
iPhone 17 256GB
Preto R$ 4.800`,
    expected: { status: 'UNKNOWN', reason: 'insufficient_document_evidence' },
  },
  {
    id: 'scope-partial-used-explicit-001',
    rawText: `SWAP - iPhone 15 Pro 256GB
Preto R$ 3.800`,
    expected: { status: 'RESOLVED', scopeKey: 'catalog:used', reason: 'explicit_used_preamble' },
  },
  {
    id: 'scope-partial-unknown-001',
    rawText: `iPhone 15 Pro 256GB baixou
Preto R$ 3.800`,
    expected: { status: 'UNKNOWN', reason: 'insufficient_document_evidence' },
  },
];
