'use client';

import { useMemo } from 'react';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  FilterSection,
  FilterSidebar,
  ListHeader,
  LoadingState,
  Modal,
  PageHeader,
  ProductCard,
  StatusBadge,
} from '@/components/shared';
import { usePricing } from '../hooks/usePricing';

const sortOptions = [
  ['lowest_price', 'Menor preco'],
  ['highest_price', 'Maior preco'],
  ['recent', 'Ultima atualizacao'],
  ['highest_profit', 'Maior lucro'],
];

export function PricingPageContent() {
  const pricing = usePricing();
  const categories = useUnique(pricing.items.map((item) => item.category));
  const models = useUnique(pricing.items.map((item) => item.model));
  const colors = useUnique(pricing.items.map((item) => item.color));
  const capacities = useUnique(pricing.items.map((item) => item.capacity));
  const types = useUnique(pricing.items.map((item) => item.productType));
  const statuses = useUnique(pricing.items.map((item) => item.status));

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Catalogo inteligente"
        title="Precificacao"
        description="Precos calculados automaticamente com Radar, Configuracoes e lucro por modelo."
        actions={
          <>
            {pricing.success ? <StatusBadge tone="green">{pricing.success}</StatusBadge> : null}
            <ActionButton variant="secondary" onClick={() => void pricing.recalculate()}>
              {pricing.saving ? 'Recalculando...' : 'Recalcular'}
            </ActionButton>
          </>
        }
      />

      {pricing.error ? <ErrorState title="Atencao" description={pricing.error} /> : null}

      <section className="grid min-h-[calc(100vh-220px)] grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <FilterSidebar eyebrow="Catalogo" title="Precificacao">
          <FilterSection title="Busca">
            <TextInput
              label="Pesquisar"
              value={pricing.filters.search}
              onChange={(value) => pricing.setFilters((current) => ({ ...current, search: value }))}
            />
          </FilterSection>

          <FilterSection title="Categoria">
            <SelectInput
              label="Categoria"
              value={pricing.filters.category}
              options={[['', 'Todas'], ...categories.map((item) => [item, item])]}
              onChange={(value) =>
                pricing.setFilters((current) => ({ ...current, category: value }))
              }
            />
          </FilterSection>

          <FilterSection title="Modelo">
            <SelectInput
              label="Modelo"
              value={pricing.filters.model}
              options={[['', 'Todos'], ...models.map((item) => [item, item])]}
              onChange={(value) => pricing.setFilters((current) => ({ ...current, model: value }))}
            />
          </FilterSection>

          <FilterSection title="Cor">
            <SelectInput
              label="Cor"
              value={pricing.filters.color}
              options={[['', 'Todas'], ...colors.map((item) => [item, item])]}
              onChange={(value) => pricing.setFilters((current) => ({ ...current, color: value }))}
            />
          </FilterSection>

          <FilterSection title="Capacidade">
            <SelectInput
              label="Capacidade"
              value={pricing.filters.capacity}
              options={[['', 'Todas'], ...capacities.map((item) => [item, item])]}
              onChange={(value) =>
                pricing.setFilters((current) => ({ ...current, capacity: value }))
              }
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

          <FilterSection title="Tipo">
            <SelectInput
              label="Tipo"
              value={pricing.filters.productType}
              options={[['', 'Todos'], ...types.map((item) => [item, item])]}
              onChange={(value) =>
                pricing.setFilters((current) => ({ ...current, productType: value }))
              }
            />
          </FilterSection>

          <FilterSection title="Status">
            <SelectInput
              label="Status"
              value={pricing.filters.status}
              options={[['', 'Todos'], ...statuses.map((item) => [item, item])]}
              onChange={(value) => pricing.setFilters((current) => ({ ...current, status: value }))}
            />
          </FilterSection>
        </FilterSidebar>

        <div className="min-h-0 overflow-y-auto pr-1 scrollbar-stable">
          <ListHeader
            sticky
            eyebrow="Precos calculados automaticamente"
            title={`${pricing.items.length} produtos encontrados`}
            description="Valores finais com custo fixo, frete, taxa e lucro por modelo."
            actions={
              <SelectInput
                label="Ordenacao"
                value={pricing.filters.sort}
                options={sortOptions}
                compact
                onChange={(value) => pricing.setFilters((current) => ({ ...current, sort: value }))}
              />
            }
          />

          <div className="mt-5 grid gap-4">
            {pricing.loading ? <LoadingState /> : null}
            {!pricing.loading && !pricing.items.length ? (
              <EmptyState
                title="Nenhum produto encontrado."
                description="O produto precisa possuir preco valido no Radar para aparecer na Precificacao."
              />
            ) : null}
            {!pricing.loading
              ? pricing.items.map((item) => (
                  <ProductCard
                    key={item.productId}
                    title={item.productName}
                    status={translateStatus(item.status)}
                    tags={[
                      item.category,
                      item.color,
                      item.capacity,
                      item.supplier.name,
                      item.deliveryTime,
                    ].filter(Boolean)}
                    meta={`Atualizado em ${formatDateTime(item.lastUpdatedAt)} - Lucro por modelo: ${
                      item.profitSource === 'default' ? 'padrao' : 'configurado'
                    } - Oferta: ${formatCurrency(item.offerPrice)}`}
                    supplier={{
                      name: item.supplier.name,
                      location: item.supplier.source || 'Menor preco valido',
                      delivery: item.deliveryTime || 'Prazo nao informado',
                    }}
                    price={formatCurrency(item.salePrice)}
                    priceLabel={`Margem ${formatPercent(item.margin)}`}
                    actions={[
                      {
                        label: 'Gerar Oferta',
                        variant: 'success',
                        onClick: () => void pricing.generateOffer(item.productId),
                      },
                      {
                        label: 'Detalhes',
                        variant: 'secondary',
                      },
                    ]}
                  />
                ))
              : null}
          </div>
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
          <div className="rounded-2xl border border-inest-line bg-inest-soft p-4">
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

function translateStatus(status: string) {
  const map: Record<string, string> = {
    ACTIVE: 'Ativo',
    APPROVED: 'Aprovado',
    PENDING_REVIEW: 'Pendente',
  };
  return map[status] ?? status;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatPercent(value: number) {
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
        className="h-12 w-full rounded-xl border border-inest-line bg-white px-4 outline-none focus:border-inest-blue"
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
  compact = false,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <label className={compact ? 'min-w-60' : 'block'}>
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full rounded-xl border border-inest-line bg-white px-4 outline-none focus:border-inest-blue"
      >
        {options.map(([valueOption, labelOption]) => (
          <option key={valueOption} value={valueOption}>
            {labelOption}
          </option>
        ))}
      </select>
    </label>
  );
}
