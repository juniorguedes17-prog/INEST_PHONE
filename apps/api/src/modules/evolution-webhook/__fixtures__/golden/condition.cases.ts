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
  {
    id: 'condition-grade-a-001',
    rule: 'P0.1C eligible Grade A is a used offer',
    input: { rawText: 'iPhone 15 128GB\nGrade A - R$ 2.100' },
    expected: {
      itemCount: 1,
      parsedItems: [{ itemIndex: 0, condition: 'SEMINOVO', qualityGrade: 'A' }],
    },
  },
  {
    id: 'condition-grade-a-plus-001',
    rule: 'P0.1C eligible Grade A+ is a used offer',
    input: { rawText: 'iPhone 15 128GB\nGrade A+ - R$ 2.200' },
    expected: {
      itemCount: 1,
      parsedItems: [{ itemIndex: 0, condition: 'SEMINOVO', qualityGrade: 'A+' }],
    },
  },
  {
    id: 'condition-detached-grade-context-001',
    rule: 'P0.1C detached eligible grade qualifies the preceding product offer',
    input: { rawText: 'iPhone 14 128GB (J/A)\nGrade A+\nPreto R$ 1.820' },
    expected: {
      itemCount: 1,
      parsedItems: [
        {
          itemIndex: 0,
          normalizedName: 'iphone 14 128gb j a',
          capacity: '128GB',
          color: 'preto',
          condition: 'SEMINOVO',
          qualityGrade: 'A+',
          price: 1820,
        },
      ],
    },
  },
  {
    id: 'condition-grade-ab-discarded-001',
    rule: 'P0.1C Grade AB remains operationally ineligible',
    input: { rawText: 'iPhone 15 128GB\nGrade AB - R$ 2.100' },
    expected: { itemCount: 0 },
  },
  {
    id: 'condition-grade-b-discarded-001',
    rule: 'P0.1C Grade B remains operationally ineligible',
    input: { rawText: 'iPhone 15 128GB\nGrade B - R$ 2.100' },
    expected: { itemCount: 0 },
  },
  {
    id: 'condition-grade-c-discarded-001',
    rule: 'P0.1C Grade C remains operationally ineligible',
    input: { rawText: 'iPhone 15 128GB\nGrade C - R$ 2.100' },
    expected: { itemCount: 0 },
  },
  {
    id: 'condition-grade-lote-novo-001',
    rule: 'P0.1C logistic LOTE NOVO cannot override an eligible grade',
    input: { rawText: 'LOTE NOVO\niPhone 15 128GB\nGrade A - R$ 2.100' },
    expected: {
      itemCount: 1,
      parsedItems: [{ itemIndex: 0, condition: 'SEMINOVO', qualityGrade: 'A' }],
    },
  },
  {
    id: 'condition-grade-novo-lote-001',
    rule: 'P0.1C logistic NOVO LOTE cannot override an eligible grade',
    input: { rawText: 'NOVO LOTE\niPhone 15 128GB\nGrade A - R$ 2.100' },
    expected: {
      itemCount: 1,
      parsedItems: [{ itemIndex: 0, condition: 'SEMINOVO', qualityGrade: 'A' }],
    },
  },
  {
    id: 'condition-grade-novo-estoque-001',
    rule: 'P0.1C logistic NOVO ESTOQUE cannot override an eligible grade',
    input: { rawText: 'NOVO ESTOQUE\niPhone 15 128GB\nGrade A - R$ 2.100' },
    expected: {
      itemCount: 1,
      parsedItems: [{ itemIndex: 0, condition: 'SEMINOVO', qualityGrade: 'A' }],
    },
  },
  {
    id: 'condition-grade-estoque-novo-001',
    rule: 'P0.1C logistic ESTOQUE NOVO cannot override an eligible grade',
    input: { rawText: 'ESTOQUE NOVO\niPhone 15 128GB\nGrade A - R$ 2.100' },
    expected: {
      itemCount: 1,
      parsedItems: [{ itemIndex: 0, condition: 'SEMINOVO', qualityGrade: 'A' }],
    },
  },
  {
    id: 'condition-swap-lote-novo-001',
    rule: 'P0.1C logistic LOTE NOVO preserves SWAP context',
    input: { rawText: 'LISTA SWAP\nLOTE NOVO\niPhone 15 128GB\nPreto R$ 3.000' },
    expected: {
      itemCount: 1,
      parsedItems: [{ itemIndex: 0, condition: 'SEMINOVO', qualityGrade: null }],
    },
  },
  {
    id: 'condition-cpo-lote-novo-001',
    rule: 'P0.1C logistic LOTE NOVO preserves CPO context',
    input: { rawText: 'CPO\nLOTE NOVO\niPhone 15 128GB\nPreto R$ 3.000' },
    expected: {
      itemCount: 1,
      parsedItems: [{ itemIndex: 0, condition: 'CPO', qualityGrade: null }],
    },
  },
  {
    id: 'condition-cpo-grade-a-001',
    rule: 'P0.1C eligible grade overrides CPO only for the graded offer',
    input: { rawText: 'CPO\niPhone 15 128GB\nGrade A - R$ 2.100' },
    expected: {
      itemCount: 1,
      parsedItems: [{ itemIndex: 0, condition: 'SEMINOVO', qualityGrade: 'A' }],
    },
  },
  {
    id: 'condition-novos-lacrados-no-grade-001',
    rule: 'P0.1C legitimate NOVO context remains NOVO without a grade',
    input: { rawText: 'NOVOS LACRADOS\niPhone 15 128GB\nPreto R$ 3.000' },
    expected: {
      itemCount: 1,
      parsedItems: [{ itemIndex: 0, condition: 'NOVO', qualityGrade: null }],
    },
  },
  {
    id: 'condition-grades-a-a-plus-coexist-001',
    rule: 'P0.1C A and A+ are separate eligible offers',
    input: {
      rawText: 'iPhone 15 128GB\nGrade A - R$ 2.100\nGrade A+ - R$ 2.200',
    },
    expected: {
      itemCount: 2,
      parsedItems: [
        { itemIndex: 0, condition: 'SEMINOVO', qualityGrade: 'A' },
        { itemIndex: 1, condition: 'SEMINOVO', qualityGrade: 'A+' },
      ],
    },
  },
  {
    id: 'condition-no-grade-null-001',
    rule: 'P0.1C ungraded offers preserve a null quality grade',
    input: { rawText: 'LISTA SWAP\niPhone 15 128GB\nPreto R$ 3.000' },
    expected: {
      itemCount: 1,
      parsedItems: [{ itemIndex: 0, condition: 'SEMINOVO', qualityGrade: null }],
    },
  },
  {
    id: 'condition-swap-nova-lista-001',
    rule: 'P0.1C NOVA LISTA remains non-destructive within SWAP context',
    input: { rawText: 'LISTA SWAP\nNOVA LISTA\niPhone 15 128GB\nPreto R$ 3.000' },
    expected: { itemCount: 1, parsedItems: [{ itemIndex: 0, condition: 'SEMINOVO' }] },
  },
  {
    id: 'condition-cpo-nova-remessa-001',
    rule: 'P0.1C NOVA REMESSA remains non-destructive within CPO context',
    input: { rawText: 'CPO\nNOVA REMESSA\niPhone 15 128GB\nPreto R$ 3.000' },
    expected: { itemCount: 1, parsedItems: [{ itemIndex: 0, condition: 'CPO' }] },
  },
  {
    id: 'condition-grade-real-stock-lote-001',
    rule: 'P0.1C sanitized graded stock list preserves only eligible Grade A offers',
    input: {
      rawText: `ATUALIZACAO DE ESTOQUE - LOTE NOVO
Grades A | AB | B
iPhone 15 128GB
Grade A - R$ 2.155
Grade AB - R$ 2.120
Grade B - R$ 2.075
iPhone 16 Pro 128GB
Grade A - R$ 3.825
Grade AB - R$ 3.790
Grade B - R$ 3.755`,
    },
    expected: {
      itemCount: 2,
      parsedItems: [
        { itemIndex: 0, condition: 'SEMINOVO', qualityGrade: 'A', price: 2155 },
        { itemIndex: 1, condition: 'SEMINOVO', qualityGrade: 'A', price: 3825 },
      ],
    },
  },
] as const);
