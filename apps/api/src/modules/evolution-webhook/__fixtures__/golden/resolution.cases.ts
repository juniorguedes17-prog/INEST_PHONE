import { defineGoldenCases, goldenCatalogProduct } from './golden.types';

const airpodsCatalogProduct = (id: string, productDescription: string, profitCondition = 'NOVO') => ({
  id,
  productDescription,
  productType: 'AIRPODS',
  profitCondition,
  variantAttributes: null,
  category: { name: 'AirPods' },
  model: { name: productDescription },
  color: null,
  storage: null,
});

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
  {
    id: 'resolution-airpods-max-001',
    rule: 'AirPods Max remains generation 1',
    input: { rawText: 'AirPods Max R$ 1.500' },
    catalog: [airpodsCatalogProduct('airpods-max-1-new', 'AirPods Max')],
    expected: {
      identities: [{ itemIndex: 0, canonicalModelKey: 'airpods-max', canonicalCondition: 'Novo' }],
      resolutions: [
        { itemIndex: 0, status: 'FOUND', candidateCount: 1, productKey: 'airpods-max-1-new' },
      ],
    },
  },
  {
    id: 'resolution-airpods-max-usbc-001',
    rule: 'AirPods Max USB-C remains generation 1 without borrowing an unconfigured variant',
    input: { rawText: 'AirPods Max USB-C R$ 1.500' },
    catalog: [airpodsCatalogProduct('airpods-max-1-new', 'AirPods Max')],
    expected: {
      identities: [{ itemIndex: 0, canonicalModelKey: 'airpods-max', canonicalCondition: 'Novo' }],
      resolutions: [
        { itemIndex: 0, status: 'MISSING', reason: 'catalog_no_match', candidateCount: 0 },
      ],
    },
  },
  {
    id: 'resolution-airpods-max-2-001',
    rule: 'AirPods Max 2 does not collapse into generation 1',
    input: { rawText: 'AirPods Max 2 A3452 R$ 1.500' },
    catalog: [
      airpodsCatalogProduct('airpods-max-1-new', 'AirPods Max'),
      airpodsCatalogProduct('airpods-max-2-new', 'AirPods Max 2'),
    ],
    expected: {
      identities: [{ itemIndex: 0, canonicalModelKey: 'airpods-max-2', canonicalCondition: 'Novo' }],
      resolutions: [
        { itemIndex: 0, status: 'FOUND', candidateCount: 1, productKey: 'airpods-max-2-new' },
      ],
    },
  },
  {
    id: 'resolution-airpods-max-2-cpo-001',
    rule: 'AirPods Max 2 CPO never matches the NOVO product',
    input: { rawText: 'CPO\nAirPods Max 2 Typo C 2026 R$ 1.500' },
    catalog: [airpodsCatalogProduct('airpods-max-2-new', 'AirPods Max 2')],
    expected: {
      identities: [{ itemIndex: 0, canonicalModelKey: 'airpods-max-2', canonicalCondition: 'CPO' }],
      resolutions: [
        { itemIndex: 0, status: 'MISSING', reason: 'catalog_no_match', candidateCount: 0 },
      ],
    },
  },
  {
    id: 'resolution-airpods-max-unknown-model-number-001',
    rule: 'Unknown AirPods Max model number has no identity authority',
    input: { rawText: 'A3452 R$ 1.500' },
    expected: {
      itemCount: 0,
    },
  },
] as const);
