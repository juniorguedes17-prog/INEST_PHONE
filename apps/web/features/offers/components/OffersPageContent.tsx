'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pagination,
  SettingsCard,
  StatusBadge,
} from '@/components/shared';
import { useOffers } from '../hooks/useOffers';
import { renderTemporaryOfferMessage } from '../utils/temporary-offer-consolidation';
import { OfferListCard } from './OfferListCard';
import { InstallmentSimulatorCard } from './InstallmentSimulatorCard';
import { OffersToolbar } from './OffersToolbar';
import {
  buildCanonicalModelFacetOptions,
  getCanonicalCapacities,
  getCanonicalCategory,
  getCanonicalColors,
  getCanonicalModelKey,
  getCatalogFacetLabel,
  normalizeCatalogFilterText,
} from '@/features/price-radar/utils/brazil-radar-facets';
import { ProductFacetsDrawer } from '@/features/price-radar/components/ProductFacetsDrawer';
import { PricingItem } from '@/features/pricing/types/pricing';

const initialFilters = {
  search: '',
  category: '',
  model: '',
  color: '',
  capacity: '',
  origin: '',
  status: '',
  date: '',
};

const deliveryTimeOptions = [
  'Em até 3 dias úteis',
  'De 3 a 5 dias úteis',
  'De 5 a 7 dias úteis',
  'De 8 a 10 dias úteis',
  'De 11 a 15 dias úteis',
  'De 25 a 30 dias úteis',
] as const;

const defaultDeliveryTime = 'Prazo conforme oferta';

export function OffersPageContent() {
  const offers = useOffers();
  const [temporaryDeliveryTimes, setTemporaryDeliveryTimes] = useState<Record<string, string>>({});
  const showingTemporaryOffer = Boolean(
    offers.currentOffer &&
    offers.consolidatedTemporaryOffers.some((offer) => offer.id === offers.currentOffer?.id),
  );
  const showingPersistedPreview = Boolean(offers.currentOffer && !showingTemporaryOffer);
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const productsById = useMemo(
    () => new Map(offers.pricingItems.map((item) => [item.productId, item])),
    [offers.pricingItems],
  );

  const filteredOffers = useMemo(() => {
    const normalizedSearch = normalizeCatalogFilterText(filters.search);
    const now = Date.now();

    const nextOffers = offers.offers.filter((offer) => {
      const product = offer.productId ? productsById.get(offer.productId) : undefined;
      const productFacetSource = product ? toFacetSource(product) : undefined;
      const origin = offer.template?.productType || 'Precificacao';
      const searchable = normalizeCatalogFilterText(
        [
          product?.productName,
          product?.model,
          product?.color,
          product?.capacity,
          offer.template?.name,
          offer.status,
        ]
          .filter(Boolean)
          .join(' '),
      );

      return (
        (!normalizedSearch || searchable.includes(normalizedSearch)) &&
        (!filters.category || productFacetSource?.category === filters.category) &&
        (!filters.model || productFacetSource?.modelKey === filters.model) &&
        (!filters.color || productFacetSource?.colors.includes(filters.color)) &&
        (!filters.capacity || productFacetSource?.capacities.includes(filters.capacity)) &&
        (!filters.origin || origin === filters.origin) &&
        (!filters.status || offer.status === filters.status) &&
        matchesDate(offer.createdAt, filters.date, now)
      );
    });

    return nextOffers.sort((left, right) => {
      if (sort === 'oldest') return dateValue(left.createdAt) - dateValue(right.createdAt);
      if (sort === 'highest_price') return right.offerPrice - left.offerPrice;
      if (sort === 'lowest_price') return left.offerPrice - right.offerPrice;
      return dateValue(right.createdAt) - dateValue(left.createdAt);
    });
  }, [filters, offers.offers, productsById, sort]);

  const categories = useCatalogFacetOptions(offers.pricingItems, (item) => [
    toFacetSource(item).category,
  ]);
  const models = useMemo(
    () => buildCanonicalModelFacetOptions(offers.pricingItems),
    [offers.pricingItems],
  );
  const colors = useCatalogFacetOptions(
    offers.pricingItems,
    (item) => toFacetSource(item).colors,
    getCatalogFacetLabel,
  );
  const capacities = useCatalogFacetOptions(
    offers.pricingItems,
    (item) => toFacetSource(item).capacities,
  );
  const origins = useUnique(
    offers.offers.map((offer) => offer.template?.productType || 'Precificacao'),
  );
  const statuses = useUnique(offers.offers.map((offer) => offer.status));
  const activeFilterCount = Object.entries(filters).filter(
    ([key, value]) => key !== 'search' && Boolean(value),
  ).length;
  const totalPages = Math.max(1, Math.ceil(filteredOffers.length / pageSize));
  const paginatedOffers = useMemo(
    () => filteredOffers.slice((page - 1) * pageSize, page * pageSize),
    [filteredOffers, page, pageSize],
  );

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize, sort]);

  function clearFilters() {
    setFilters(initialFilters);
    setSort('recent');
    setPage(1);
  }

  return (
    <div className="grid gap-4">
      <PageHeader
        eyebrow="Comercial"
        title="Gerador de Ofertas"
        description="Mensagens comerciais geradas a partir da Precificação oficial."
        actions={offers.success ? <StatusBadge tone="green">{offers.success}</StatusBadge> : null}
      />

      {offers.error ? <ErrorState title="Atenção" description={offers.error} /> : null}

      <OffersToolbar
        search={filters.search}
        total={filteredOffers.length}
        sort={sort}
        pageSize={pageSize}
        activeFilterCount={activeFilterCount}
        onSearchChange={(search) => setFilters((current) => ({ ...current, search }))}
        onClear={clearFilters}
        onSortChange={setSort}
        onPageSizeChange={setPageSize}
        onOpenFilters={() => setFiltersOpen(true)}
      />

      <InstallmentSimulatorCard
        offers={offers.offers}
        drafts={offers.temporaryOfferDrafts}
        loading={offers.loading}
        error={offers.error}
      />

      {offers.consolidatedTemporaryOffers.length ? (
        <div className="grid gap-4">
          {offers.consolidatedTemporaryOffers.map((offer) => (
            <SettingsCard
              key={offer.id}
              eyebrow="Oferta preparada"
              title="Template comercial da Precificação"
              description="Rascunho temporário pronto para envio, sem gravação no banco."
            >
              <div className="grid gap-3">
                <p className="text-sm font-bold text-inest-text">
                  {offer.template?.name || 'Template comercial'}
                </p>
                <label className="grid gap-1.5 text-sm font-bold text-inest-text">
                  <span>Prazo de entrega</span>
                  <select
                    value={temporaryDeliveryTimes[offer.id] ?? ''}
                    onChange={(event) =>
                      setTemporaryDeliveryTimes((current) => ({
                        ...current,
                        [offer.id]: event.target.value || defaultDeliveryTime,
                      }))
                    }
                    className="w-full rounded-lg border border-inest-line bg-white px-3 py-2 font-normal outline-none focus:border-inest-blue"
                  >
                    <option value="">{defaultDeliveryTime}</option>
                    {deliveryTimeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-inest-line bg-inest-soft p-3 text-sm leading-6 text-inest-text">
                  {renderTemporaryOfferMessage(
                    offer,
                    temporaryDeliveryTimes[offer.id] || defaultDeliveryTime,
                  )}
                </pre>
                <div className="grid gap-2 sm:grid-cols-2">
                  <ActionButton
                    variant="secondary"
                    onClick={() =>
                      void offers.copy({
                        ...offer,
                        message: renderTemporaryOfferMessage(
                          offer,
                          temporaryDeliveryTimes[offer.id] || defaultDeliveryTime,
                        ),
                      })
                    }
                  >
                    Copiar texto
                  </ActionButton>
                  <ActionButton
                    variant="success"
                    onClick={() =>
                      void offers.share({
                        ...offer,
                        message: renderTemporaryOfferMessage(
                          offer,
                          temporaryDeliveryTimes[offer.id] || defaultDeliveryTime,
                        ),
                      })
                    }
                  >
                    Compartilhar
                  </ActionButton>
                </div>
              </div>
            </SettingsCard>
          ))}
        </div>
      ) : null}

      <section className="min-h-[calc(100vh-330px)]">
        <div
          className={
            showingPersistedPreview
              ? 'grid min-h-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]'
              : 'grid min-h-0 gap-4'
          }
        >
          <div className="min-h-0 overflow-y-auto pr-1 scrollbar-stable">
            <div className="grid gap-3">
              {offers.loading ? <LoadingState /> : null}
              {!offers.loading && !filteredOffers.length && offers.offers.length ? (
                <EmptyState
                  title="Nenhuma oferta encontrada."
                  description="Ajuste ou limpe os filtros para visualizar outros registros."
                />
              ) : null}
              {!offers.loading
                ? paginatedOffers.map((offer) => (
                    <OfferListCard
                      key={offer.id}
                      offer={offer}
                      product={offer.productId ? productsById.get(offer.productId) : undefined}
                      busy={offers.saving}
                      onPreview={() => offers.setCurrentOffer(offer)}
                      onShare={() => void offers.share(offer)}
                      onDelete={() => void offers.remove(offer.id)}
                    />
                  ))
                : null}
            </div>

            {filteredOffers.length ? (
              <div className="mt-4 rounded-2xl border border-inest-line/70 bg-inest-surface p-5 shadow-[0_14px_34px_rgba(16,24,40,0.055)]">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalItems={filteredOffers.length}
                  onPageChange={setPage}
                />
                {totalPages === 1 ? (
                  <p className="text-sm text-inest-muted">
                    {filteredOffers.length} ofertas exibidas
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {showingPersistedPreview ? (
            <aside className="min-w-0 2xl:sticky 2xl:top-0 2xl:self-start">
              <SettingsCard
                eyebrow="Previa"
                title="Mensagem comercial"
                description="Somente informacoes destinadas ao cliente."
              >
                <div className="grid gap-3">
                  <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-inest-line bg-inest-soft p-3 text-sm leading-6 text-inest-text">
                    {offers.currentOffer?.message}
                  </pre>
                  <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-1">
                    <ActionButton
                      variant="secondary"
                      onClick={() => void offers.copy(offers.currentOffer!)}
                    >
                      Copiar texto
                    </ActionButton>
                    <ActionButton
                      variant="success"
                      onClick={() => void offers.share(offers.currentOffer!)}
                    >
                      Compartilhar
                    </ActionButton>
                  </div>
                </div>
              </SettingsCard>
            </aside>
          ) : null}
        </div>
      </section>

      <ProductFacetsDrawer
        open={filtersOpen}
        ariaLabel="Filtros de ofertas"
        resultCount={filteredOffers.length}
        categories={offerFilterGroup('Categoria', categories, filters.category, (category) =>
          setFilters((current) => ({ ...current, category })),
        )}
        models={{
          ...offerFilterGroup('Modelo', models, filters.model, (model) =>
            setFilters((current) => ({ ...current, model })),
          ),
          collapsible: true,
        }}
        colors={offerFilterGroup('Cor', colors, filters.color, (color) =>
          setFilters((current) => ({ ...current, color })),
        )}
        capacities={offerFilterGroup(
          'Armazenamento / Capacidade',
          capacities,
          filters.capacity,
          (capacity) => setFilters((current) => ({ ...current, capacity })),
        )}
        additionalGroups={[
          offerFilterGroup('Origem', toFilterOptions(origins), filters.origin, (origin) =>
            setFilters((current) => ({ ...current, origin })),
          ),
          offerFilterGroup('Status', toFilterOptions(statuses), filters.status, (status) =>
            setFilters((current) => ({ ...current, status })),
          ),
          offerFilterGroup(
            'Periodo',
            [
              { value: 'today', label: 'Hoje' },
              { value: '7days', label: 'Ultimos 7 dias' },
              { value: '30days', label: 'Ultimos 30 dias' },
            ],
            filters.date,
            (date) => setFilters((current) => ({ ...current, date })),
          ),
        ]}
        onClear={clearFilters}
        onClose={() => setFiltersOpen(false)}
      />
    </div>
  );
}

function useUnique(values: string[]) {
  return useMemo(() => Array.from(new Set(values.filter(Boolean))).sort(), [values]);
}

function toFilterOptions(values: string[]): FilterOption[] {
  return values.map((value) => ({ value, label: value }));
}

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

function offerFilterGroup(
  title: string,
  options: FilterOption[],
  value: string,
  onChange: (value: string) => void,
) {
  return {
    title,
    options: options.map((option) => ({ ...option, count: option.count ?? 1 })),
    selected: value ? [value] : [],
    onToggle: (nextValue: string) => onChange(nextValue === value ? '' : nextValue),
  };
}

function toFacetSource(item: PricingItem) {
  return {
    category: getCanonicalCategory(item),
    modelKey: getCanonicalModelKey(item),
    colors: getCanonicalColors(item),
    capacities: getCanonicalCapacities(item),
  };
}

function useCatalogFacetOptions(
  items: PricingItem[],
  getValues: (item: PricingItem) => string[],
  getLabel: (value: string) => string = (value) => value,
) {
  return useMemo(
    () =>
      Array.from(new Set(items.flatMap(getValues).filter(Boolean)))
        .map((value) => ({ value, label: getLabel(value) }))
        .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR')),
    [getLabel, getValues, items],
  );
}

function matchesDate(value: string, filter: string, now: number) {
  if (!filter) return true;
  const createdAt = dateValue(value);
  if (filter === 'today') {
    const today = new Date(now);
    const created = new Date(createdAt);
    return created.toDateString() === today.toDateString();
  }
  const days = filter === '7days' ? 7 : 30;
  return now - createdAt <= days * 24 * 60 * 60 * 1000;
}

function dateValue(value: string) {
  return new Date(value).getTime();
}
