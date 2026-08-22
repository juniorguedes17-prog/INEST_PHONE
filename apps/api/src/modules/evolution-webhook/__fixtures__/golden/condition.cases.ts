import { defineGoldenCases } from './golden.types';

export const conditionCases = defineGoldenCases([
  {
    id: 'condition-novo-explicit-001',
    rule: 'P0.1A explicit NOVO',
    originCommit: 'b508392',
    input: { rawText: 'NOVO\niPhone 16 128GB\nPreto R$ 3.500' },
    expected: { parsedItems: [{ itemIndex: 0, condition: 'NOVO' }] },
  },
  {
    id: 'condition-cpo-explicit-001',
    rule: 'P0.1A explicit CPO',
    originCommit: 'b508392',
    input: { rawText: 'CPO\niPhone 16 Pro 256GB\nPreto R$ 4.950' },
    expected: { parsedItems: [{ itemIndex: 0, condition: 'CPO' }] },
  },
  {
    id: 'condition-seminovo-explicit-001',
    rule: 'P0.1A explicit SEMINOVO',
    originCommit: 'b508392',
    input: { rawText: 'SEMINOVO\niPhone 15 128GB\nAzul R$ 3.000' },
    expected: { parsedItems: [{ itemIndex: 0, condition: 'SEMINOVO' }] },
  },
  {
    id: 'condition-seminovos-header-001',
    rule: 'P0.1A SEMINOVOS context',
    originCommit: 'b508392',
    input: { rawText: 'SEMINOVOS\niPhone 16 128GB\nPreto R$ 3.500' },
    expected: { parsedItems: [{ itemIndex: 0, condition: 'SEMINOVO' }] },
  },
  {
    id: 'condition-semi-novos-001',
    rule: 'P0.1A plural SEMI NOVOS context',
    originCommit: 'b508392',
    input: {
      rawText: `IPHONES SEMI NOVOS - bateria 85% - 100%
iPhone 16 Pro 256GB
Preto R$ 4.500
iPhone 15 128GB
Azul R$ 3.500`,
    },
    expected: {
      itemCount: 2,
      parsedItems: [
        { itemIndex: 0, condition: 'SEMINOVO' },
        { itemIndex: 1, condition: 'SEMINOVO' },
      ],
    },
  },
  {
    id: 'condition-swap-header-001',
    rule: 'P0.1A LISTA SWAP context',
    originCommit: 'b508392',
    input: { rawText: 'LISTA-SWAP\niPhone 15 128GB\nPreto R$ 3.000' },
    expected: { parsedItems: [{ itemIndex: 0, condition: 'SEMINOVO' }] },
  },
  {
    id: 'condition-swap-inline-001',
    rule: 'P0.1A SWAP inline',
    originCommit: 'b508392',
    input: { rawText: 'iPhone 15 256GB SWAP\nPreto R$ 3.000' },
    expected: { parsedItems: [{ itemIndex: 0, condition: 'SEMINOVO' }] },
  },
  {
    id: 'condition-cpo-to-lacrados-001',
    rule: 'P0.1A explicit section replacement',
    originCommit: 'b508392',
    input: {
      rawText: `APARELHOS CPO
iPhone 14 Pro 256GB
Preto R$ 3.500
IPHONES LACRADOS
iPhone 16 128GB
Branco R$ 4.000`,
    },
    expected: {
      itemCount: 2,
      parsedItems: [
        { itemIndex: 0, condition: 'CPO' },
        { itemIndex: 1, condition: 'NOVO' },
      ],
    },
  },
  {
    id: 'condition-cpo-no-leak-001',
    rule: 'P0.1A CPO does not leak past NOVO section',
    originCommit: 'b508392',
    input: {
      rawText: `APARELHOS CPO
iPhone 14 Pro 256GB
Preto R$ 3.500
IPHONES NOVOS
iPhone 16 128GB
Branco R$ 4.000
iPad 11 128GB
Azul R$ 2.500`,
    },
    expected: {
      itemCount: 3,
      parsedItems: [
        { itemIndex: 0, condition: 'CPO' },
        { itemIndex: 1, condition: 'NOVO' },
        { itemIndex: 2, condition: 'NOVO' },
      ],
    },
  },
  {
    id: 'condition-cpo-novo-lacrado-001',
    rule: 'P0.1A descriptive NOVO does not reset CPO context',
    originCommit: 'b508392',
    input: {
      rawText: `APARELHOS CPO
Recondicionado pela apple
Novo lacrado e com garantia apple
iPhone 15 Pro 256GB
Preto R$ 3.500`,
    },
    expected: { itemCount: 1, parsedItems: [{ itemIndex: 0, condition: 'CPO' }] },
  },
] as const);
