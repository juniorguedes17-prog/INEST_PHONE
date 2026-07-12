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
import { OperationalCard } from './OperationalCard';

export function DashboardPageContent() {
  const dashboard = useDashboard();
  const data = dashboard.data;
  const lastUpdated = dashboard.lastUpdated
    ? formatDateTime(dashboard.lastUpdated)
    : 'Aguardando atualizacao';

  return (
    <div className="grid gap-4">
      <PageHeader
        eyebrow="Operacao comercial"
        title="Dashboard"
        description="Visao objetiva dos modulos essenciais para a operacao diaria da iNest Phone."
      />

      <DashboardToolbar
        loading={dashboard.loading}
        lastUpdated={lastUpdated}
        onRefresh={dashboard.load}
      />

      {dashboard.error ? <ErrorState title="Atencao" description={dashboard.error} /> : null}
      {dashboard.loading && !data ? <LoadingState /> : null}
      {!dashboard.loading && !data ? (
        <EmptyState
          title="Sem dados para exibir."
          description="Os indicadores aparecerao quando os modulos oficiais tiverem registros."
        />
      ) : null}

      {data ? (
        <>
          <PageSection title="Resumo operacional" description="Indicadores essenciais do MVP.">
            <div
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6"
              aria-label="Indicadores operacionais"
            >
              <KpiCard
                label="Produtos no Radar"
                value={formatNumber(data.radar.quotesCount)}
                detail="Cotacoes disponiveis"
                tone="blue"
              />
              <KpiCard
                label="Produtos precificados"
                value="—"
                detail="Indicador em preparacao"
                tone="green"
              />
              <KpiCard
                label="Ofertas geradas"
                value={formatNumber(data.offers.generated)}
                detail="Total registrado"
                tone="purple"
              />
              <KpiCard
                label="Clientes"
                value="—"
                detail="Integracao futura"
                tone="amber"
              />
              <KpiCard
                label="Fornecedores"
                value={formatNumber(data.suppliers.active)}
                detail={`${formatNumber(data.suppliers.total)} cadastrados`}
                tone="green"
              />
              <KpiCard
                label="Ultima atualizacao"
                value={formatTime(dashboard.lastUpdated)}
                detail={dashboard.lastUpdated ? formatDate(dashboard.lastUpdated) : 'Sem registro'}
                tone="blue"
              />
            </div>
          </PageSection>

          <PageSection
            title="Modulos operacionais"
            description="Situacao atual das areas ativas do MVP."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <OperationalCard
                eyebrow="Radar"
                title="Radar de Precos"
                quantity={formatNumber(data.radar.quotesCount)}
                quantityLabel="cotacoes"
                status={data.radar.quotesCount > 0 ? 'Operacional' : 'Sem registros'}
                statusTone={data.radar.quotesCount > 0 ? 'green' : 'gray'}
                updatedAt={lastUpdated}
              />
              <OperationalCard
                eyebrow="Precos"
                title="Precificacao"
                quantity="—"
                quantityLabel="produtos"
                status="Preparado"
                statusTone="blue"
                updatedAt={lastUpdated}
              />
              <OperationalCard
                eyebrow="Comercial"
                title="Gerador de Ofertas"
                quantity={formatNumber(data.offers.generated)}
                quantityLabel="ofertas"
                status={data.offers.generated > 0 ? 'Operacional' : 'Sem registros'}
                statusTone={data.offers.generated > 0 ? 'green' : 'gray'}
                updatedAt={lastUpdated}
              />
              <OperationalCard
                eyebrow="Relacionamento"
                title="Clientes"
                quantity="—"
                quantityLabel="clientes"
                status="Integracao futura"
                statusTone="amber"
                updatedAt="Aguardando Google Sheets"
              />
              <OperationalCard
                eyebrow="Parceiros"
                title="Fornecedores"
                quantity={formatNumber(data.suppliers.active)}
                quantityLabel="ativos"
                status={data.suppliers.active > 0 ? 'Operacional' : 'Sem registros'}
                statusTone={data.suppliers.active > 0 ? 'green' : 'gray'}
                updatedAt={lastUpdated}
              />
            </div>
          </PageSection>
        </>
      ) : null}
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(value);
}

function formatTime(value: Date | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}
