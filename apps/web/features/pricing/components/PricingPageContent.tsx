'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  KpiCard,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  StatusBadge,
} from '@/components/shared';
import { usePricing } from '../hooks/usePricing';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { PricingProductCard } from './PricingProductCard';
import { PricingToolbar } from './PricingToolbar';
import {
  buildCanonicalModelFacetOptions,
  getCanonicalCapacities,
  getCanonicalCategory,
  getCanonicalColors,
  getCatalogFacetLabel,
} from '@/features/price-radar/utils/brazil-radar-facets';
import {
  ProductFacetsDrawer,
  buildFacetOptions,
} from '@/features/price-radar/components/ProductFacetsDrawer';
import { getProductCardPresentation } from '@/utils/product-card-presentation';
import { PricingOfferTarget } from '../types/pricing';

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
  const { settings: settingsPayload } = useSettings();
  const [includeOfferIncrement, setIncludeOfferIncrement] = useState(true);
  const pricing = usePricing({
    includeOfferIncrement,
    offerIncrement: settingsPayload?.pricing.offerIncrement,
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [profitModalOpen, setProfitModalOpen] = useState(false);
  const [profitValue, setProfitValue] = useState('');
  const [profitModalError, setProfitModalError] = useState<string | null>(null);
  const [selectedOfferIds, setSelectedOfferIds] = useState<Set<string>>(() => new Set());
  const [profitItem, setProfitItem] = useState<
    ReturnType<typeof usePricing>['brazilRadarPricings'][number] | null
  >(null);
  const categories = useUnique(pricing.items.map((item) => getCanonicalCategory(item)));
  const models = useMemo(() => buildCanonicalModelFacetOptions(pricing.items), [pricing.items]);
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
  const selectablePageItems = useMemo(
    () => paginatedItems.filter((item) => item.googleSheetsReady),
    [paginatedItems],
  );
  const selectedOfferTargets = useMemo<PricingOfferTarget[]>(() => {
    const catalogTargets = pricing.items
      .filter(
        (item) =>
          item.googleSheetsReady && selectedOfferIds.has(catalogSelectionId(item.productId)),
      )
      .map((item) => ({
        id: catalogSelectionId(item.productId),
        kind: 'catalog' as const,
        productId: item.productId,
      }));
    const radarTargets = pricing.brazilRadarPricings
      .filter(
        (item) =>
          item.calculationStatus === 'ready' &&
          item.offerDraft !== null &&
          selectedOfferIds.has(radarSelectionId(item.sourceQuoteId)),
      )
      .map((item) => ({
        id: radarSelectionId(item.sourceQuoteId),
        kind: 'brazil-radar' as const,
        item,
      }));

    return [...catalogTargets, ...radarTargets];
  }, [pricing.brazilRadarPricings, pricing.items, selectedOfferIds]);

  useEffect(() => {
    setPage(1);
  }, [pricing.filters, pageSize]);

  function clearFilters() {
    pricing.setFilters(initialFilters);
    setPage(1);
  }

  function setOfferSelection(id: string, selected: boolean) {
    setSelectedOfferIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function selectCurrentPage(selected: boolean) {
    setSelectedOfferIds((current) => {
      const next = new Set(current);
      selectablePageItems.forEach((item) => {
        const id = catalogSelectionId(item.productId);
        if (selected) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  }

  async function generateSelectedOffers() {
    const result = await pricing.prepareOfferBatch(selectedOfferTargets);
    if (!result) return;

    setSelectedOfferIds((current) => {
      const next = new Set(current);
      result.successfulIds.forEach((id) => next.delete(id));
      return next;
    });

    if (result.drafts.length) {
      pricing.sendOfferDraftBatch(result.drafts, result.failedIds.length);
    }
  }

  function openProfitModal(item: ReturnType<typeof usePricing>['brazilRadarPricings'][number]) {
    setProfitItem(item);
    setProfitValue('');
    setProfitModalError(null);
    setProfitModalOpen(true);
  }

  async function saveMissingProfit() {
    setProfitModalError(null);
    try {
      if (!profitItem) return;
      await pricing.registerBrazilRadarProfit(profitItem, profitValue);
      setProfitModalOpen(false);
      setProfitItem(null);
    } catch (profitError) {
      setProfitModalError(
        profitError instanceof Error
          ? profitError.message
          : 'Nao foi possivel salvar o Lucro Liquido.',
      );
    }
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
          <label className="mb-3 flex w-fit items-center gap-2 rounded-xl border border-inest-line/70 bg-inest-surface px-3 py-2 text-sm font-semibold text-inest-text shadow-[0_4px_12px_rgba(16,24,40,0.035)]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-inest-green"
              checked={includeOfferIncrement}
              onChange={(event) => setIncludeOfferIncrement(event.target.checked)}
            />
            <span>Adicionar acrescimo a oferta</span>
            <span className="text-xs text-inest-muted">
              {settingsPayload
                ? `+ ${formatCurrency(settingsPayload.pricing.offerIncrement)}`
                : 'Carregando acrescimo'}
            </span>
          </label>
          {selectedOfferTargets.length ? (
            <div className="sticky top-2 z-10 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-inest-blue/30 bg-white p-3 shadow-card">
              <strong className="text-sm text-inest-text">
                {selectedOfferTargets.length}{' '}
                {selectedOfferTargets.length === 1
                  ? 'produto selecionado'
                  : 'produtos selecionados'}
              </strong>
              <div className="flex items-center gap-2">
                <ActionButton
                  variant="secondary"
                  className="h-9 px-3 text-xs"
                  disabled={pricing.saving}
                  onClick={() => setSelectedOfferIds(new Set())}
                >
                  Limpar selecao
                </ActionButton>
                <ActionButton
                  variant="success"
                  className="h-9 px-3 text-xs"
                  disabled={pricing.saving}
                  onClick={() => void generateSelectedOffers()}
                >
                  {pricing.saving ? 'Preparando...' : 'Gerar Ofertas'}
                </ActionButton>
              </div>
            </div>
          ) : null}
          {selectablePageItems.length ? (
            <label className="mb-3 flex w-fit items-center gap-2 text-sm font-bold text-inest-text">
              <input
                type="checkbox"
                className="h-4 w-4 accent-inest-blue"
                checked={selectablePageItems.every((item) =>
                  selectedOfferIds.has(catalogSelectionId(item.productId)),
                )}
                onChange={(event) => selectCurrentPage(event.target.checked)}
              />
              Selecionar pagina
            </label>
          ) : null}
          <div className="grid gap-3">
            {pricing.loading ? <LoadingState /> : null}
            {!pricing.loading &&
            !pricing.items.length &&
            !pricing.temporaryImportPricing &&
            !pricing.brazilRadarPricings.length ? (
              <EmptyState
                title="Nenhum produto encontrado."
                description="O produto precisa possuir preco valido no Radar para aparecer na Precificacao."
              />
            ) : null}
            {!pricing.loading ? (
              <>
                {pricing.brazilRadarPricings.map((item) => (
                  <BrazilRadarQuotePricingCard
                    key={item.sourceQuoteId}
                    item={item}
                    generating={pricing.saving}
                    selected={selectedOfferIds.has(radarSelectionId(item.sourceQuoteId))}
                    onSelect={(selected) =>
                      setOfferSelection(radarSelectionId(item.sourceQuoteId), selected)
                    }
                    onGenerateOffer={() => pricing.generateBrazilRadarOffer(item)}
                    onRegisterProfit={() => openProfitModal(item)}
                  />
                ))}
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
                    selected={selectedOfferIds.has(catalogSelectionId(item.productId))}
                    onSelect={(productId, selected) =>
                      setOfferSelection(catalogSelectionId(productId), selected)
                    }
                    onGenerateOffer={(productId) => void pricing.generateOffer(productId)}
                  />
                ))}
              </>
            ) : null}
          </div>

          {pricing.items.length ? (
            <div className="mt-4 rounded-2xl border border-inest-line/70 bg-inest-surface p-5 shadow-[0_14px_34px_rgba(16,24,40,0.055)]">
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
          ...singleFilterGroup('Modelo', models, pricing.filters.model, (model) =>
            pricing.setFilters((current) => ({ ...current, model })),
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
          onMinChange: (minPrice) => pricing.setFilters((current) => ({ ...current, minPrice })),
          onMaxChange: (maxPrice) => pricing.setFilters((current) => ({ ...current, maxPrice })),
        }}
        onClear={clearFilters}
        onClose={() => setFiltersOpen(false)}
      />

      <MissingProfitModal
        open={profitModalOpen}
        item={profitItem}
        value={profitValue}
        error={profitModalError}
        saving={pricing.saving}
        onChange={setProfitValue}
        onClose={() => {
          setProfitModalOpen(false);
          setProfitItem(null);
        }}
        onSave={() => void saveMissingProfit()}
      />
    </div>
  );
}

function catalogSelectionId(productId: string) {
  return `catalog:${productId}`;
}

function radarSelectionId(sourceQuoteId: string) {
  return `radar:${sourceQuoteId}`;
}

function BrazilRadarQuotePricingCard({
  item,
  generating,
  selected,
  onSelect,
  onGenerateOffer,
  onRegisterProfit,
}: {
  item: ReturnType<typeof usePricing>['brazilRadarPricings'][number];
  generating: boolean;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onGenerateOffer: () => void;
  onRegisterProfit: () => void;
}) {
  const presentation = getProductCardPresentation({
    canonicalDescription: item.profit.productDescription,
    rawDescription: item.product.name,
    condition: item.product.condition,
    capacity: item.product.capacity,
    color: item.product.color,
  });
  const ready = item.calculationStatus === 'ready' && item.offerDraft !== null;

  return (
    <article className="grid w-full gap-4 rounded-xl border border-green-200 bg-inest-surface p-4 shadow-[0_10px_30px_rgba(16,24,40,0.045)] md:grid-cols-[28px_minmax(220px,1fr)_170px_150px_170px] md:items-center">
      <label
        className="flex h-8 w-8 items-center justify-center"
        aria-label={`Selecionar ${presentation.title}`}
      >
        <input
          type="checkbox"
          className="h-4 w-4 accent-inest-blue"
          checked={selected}
          disabled={generating || !ready}
          onChange={(event) => onSelect(event.target.checked)}
        />
      </label>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="line-clamp-2 text-base font-black leading-tight text-inest-text">
            {presentation.title}
          </h3>
          <StatusBadge tone="green">Brasil</StatusBadge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presentation.attributes.map((tag) => (
            <StatusBadge key={tag} tone="gray">
              {tag}
            </StatusBadge>
          ))}
        </div>
        {item.calculationError ? (
          <p className="mt-2 text-sm font-bold text-red-700">{item.calculationError}</p>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase text-inest-muted">Fornecedor</p>
        <strong className="mt-0.5 block truncate text-sm text-inest-text">
          {item.product.supplier}
        </strong>
        {item.product.city ? (
          <p className="mt-1 truncate text-xs text-inest-muted">{item.product.city}</p>
        ) : null}
      </div>
      <div className="min-w-0 md:text-right">
        <p className="text-[10px] font-black uppercase text-inest-muted">Custo informado</p>
        <strong className="mt-0.5 block text-sm text-inest-text">
          {formatCurrency(item.costProduct)}
        </strong>
        <p className="mt-2 text-[10px] font-black uppercase text-inest-muted">Lucro</p>
        <strong className="mt-0.5 block text-sm text-inest-green">
          {formatCurrency(item.desiredNetProfit)}
        </strong>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1 md:items-end">
        <span className="text-[10px] font-black uppercase text-inest-muted">Preco de venda</span>
        <strong className="font-display text-2xl font-black text-inest-text">
          {formatCurrency(item.salePrice)}
        </strong>
        <span className="text-xs font-bold text-inest-muted">
          Margem {formatPercent(item.margin)}
        </span>
        {ready ? (
          <ActionButton
            variant="success"
            className="mt-1 h-9 px-3 text-xs"
            disabled={generating}
            onClick={onGenerateOffer}
          >
            {generating ? 'Preparando...' : 'Gerar Oferta'}
          </ActionButton>
        ) : null}
        {item.calculationStatus === 'missing_profit' ? (
          <ActionButton
            variant="primary"
            className="mt-1 h-9 px-3 text-xs"
            disabled={generating}
            onClick={onRegisterProfit}
          >
            Cadastrar lucro
          </ActionButton>
        ) : null}
      </div>
    </article>
  );
}

function MissingProfitModal({
  open,
  item,
  value,
  error,
  saving,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean;
  item: ReturnType<typeof usePricing>['brazilRadarPricings'][number] | null;
  value: string;
  error: string | null;
  saving: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  if (!item) return null;

  return (
    <Modal
      open={open}
      title="Cadastrar lucro liquido"
      onClose={onClose}
      dialogClassName="max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden"
      contentClassName="min-h-0 flex-1 overflow-y-auto pr-1"
      footer={
        <>
          <ActionButton variant="secondary" disabled={saving} onClick={onClose}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" form="missing-profit-form" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar e recalcular'}
          </ActionButton>
        </>
      }
    >
      <form
        id="missing-profit-form"
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSave();
        }}
      >
        <div className="grid gap-3 rounded-xl border border-inest-line bg-inest-soft p-4 text-sm">
          <div>
            <span className="block text-xs font-black uppercase text-inest-muted">Produto</span>
            <strong className="mt-1 block text-inest-text">{item.profit.productDescription}</strong>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-black uppercase text-inest-muted">Condicao</span>
              <strong className="mt-1 block text-inest-text">{item.product.condition}</strong>
            </div>
            {item.product.capacity ? (
              <div>
                <span className="block text-xs font-black uppercase text-inest-muted">
                  Capacidade
                </span>
                <strong className="mt-1 block text-inest-text">{item.product.capacity}</strong>
              </div>
            ) : null}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-bold text-inest-muted">Lucro liquido</span>
          <input
            autoFocus
            required
            inputMode="decimal"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Ex.: 1.090,00"
            className="field-control"
          />
        </label>
        {error ? (
          <p className="text-sm font-bold text-red-700" role="alert">
            {error}
          </p>
        ) : null}
      </form>
    </Modal>
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
  const presentation = getProductCardPresentation({
    canonicalDescription: item.profit.productDescription,
    rawDescription: item.product.name,
    condition: item.profit.condition,
    capacity: item.product.capacity,
    color: item.product.color,
  });

  return (
    <article className="grid w-full gap-4 rounded-xl border border-blue-200 bg-inest-surface p-4 shadow-[0_10px_30px_rgba(16,24,40,0.045)] md:grid-cols-[minmax(220px,1fr)_170px_150px_170px] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="line-clamp-2 text-base font-black leading-tight text-inest-text">
            {presentation.title}
          </h3>
          <StatusBadge tone="blue">Paraguai</StatusBadge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presentation.attributes.map((tag) => (
            <StatusBadge key={tag} tone="gray">
              {tag}
            </StatusBadge>
          ))}
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase text-inest-muted">Fornecedor</p>
        <strong className="mt-0.5 block truncate text-sm text-inest-text">
          {item.product.supplier}
        </strong>
        <p className="mt-1 truncate text-xs text-inest-muted">
          {item.product.city || item.product.store}
        </p>
      </div>
      <div className="min-w-0 md:text-right">
        <p className="text-[10px] font-black uppercase text-inest-muted">Custo final</p>
        <strong className="mt-0.5 block text-sm text-inest-text">
          {formatCurrency(item.importCosts.totalCost)}
        </strong>
        <p className="mt-2 text-[10px] font-black uppercase text-inest-muted">Lucro</p>
        <strong className="mt-0.5 block text-sm text-inest-green">
          {formatCurrency(item.desiredNetProfit)}
        </strong>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1 md:items-end">
        <span className="text-[10px] font-black uppercase text-inest-muted">Preco de venda</span>
        <strong className="font-display text-2xl font-black text-inest-text">
          {formatCurrency(item.salePrice)}
        </strong>
        <span className="text-xs font-bold text-inest-muted">
          Margem {formatPercent(item.margin)}
        </span>
        <ActionButton
          variant="success"
          className="mt-1 h-9 px-3 text-xs"
          disabled={generating}
          onClick={onGenerateOffer}
        >
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
