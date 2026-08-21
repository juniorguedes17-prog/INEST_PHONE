'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  KpiCard,
  LoadingState,
  Modal,
  Pagination,
  PageHeader,
  StatusBadge,
} from '@/components/shared';
import { listProducts } from '@/features/products/services/products-service';
import { ProductItem } from '@/features/products/types/products';
import { replaceBrazilRadarPricingWorkSnapshot } from '@/features/pricing/services/pricing-service';
import { listSuppliers } from '@/features/suppliers/services/suppliers-service';
import { SupplierItem } from '@/features/suppliers/types/suppliers';
import { usePriceRadar } from '../hooks/usePriceRadar';
import { PriceQuoteFormPayload, PriceQuoteItem } from '../types/price-radar';
import { BrazilRadarProduct, BrazilRadarProductCard } from './BrazilRadarProductCard';
import { PreparedRadarOrigin } from './PreparedRadarOrigin';
import { ParaguayRadarOrigin } from './ParaguayRadarOrigin';
import { RadarToolbar } from './RadarToolbar';
import { RadarOrigin, RadarOriginTabs } from './RadarOriginTabs';
import { BrazilRadarFiltersDrawer } from './BrazilRadarFiltersDrawer';
import {
  BrazilRadarFacetState,
  BrazilRadarFacetDimension,
  buildBrazilRadarFacetsFromIndex,
  countActiveBrazilRadarFacets,
  emptyBrazilRadarFacetState,
  areBrazilRadarFacetStatesEqual,
  filterBrazilRadarQuotesByIndex,
  normalizeBrazilRadarFacetState,
} from '../utils/brazil-radar-facets';
import {
  getBrazilRadarSnapshotCache,
  updateBrazilRadarUiState,
} from '../state/brazil-radar-snapshot-cache';

const sortOptions = [
  ['lowest_price', 'Menor preço'],
  ['highest_price', 'Maior preço'],
  ['recent', 'Mais recentes'],
  ['supplier', 'Fornecedor'],
  ['product', 'Produto'],
  ['delivery', 'Prazo de entrega'],
];

export function PriceRadarPageContent() {
  const router = useRouter();
  const radar = usePriceRadar();
  const [origin, setOrigin] = useState<RadarOrigin>('brasil');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<PriceQuoteItem | null>(null);
  const [facetFilters, setFacetFilters] = useState<BrazilRadarFacetState>(
    () => getBrazilRadarSnapshotCache().ui.facetFilters ?? createEmptyFacetFilters(),
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(() => getBrazilRadarSnapshotCache().ui.page);
  const [pageSize, setPageSize] = useState(() => getBrazilRadarSnapshotCache().ui.pageSize);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [handoffSending, setHandoffSending] = useState(false);
  const pageStateInitialized = useRef(false);

  const persistFacetFilters = useCallback((nextFilters: BrazilRadarFacetState) => {
    setFacetFilters(nextFilters);
    updateBrazilRadarUiState({ facetFilters: nextFilters });
  }, []);
  const persistPage = useCallback((nextPage: number) => {
    setPage(nextPage);
    updateBrazilRadarUiState({ page: nextPage });
  }, []);
  const persistPageSize = useCallback((nextPageSize: number) => {
    setPageSize(nextPageSize);
    updateBrazilRadarUiState({ pageSize: nextPageSize });
  }, []);

  useEffect(() => {
    async function loadReferences() {
      const [nextProducts, nextSuppliers] = await Promise.all([
        listProducts({
          search: '',
          categoryId: '',
          modelId: '',
          status: '',
          productType: '',
          colorId: '',
          storageId: '',
        }),
        listSuppliers({ search: '', source: '', status: 'ACTIVE' }),
      ]);
      setProducts(nextProducts);
      setSuppliers(nextSuppliers);
    }

    void loadReferences();
  }, []);

  const initialForm = useMemo<PriceQuoteFormPayload>(
    () => ({
      productId: editingQuote?.productId ?? products[0]?.id ?? '',
      supplierId: editingQuote?.supplierId ?? suppliers[0]?.id ?? '',
      costProduct: editingQuote?.costProduct ?? 0,
      deliveryTime: editingQuote?.deliveryTime ?? '',
      city: editingQuote?.city ?? '',
      contact: editingQuote?.contact ?? '',
      quality: editingQuote?.quality ?? '',
      notes: editingQuote?.notes ?? '',
      quoteDate: editingQuote?.quoteDate?.slice(0, 10) ?? '',
    }),
    [editingQuote, products, suppliers],
  );

  const visibleRadarQuotes = radar.visibleQuotes;
  const facetIndex = radar.facetIndex;
  const facets = useMemo(
    () => buildBrazilRadarFacetsFromIndex(facetIndex, facetFilters),
    [facetFilters, facetIndex],
  );
  const normalizedFacetFilters = useMemo(
    () => normalizeBrazilRadarFacetState(facetFilters, facets),
    [facetFilters, facets],
  );
  const filteredQuotes = useMemo(
    () => filterBrazilRadarQuotesByIndex(facetIndex, normalizedFacetFilters),
    [facetIndex, normalizedFacetFilters],
  );
  const activeFilterCount = useMemo(
    () => countActiveBrazilRadarFacets(normalizedFacetFilters),
    [normalizedFacetFilters],
  );

  useEffect(() => {
    if (!areBrazilRadarFacetStatesEqual(facetFilters, normalizedFacetFilters)) {
      persistFacetFilters(normalizedFacetFilters);
    }
  }, [facetFilters, normalizedFacetFilters, persistFacetFilters]);

  const groupedProducts = useMemo(() => toBrazilRadarProducts(filteredQuotes), [filteredQuotes]);
  const totalPages = Math.max(1, Math.ceil(groupedProducts.length / pageSize));
  const visibleProducts = useMemo(
    () => groupedProducts.slice((page - 1) * pageSize, page * pageSize),
    [groupedProducts, page, pageSize],
  );

  const lastUpdated = useMemo(() => {
    const latest = filteredQuotes.reduce<string | null>((current, quote) => {
      if (!current || new Date(quote.updatedAt) > new Date(current)) {
        return quote.updatedAt;
      }
      return current;
    }, null);
    return latest ? formatDateTime(latest) : undefined;
  }, [filteredQuotes]);

  const updatedToday = useMemo(
    () =>
      filteredQuotes.filter(
        (quote) => Date.now() - new Date(quote.updatedAt).getTime() < 24 * 60 * 60 * 1000,
      ).length,
    [filteredQuotes],
  );

  const activeSuppliers = useMemo(
    () => new Set(filteredQuotes.map((quote) => quote.supplier.id)).size,
    [filteredQuotes],
  );

  const displayKpis = useMemo(() => {
    const validQuotes = filteredQuotes.filter(
      (quote) => quote.valid && quote.status === 'valid' && quote.costProduct > 0,
    );
    const prices = validQuotes.map((quote) => quote.costProduct);
    return {
      lowest: prices.length ? Math.min(...prices) : 0,
      average: prices.length
        ? prices.reduce((total, price) => total + price, 0) / prices.length
        : 0,
      highest: prices.length ? Math.max(...prices) : 0,
      hidden: filteredQuotes.filter((quote) => quote.status === 'hidden').length,
    };
  }, [filteredQuotes]);

  useEffect(() => {
    if (!pageStateInitialized.current) {
      pageStateInitialized.current = true;
      return;
    }
    persistPage(1);
  }, [pageSize, facetFilters, persistPage, radar.filters.search, radar.filters.sort]);

  function clearFilters() {
    radar.setFilters({
      search: '',
      productId: '',
      supplierId: '',
      city: '',
      quality: '',
      deliveryTime: '',
      status: '',
      sort: 'lowest_price',
    });
    persistFacetFilters(createEmptyFacetFilters());
    setSelectedIds(new Set());
  }

  function changeFacetFilters(nextFilters: BrazilRadarFacetState) {
    const changedDimension = getChangedFacetDimension(facetFilters, nextFilters);
    const nextFacets = buildBrazilRadarFacetsFromIndex(facetIndex, nextFilters);
    const firstPass = normalizeBrazilRadarFacetState(nextFilters, nextFacets, changedDimension);
    const stableFacets = buildBrazilRadarFacetsFromIndex(facetIndex, firstPass);
    persistFacetFilters(normalizeBrazilRadarFacetState(firstPass, stableFacets));
  }

  function toggleSelected(id: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function sendToPricing(quote: PriceQuoteItem) {
    setHandoffError(null);
    try {
      if (quote.source !== 'BRAZIL_RADAR') {
        if (!quote.productId) {
          throw new Error('Produto do catálogo não identificado para Precificação.');
        }
        router.push(`/pricing?productId=${encodeURIComponent(quote.productId)}`);
        return;
      }

      if (!quote.sourceQuoteId) {
        throw new Error('Cotação do Radar Brasil sem identificador de origem.');
      }
      await replaceBrazilRadarPricingWorkSnapshot([quote.sourceQuoteId]);
      router.push('/pricing?source=br-radar');
    } catch (error) {
      setHandoffError(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar a cotação para Precificação.',
      );
    }
  }

  async function sendSelectedToPricing() {
    if (handoffSending) return;

    const selectedQuotes = groupedProducts
      .filter((product) => selectedIds.has(product.id))
      .map((product) => product.referenceQuote);
    if (!selectedQuotes.length) return;

    setHandoffSending(true);
    setHandoffError(null);
    try {
      const sourceQuoteIds = selectedQuotes
        .map((quote) => quote.sourceQuoteId)
        .filter((sourceQuoteId): sourceQuoteId is string => Boolean(sourceQuoteId));
      if (sourceQuoteIds.length !== selectedQuotes.length) {
        throw new Error('Cotação do Radar Brasil sem identificador de origem.');
      }

      await replaceBrazilRadarPricingWorkSnapshot(sourceQuoteIds);
      setSelectedIds(new Set());
      router.push('/pricing?source=br-radar');
    } catch (error) {
      setHandoffError(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar as cotações para Precificação.',
      );
    } finally {
      setHandoffSending(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <PageHeader
        eyebrow="Inteligência comercial"
        title="Radar de Preços"
        description="Central de custos de fornecedores para identificar melhores oportunidades."
        actions={
          origin === 'brasil' ? (
            <>
              {radar.success ? <StatusBadge tone="green">{radar.success}</StatusBadge> : null}
              {radar.revalidationError ? (
                <StatusBadge tone="amber">Atualização pendente</StatusBadge>
              ) : null}
              <ActionButton variant="secondary" onClick={() => setImportModalOpen(true)}>
                Importar CSV
              </ActionButton>
            </>
          ) : origin === 'paraguai' ? (
            <StatusBadge tone="green">Fonte oficial ativa</StatusBadge>
          ) : (
            <StatusBadge tone="amber">Estrutura preparada</StatusBadge>
          )
        }
      />

      {origin === 'brasil' && radar.error ? (
        <ErrorState title="Atenção" description={radar.error} />
      ) : null}
      {origin === 'brasil' && handoffError ? (
        <ErrorState title="Atenção" description={handoffError} />
      ) : null}

      <RadarOriginTabs
        value={origin}
        onChange={(nextOrigin) => {
          setOrigin(nextOrigin);
          setSelectedIds(new Set());
        }}
      />

      {origin === 'paraguai' ? <ParaguayRadarOrigin /> : null}
      {origin === 'eua' ? <PreparedRadarOrigin origin="eua" /> : null}

      {origin === 'brasil' ? (
        <>
          <RadarToolbar
            search={radar.filters.search}
            total={groupedProducts.length}
            lastUpdated={lastUpdated}
            sort={radar.filters.sort}
            sortOptions={sortOptions}
            pageSize={pageSize}
            updating={radar.isRevalidating}
            activeFilterCount={activeFilterCount}
            onSearchChange={(search) => radar.setFilters((current) => ({ ...current, search }))}
            onRefresh={() => void radar.reload()}
            onClear={clearFilters}
            onSortChange={(sort) => radar.setFilters((current) => ({ ...current, sort }))}
            onPageSizeChange={persistPageSize}
            onOpenFilters={() => setFiltersOpen(true)}
          />

          <section
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
            aria-label="Indicadores do Radar"
          >
            <KpiCard
              label="Produtos encontrados"
              value={String(groupedProducts.length)}
              detail="Resultado dos filtros atuais"
              tone="blue"
            />
            <KpiCard
              label="Atualizados hoje"
              value={String(updatedToday)}
              detail="Últimas 24 horas"
              tone="green"
            />
            <KpiCard
              label="Fornecedores ativos"
              value={String(activeSuppliers)}
              detail="Com cotações no Radar"
              tone="purple"
            />
            <KpiCard
              label="Menor preço"
              value={formatCurrency(displayKpis.lowest)}
              detail="Apenas registros válidos"
              tone="green"
            />
            <KpiCard
              label="Preço médio"
              value={formatCurrency(displayKpis.average)}
              detail="Base de cotações válidas"
              tone="blue"
            />
            <KpiCard
              label="Maior preço"
              value={formatCurrency(displayKpis.highest)}
              detail={`${displayKpis.hidden} registros ocultados`}
              tone="amber"
            />
          </section>

          <section className="min-w-0">
            <div className="min-h-0 overflow-y-auto pr-1 scrollbar-stable">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-inest-line bg-white px-4 py-2.5 shadow-card">
                <label className="flex items-center gap-2 text-sm font-bold text-inest-text">
                  <input
                    type="checkbox"
                    checked={
                      visibleProducts.length > 0 &&
                      visibleProducts.every((product) => selectedIds.has(product.id))
                    }
                    onChange={(event) => {
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        visibleProducts.forEach((product) => {
                          if (event.target.checked) next.add(product.id);
                          else next.delete(product.id);
                        });
                        return next;
                      });
                    }}
                    className="h-4 w-4 accent-inest-blue"
                  />
                  Selecionar página
                </label>
                <span className="text-xs font-bold text-inest-muted">
                  Página {page} de {totalPages}
                </span>
              </div>

              {selectedIds.size ? (
                <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-card">
                  <strong className="text-sm text-blue-800">
                    {selectedIds.size} produtos selecionados
                  </strong>
                  <div className="flex flex-wrap gap-2">
                    <ActionButton
                      disabled={handoffSending}
                      onClick={() => void sendSelectedToPricing()}
                    >
                      {handoffSending ? 'Enviando...' : 'Enviar para Precificação'}
                    </ActionButton>
                    <ActionButton variant="ghost" onClick={() => setSelectedIds(new Set())}>
                      Limpar seleção
                    </ActionButton>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3">
                {radar.loading ? <LoadingState /> : null}
                {!radar.loading && !visibleRadarQuotes.length ? (
                  <EmptyState
                    title="Radar ainda sem cotações."
                    description="Cadastre uma cotação ou importe uma lista CSV para iniciar."
                  />
                ) : null}
                {!radar.loading && visibleRadarQuotes.length > 0 && !filteredQuotes.length ? (
                  <EmptyState
                    title="Nenhum resultado para estes filtros."
                    description="Limpe os filtros ou amplie os critérios da consulta."
                    action={
                      <ActionButton variant="secondary" onClick={clearFilters}>
                        Limpar filtros
                      </ActionButton>
                    }
                  />
                ) : null}
                {!radar.loading
                  ? visibleProducts.map((product) => (
                      <BrazilRadarProductCard
                        key={product.id}
                        product={product}
                        selected={selectedIds.has(product.id)}
                        onSelect={toggleSelected}
                        onView={(selectedQuote) => {
                          setEditingQuote(selectedQuote);
                          setQuoteModalOpen(true);
                        }}
                        onSupplier={openWhatsapp}
                        onSendToPricing={(quote) => void sendToPricing(quote)}
                      />
                    ))
                  : null}
              </div>

              <div className="mt-4 rounded-xl border border-inest-line bg-white p-4 shadow-card">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  totalItems={groupedProducts.length}
                  onPageChange={persistPage}
                />
                {totalPages <= 1 ? (
                  <p className="text-sm text-inest-muted">
                    Exibindo {visibleProducts.length} de {groupedProducts.length} produtos
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <BrazilRadarFiltersDrawer
            open={filtersOpen}
            filters={facetFilters}
            facets={facets}
            resultCount={groupedProducts.length}
            onChange={changeFacetFilters}
            onClear={clearFilters}
            onClose={() => setFiltersOpen(false)}
          />
        </>
      ) : null}

      <QuoteFormModal
        open={quoteModalOpen}
        initialForm={initialForm}
        products={products}
        suppliers={suppliers}
        saving={radar.saving}
        onClose={() => setQuoteModalOpen(false)}
        onSave={async (payload) => {
          if (!editingQuote) return;
          await radar.save(payload, editingQuote.id);
          setQuoteModalOpen(false);
        }}
      />

      <CsvImportModal
        open={importModalOpen}
        saving={radar.saving}
        lastImport={radar.lastImport}
        onClose={() => setImportModalOpen(false)}
        onImport={radar.importCsv}
      />
    </div>
  );
}

function getChangedFacetDimension(
  previous: BrazilRadarFacetState,
  next: BrazilRadarFacetState,
): BrazilRadarFacetDimension | undefined {
  if (!arraysEqual(previous.categories, next.categories)) return 'categories';
  if (!arraysEqual(previous.models, next.models)) return 'models';
  if (previous.condition !== next.condition) return 'condition';
  if (!arraysEqual(previous.colors, next.colors)) return 'colors';
  if (!arraysEqual(previous.capacities, next.capacities)) return 'capacities';
  if (previous.minPrice !== next.minPrice || previous.maxPrice !== next.maxPrice) return 'price';
  return undefined;
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function QuoteFormModal({
  open,
  initialForm,
  products,
  suppliers,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  initialForm: PriceQuoteFormPayload;
  products: ProductItem[];
  suppliers: SupplierItem[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: PriceQuoteFormPayload) => Promise<void>;
}) {
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave({
      ...form,
      costProduct: Number(form.costProduct),
      quoteDate: form.quoteDate || undefined,
    });
  }

  return (
    <Modal open={open} title="Editar cotação" onClose={onClose}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <SelectInput
          label="Produto"
          value={form.productId}
          options={products.map((product) => [product.id, getProductTitle(product)])}
          onChange={(value) => setForm((current) => ({ ...current, productId: value }))}
        />
        <SelectInput
          label="Fornecedor"
          value={form.supplierId}
          options={suppliers.map((supplier) => [supplier.id, supplier.name])}
          onChange={(value) => setForm((current) => ({ ...current, supplierId: value }))}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <NumberInput
            label="Preço de custo"
            value={form.costProduct}
            onChange={(value) => setForm((current) => ({ ...current, costProduct: value }))}
          />
          <TextInput
            label="Prazo de entrega"
            value={form.deliveryTime ?? ''}
            onChange={(value) => setForm((current) => ({ ...current, deliveryTime: value }))}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Cidade"
            value={form.city ?? ''}
            onChange={(value) => setForm((current) => ({ ...current, city: value }))}
          />
          <TextInput
            label="Qualidade"
            value={form.quality ?? ''}
            onChange={(value) => setForm((current) => ({ ...current, quality: value }))}
          />
        </div>
        <TextInput
          label="Data da cotação"
          type="date"
          value={form.quoteDate ?? ''}
          onChange={(value) => setForm((current) => ({ ...current, quoteDate: value }))}
        />
        <TextArea
          label="Observações"
          value={form.notes ?? ''}
          onChange={(value) => setForm((current) => ({ ...current, notes: value }))}
        />
        <div className="flex justify-end gap-3">
          <ActionButton variant="secondary" onClick={onClose}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" disabled={saving || !form.productId || !form.supplierId}>
            {saving ? 'Salvando...' : 'Salvar'}
          </ActionButton>
        </div>
      </form>
    </Modal>
  );
}

function CsvImportModal({
  open,
  saving,
  lastImport,
  onClose,
  onImport,
}: {
  open: boolean;
  saving: boolean;
  lastImport: ReturnType<typeof usePriceRadar>['lastImport'];
  onClose: () => void;
  onImport: (csvContent: string) => Promise<void>;
}) {
  const [csvContent, setCsvContent] = useState(
    'productId,supplierId,costProduct,deliveryTime,city,quality,notes',
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onImport(csvContent);
  }

  return (
    <Modal open={open} title="Importar CSV" onClose={onClose}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <TextArea label="Conteudo CSV" value={csvContent} onChange={setCsvContent} rows={8} />
        {lastImport ? (
          <div className="rounded-xl border border-inest-line bg-inest-soft p-4 text-sm text-inest-muted">
            <strong className="block text-inest-text">Resultado da última importação</strong>
            {lastImport.validRecords} válidos, {lastImport.invalidRecords} inconsistências de{' '}
            {lastImport.totalRecords} linhas.
          </div>
        ) : null}
        <div className="flex justify-end gap-3">
          <ActionButton variant="secondary" onClick={onClose}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" disabled={saving}>
            {saving ? 'Importando...' : 'Importar'}
          </ActionButton>
        </div>
      </form>
    </Modal>
  );
}

function getProductTitle(product: ProductItem) {
  return [
    product.category?.name,
    product.model?.name,
    product.storage?.displayName,
    product.color?.name,
  ]
    .filter(Boolean)
    .join(' ');
}

function createEmptyFacetFilters(): BrazilRadarFacetState {
  return {
    ...emptyBrazilRadarFacetState,
    categories: [],
    models: [],
    colors: [],
    capacities: [],
  };
}

function toBrazilRadarProducts(quotes: PriceQuoteItem[]): BrazilRadarProduct[] {
  return quotes.map((quote) => ({
    id: quote.id,
    name: quote.productName,
    productDescription: quote.productDescription,
    category: quote.category,
    model: quote.model,
    color: quote.color,
    capacity: quote.capacity,
    lowestCost: quote.costProduct,
    supplierCount: 1,
    updatedAt: quote.updatedAt,
    referenceQuote: quote,
  }));
}

function openWhatsapp(quote: PriceQuoteItem) {
  if (!quote.supplier.whatsappLink) {
    return;
  }
  const message = `Olá! Tenho interesse no ${quote.productName} que encontrei no Radar de Preços da iNest. Poderia confirmar disponibilidade e valor?`;
  window.open(`${quote.supplier.whatsappLink}?text=${encodeURIComponent(message)}`, '_blank');
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="field-control"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full rounded-xl border border-inest-line bg-white px-4 py-3 outline-none focus:border-inest-blue"
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
        className="field-control"
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
