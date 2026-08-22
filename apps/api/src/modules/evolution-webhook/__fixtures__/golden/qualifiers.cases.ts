import { defineGoldenCases, goldenCatalogProduct } from './golden.types';

const catalog = [goldenCatalogProduct('iphone-17-pro-256-new', 'iPhone 17 Pro 256GB')];

export const qualifierCases = defineGoldenCases([
  {
    id: 'qualifier-lla-001',
    rule: 'P1.4 LL/A remains outside the base financial identity',
    originCommit: 'd198858',
    input: { rawText: 'iPhone 17 Pro 256GB LL/A\nBlack R$ 4.500' },
    catalog,
    expected: {
      identities: [
        {
          itemIndex: 0,
          canonicalModelKey: 'iphone-17-pro',
          canonicalStorage: '256GB',
          canonicalCondition: 'Novo',
        },
      ],
      resolutions: [
        { itemIndex: 0, status: 'FOUND', candidateCount: 1, productKey: 'iphone-17-pro-256-new' },
      ],
    },
  },
  {
    id: 'qualifier-hna-001',
    rule: 'P1.4 HN/A remains outside the base financial identity',
    originCommit: 'd198858',
    input: { rawText: 'iPhone 17 Pro 256GB HN/A\nBlack R$ 4.500' },
    catalog,
    expected: {
      identities: [{ itemIndex: 0, canonicalModelKey: 'iphone-17-pro', canonicalStorage: '256GB' }],
      resolutions: [
        { itemIndex: 0, status: 'FOUND', candidateCount: 1, productKey: 'iphone-17-pro-256-new' },
      ],
    },
  },
  {
    id: 'qualifier-esim-001',
    rule: 'P1.4 eSIM preserves the existing financial identity behavior',
    originCommit: 'd198858',
    input: { rawText: 'iPhone 17 Pro 256GB eSIM\nBlack R$ 4.500' },
    catalog,
    expected: {
      identities: [{ itemIndex: 0, canonicalModelKey: 'iphone-17-pro', canonicalStorage: '256GB' }],
      resolutions: [
        { itemIndex: 0, status: 'FOUND', candidateCount: 1, productKey: 'iphone-17-pro-256-new' },
      ],
    },
  },
] as const);
