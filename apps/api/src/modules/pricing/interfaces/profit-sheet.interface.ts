export const PROFIT_SHEET_HEADERS = [
  'produto_id',
  'condicao_produto',
  'produto_descricao',
  'lucro_liquido',
] as const;

export type ProfitSheetHeader = (typeof PROFIT_SHEET_HEADERS)[number];
export type ProfitCondition = 'NOVO' | 'SEMINOVO' | 'CPO';

export interface ProfitSheetRecord {
  productId: string;
  condition: ProfitCondition;
  productDescription: string;
  normalizedDescription: string;
  netProfit: number;
}

export interface ProfitSheetCatalog {
  records: ProfitSheetRecord[];
  fetchedAt: string;
}

export type ProfitLookupResult =
  | { status: 'found'; record: ProfitSheetRecord }
  | { status: 'not_found' }
  | { status: 'duplicate'; records: ProfitSheetRecord[] };
