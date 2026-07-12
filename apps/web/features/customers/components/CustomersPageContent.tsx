'use client';
import { ActionButton, EmptyState, ErrorState, KpiCard, LoadingState, PageHeader, Pagination, SearchInput, Select, Toolbar } from '@/components/shared';
import { useCustomers } from '../hooks/useCustomers';
import { CustomerCard } from './CustomerCard';
export function CustomersPageContent() {
  const state = useCustomers(); const data = state.data;
  return <div className="grid min-w-0 gap-4 overflow-x-hidden">
    <PageHeader eyebrow="Google Sheets" title="Clientes" description="Consulta somente leitura da base oficial de clientes e vendas." />
    <section className="rounded-xl border border-inest-line bg-white p-3 shadow-card"><Toolbar><div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(220px,1fr)_180px_120px]"><SearchInput value={state.search} onChange={(event) => { state.setSearch(event.target.value); state.setPage(1); }} placeholder="Buscar cliente, CPF, cidade ou contato" aria-label="Pesquisar clientes" /><Select value={state.origin} onChange={(event) => { state.setOrigin(event.target.value); state.setPage(1); }} aria-label="Filtrar por origem"><option value="">Todas as origens</option><option value="TRAFEGO">Trafego</option><option value="INDICACAO">Indicacao</option><option value="ORGANICO">Organico</option><option value="RECORRENTE">Recorrente</option></Select><Select value={state.pageSize} onChange={(event) => { state.setPageSize(Number(event.target.value)); state.setPage(1); }} aria-label="Itens por pagina"><option value={10}>10 por pagina</option><option value={20}>20 por pagina</option><option value={50}>50 por pagina</option></Select></div><ActionButton className="min-h-11 w-full sm:w-auto" onClick={() => void state.sync()} disabled={state.syncing}>{state.syncing ? 'Sincronizando...' : 'Sincronizar Google Sheets'}</ActionButton></Toolbar></section>
    {data ? <div className="grid gap-3 sm:grid-cols-3"><KpiCard label="Total de clientes" value={formatNumber(data.summary.totalCustomers)} /><KpiCard label="Total de vendas" value={formatNumber(data.summary.totalSales)} tone="green" /><KpiCard label="Ultima sincronizacao" value={formatDateTime(data.summary.lastSync)} tone="purple" /></div> : null}
    {state.error ? <ErrorState title="Falha na sincronizacao" description={state.error} /> : null}{state.loading && !data ? <LoadingState /> : null}{data && !data.items.length ? <EmptyState title="Nenhum cliente encontrado" description="Ajuste os filtros ou sincronize novamente a planilha." /> : null}
    {data?.items.length ? <section className="grid min-w-0 gap-2" aria-label="Lista de clientes">{data.items.map((customer) => <CustomerCard key={customer.id} customer={customer} />)}<Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} totalItems={data.pagination.totalItems} onPageChange={state.setPage} /></section> : null}
  </div>;
}
const formatNumber = (value: number) => new Intl.NumberFormat('pt-BR').format(value);
const formatDateTime = (value: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
