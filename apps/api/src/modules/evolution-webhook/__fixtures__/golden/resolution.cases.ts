import { defineGoldenCases, goldenCatalogProduct } from './golden.types';

export const resolutionCases = defineGoldenCases([
  {
    id: 'resolution-found-001',
    rule: 'P2.1 exactly one catalog candidate',
    originCommit: '1924ca0',
    input: { rawText: 'iPhone 17 Air 256GB\nBlack R$ 4.500' },
    catalog: [goldenCatalogProduct('iphone-17-air-256-new', 'iPhone 17 Air 256GB')],
    expected: {
      resolutions: [
        { itemIndex: 0, status: 'FOUND', candidateCount: 1, productKey: 'iphone-17-air-256-new' },
      ],
    },
  },
  {
    id: 'resolution-identity-insufficient-001',
    rule: 'P2.1 missing required MacBook screen',
    originCommit: '1924ca0',
    input: { rawText: 'MacBook Neo 8/512\nSilver R$ 4.500' },
    catalog: [],
    expected: {
      identities: [{ itemIndex: 0, canonicalScreen: null }],
      resolutions: [
        {
          itemIndex: 0,
          status: 'MISSING',
          reason: 'identity_insufficient',
          candidateCount: 0,
        },
      ],
    },
  },
  {
    id: 'resolution-catalog-no-match-001',
    rule: 'P2.1 complete identity with empty catalog',
    originCommit: '1924ca0',
    input: { rawText: 'iPhone 17 Air 256GB\nBlack R$ 4.500' },
    catalog: [],
    expected: {
      resolutions: [
        { itemIndex: 0, status: 'MISSING', reason: 'catalog_no_match', candidateCount: 0 },
      ],
    },
  },
  {
    id: 'resolution-ambiguous-001',
    rule: 'P2.1 multiple equivalent catalog candidates',
    originCommit: '1924ca0',
    input: { rawText: 'iPhone 17 Air 256GB\nBlack R$ 4.500' },
    catalog: [
      goldenCatalogProduct('iphone-17-air-256-a', 'iPhone 17 Air 256GB'),
      goldenCatalogProduct('iphone-17-air-256-b', 'iPhone 17 Air 256GB'),
    ],
    expected: {
      resolutions: [
        {
          itemIndex: 0,
          status: 'AMBIGUOUS',
          reason: 'multiple_catalog_candidates',
          candidateCount: 2,
        },
      ],
    },
  },
] as const);
