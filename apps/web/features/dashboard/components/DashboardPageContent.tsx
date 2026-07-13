'use client';

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

export function DashboardPageContent() {
  const dashboard = useDashboard();
  const data = dashboard.data;
  const charts = data?.sheetCharts ?? EMPTY_CHARTS;
  const lastUpdated = data?.sheet.lastSync
    ? formatDateTime(data.sheet.lastSync)
    : 'Aguardando sincronizacao';
  return (
    <div className="grid min-w-0 gap-4 overflow-x-hidden">
      <PageHeader
        eyebrow="Operacao comercial"
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
          title="Resumo operacional"
          description="Dados calculados exclusivamente a partir da planilha oficial."
        >
          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            aria-label="Indicadores do Google Sheets"
          >
            <KpiCard
              label="Total de clientes"
              value={formatNumber(data.sheet.totalCustomers)}
              tone="blue"
            />
            <KpiCard
              label="Total de vendas"
              value={formatNumber(data.sheet.totalSales)}
              tone="green"
            />
            <KpiCard
              label="Receita total"
              value={formatCurrency(data.sheet.totalRevenue)}
              tone="purple"
            />
            <KpiCard
              label="Lucro total"
              value={formatCurrency(data.sheet.totalProfit)}
              tone="green"
            />
            <KpiCard
              label="Ticket medio"
              value={formatCurrency(data.sheet.averageTicket)}
              tone="amber"
            />
            <KpiCard
              label="Produtos vendidos"
              value={formatNumber(data.sheet.productsSold)}
              tone="blue"
            />
            <KpiCard label="Ultima venda" value={formatDate(data.sheet.lastSale)} tone="purple" />
            <KpiCard label="Ultima sincronizacao" value={lastUpdated} tone="amber" />
          </div>
        </PageSection>
      ) : null}
      {data ? (
        <PageSection
          title="Evolucao das vendas"
          description="Indicadores atualizados a partir do mesmo snapshot sincronizado."
        >
          <div className="grid min-w-0 gap-4">
            <DashboardChartCard
              title="Quantidade de aparelhos vendidos por mes"
              description="Total de unidades vendidas em cada mes."
            >
              <MonthlyBarChart
                data={charts.monthlyUnits}
                title="Quantidade de aparelhos vendidos por mes"
              />
            </DashboardChartCard>
            <DashboardChartCard
              title="Receita bruta por mes"
              description="Somatorio do valor real das vendas por mes."
            >
              <MonthlyLineChart data={charts.monthlyRevenue} title="Receita bruta por mes" />
            </DashboardChartCard>
            <DashboardChartCard
              title="Lucro liquido por mes"
              description="Somatorio do lucro realizado em cada mes."
            >
              <MonthlyLineChart data={charts.monthlyProfit} title="Lucro liquido por mes" />
            </DashboardChartCard>
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
              <DashboardChartCard
                title="Valor vendido por cidade"
                description="As 10 cidades com maior receita."
              >
                <CityBarChart data={charts.revenueByCity} />
              </DashboardChartCard>
              <DashboardChartCard
                title="Origem dos clientes"
                description="Distribuicao dinamica dos clientes por origem."
              >
                <OriginDonutChart data={charts.customersByOrigin} />
              </DashboardChartCard>
            </div>
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
