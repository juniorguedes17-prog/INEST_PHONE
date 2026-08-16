'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  KpiCard,
  LoadingState,
  PageHeader,
  Pagination,
  StatusBadge,
} from '@/components/shared';
import { usePricing } from '../hooks/usePricing';
import { PricingProductCard } from './PricingProductCard';
import { PricingToolbar } from './PricingToolbar';
import {
  getCanonicalCapacities,
  getCanonicalCategory,
  getCanonicalColors,
  getCanonicalModel,
  getCatalogFacetLabel,
} from '@/features/price-radar/utils/brazil-radar-facets';
import { ProductFacetsDrawer, buildFacetOptions } from '@/features/price-radar/components/ProductFacetsDrawer';

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const categories = useUnique(pricing.items.map((item) => getCanonicalCategory(item)));
  const models = useUnique(pricing.items.map((item) => getCanonicalModel(item)));
  const colors = useUnique(pricing.items.flatMap((item) => getCanonicalColors(item)));
  const capacities = useUnique(pricing.items.flatMap((item) => getCanonicalCapacities(item)));
  const types = useUnique(pricing.items.map((item) => item.productType));
  const statuses = useUnique(pricing.items.map((item) => item.status));
  const activeFilterCount = Object.entries(pricing.filters).filter(
    ([key, value]) => key !== 'search' && key !== 'sort' && Boolean(value),
  ).length;
  const priceBounds = useMemo(
    () => getPriceBounds(pricing.items.map((item) => item.salePrice ?? item.costProduct)),
    [pricing.items],
  );

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
        activeFilterCount={activeFilterCount}
        recalculating={pricing.saving}
        onSearchChange={(value) => pricing.setFilters((current) => ({ ...current, search: value }))}
        onRecalculate={() => void pricing.recalculate()}
        onClear={clearFilters}
        onSortChange={(value) => pricing.setFilters((current) => ({ ...current, sort: value }))}
        onPageSizeChange={setPageSize}
        onOpenFilters={() => setFiltersOpen(true)}
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

      <section className="min-h-[calc(100vh-330px)]">
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

      <ProductFacetsDrawer
        open={filtersOpen}
        ariaLabel="Filtros da Precificacao"
        resultCount={pricing.items.length}
        categories={singleFilterGroup(
          'Categoria',
          buildFacetOptions(categories),
          pricing.filters.category,
          (category) => pricing.setFilters((current) => ({ ...current, category })),
        )}
        models={{
          ...singleFilterGroup(
            'Modelo',
            buildFacetOptions(models),
            pricing.filters.model,
            (model) => pricing.setFilters((current) => ({ ...current, model })),
          ),
          collapsible: true,
        }}
        colors={singleFilterGroup(
          'Cor',
          buildFacetOptions(colors, getCatalogFacetLabel),
          pricing.filters.color,
          (color) => pricing.setFilters((current) => ({ ...current, color })),
        )}
        capacities={singleFilterGroup(
          'Armazenamento / Capacidade',
          buildFacetOptions(capacities),
          pricing.filters.capacity,
          (capacity) => pricing.setFilters((current) => ({ ...current, capacity })),
        )}
        additionalGroups={[
          singleFilterGroup(
            'Tipo',
            buildFacetOptions(types),
            pricing.filters.productType,
            (productType) => pricing.setFilters((current) => ({ ...current, productType })),
          ),
          singleFilterGroup(
            'Status',
            buildFacetOptions(statuses, translateStatus),
            pricing.filters.status,
            (status) => pricing.setFilters((current) => ({ ...current, status })),
          ),
        ]}
        price={{
          min: priceBounds.min,
          max: priceBounds.max,
          minValue: pricing.filters.minPrice,
          maxValue: pricing.filters.maxPrice,
          onMinChange: (minPrice) =>
            pricing.setFilters((current) => ({ ...current, minPrice })),
          onMaxChange: (maxPrice) =>
            pricing.setFilters((current) => ({ ...current, maxPrice })),
        }}
        onClear={clearFilters}
        onClose={() => setFiltersOpen(false)}
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

function useUnique(values: string[]) {
  return useMemo(() => Array.from(new Set(values.filter(Boolean))).sort(), [values]);
}

function singleFilterGroup(
  title: string,
  options: ReturnType<typeof buildFacetOptions>,
  value: string,
  onChange: (value: string) => void,
) {
  return {
    title,
    options,
    selected: value ? [value] : [],
    onToggle: (nextValue: string) => onChange(nextValue === value ? '' : nextValue),
  };
}

function getPriceBounds(values: Array<number | null>) {
  const validValues = values.filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  );
  return {
    min: validValues.length ? Math.min(...validValues) : 0,
    max: validValues.length ? Math.max(...validValues) : 0,
  };
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
