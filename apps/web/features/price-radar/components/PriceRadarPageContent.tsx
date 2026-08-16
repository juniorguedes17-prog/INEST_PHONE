'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
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
import { calculateBrazilRadarQuotePricing } from '@/features/pricing/services/pricing-service';
import { BRAZIL_RADAR_PRICING_STORAGE_KEY } from '@/features/pricing/types/pricing';
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
  buildBrazilRadarFacets,
  countActiveBrazilRadarFacets,
  emptyBrazilRadarFacetState,
  filterBrazilRadarQuotes,
  isVisibleRadarQuote,
} from '../utils/brazil-radar-facets';

const sortOptions = [
  ['lowest_price', 'Menor preco'],
  ['highest_price', 'Maior preco'],
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
  const [facetFilters, setFacetFilters] = useState<BrazilRadarFacetState>(() => createEmptyFacetFilters());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [handoffError, setHandoffError] = useState<string | null>(null);

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

  const visibleRadarQuotes = useMemo(
    () => radar.quotes.filter(isVisibleRadarQuote),
    [radar.quotes],
  );
  const facets = useMemo(() => buildBrazilRadarFacets(visibleRadarQuotes), [visibleRadarQuotes]);
  const filteredQuotes = useMemo(
    () => filterBrazilRadarQuotes(visibleRadarQuotes, facetFilters),
    [facetFilters, visibleRadarQuotes],
  );
  const activeFilterCount = useMemo(
    () => countActiveBrazilRadarFacets(facetFilters),
    [facetFilters],
  );

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
      average: prices.length ? prices.reduce((total, price) => total + price, 0) / prices.length : 0,
      highest: prices.length ? Math.max(...prices) : 0,
      hidden: filteredQuotes.filter((quote) => quote.status === 'hidden').length,
    };
  }, [filteredQuotes]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, facetFilters, radar.filters.search, radar.filters.sort]);

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
    setFacetFilters(createEmptyFacetFilters());
    setSelectedIds(new Set());
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
          throw new Error('Produto do catalogo nao identificado para Precificacao.');
        }
        router.push(`/pricing?productId=${encodeURIComponent(quote.productId)}`);
        return;
      }

      if (!quote.sourceQuoteId) {
        throw new Error('Cotacao do Radar Brasil sem identificador de origem.');
      }
      const prepared = await calculateBrazilRadarQuotePricing({
        sourceQuoteId: quote.sourceQuoteId,
      });
      window.sessionStorage.setItem(
        BRAZIL_RADAR_PRICING_STORAGE_KEY,
        JSON.stringify(prepared),
      );
      router.push('/pricing?source=br-radar');
    } catch (error) {
      setHandoffError(
        error instanceof Error ? error.message : 'Nao foi possivel enviar a cotacao para Precificacao.',
      );
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <PageHeader
        eyebrow="Inteligencia comercial"
        title="Radar de Precos"
        description="Central de custos de fornecedores para identificar melhores oportunidades."
        actions={
          origin === 'brasil' ? (
            <>
              {radar.success ? <StatusBadge tone="green">{radar.success}</StatusBadge> : null}
              <ActionButton variant="secondary" onClick={() => setImportModalOpen(true)}>
                Importar CSV
              </ActionButton>
              <ActionButton
                onClick={() => {
                  setEditingQuote(null);
                  setQuoteModalOpen(true);
                }}
              >
                Nova cotacao
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
        <ErrorState title="Atencao" description={radar.error} />
      ) : null}
      {origin === 'brasil' && handoffError ? (
        <ErrorState title="Atencao" description={handoffError} />
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
        updating={radar.loading}
        activeFilterCount={activeFilterCount}
        onSearchChange={(search) =>
          radar.setFilters((current) => ({ ...current, search }))
        }
        onRefresh={() => void radar.reload()}
        onClear={clearFilters}
        onSortChange={(sort) => radar.setFilters((current) => ({ ...current, sort }))}
        onPageSizeChange={setPageSize}
        onOpenFilters={() => setFiltersOpen(true)}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" aria-label="Indicadores do Radar">
        <KpiCard
          label="Produtos encontrados"
          value={String(groupedProducts.length)}
          detail="Resultado dos filtros atuais"
          tone="blue"
        />
        <KpiCard
          label="Atualizados hoje"
          value={String(updatedToday)}
          detail="Ultimas 24 horas"
          tone="green"
        />
        <KpiCard
          label="Fornecedores ativos"
          value={String(activeSuppliers)}
          detail="Com cotacoes no Radar"
          tone="purple"
        />
        <KpiCard
          label="Menor preco"
          value={formatCurrency(displayKpis.lowest)}
          detail="Apenas registros validos"
          tone="green"
        />
        <KpiCard
          label="Preco medio"
          value={formatCurrency(displayKpis.average)}
          detail="Base de cotacoes validas"
          tone="blue"
        />
        <KpiCard
          label="Maior preco"
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
                checked={visibleProducts.length > 0 && visibleProducts.every((product) => selectedIds.has(product.id))}
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
              Selecionar pagina
            </label>
            <span className="text-xs font-bold text-inest-muted">
              Pagina {page} de {totalPages}
            </span>
          </div>

          {selectedIds.size ? (
            <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 shadow-card">
              <strong className="text-sm text-blue-800">{selectedIds.size} produtos selecionados</strong>
              <div className="flex flex-wrap gap-2">
                <ActionButton disabled title="Integracao com Precificacao preparada para evolucao futura">
                  Enviar para Precificacao
                </ActionButton>
                <ActionButton variant="ghost" onClick={() => setSelectedIds(new Set())}>
                  Limpar selecao
                </ActionButton>
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3">
            {radar.loading ? <LoadingState /> : null}
            {!radar.loading && !visibleRadarQuotes.length ? (
              <EmptyState
                title="Radar ainda sem cotacoes."
                description="Cadastre uma cotacao ou importe uma lista CSV para iniciar."
              />
            ) : null}
            {!radar.loading && visibleRadarQuotes.length > 0 && !filteredQuotes.length ? (
              <EmptyState
                title="Nenhum resultado para estes filtros."
                description="Limpe os filtros ou amplie os criterios da consulta."
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
              onPageChange={setPage}
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
        onChange={setFacetFilters}
        onClear={clearFilters}
        onClose={() => setFiltersOpen(false)}
      />

        </>
      ) : null}

      <QuoteFormModal
        open={quoteModalOpen}
        quote={editingQuote}
        initialForm={initialForm}
        products={products}
        suppliers={suppliers}
        saving={radar.saving}
        onClose={() => setQuoteModalOpen(false)}
        onSave={async (payload) => {
          await radar.save(payload, editingQuote?.id);
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

function QuoteFormModal({
  open,
  quote,
  initialForm,
  products,
  suppliers,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  quote: PriceQuoteItem | null;
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
    <Modal open={open} title={quote ? 'Editar cotacao' : 'Nova cotacao'} onClose={onClose}>
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
            label="Preco de custo"
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
          label="Data da cotacao"
          type="date"
          value={form.quoteDate ?? ''}
          onChange={(value) => setForm((current) => ({ ...current, quoteDate: value }))}
        />
        <TextArea
          label="Observacoes"
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
            <strong className="block text-inest-text">Resultado da ultima importacao</strong>
            {lastImport.validRecords} validos, {lastImport.invalidRecords} inconsistencias de{' '}
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
  const message = `Ola! Tenho interesse no ${quote.productName} que encontrei no Radar de Precos da iNest. Poderia confirmar disponibilidade e valor?`;
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
