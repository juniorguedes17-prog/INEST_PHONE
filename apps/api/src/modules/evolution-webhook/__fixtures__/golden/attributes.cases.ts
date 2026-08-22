import { defineGoldenCases } from './golden.types';

const iphoneStorage = (id: string, token: string, expectedStorage: string) => ({
  id,
  rule: 'P1.3 storage equivalent representation',
  originCommit: 'f86c62c',
  input: { rawText: `iPhone 17 Pro ${token}\nBlack R$ 4.500` },
  expected: {
    identities: [{ itemIndex: 0, canonicalStorage: expectedStorage, canonicalCategory: 'iPhone' }],
  },
});

export const attributeCases = defineGoldenCases([
  iphoneStorage('attribute-storage-bare-64-001', '64', '64GB'),
  iphoneStorage('attribute-storage-unit-64-001', '64GB', '64GB'),
  iphoneStorage('attribute-storage-spaced-64-001', '64 GB', '64GB'),
  iphoneStorage('attribute-storage-bare-128-001', '128', '128GB'),
  iphoneStorage('attribute-storage-unit-128-001', '128GB', '128GB'),
  iphoneStorage('attribute-storage-spaced-128-001', '128 GB', '128GB'),
  iphoneStorage('attribute-storage-bare-256-001', '256', '256GB'),
  iphoneStorage('attribute-storage-unit-256-001', '256GB', '256GB'),
  iphoneStorage('attribute-storage-spaced-256-001', '256 GB', '256GB'),
  iphoneStorage('attribute-storage-bare-512-001', '512', '512GB'),
  iphoneStorage('attribute-storage-unit-512-001', '512GB', '512GB'),
  iphoneStorage('attribute-storage-spaced-512-001', '512 GB', '512GB'),
  iphoneStorage('attribute-storage-terabyte-spaced-001', '1 TB', '1TB'),
  {
    id: 'attribute-ram-prefix-001',
    rule: 'P1.2 deterministic RAM normalization',
    originCommit: '4d78cca',
    input: { rawText: 'MacBook Neo A18 Pro 13" RAM 8GB 256GB\nSilver R$ 4.500' },
    expected: {
      identities: [
        {
          itemIndex: 0,
          canonicalModelKey: 'macbook-neo-13',
          canonicalRam: '8GB',
          canonicalStorage: '256GB',
          canonicalScreen: '13"',
          canonicalChip: 'A18 Pro',
        },
      ],
    },
  },
  {
    id: 'attribute-ram-suffix-001',
    rule: 'P1.2 deterministic RAM normalization',
    originCommit: '4d78cca',
    input: { rawText: 'MacBook Neo A18 Pro 13 8GB RAM 256GB\nSilver R$ 4.500' },
    expected: { identities: [{ itemIndex: 0, canonicalRam: '8GB', canonicalStorage: '256GB' }] },
  },
  {
    id: 'attribute-ram-compact-001',
    rule: 'P1.2 deterministic RAM normalization',
    originCommit: '4d78cca',
    input: { rawText: 'MacBook Neo A18 Pro 13 8RAM 256GB\nSilver R$ 4.500' },
    expected: { identities: [{ itemIndex: 0, canonicalRam: '8GB', canonicalStorage: '256GB' }] },
  },
  {
    id: 'attribute-mac-compact-8-256-001',
    rule: 'P1.2 family-aware compact memory',
    originCommit: '4d78cca',
    input: { rawText: 'MacBook Neo A18 Pro 13 8/256\nSilver R$ 4.500' },
    expected: { identities: [{ itemIndex: 0, canonicalRam: '8GB', canonicalStorage: '256GB' }] },
  },
  {
    id: 'attribute-mac-compact-spaced-001',
    rule: 'P1.2 family-aware compact memory',
    originCommit: '4d78cca',
    input: { rawText: 'MacBook Neo A18 Pro 13 8 / 256\nSilver R$ 4.500' },
    expected: { identities: [{ itemIndex: 0, canonicalRam: '8GB', canonicalStorage: '256GB' }] },
  },
  {
    id: 'attribute-mac-compact-units-001',
    rule: 'P1.2 family-aware compact memory',
    originCommit: '4d78cca',
    input: { rawText: 'MacBook Neo A18 Pro 13 8GB / 256GB\nSilver R$ 4.500' },
    expected: { identities: [{ itemIndex: 0, canonicalRam: '8GB', canonicalStorage: '256GB' }] },
  },
  {
    id: 'attribute-mac-compact-16-512-001',
    rule: 'P1.2 family-aware compact memory',
    originCommit: '4d78cca',
    input: { rawText: 'MacBook Air M5 15 16/512\nSilver R$ 4.500' },
    expected: {
      identities: [
        {
          itemIndex: 0,
          canonicalModelKey: 'macbook-air-m5-15',
          canonicalRam: '16GB',
          canonicalStorage: '512GB',
          canonicalScreen: '15"',
          canonicalChip: 'M5',
        },
      ],
    },
  },
  {
    id: 'attribute-mac-ram-8g-001',
    rule: 'P1.3 supported abbreviated Mac RAM',
    originCommit: 'f86c62c',
    input: { rawText: 'MacBook Neo A18 Pro 13" 8G 512\nSilver R$ 4.500' },
    expected: {
      identities: [
        {
          itemIndex: 0,
          canonicalModelKey: 'macbook-neo-13',
          canonicalRam: '8GB',
          canonicalStorage: '512GB',
          canonicalScreen: '13"',
        },
      ],
    },
  },
  {
    id: 'attribute-iphone-compact-protected-001',
    rule: 'P1.2 compact Mac rule does not apply to iPhone',
    originCommit: '4d78cca',
    input: { rawText: 'iPhone 17 8/256GB\nBlack R$ 4.500' },
    expected: { identities: [{ itemIndex: 0, canonicalRam: null, canonicalStorage: null }] },
  },
  {
    id: 'attribute-screen-order-001',
    rule: 'P1.2 attributes work independently of position',
    originCommit: '4d78cca',
    input: { rawText: 'MacBook Neo A18 Pro 8/256GB 13”\nSilver R$ 4.500' },
    expected: {
      identities: [
        {
          itemIndex: 0,
          canonicalModelKey: 'macbook-neo-13',
          canonicalScreen: '13"',
          canonicalRam: '8GB',
          canonicalStorage: '256GB',
        },
      ],
    },
  },
  {
    id: 'attribute-screen-double-prime-001',
    rule: 'P1.3 supported double-prime screen representation',
    originCommit: 'f86c62c',
    input: { rawText: 'MacBook Neo A18 Pro 8/256GB 13″\nSilver R$ 4.500' },
    expected: {
      identities: [
        {
          itemIndex: 0,
          canonicalModelKey: 'macbook-neo-13',
          canonicalScreen: '13"',
          canonicalRam: '8GB',
          canonicalStorage: '256GB',
        },
      ],
    },
  },
  {
    id: 'attribute-memory-conflict-001',
    rule: 'P1.2 fail-closed attribute conflict',
    originCommit: '4d78cca',
    input: { rawText: 'iPhone 17 Pro 256GB 512GB\nBlack R$ 4.500' },
    expected: { identities: [{ itemIndex: 0, canonicalStorage: null }] },
  },
] as const);
