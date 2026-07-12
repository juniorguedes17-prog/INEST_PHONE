'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  FilterSection,
  FilterSidebar,
  LoadingState,
  PageHeader,
  Pagination,
  SettingsCard,
  StatusBadge,
} from '@/components/shared';
import { useOffers } from '../hooks/useOffers';
import { OfferListCard } from './OfferListCard';
import { OffersToolbar } from './OffersToolbar';

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

export function OffersPageContent() {
  const searchParams = useSearchParams();
  const offers = useOffers(searchParams.get('productId'));
  const [filters, setFilters] = useState(initialFilters);
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const productsById = useMemo(
    () => new Map(offers.pricingItems.map((item) => [item.productId, item])),
    [offers.pricingItems],
  );

  const filteredOffers = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLocaleLowerCase('pt-BR');
    const now = Date.now();

    const nextOffers = offers.offers.filter((offer) => {
      const product = offer.productId ? productsById.get(offer.productId) : undefined;
      const origin = offer.template?.productType || 'Precificacao';
      const searchable = [
        product?.productName,
        product?.model,
        product?.color,
        product?.capacity,
        offer.template?.name,
        offer.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR');

      return (
        (!normalizedSearch || searchable.includes(normalizedSearch)) &&
        (!filters.category || product?.category === filters.category) &&
        (!filters.model || product?.model === filters.model) &&
        (!filters.color || product?.color === filters.color) &&
        (!filters.capacity || product?.capacity === filters.capacity) &&
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

  const categories = useUnique(offers.pricingItems.map((item) => item.category));
  const models = useUnique(offers.pricingItems.map((item) => item.model));
  const colors = useUnique(offers.pricingItems.map((item) => item.color));
  const capacities = useUnique(offers.pricingItems.map((item) => item.capacity));
  const origins = useUnique(
    offers.offers.map((offer) => offer.template?.productType || 'Precificacao'),
  );
  const statuses = useUnique(offers.offers.map((offer) => offer.status));
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
        description="Mensagens comerciais geradas a partir da Precificacao oficial."
        actions={
          offers.success ? <StatusBadge tone="green">{offers.success}</StatusBadge> : null
        }
      />

      {offers.error ? <ErrorState title="Atencao" description={offers.error} /> : null}

      <OffersToolbar
        search={filters.search}
        total={filteredOffers.length}
        sort={sort}
        pageSize={pageSize}
        onSearchChange={(search) => setFilters((current) => ({ ...current, search }))}
        onClear={clearFilters}
        onSortChange={setSort}
        onPageSizeChange={setPageSize}
      />

      <SettingsCard
        eyebrow="Nova oferta"
        title="Produto e template"
        description="Selecione os dados oficiais e gere a mensagem comercial."
      >
        <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto] md:items-end">
          <SelectInput
            label="Produto precificado"
            value={offers.selectedProductId}
            options={offers.pricingItems.map((item) => [item.productId, item.productName])}
            onChange={offers.setSelectedProductId}
          />
          <SelectInput
            label="Template"
            value={offers.selectedTemplateId}
            options={[
              ['', 'Automatico pelo tipo do produto'],
              ...offers.templates.map((template) => [template.id, template.name]),
            ]}
            onChange={offers.setSelectedTemplateId}
          />
          <ActionButton
            variant="success"
            className="w-full md:w-auto"
            onClick={() => void offers.generate()}
            disabled={offers.saving}
          >
            {offers.saving ? 'Gerando...' : 'Gerar Oferta'}
          </ActionButton>
        </div>
      </SettingsCard>

      <section className="grid min-h-[calc(100vh-330px)] grid-cols-1 gap-4 xl:grid-cols-[288px_minmax(0,1fr)]">
        <FilterSidebar eyebrow="Filtros" title="Ofertas">
          <FilterSelect
            title="Categoria"
            value={filters.category}
            options={categories}
            emptyLabel="Todas"
            onChange={(category) => setFilters((current) => ({ ...current, category }))}
          />
          <FilterSelect
            title="Modelo"
            value={filters.model}
            options={models}
            emptyLabel="Todos"
            onChange={(model) => setFilters((current) => ({ ...current, model }))}
          />
          <FilterSelect
            title="Cor"
            value={filters.color}
            options={colors}
            emptyLabel="Todas"
            onChange={(color) => setFilters((current) => ({ ...current, color }))}
          />
          <FilterSelect
            title="Capacidade"
            value={filters.capacity}
            options={capacities}
            emptyLabel="Todas"
            onChange={(capacity) => setFilters((current) => ({ ...current, capacity }))}
          />
          <FilterSelect
            title="Origem"
            value={filters.origin}
            options={origins}
            emptyLabel="Todas"
            onChange={(origin) => setFilters((current) => ({ ...current, origin }))}
          />
          <FilterSelect
            title="Status"
            value={filters.status}
            options={statuses}
            emptyLabel="Todos"
            onChange={(status) => setFilters((current) => ({ ...current, status }))}
          />
          <FilterSection title="Data">
            <SelectInput
              label="Periodo"
              value={filters.date}
              options={[
                ['', 'Todas as datas'],
                ['today', 'Hoje'],
                ['7days', 'Ultimos 7 dias'],
                ['30days', 'Ultimos 30 dias'],
              ]}
              onChange={(date) => setFilters((current) => ({ ...current, date }))}
            />
          </FilterSection>
        </FilterSidebar>

        <div className="grid min-h-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-h-0 overflow-y-auto pr-1 scrollbar-stable">
            <div className="grid gap-3">
              {offers.loading ? <LoadingState /> : null}
              {!offers.loading && !filteredOffers.length ? (
                <EmptyState
                  title={offers.offers.length ? 'Nenhuma oferta encontrada.' : 'Nenhuma oferta gerada.'}
                  description={
                    offers.offers.length
                      ? 'Ajuste ou limpe os filtros para visualizar outros registros.'
                      : 'Selecione um produto precificado e gere a primeira mensagem.'
                  }
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
              <div className="mt-4 rounded-xl border border-inest-line bg-white p-4 shadow-card">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalItems={filteredOffers.length}
                  onPageChange={setPage}
                />
                {totalPages === 1 ? (
                  <p className="text-sm text-inest-muted">{filteredOffers.length} ofertas exibidas</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <aside className="min-w-0 2xl:sticky 2xl:top-0 2xl:self-start">
            <SettingsCard
              eyebrow="Previa"
              title="Mensagem comercial"
              description="Somente informacoes destinadas ao cliente."
            >
              {offers.currentOffer ? (
                <div className="grid gap-3">
                  <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-lg border border-inest-line bg-inest-soft p-3 text-sm leading-6 text-inest-text">
                    {offers.currentOffer.message}
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
              ) : (
                <EmptyState
                  title="Sem previa."
                  description="Gere ou visualize uma oferta para conferir a mensagem."
                />
              )}
            </SettingsCard>
          </aside>
        </div>
      </section>
    </div>
  );
}

function FilterSelect({
  title,
  value,
  options,
  emptyLabel,
  onChange,
}: {
  title: string;
  value: string;
  options: string[];
  emptyLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <FilterSection title={title}>
      <SelectInput
        label={title}
        value={value}
        options={[['', emptyLabel], ...options.map((option) => [option, option])]}
        onChange={onChange}
      />
    </FilterSection>
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
    <label className="block min-w-0">
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

function useUnique(values: string[]) {
  return useMemo(() => Array.from(new Set(values.filter(Boolean))).sort(), [values]);
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
