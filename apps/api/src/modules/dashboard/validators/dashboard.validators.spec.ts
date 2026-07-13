import { describe, expect, it } from 'vitest';
import {
  GoogleSheetsCustomer,
  GoogleSheetsSaleRecord,
} from '../../integrations/interfaces/google-sheets-data.interface';
import { buildSheetCharts } from './dashboard.validators';

const emptyRecord = (): GoogleSheetsSaleRecord =>
  new Proxy({} as GoogleSheetsSaleRecord, {
    get: (target, property: string) => target[property as keyof GoogleSheetsSaleRecord] ?? '',
  });

describe('buildSheetCharts', () => {
  it('agrupa indicadores mensais e interpreta valores brasileiros', () => {
    const january = emptyRecord();
    Object.assign(january, {
      data_venda: '15/01/2026',
      quantidade_vendida: '2',
      receita_venda_real: 'R$ 3.500,50',
      lucro_real: 'R$ 700,10',
      cliente_cidade: 'Sao Paulo',
    });
    const february = emptyRecord();
    Object.assign(february, {
      data_venda: '2026-02-10',
      quantidade_vendida: '1',
      receita_venda_real: '1000.25',
      lucro_real: '200.50',
      cliente_cidade: 'Campinas',
    });

    const result = buildSheetCharts([february, january], []);

    expect(result.monthlyUnits).toEqual([
      { label: '2026-01', value: 2 },
      { label: '2026-02', value: 1 },
    ]);
    expect(result.monthlyRevenue[0]).toEqual({ label: '2026-01', value: 3500.5 });
    expect(result.monthlyProfit[1]).toEqual({ label: '2026-02', value: 200.5 });
  });

  it('ordena cidades e conta clientes unicos por origem', () => {
    const records = ['Santos', 'Sao Paulo', 'Santos'].map((city, index) => {
      const record = emptyRecord();
      Object.assign(record, {
        cliente_cidade: city,
        receita_venda_real: index === 1 ? '500' : '400',
      });
      return record;
    });
    const customers = [
      { origin: 'Instagram' },
      { origin: 'Indicacao' },
      { origin: 'Instagram' },
      { origin: '' },
    ] as GoogleSheetsCustomer[];

    const result = buildSheetCharts(records, customers);

    expect(result.revenueByCity).toEqual([
      { label: 'Santos', value: 800 },
      { label: 'Sao Paulo', value: 500 },
    ]);
    expect(result.customersByOrigin).toEqual([
      { label: 'Instagram', value: 2 },
      { label: 'Indicacao', value: 1 },
      { label: 'Nao informado', value: 1 },
    ]);
  });
});
