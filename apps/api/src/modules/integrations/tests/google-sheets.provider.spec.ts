import { describe, expect, it } from 'vitest';
import { GOOGLE_SHEETS_HEADERS } from '../interfaces/google-sheets-data.interface';
import { buildGoogleSheetsSnapshot, mapSheetValues } from '../providers/google-sheets.provider';

describe('GoogleSheetsProvider mapping', () => {
  it('mapeia valores pelos nomes dos cabecalhos mesmo quando reordenados', () => {
    const headers = [...GOOGLE_SHEETS_HEADERS].reverse();
    const row = headers.map((header) => header === 'cliente_nome' ? 'Maria' : header === 'receita_venda_real' ? 'R$ 1.250,50' : header === 'quantidade_vendida' ? '2' : header === 'data_venda' ? '10/07/2026' : '');
    const records = mapSheetValues([headers, row]);
    expect(records[0]!.cliente_nome).toBe('Maria');
    expect(records[0]!.receita_venda_real).toBe('R$ 1.250,50');
    const snapshot = buildGoogleSheetsSnapshot(records, '2026-07-12T12:00:00.000Z');
    expect(snapshot.metrics.totalCustomers).toBe(1);
    expect(snapshot.metrics.totalRevenue).toBe(1250.5);
    expect(snapshot.metrics.productsSold).toBe(2);
  });

  it('informa cabecalhos obrigatorios ausentes', () => {
    expect(() => mapSheetValues([['cliente_nome'], ['Maria']])).toThrow('Cabecalhos obrigatorios ausentes');
  });

  it('aceita os aliases da planilha oficial e separa cidade e UF', () => {
    const officialHeaders: string[] = [
      ...GOOGLE_SHEETS_HEADERS.filter(
        (header) =>
          !['categoria_produto', 'produto_codigo', 'cliente_cidade', 'cliente_uf'].includes(header),
      ),
      'codigo',
      'cliente_cidade_uf',
    ];
    const row = officialHeaders.map((header) =>
      header === 'codigo' ? '13128GB' : header === 'cliente_cidade_uf' ? 'Telemaco Borba-PR' : '',
    );

    const [record] = mapSheetValues([officialHeaders, row]);

    expect(record!.categoria_produto).toBe('');
    expect(record!.produto_codigo).toBe('13128GB');
    expect(record!.cliente_cidade).toBe('Telemaco Borba');
    expect(record!.cliente_uf).toBe('PR');
  });
});
