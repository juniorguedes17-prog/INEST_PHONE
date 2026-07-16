'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  FilterSection,
  FilterSidebar,
  KpiCard,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  StatusBadge,
} from '@/components/shared';
import { usePricing } from '../hooks/usePricing';
import { PricingProductCard } from './PricingProductCard';
import { PricingToolbar } from './PricingToolbar';

const sortOptions = [
  ['lowest_price', 'Menor preco'],
  ['highest_price', 'Maior preco'],
  ['recent', 'Ultima atualizacao'],
  ['highest_profit', 'Maior lucro'],
];

const initialFilters = {
  search: '',
  category: '',
  model: '',
  color: '',
  capacity: '',
  productType: '',
  status: '',
  minPrice: '',
  maxPrice: '',
  sort: 'lowest_price',
};

export function PricingPageContent() {
  const pricing = usePricing();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const categories = useUnique(pricing.items.map((item) => item.category));
  const models = useUnique(pricing.items.map((item) => item.model));
  const colors = useUnique(pricing.items.map((item) => item.color));
  const capacities = useUnique(pricing.items.map((item) => item.capacity));
  const types = useUnique(pricing.items.map((item) => item.productType));
  const statuses = useUnique(pricing.items.map((item) => item.status));

  const metrics = useMemo(() => {
    const total = pricing.items.length;
    const readyItems = pricing.items.filter(
      (item) => item.salePrice !== null && item.desiredNetProfit !== null && item.margin !== null,
    );
    const readyTotal = readyItems.length;
    const averageSalePrice = readyTotal
      ? readyItems.reduce((sum, item) => sum + (item.salePrice ?? 0), 0) / readyTotal
      : 0;
    const averageProfit = readyTotal
      ? readyItems.reduce((sum, item) => sum + (item.desiredNetProfit ?? 0), 0) / readyTotal
      : 0;
    const highestMargin = readyTotal ? Math.max(...readyItems.map((item) => item.margin ?? 0)) : 0;
    return { total, readyTotal, averageSalePrice, averageProfit, highestMargin };
  }, [pricing.items]);

  const lastUpdated = useMemo(
    () =>
      pricing.items.reduce<string | undefined>((latest, item) => {
        if (!latest || new Date(item.lastUpdatedAt) > new Date(latest)) {
          return item.lastUpdatedAt;
        }
        return latest;
      }, undefined),
    [pricing.items],
  );

  const totalPages = Math.max(1, Math.ceil(pricing.items.length / pageSize));
  const paginatedItems = useMemo(
    () => pricing.items.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize, pricing.items],
  );

  useEffect(() => {
    setPage(1);
  }, [pricing.filters, pageSize]);

  function clearFilters() {
    pricing.setFilters(initialFilters);
    setPage(1);
  }

  return (
    <div className="grid gap-4">
      <PageHeader
        eyebrow="Catalogo inteligente"
        title="Precificacao"
        description="Precos calculados automaticamente com Radar, Configuracoes e lucro por modelo."
        actions={pricing.success ? <StatusBadge tone="green">{pricing.success}</StatusBadge> : null}
      />

      {pricing.error ? <ErrorState title="Atencao" description={pricing.error} /> : null}

      <PricingToolbar
        search={pricing.filters.search}
        total={pricing.items.length}
        lastUpdated={lastUpdated ? formatDateTime(lastUpdated) : undefined}
        sort={pricing.filters.sort}
        sortOptions={sortOptions}
        pageSize={pageSize}
        recalculating={pricing.saving}
        onSearchChange={(value) => pricing.setFilters((current) => ({ ...current, search: value }))}
        onRecalculate={() => void pricing.recalculate()}
        onClear={clearFilters}
        onSortChange={(value) => pricing.setFilters((current) => ({ ...current, sort: value }))}
        onPageSizeChange={setPageSize}
      />

      <section
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        aria-label="Indicadores da Precificacao"
      >
        <KpiCard
          label="Produtos encontrados"
          value={String(metrics.total)}
          detail={`${metrics.readyTotal} com lucro cadastrado`}
          tone="blue"
        />
        <KpiCard
          label="Preco medio"
          value={formatCurrency(metrics.averageSalePrice)}
          detail="Preco de venda calculado"
          tone="purple"
        />
        <KpiCard
          label="Lucro medio"
          value={formatCurrency(metrics.averageProfit)}
          detail="Lucro liquido por modelo"
          tone="green"
        />
        <KpiCard
          label="Maior margem"
          value={formatPercent(metrics.highestMargin)}
          detail="Entre os produtos listados"
          tone="amber"
        />
      </section>

      <section className="grid min-h-[calc(100vh-330px)] grid-cols-1 gap-4 xl:grid-cols-[288px_minmax(0,1fr)]">
        <FilterSidebar eyebrow="Filtros" title="Precificacao">
          <FilterSection title="Categoria">
            <SelectInput
              label="Categoria"
              value={pricing.filters.category}
              options={[['', 'Todas'], ...toOptions(categories)]}
              onChange={(value) =>
                pricing.setFilters((current) => ({ ...current, category: value }))
              }
            />
          </FilterSection>

          <FilterSection title="Modelo">
            <SelectInput
              label="Modelo"
              value={pricing.filters.model}
              options={[['', 'Todos'], ...toOptions(models)]}
              onChange={(value) => pricing.setFilters((current) => ({ ...current, model: value }))}
            />
          </FilterSection>

          <FilterSection title="Cor">
            <SelectInput
              label="Cor"
              value={pricing.filters.color}
              options={[['', 'Todas'], ...toOptions(colors)]}
              onChange={(value) => pricing.setFilters((current) => ({ ...current, color: value }))}
            />
          </FilterSection>

          <FilterSection title="Capacidade">
            <SelectInput
              label="Capacidade"
              value={pricing.filters.capacity}
              options={[['', 'Todas'], ...toOptions(capacities)]}
              onChange={(value) =>
                pricing.setFilters((current) => ({ ...current, capacity: value }))
              }
            />
          </FilterSection>

          <FilterSection title="Tipo">
            <SelectInput
              label="Tipo"
              value={pricing.filters.productType}
              options={[['', 'Todos'], ...toOptions(types)]}
              onChange={(value) =>
                pricing.setFilters((current) => ({ ...current, productType: value }))
              }
            />
          </FilterSection>

          <FilterSection title="Status">
            <SelectInput
              label="Status"
              value={pricing.filters.status}
              options={[['', 'Todos'], ...toOptions(statuses, translateStatus)]}
              onChange={(value) => pricing.setFilters((current) => ({ ...current, status: value }))}
            />
          </FilterSection>

          <FilterSection title="Faixa de preco">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <TextInput
                label="Minimo"
                type="number"
                value={pricing.filters.minPrice}
                onChange={(value) =>
                  pricing.setFilters((current) => ({ ...current, minPrice: value }))
                }
              />
              <TextInput
                label="Maximo"
                type="number"
                value={pricing.filters.maxPrice}
                onChange={(value) =>
                  pricing.setFilters((current) => ({ ...current, maxPrice: value }))
                }
              />
            </div>
          </FilterSection>
        </FilterSidebar>

        <div className="min-h-0 overflow-y-auto pr-1 scrollbar-stable">
          <div className="grid gap-3">
            {pricing.loading ? <LoadingState /> : null}
            {!pricing.loading && !pricing.items.length && !pricing.temporaryImportPricing ? (
              <EmptyState
                title="Nenhum produto encontrado."
                description="O produto precisa possuir preco valido no Radar para aparecer na Precificacao."
              />
            ) : null}
            {!pricing.loading
              ? (
                  <>
                    {pricing.temporaryImportPricing ? (
                      <TemporaryImportPricingCard
                        item={pricing.temporaryImportPricing}
                        generating={pricing.saving}
                        onGenerateOffer={pricing.generateTemporaryOffer}
                      />
                    ) : null}
                    {paginatedItems.map((item) => (
                  <PricingProductCard
                    key={item.productId}
                    item={item}
                    generating={pricing.saving}
                    onGenerateOffer={(productId) => void pricing.generateOffer(productId)}
                  />
                    ))}
                  </>
                )
              : null}
          </div>

          {pricing.items.length ? (
            <div className="mt-4 rounded-xl border border-inest-line bg-white p-4 shadow-card">
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={pricing.items.length}
                onPageChange={setPage}
              />
              {totalPages === 1 ? (
                <p className="text-sm text-inest-muted">{pricing.items.length} produtos exibidos</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <OfferDraftModal
        open={Boolean(pricing.offerDraft)}
        item={pricing.offerDraft?.payload ?? null}
        onClose={() => pricing.setOfferDraft(null)}
      />
    </div>
  );
}

function TemporaryImportPricingCard({
  item,
  generating,
  onGenerateOffer,
}: {
  item: NonNullable<ReturnType<typeof usePricing>['temporaryImportPricing']>;
  generating: boolean;
  onGenerateOffer: () => void;
}) {
  return (
    <article className="grid w-full gap-3 rounded-xl border border-blue-200 bg-white p-3 shadow-card md:grid-cols-[64px_minmax(220px,1fr)_170px_150px_170px] md:items-center">
      <div className="grid h-16 w-16 place-items-center rounded-lg bg-blue-50 font-display text-lg font-black text-inest-blue">
        PY
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="line-clamp-2 text-base font-black leading-tight text-inest-text">
            {item.product.name}
          </h3>
          <StatusBadge tone="blue">Paraguai</StatusBadge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[item.product.category, item.product.model, item.product.color, item.product.capacity]
            .filter(Boolean)
            .map((tag) => (
              <StatusBadge key={tag} tone="gray">
                {tag}
              </StatusBadge>
            ))}
        </div>
        <p className="mt-1.5 text-xs text-inest-muted">
          Lucro por modelo: {item.profit.condition} - {item.profit.productDescription}
        </p>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase text-inest-muted">Fornecedor</p>
        <strong className="mt-0.5 block truncate text-sm text-inest-text">{item.product.supplier}</strong>
        <p className="mt-1 truncate text-xs text-inest-muted">{item.product.city || item.product.store}</p>
      </div>
      <div className="min-w-0 md:text-right">
        <p className="text-[10px] font-black uppercase text-inest-muted">Custo final</p>
        <strong className="mt-0.5 block text-sm text-inest-text">{formatCurrency(item.importCosts.totalCost)}</strong>
        <p className="mt-2 text-[10px] font-black uppercase text-inest-muted">Lucro</p>
        <strong className="mt-0.5 block text-sm text-inest-green">{formatCurrency(item.desiredNetProfit)}</strong>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1 md:items-end">
        <span className="text-[10px] font-black uppercase text-inest-muted">Preco de venda</span>
        <strong className="font-display text-2xl font-black text-inest-text">{formatCurrency(item.salePrice)}</strong>
        <span className="text-xs font-bold text-inest-muted">Margem {formatPercent(item.margin)}</span>
        <ActionButton variant="success" className="mt-1 h-9 px-3 text-xs" disabled={generating} onClick={onGenerateOffer}>
          {generating ? 'Preparando...' : 'Gerar Oferta'}
        </ActionButton>
      </div>
    </article>
  );
}

function OfferDraftModal({
  open,
  item,
  onClose,
}: {
  open: boolean;
  item: {
    productName: string;
    color: string;
    capacity: string;
    salePrice: number;
    offerPrice: number;
    deliveryTime: string;
    warranty: string;
  } | null;
  onClose: () => void;
}) {
  return (
    <Modal open={open} title="Oferta preparada" onClose={onClose}>
      {item ? (
        <div className="grid gap-4">
          <p className="text-inest-muted">
            Os dados abaixo foram preparados para o modulo de Ofertas, sem preenchimento manual.
          </p>
          <div className="rounded-xl border border-inest-line bg-inest-soft p-4">
            <strong className="block font-display text-xl text-inest-text">
              {item.productName}
            </strong>
            <p className="mt-2 text-sm text-inest-muted">
              {item.color} {item.capacity} - {item.deliveryTime}
            </p>
            <p className="mt-4 text-sm font-bold text-inest-muted">Preco de venda</p>
            <p className="font-display text-3xl font-black text-inest-text">
              {formatCurrency(item.salePrice)}
            </p>
            <p className="mt-3 text-sm font-bold text-inest-muted">Preco de oferta</p>
            <p className="font-display text-2xl font-black text-inest-green">
              {formatCurrency(item.offerPrice)}
            </p>
            <p className="mt-3 text-sm text-inest-muted">{item.warranty}</p>
          </div>
          <div className="flex justify-end">
            <ActionButton onClick={onClose}>Entendi</ActionButton>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function useUnique(values: string[]) {
  return useMemo(() => Array.from(new Set(values.filter(Boolean))).sort(), [values]);
}

function toOptions(values: string[], label = (value: string) => value) {
  return values.map((value) => [value, label(value)]);
}

function translateStatus(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'Ativo',
    APPROVED: 'Aprovado',
    PENDING_REVIEW: 'Pendente',
  };
  return map[status] ?? status;
}

function formatCurrency(value: number | null) {
  if (value === null) return '--';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null) return '--';
  return new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(
    value,
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
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
        className="field-control"
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="field-control"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
