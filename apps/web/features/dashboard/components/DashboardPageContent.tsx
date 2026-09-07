'use client';

import { useMemo, useState } from 'react';
import {
  EmptyState,
  ErrorState,
  KpiCard,
  LoadingState,
  PageHeader,
  PageSection,
} from '@/components/shared';
import { useDashboard } from '../hooks/useDashboard';
import { DashboardToolbar } from './DashboardToolbar';
import {
  CityBarChart,
  DashboardChartCard,
  MonthlyBarChart,
  MonthlyLineChart,
  OriginDonutChart,
} from './DashboardCharts';

const EMPTY_CHARTS = {
  monthlyUnits: [],
  monthlyRevenue: [],
  monthlyProfit: [],
  revenueByCity: [],
  customersByOrigin: [],
};

const chartOptions = [
  ['all', 'Todos os gráficos'],
  ['units', 'Quantidade de aparelhos vendidos por mês'],
  ['revenue', 'Receita bruta por mês'],
  ['profit', 'Lucro líquido por mês'],
  ['city', 'Valor vendido por cidade'],
  ['origin', 'Origem dos clientes'],
] as const;

type ChartType = (typeof chartOptions)[number][0];

export function DashboardPageContent() {
  const dashboard = useDashboard();
  const data = dashboard.data;
  const charts = data?.sheetCharts ?? EMPTY_CHARTS;
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedChart, setSelectedChart] = useState<ChartType>('all');
  const availablePeriods = data?.sheetChartPeriods ?? [];
  const availableYears = useMemo(
    () =>
      Array.from(new Set(availablePeriods.map((period) => period.slice(0, 4))))
        .sort()
        .reverse(),
    [availablePeriods],
  );
  const availableMonths = useMemo(
    () =>
      Array.from(
        new Set(
          availablePeriods
            .filter((period) => period.startsWith(`${selectedYear}-`))
            .map((period) => period.slice(5, 7)),
        ),
      ).sort(),
    [availablePeriods, selectedYear],
  );
  const lastUpdated = data?.sheet.lastSync
    ? formatDateTime(data.sheet.lastSync)
    : 'Aguardando sincronização';
  return (
    <div className="grid min-w-0 gap-5 overflow-x-hidden sm:gap-4">
      <PageHeader
        eyebrow="Operação comercial"
        title="Dashboard"
        description="Indicadores operacionais oficiais sincronizados com o Google Sheets."
      />
      <DashboardToolbar
        loading={dashboard.loading || dashboard.syncing}
        lastUpdated={lastUpdated}
        onRefresh={dashboard.sync}
      />
      {dashboard.error ? (
        <ErrorState title="Falha na fonte de dados" description={dashboard.error} />
      ) : null}
      {dashboard.loading && !data ? <LoadingState /> : null}
      {!dashboard.loading && !data ? (
        <EmptyState
          title="Sem dados para exibir"
          description="Sincronize a planilha para carregar os indicadores operacionais."
        />
      ) : null}
      {data ? (
        <PageSection
          className="gap-3 sm:gap-4"
          title="Resumo operacional"
          description="Dados calculados exclusivamente a partir da planilha oficial."
        >
          <div
            className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4"
            aria-label="Indicadores do Google Sheets"
          >
            <KpiCard
              label="Total de clientes"
              value={formatNumber(data.sheet.totalCustomers)}
              tone="blue"
              mobileCompact
              className="min-h-[104px] px-3 py-3 sm:min-h-[116px] sm:px-5 sm:py-4"
            />
            <KpiCard
              label="Total de vendas"
              value={formatNumber(data.sheet.totalSales)}
              tone="green"
              mobileCompact
              className="min-h-[104px] px-3 py-3 sm:min-h-[116px] sm:px-5 sm:py-4"
            />
            <KpiCard
              label="Receita total"
              value={formatCurrency(data.sheet.totalRevenue)}
              tone="purple"
              mobileCompact
              className="min-h-[104px] px-3 py-3 sm:min-h-[116px] sm:px-5 sm:py-4"
            />
            <KpiCard
              label="Lucro total"
              value={formatCurrency(data.sheet.totalProfit)}
              tone="green"
              mobileCompact
              className="min-h-[104px] px-3 py-3 sm:min-h-[116px] sm:px-5 sm:py-4"
            />
            <KpiCard
              label="Ticket médio"
              value={formatCurrency(data.sheet.averageTicket)}
              tone="amber"
              mobileCompact
              className="min-h-[104px] px-3 py-3 sm:min-h-[116px] sm:px-5 sm:py-4"
            />
            <KpiCard
              label="Produtos vendidos"
              value={formatNumber(data.sheet.productsSold)}
              tone="blue"
              mobileCompact
              className="min-h-[104px] px-3 py-3 sm:min-h-[116px] sm:px-5 sm:py-4"
            />
            <KpiCard
              label="Última venda"
              value={formatDate(data.sheet.lastSale)}
              tone="purple"
              mobileCompact
              className="min-h-[104px] px-3 py-3 sm:min-h-[116px] sm:px-5 sm:py-4"
            />
            <KpiCard
              label="Última sincronização"
              value={lastUpdated}
              tone="amber"
              mobileCompact
              className="min-h-[104px] px-3 py-3 sm:min-h-[116px] sm:px-5 sm:py-4"
            />
          </div>
        </PageSection>
      ) : null}
      {data ? (
        <PageSection
          className="gap-3 sm:gap-4"
          title="Evolução das vendas"
          description="Indicadores atualizados a partir do mesmo snapshot sincronizado."
        >
          <div className="grid min-w-0 gap-4">
            <div
              className="flex flex-wrap items-end gap-3 rounded-xl border border-inest-line bg-inest-surface p-4"
              aria-label="Filtros dos gráficos"
            >
              <label className="grid gap-1.5 text-sm font-bold text-inest-muted">
                Ano
                <select
                  aria-label="Ano do período"
                  value={selectedYear}
                  onChange={(event) => {
                    const year = event.target.value;
                    setSelectedYear(year);
                    setSelectedMonth('');
                    if (dashboard.filters.startDate || dashboard.filters.endDate) {
                      dashboard.setFilters((current) => ({
                        ...current,
                        startDate: '',
                        endDate: '',
                      }));
                    }
                  }}
                  className="field-control min-w-40"
                >
                  <option value="">Todos os anos</option>
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-bold text-inest-muted">
                Mês
                <select
                  aria-label="Mês do período"
                  value={selectedMonth}
                  disabled={!selectedYear}
                  onChange={(event) => {
                    const month = event.target.value;
                    setSelectedMonth(month);
                    if (!selectedYear || !month) {
                      if (dashboard.filters.startDate || dashboard.filters.endDate) {
                        dashboard.setFilters((current) => ({
                          ...current,
                          startDate: '',
                          endDate: '',
                        }));
                      }
                      return;
                    }
                    const { startDate, endDate } = getMonthRange(selectedYear, month);
                    dashboard.setFilters((current) => ({ ...current, startDate, endDate }));
                  }}
                  className="field-control min-w-44"
                >
                  <option value="">Todos os meses</option>
                  {availableMonths.map((month) => (
                    <option key={month} value={month}>
                      {formatMonthOption(month)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-72 gap-1.5 text-sm font-bold text-inest-muted">
                Tipo de gráfico
                <select
                  aria-label="Tipo de gráfico"
                  value={selectedChart}
                  onChange={(event) => setSelectedChart(event.target.value as ChartType)}
                  className="field-control"
                >
                  {chartOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {showsChart(selectedChart, 'units') ? (
              <DashboardChartCard
                title="Quantidade de aparelhos vendidos por mês"
                description="Total de unidades vendidas em cada mês."
              >
                <MonthlyBarChart
                  data={charts.monthlyUnits}
                  title="Quantidade de aparelhos vendidos por mês"
                />
              </DashboardChartCard>
            ) : null}
            {showsChart(selectedChart, 'revenue') ? (
              <DashboardChartCard
                title="Receita bruta por mês"
                description="Somatório do valor real das vendas por mês."
              >
                <MonthlyLineChart data={charts.monthlyRevenue} title="Receita bruta por mes" />
              </DashboardChartCard>
            ) : null}
            {showsChart(selectedChart, 'profit') ? (
              <DashboardChartCard
                title="Lucro líquido por mês"
                description="Somatório do lucro realizado em cada mês."
              >
                <MonthlyLineChart data={charts.monthlyProfit} title="Lucro liquido por mes" />
              </DashboardChartCard>
            ) : null}
            {showsChart(selectedChart, 'city') || showsChart(selectedChart, 'origin') ? (
              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                {showsChart(selectedChart, 'city') ? (
                  <DashboardChartCard
                    title="Valor vendido por cidade"
                    description="As 10 cidades com maior receita."
                  >
                    <CityBarChart data={charts.revenueByCity} />
                  </DashboardChartCard>
                ) : null}
                {showsChart(selectedChart, 'origin') ? (
                  <DashboardChartCard
                    title="Origem dos clientes"
                    description="Distribuicao dinamica dos clientes por origem."
                  >
                    <OriginDonutChart data={charts.customersByOrigin} />
                  </DashboardChartCard>
                ) : null}
              </div>
            ) : null}
          </div>
        </PageSection>
      ) : null}
    </div>
  );
}

const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
const formatDate = (value: string | null) =>
  value ? new Intl.DateTimeFormat('pt-BR').format(new Date(value)) : 'Sem registro';
const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );

function showsChart(selectedChart: ChartType, chart: Exclude<ChartType, 'all'>) {
  return selectedChart === 'all' || selectedChart === chart;
}

function getMonthRange(year: string, month: string) {
  const lastDay = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function formatMonthOption(month: string) {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
    new Date(Date.UTC(2000, Number(month) - 1, 1)),
  );
}
