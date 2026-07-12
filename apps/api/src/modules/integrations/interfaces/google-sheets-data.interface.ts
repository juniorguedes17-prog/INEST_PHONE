export const GOOGLE_SHEETS_HEADERS = [
  'venda_item_id',
  'data_aquisicao',
  'data_venda',
  'dias_em_estoque',
  'competencia_venda',
  'categoria_produto',
  'condicao_produto',
  'produto_codigo',
  'produto_descricao',
  'produto_modelo',
  'capacidade',
  'cor',
  'fornecedor_nome',
  'custo_produto',
  'custo_impostos_juros',
  'custo_frete_seguro',
  'custo_brinde',
  'custo_garantia_nota',
  'custo_capinha_pelicula',
  'custo_brinde_extra',
  'custo_embalagem',
  'custo_trafego',
  'quantidade_comprada',
  'custo_total',
  'preco_venda_previsto',
  'quantidade_vendida',
  'receita_venda_real',
  'lucro_real',
  'margem_lucro_percentual',
  'cliente_nome',
  'cliente_cpf',
  'cliente_endereco',
  'cliente_complemento',
  'cliente_cidade',
  'cliente_uf',
  'cliente_telefone',
  'cliente_email',
  'cliente_origem',
  'imei_1',
] as const;

export type GoogleSheetsHeader = (typeof GOOGLE_SHEETS_HEADERS)[number];
export type GoogleSheetsSaleRecord = Record<GoogleSheetsHeader, string>;

export interface GoogleSheetsCustomer {
  id: string;
  name: string;
  cpf: string;
  address: string;
  complement: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  origin: string;
  salesCount: number;
  productsSold: number;
  totalRevenue: number;
  lastSale: string | null;
}

export interface GoogleSheetsMetrics {
  totalCustomers: number;
  totalSales: number;
  totalRevenue: number;
  totalProfit: number;
  averageTicket: number;
  productsSold: number;
  lastSale: string | null;
  lastSync: string;
}

export interface GoogleSheetsSnapshot {
  records: GoogleSheetsSaleRecord[];
  customers: GoogleSheetsCustomer[];
  metrics: GoogleSheetsMetrics;
}
