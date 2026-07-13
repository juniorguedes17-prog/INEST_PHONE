import {
  GoogleSheetsCustomer,
  GoogleSheetsSaleRecord,
} from '../../integrations/interfaces/google-sheets-data.interface';

export interface DashboardChartPoint {
  label: string;
  value: number;
}

export interface DashboardSheetCharts {
  monthlyUnits: DashboardChartPoint[];
  monthlyRevenue: DashboardChartPoint[];
  monthlyProfit: DashboardChartPoint[];
  revenueByCity: DashboardChartPoint[];
  customersByOrigin: DashboardChartPoint[];
}

export function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

export function monthKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

export function dayKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function isToday(value?: Date) {
  if (!value) {
    return false;
  }
  return dayKey(value) === dayKey(new Date());
}

export function buildSheetCharts(
  records: GoogleSheetsSaleRecord[],
  customers: GoogleSheetsCustomer[],
): DashboardSheetCharts {
  const monthlyUnits = new Map<string, number>();
  const monthlyRevenue = new Map<string, number>();
  const monthlyProfit = new Map<string, number>();
  const revenueByCity = new Map<string, number>();

  records.forEach((record) => {
    const month = sheetMonthKey(record.data_venda);
    if (month) {
      addToGroup(monthlyUnits, month, sheetNumber(record.quantidade_vendida));
      addToGroup(monthlyRevenue, month, sheetNumber(record.receita_venda_real));
      addToGroup(monthlyProfit, month, sheetNumber(record.lucro_real));
    }

    const city = record.cliente_cidade.trim();
    if (city) addToGroup(revenueByCity, city, sheetNumber(record.receita_venda_real));
  });

  const customersByOrigin = new Map<string, number>();
  customers.forEach((customer) => {
    addToGroup(customersByOrigin, customer.origin.trim() || 'Nao informado', 1);
  });

  return {
    monthlyUnits: sortedMonths(monthlyUnits),
    monthlyRevenue: sortedMonths(monthlyRevenue),
    monthlyProfit: sortedMonths(monthlyProfit),
    revenueByCity: sortedValues(revenueByCity).slice(0, 10),
    customersByOrigin: sortedValues(customersByOrigin),
  };
}

function sheetNumber(value: string) {
  const clean = value.replace(/[^0-9,.-]/g, '');
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sheetMonthKey(value: string) {
  if (!value) return null;
  const brazilianDate = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (brazilianDate) return `${brazilianDate[3]}-${brazilianDate[2]}`;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function addToGroup(group: Map<string, number>, key: string, value: number) {
  group.set(key, (group.get(key) ?? 0) + value);
}

function sortedMonths(group: Map<string, number>): DashboardChartPoint[] {
  return Array.from(group, ([label, value]) => ({ label, value })).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

function sortedValues(group: Map<string, number>): DashboardChartPoint[] {
  return Array.from(group, ([label, value]) => ({ label, value })).sort(
    (a, b) => b.value - a.value || a.label.localeCompare(b.label),
  );
}
