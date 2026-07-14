'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ActionButton,
  Drawer,
  EmptyState,
  ErrorState,
  FilterSection,
  FilterSidebar,
  KpiCard,
  LoadingState,
  Modal,
  Pagination,
  PageHeader,
  StatusBadge,
} from '@/components/shared';
import { listProducts } from '@/features/products/services/products-service';
import { ProductItem } from '@/features/products/types/products';
import { listSuppliers } from '@/features/suppliers/services/suppliers-service';
import { SupplierItem } from '@/features/suppliers/types/suppliers';
import { usePriceRadar } from '../hooks/usePriceRadar';
import { PriceQuoteFormPayload, PriceQuoteItem } from '../types/price-radar';
import { BrazilRadarProduct, BrazilRadarProductCard } from './BrazilRadarProductCard';
import { PreparedRadarOrigin } from './PreparedRadarOrigin';
import { ParaguayRadarOrigin } from './ParaguayRadarOrigin';
import { RadarToolbar } from './RadarToolbar';
import { RadarOrigin, RadarOriginTabs } from './RadarOriginTabs';

const sortOptions = [
  ['lowest_price', 'Menor preco'],
  ['highest_price', 'Maior preco'],
  ['recent', 'Mais recentes'],
  ['supplier', 'Fornecedor'],
  ['product', 'Produto'],
  ['delivery', 'Prazo de entrega'],
];

const statusOptions = [
  ['', 'Todos'],
  ['valid', 'Validos'],
  ['hidden', 'Ocultados'],
];

const emptyVisualFilters = {
  category: '',
  brand: '',
  model: '',
  color: '',
  capacity: '',
  state: '',
  minPrice: '',
  maxPrice: '',
  availability: '',
  updatedWithin: '',
  origin: '',
};

export function PriceRadarPageContent() {
  const radar = usePriceRadar();
  const [origin, setOrigin] = useState<RadarOrigin>('brasil');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<PriceQuoteItem | null>(null);
  const [visualFilters, setVisualFilters] = useState(emptyVisualFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  const cities = useMemo(
    () => Array.from(new Set(radar.quotes.map((quote) => quote.city).filter(Boolean))),
    [radar.quotes],
  );
  const qualities = useMemo(
    () => Array.from(new Set(radar.quotes.map((quote) => quote.quality).filter(Boolean))),
    [radar.quotes],
  );
  const deliveryTimes = useMemo(
    () => Array.from(new Set(radar.quotes.map((quote) => quote.deliveryTime).filter(Boolean))),
    [radar.quotes],
  );

  const filterOptions = useMemo(
    () => ({
      categories: uniqueValues(radar.quotes.map((quote) => quote.category)),
      brands: uniqueValues(radar.quotes.map((quote) => quote.productName.split(' ')[0] ?? '')),
      models: uniqueValues(radar.quotes.map((quote) => quote.model)),
      colors: uniqueValues(radar.quotes.map((quote) => quote.color)),
      capacities: uniqueValues(radar.quotes.map((quote) => quote.capacity)),
      origins: uniqueValues(radar.quotes.map((quote) => quote.supplier.source ?? '')),
    }),
    [radar.quotes],
  );

  const filteredQuotes = useMemo(() => {
    const now = Date.now();
    const minPrice = Number(visualFilters.minPrice) || 0;
    const maxPrice = Number(visualFilters.maxPrice) || Number.POSITIVE_INFINITY;
    const updatedLimit = visualFilters.updatedWithin
      ? now - Number(visualFilters.updatedWithin) * 24 * 60 * 60 * 1000
      : 0;

    return radar.quotes.filter((quote) => {
      return (
        (!visualFilters.category || quote.category === visualFilters.category) &&
        (!visualFilters.brand || quote.productName.startsWith(visualFilters.brand)) &&
        (!visualFilters.model || quote.model === visualFilters.model) &&
        (!visualFilters.color || quote.color === visualFilters.color) &&
        (!visualFilters.capacity || quote.capacity === visualFilters.capacity) &&
        (!visualFilters.state || quote.city.toLowerCase().includes(visualFilters.state.toLowerCase())) &&
        quote.costProduct >= minPrice &&
        quote.costProduct <= maxPrice &&
        (!visualFilters.availability || quote.status === visualFilters.availability) &&
        (!updatedLimit || new Date(quote.updatedAt).getTime() >= updatedLimit) &&
        (!visualFilters.origin || quote.supplier.source === visualFilters.origin)
      );
    });
  }, [radar.quotes, visualFilters]);

  const groupedProducts = useMemo(() => groupQuotesByProduct(filteredQuotes), [filteredQuotes]);
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
      radar.quotes.filter(
        (quote) => Date.now() - new Date(quote.updatedAt).getTime() < 24 * 60 * 60 * 1000,
      ).length,
    [radar.quotes],
  );

  const activeSuppliers = useMemo(
    () => new Set(radar.quotes.map((quote) => quote.supplier.id)).size,
    [radar.quotes],
  );

  useEffect(() => {
    setPage(1);
  }, [pageSize, visualFilters, radar.filters.search, radar.filters.sort]);

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
    setVisualFilters(emptyVisualFilters);
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
        onSearchChange={(search) =>
          radar.setFilters((current) => ({ ...current, search }))
        }
        onRefresh={() => void radar.reload()}
        onClear={clearFilters}
        onSortChange={(sort) => radar.setFilters((current) => ({ ...current, sort }))}
        onPageSizeChange={setPageSize}
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
          value={formatCurrency(radar.kpis.lowestValidPrice)}
          detail="Apenas registros validos"
          tone="green"
        />
        <KpiCard
          label="Preco medio"
          value={formatCurrency(radar.kpis.averagePrice)}
          detail="Base de cotacoes validas"
          tone="blue"
        />
        <KpiCard
          label="Maior preco"
          value={formatCurrency(radar.kpis.highestPrice)}
          detail={`${radar.kpis.hiddenCount} registros ocultados`}
          tone="amber"
        />
      </section>

      <ActionButton
        variant="secondary"
        className="min-h-11 w-full xl:hidden"
        onClick={() => setFiltersOpen(true)}
      >
        Abrir filtros do Radar Brasil
      </ActionButton>

      <section className="grid min-w-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <FilterSidebar eyebrow="BR" title="Filtros" className="hidden max-h-[calc(100vh-220px)] xl:block">
          <FilterSection title="Categoria">
            <SelectInput
              label="Categoria"
              value={visualFilters.category}
              options={toOptions(filterOptions.categories, 'Todas')}
              onChange={(category) => setVisualFilters((current) => ({ ...current, category }))}
            />
          </FilterSection>

          <FilterSection title="Marca">
            <SelectInput
              label="Marca"
              value={visualFilters.brand}
              options={toOptions(filterOptions.brands, 'Todas')}
              onChange={(brand) => setVisualFilters((current) => ({ ...current, brand }))}
            />
          </FilterSection>

          <FilterSection title="Modelo">
            <SelectInput
              label="Modelo"
              value={visualFilters.model}
              options={toOptions(filterOptions.models, 'Todos')}
              onChange={(model) => setVisualFilters((current) => ({ ...current, model }))}
            />
          </FilterSection>

          <FilterSection title="Produto" defaultOpen={false}>
            <SelectInput
              label="Produto"
              value={radar.filters.productId}
              options={[
                ['', 'Todos'],
                ...products.map((product) => [product.id, getProductTitle(product)]),
              ]}
              onChange={(productId) =>
                radar.setFilters((current) => ({ ...current, productId }))
              }
            />
          </FilterSection>

          <FilterSection title="Cor" defaultOpen={false}>
            <SelectInput
              label="Cor"
              value={visualFilters.color}
              options={toOptions(filterOptions.colors, 'Todas')}
              onChange={(color) => setVisualFilters((current) => ({ ...current, color }))}
            />
          </FilterSection>

          <FilterSection title="Capacidade" defaultOpen={false}>
            <SelectInput
              label="Capacidade"
              value={visualFilters.capacity}
              options={toOptions(filterOptions.capacities, 'Todas')}
              onChange={(capacity) => setVisualFilters((current) => ({ ...current, capacity }))}
            />
          </FilterSection>

          <FilterSection title="Condicao">
            <SelectInput
              label="Condicao"
              value={radar.filters.quality}
              options={[['', 'Todas'], ...qualities.map((quality) => [quality, quality])]}
              onChange={(quality) => radar.setFilters((current) => ({ ...current, quality }))}
            />
          </FilterSection>

          <FilterSection title="Fornecedor">
            <SelectInput
              label="Fornecedor"
              value={radar.filters.supplierId}
              options={[
                ['', 'Todos'],
                ...suppliers.map((supplier) => [supplier.id, supplier.name]),
              ]}
              onChange={(supplierId) =>
                radar.setFilters((current) => ({ ...current, supplierId }))
              }
            />
          </FilterSection>

          <FilterSection title="Cidade" defaultOpen={false}>
            <SelectInput
              label="Cidade"
              value={radar.filters.city}
              options={[['', 'Todas'], ...cities.map((city) => [city, city])]}
              onChange={(city) => radar.setFilters((current) => ({ ...current, city }))}
            />
          </FilterSection>

          <FilterSection title="Estado" defaultOpen={false}>
            <TextInput
              label="UF ou estado"
              value={visualFilters.state}
              onChange={(state) => setVisualFilters((current) => ({ ...current, state }))}
            />
          </FilterSection>

          <FilterSection title="Faixa de preco" defaultOpen={false}>
            <div className="grid grid-cols-2 gap-2">
              <TextInput
                label="Minimo"
                type="number"
                value={visualFilters.minPrice}
                onChange={(minPrice) => setVisualFilters((current) => ({ ...current, minPrice }))}
              />
              <TextInput
                label="Maximo"
                type="number"
                value={visualFilters.maxPrice}
                onChange={(maxPrice) => setVisualFilters((current) => ({ ...current, maxPrice }))}
              />
            </div>
          </FilterSection>

          <FilterSection title="Disponibilidade" defaultOpen={false}>
            <SelectInput
              label="Disponibilidade"
              value={visualFilters.availability}
              options={statusOptions}
              onChange={(availability) =>
                setVisualFilters((current) => ({ ...current, availability }))
              }
            />
          </FilterSection>

          <FilterSection title="Atualizacao" defaultOpen={false}>
            <SelectInput
              label="Periodo"
              value={visualFilters.updatedWithin}
              options={[
                ['', 'Qualquer data'],
                ['1', 'Ultimas 24 horas'],
                ['7', 'Ultimos 7 dias'],
                ['30', 'Ultimos 30 dias'],
              ]}
              onChange={(updatedWithin) =>
                setVisualFilters((current) => ({ ...current, updatedWithin }))
              }
            />
          </FilterSection>

          <FilterSection title="Origem" defaultOpen={false}>
            <SelectInput
              label="Origem"
              value={visualFilters.origin}
              options={toOptions(filterOptions.origins, 'Todas')}
              onChange={(origin) => setVisualFilters((current) => ({ ...current, origin }))}
            />
          </FilterSection>

          <FilterSection title="Prazo" defaultOpen={false}>
            <SelectInput
              label="Prazo de entrega"
              value={radar.filters.deliveryTime}
              options={[['', 'Todos'], ...deliveryTimes.map((delivery) => [delivery, delivery])]}
              onChange={(deliveryTime) =>
                radar.setFilters((current) => ({ ...current, deliveryTime }))
              }
            />
          </FilterSection>
        </FilterSidebar>

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
            {!radar.loading && !radar.quotes.length ? (
              <EmptyState
                title="Radar ainda sem cotacoes."
                description="Cadastre uma cotacao ou importe uma lista CSV para iniciar."
              />
            ) : null}
            {!radar.loading && radar.quotes.length && !filteredQuotes.length ? (
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

      <Drawer open={filtersOpen} title="Filtros - Brasil" onClose={() => setFiltersOpen(false)}>
        <div className="grid gap-3">
          <SelectInput
            label="Categoria"
            value={visualFilters.category}
            options={toOptions(filterOptions.categories, 'Todas')}
            onChange={(category) => setVisualFilters((current) => ({ ...current, category }))}
          />
          <SelectInput
            label="Modelo"
            value={visualFilters.model}
            options={toOptions(filterOptions.models, 'Todos')}
            onChange={(model) => setVisualFilters((current) => ({ ...current, model }))}
          />
          <SelectInput
            label="Cor"
            value={visualFilters.color}
            options={toOptions(filterOptions.colors, 'Todas')}
            onChange={(color) => setVisualFilters((current) => ({ ...current, color }))}
          />
          <SelectInput
            label="Capacidade"
            value={visualFilters.capacity}
            options={toOptions(filterOptions.capacities, 'Todas')}
            onChange={(capacity) => setVisualFilters((current) => ({ ...current, capacity }))}
          />
          <SelectInput
            label="Condicao"
            value={radar.filters.quality}
            options={[['', 'Todas'], ...qualities.map((quality) => [quality, quality])]}
            onChange={(quality) => radar.setFilters((current) => ({ ...current, quality }))}
          />
          <SelectInput
            label="Fornecedor"
            value={radar.filters.supplierId}
            options={[['', 'Todos'], ...suppliers.map((supplier) => [supplier.id, supplier.name])]}
            onChange={(supplierId) => radar.setFilters((current) => ({ ...current, supplierId }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <TextInput
              label="Custo minimo"
              type="number"
              value={visualFilters.minPrice}
              onChange={(minPrice) => setVisualFilters((current) => ({ ...current, minPrice }))}
            />
            <TextInput
              label="Custo maximo"
              type="number"
              value={visualFilters.maxPrice}
              onChange={(maxPrice) => setVisualFilters((current) => ({ ...current, maxPrice }))}
            />
          </div>
          <ActionButton
            variant="secondary"
            className="min-h-11"
            onClick={() => {
              clearFilters();
              setFiltersOpen(false);
            }}
          >
            Limpar filtros
          </ActionButton>
          <ActionButton className="min-h-11" onClick={() => setFiltersOpen(false)}>
            Ver resultados
          </ActionButton>
        </div>
      </Drawer>

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

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function toOptions(values: string[], emptyLabel: string) {
  return [['', emptyLabel], ...values.map((value) => [value, value])];
}

function groupQuotesByProduct(quotes: PriceQuoteItem[]): BrazilRadarProduct[] {
  const grouped = new Map<string, BrazilRadarProduct & { supplierIds: Set<string> }>();

  quotes.forEach((quote) => {
    const current = grouped.get(quote.productId);
    if (!current) {
      grouped.set(quote.productId, {
        id: quote.productId,
        name: quote.productName,
        category: quote.category,
        model: quote.model,
        color: quote.color,
        capacity: quote.capacity,
        lowestCost: quote.costProduct,
        supplierCount: 1,
        supplierIds: new Set([quote.supplier.id]),
        updatedAt: quote.updatedAt,
        referenceQuote: quote,
      });
      return;
    }

    current.supplierIds.add(quote.supplier.id);
    current.supplierCount = current.supplierIds.size;

    if (quote.costProduct < current.lowestCost) {
      current.lowestCost = quote.costProduct;
      current.referenceQuote = quote;
    }

    if (new Date(quote.updatedAt) > new Date(current.updatedAt)) {
      current.updatedAt = quote.updatedAt;
    }
  });

  return Array.from(grouped.values()).map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    model: item.model,
    color: item.color,
    capacity: item.capacity,
    lowestCost: item.lowestCost,
    supplierCount: item.supplierCount,
    updatedAt: item.updatedAt,
    referenceQuote: item.referenceQuote,
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
