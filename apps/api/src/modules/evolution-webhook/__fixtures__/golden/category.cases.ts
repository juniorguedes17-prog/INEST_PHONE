import { defineGoldenCases } from './golden.types';

const quote = (productName: string) => `${productName}\nBlack R$ 1.000`;

export const categoryCases = defineGoldenCases([
  {
    id: 'category-iphone-001',
    rule: 'existing Apple category',
    input: { rawText: quote('iPhone 17 Pro 256GB') },
    expected: { parsedItems: [{ itemIndex: 0, category: 'iPhone' }] },
  },
  {
    id: 'category-ipad-001',
    rule: 'existing Apple category',
    input: { rawText: quote('iPad Pro M5 11 256GB') },
    expected: { parsedItems: [{ itemIndex: 0, category: 'iPad' }] },
  },
  {
    id: 'category-macbook-001',
    rule: 'existing Apple category',
    input: { rawText: quote('MacBook Air M5 13 16GB 512GB') },
    expected: { parsedItems: [{ itemIndex: 0, category: 'MacBook' }] },
  },
  {
    id: 'category-apple-watch-001',
    rule: 'existing Apple category',
    input: { rawText: quote('Apple Watch SE 3 GPS 40mm') },
    expected: { parsedItems: [{ itemIndex: 0, category: 'Apple Watch' }] },
  },
  {
    id: 'category-fones-airpods-001',
    rule: 'P0.2 structured Fones category',
    originCommit: '62880da',
    input: { rawText: quote('AirPods Pro 3') },
    expected: { parsedItems: [{ itemIndex: 0, category: 'Fones' }] },
  },
  {
    id: 'category-garmin-alpha-001',
    rule: 'P0.3 explicit Garmin brand',
    originCommit: '242a06c',
    input: { rawText: quote('Garmin Alpha 300') },
    expected: { parsedItems: [{ itemIndex: 0, category: 'Garmin' }] },
  },
  {
    id: 'category-garmin-not-electronics-001',
    rule: 'P0.3 Garmin precedence over Eletronicos',
    originCommit: '242a06c',
    input: { rawText: quote('Garmin Fenix 8') },
    expected: { parsedItems: [{ itemIndex: 0, category: 'Garmin' }] },
  },
  {
    id: 'category-electronics-xiaomi-001',
    rule: 'P0.4 explicit Xiaomi brand',
    originCommit: 'aacc0f0',
    input: { rawText: quote('Xiaomi Redmi Pad') },
    expected: { parsedItems: [{ itemIndex: 0, category: 'Eletronicos' }] },
  },
  {
    id: 'category-electronics-samsung-001',
    rule: 'P0.4 explicit Samsung brand',
    originCommit: 'aacc0f0',
    input: { rawText: quote('Samsung Galaxy S25') },
    expected: { parsedItems: [{ itemIndex: 0, category: 'Eletronicos' }] },
  },
  {
    id: 'category-electronics-tecno-001',
    rule: 'P0.4 explicit Tecno brand',
    originCommit: 'aacc0f0',
    input: { rawText: quote('Tecno Spark') },
    expected: { parsedItems: [{ itemIndex: 0, category: 'Eletronicos' }] },
  },
  {
    id: 'category-electronics-jbl-001',
    rule: 'P0.4 explicit JBL brand',
    originCommit: 'aacc0f0',
    input: { rawText: quote('JBL Flip 6') },
    expected: { parsedItems: [{ itemIndex: 0, category: 'Eletronicos' }] },
  },
  {
    id: 'category-unknown-not-electronics-001',
    rule: 'P0.4 no fallback category',
    originCommit: 'aacc0f0',
    input: { rawText: 'Produto XYZ 512GB\nBlack R$ 900' },
    expected: { parsedItems: [{ itemIndex: 0, category: null, capacity: '512GB' }] },
  },
] as const);
