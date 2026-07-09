'use client';

import {
  EmptyState,
  ErrorState,
  FilterSection,
  FilterSidebar,
  KpiCard,
  LoadingState,
  PageHeader,
  SettingsCard,
} from '@/components/shared';
import { DashboardPoint } from '../types/dashboard';
import { useDashboard } from '../hooks/useDashboard';

export function DashboardPageContent() {
  const dashboard = useDashboard();
  const data = dashboard.data;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Operacao comercial"
        title="Dashboard"
        description="Indicadores consolidados a partir dos modulos oficiais da iNest Phone."
      />

      {dashboard.error ? <ErrorState title="Atencao" description={dashboard.error} /> : null}

      <section className="grid min-h-[calc(100vh-220px)] grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <FilterSidebar eyebrow="BI" title="Filtros globais">
          <FilterSection title="Periodo">
            <TextInput
              label="Inicio"
              type="date"
              value={dashboard.filters.startDate}
              onChange={(value) =>
                dashboard.setFilters((current) => ({ ...current, startDate: value }))
              }
            />
            <TextInput
              label="Fim"
              type="date"
              value={dashboard.filters.endDate}
              onChange={(value) =>
                dashboard.setFilters((current) => ({ ...current, endDate: value }))
              }
            />
          </FilterSection>

          <FilterSection title="Dimensoes">
            <TextInput
              label="Categoria"
              value={dashboard.filters.category}
              onChange={(value) =>
                dashboard.setFilters((current) => ({ ...current, category: value }))
              }
            />
            <TextInput
              label="Produto ID"
              value={dashboard.filters.productId}
              onChange={(value) =>
                dashboard.setFilters((current) => ({ ...current, productId: value }))
              }
            />
            <TextInput
              label="Fornecedor ID"
              value={dashboard.filters.supplierId}
              onChange={(value) =>
                dashboard.setFilters((current) => ({ ...current, supplierId: value }))
              }
            />
            <TextInput
              label="Usuario ID"
              value={dashboard.filters.userId}
              onChange={(value) =>
                dashboard.setFilters((current) => ({ ...current, userId: value }))
              }
            />
          </FilterSection>
        </FilterSidebar>

        <div className="min-h-0 overflow-y-auto pr-1 scrollbar-stable">
          {dashboard.loading ? <LoadingState /> : null}
          {!dashboard.loading && !data ? (
            <EmptyState
              title="Sem dados para exibir."
              description="Os indicadores aparecerao quando os modulos oficiais tiverem registros."
            />
          ) : null}
          {data ? (
            <div className="grid gap-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                <KpiCard
                  label="Faturamento do mes"
                  value={formatCurrency(data.kpis.monthRevenue)}
                  tone="blue"
                />
                <KpiCard
                  label="Lucro liquido"
                  value={formatCurrency(data.kpis.monthProfit)}
                  tone="green"
                />
                <KpiCard label="Vendas" value={String(data.kpis.salesCount)} tone="purple" />
                <KpiCard
                  label="Ticket medio"
                  value={formatCurrency(data.kpis.ticketAverage)}
                  tone="amber"
                />
                <KpiCard
                  label="Produtos cadastrados"
                  value={String(data.kpis.productsTotal)}
                  tone="blue"
                />
                <KpiCard
                  label="Produtos ativos"
                  value={String(data.kpis.activeProducts)}
                  tone="green"
                />
                <KpiCard
                  label="Fornecedores ativos"
                  value={String(data.kpis.activeSuppliers)}
                  tone="purple"
                />
                <KpiCard
                  label="Ofertas geradas"
                  value={String(data.kpis.offersGenerated)}
                  tone="amber"
                />
                <KpiCard
                  label="Radar atualizado hoje"
                  value={String(data.kpis.radarUpdatedToday)}
                  tone="blue"
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <ChartCard
                  title="Faturamento mensal"
                  type="bar"
                  data={data.financial.monthlyRevenue}
                  money
                />
                <ChartCard
                  title="Lucro mensal"
                  type="area"
                  data={data.financial.monthlyProfit}
                  money
                />
                <ChartCard
                  title="Evolucao do faturamento"
                  type="line"
                  data={data.financial.revenueEvolution}
                  money
                />
                <ChartCard
                  title="Evolucao do lucro"
                  type="line"
                  data={data.financial.profitEvolution}
                  money
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <MetricPanel
                  title="Indicadores comerciais"
                  items={data.commercial.mostConsultedProducts}
                />
                <MetricPanel
                  title="Produtos mais lucrativos"
                  items={data.commercial.mostProfitableProducts}
                  money
                />
                <MetricPanel
                  title="Produtos com menor custo"
                  items={data.commercial.lowestCostProducts}
                  money
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <SettingsCard eyebrow="Radar" title="Radar de Precos">
                  <MetricLine label="Fornecedores" value={data.radar.suppliersCount} />
                  <MetricLine label="Cotacoes" value={data.radar.quotesCount} />
                  <MetricLine label="Menor preco" value={formatCurrency(data.radar.lowestPrice)} />
                  <MetricLine label="Ocultados" value={data.radar.hiddenProducts} />
                  <MetricLine label="Sem cotacao" value={data.radar.productsWithoutQuotes} />
                  <MetricLine label="Atualizacoes hoje" value={data.radar.updatesToday} />
                </SettingsCard>
                <SettingsCard eyebrow="Importacao" title="Radar de Importacao">
                  <MetricLine label="Pesquisas" value={data.importation.searches} />
                  <MetricLine
                    label="Produtos simulados"
                    value={data.importation.simulatedProducts}
                  />
                  <MetricLine
                    label="Economia estimada"
                    value={formatCurrency(data.importation.estimatedSavings)}
                  />
                  <MetricLine
                    label="Produtos importados"
                    value={data.importation.importedProducts}
                  />
                  <MetricLine
                    label="Ultimo dolar"
                    value={formatCurrency(data.importation.lastDollarQuote)}
                  />
                </SettingsCard>
                <SettingsCard eyebrow="Ofertas" title="Gerador de Ofertas">
                  <MetricLine label="Geradas" value={data.offers.generated} />
                  <MetricLine label="Compartilhadas" value={data.offers.shared} />
                  <MetricPanel
                    title="Mais ofertados"
                    items={data.offers.mostOfferedProducts}
                    compact
                  />
                </SettingsCard>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function ChartCard({
  title,
  data,
  money = false,
  type,
}: {
  title: string;
  data: DashboardPoint[];
  money?: boolean;
  type: 'bar' | 'line' | 'area';
}) {
  const max = Math.max(...data.map((item) => item.value), 1);
  return (
    <SettingsCard eyebrow={type} title={title}>
      <div className="flex h-56 items-end gap-3">
        {data.length ? (
          data.map((item) => (
            <div key={item.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-xl bg-gradient-to-t from-inest-blue to-inest-purple"
                style={{ height: `${Math.max((item.value / max) * 100, 4)}%` }}
                title={`${item.label}: ${money ? formatCurrency(item.value) : item.value}`}
              />
              <span className="w-full truncate text-center text-xs font-bold text-inest-muted">
                {item.label}
              </span>
            </div>
          ))
        ) : (
          <EmptyState title="Sem serie." description="Aguardando dados." />
        )}
      </div>
    </SettingsCard>
  );
}

function MetricPanel({
  title,
  items,
  money = false,
  compact = false,
}: {
  title: string;
  items: DashboardPoint[];
  money?: boolean;
  compact?: boolean;
}) {
  return (
    <SettingsCard eyebrow="Ranking" title={title}>
      <div className={compact ? 'grid gap-2' : 'grid gap-3'}>
        {items.length ? (
          items.map((item) => (
            <MetricLine
              key={item.label}
              label={item.label}
              value={money ? formatCurrency(item.value) : formatNumber(item.value)}
            />
          ))
        ) : (
          <EmptyState title="Sem dados." description="Aguardando registros." />
        )}
      </div>
    </SettingsCard>
  );
}

function MetricLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-inest-line pt-3">
      <span className="min-w-0 truncate text-sm font-bold text-inest-muted">{label}</span>
      <strong className="shrink-0 text-inest-text">{value}</strong>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-inest-line bg-white px-4 outline-none focus:border-inest-blue"
      />
    </label>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}
