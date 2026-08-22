import { defineGoldenCases } from './golden.types';

const yearCase = (id: string, header: string) => ({
  id,
  rule: 'P1.1 year header remains contextual',
  originCommit: '8952ed9',
  input: {
    rawText: `MACBOOK LACRADOS
${header}
MacBook Air M5 13 512GB
Silver R$ 4.500`,
  },
  expected: {
    itemCount: 1,
    parsedItems: [
      {
        itemIndex: 0,
        productName: 'MacBook Air M5 13 512GB',
        category: 'MacBook',
        condition: 'NOVO',
      },
    ],
  },
});

export const contextCases = defineGoldenCases([
  yearCase('context-year-header-2024-001', 'ANO 2024'),
  yearCase('context-year-header-2025-001', 'Ano: 2025'),
  yearCase('context-year-header-2026-001', 'ano - 2026'),
  {
    id: 'context-year-in-product-001',
    rule: 'P1.1 year inside valid product remains product text',
    originCommit: '8952ed9',
    input: { rawText: 'Apple Watch Ultra 3 2024\nBlack R$ 1.000' },
    expected: {
      parsedItems: [
        { itemIndex: 0, productName: 'Apple Watch Ultra 3 2024', category: 'Apple Watch' },
      ],
    },
  },
  {
    id: 'context-category-header-001',
    rule: 'P1.1 category header updates context without becoming product',
    originCommit: '8952ed9',
    input: { rawText: 'GARMIN\nGarmin Alpha 300\nBlack R$ 1.000' },
    expected: {
      itemCount: 1,
      parsedItems: [{ itemIndex: 0, productName: 'Garmin Alpha 300', category: 'Garmin' }],
    },
  },
  {
    id: 'context-condition-header-001',
    rule: 'P1.1 condition header is context, not a product',
    originCommit: '8952ed9',
    input: { rawText: 'APARELHOS CPO\niPhone 16 128GB\nPreto R$ 3.500' },
    expected: {
      itemCount: 1,
      parsedItems: [{ itemIndex: 0, productName: 'iPhone 16 128GB', condition: 'CPO' }],
    },
  },
] as const);
