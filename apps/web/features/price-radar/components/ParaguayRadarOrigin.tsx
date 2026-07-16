'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  SearchInput,
  StatusBadge,
} from '@/components/shared';
import {
  calculateImportCost,
  searchImportProducts,
} from '@/features/import-radar/services/import-radar-service';
import {
  ImportCalculation,
  ImportProduct,
} from '@/features/import-radar/types/import-radar';
import { calculateTemporaryImportPricing } from '@/features/pricing/services/pricing-service';
import {
  TEMPORARY_IMPORT_PRICING_STORAGE_KEY,
  TemporaryImportPricingRequest,
} from '@/features/pricing/types/pricing';

type SortMode = 'lowest' | 'highest' | 'recent' | 'stores' | 'name';

const emptyFilters = {
  category: '',
  brand: '',
  model: '',
  color: '',
  capacity: '',
  store: '',
  city: '',
  availability: '',
  minPrice: '',
  maxPrice: '',
};

export function ParaguayRadarOrigin() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const [products, setProducts] = useState<ImportProduct[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [sort, setSort] = useState<SortMode>('lowest');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [sendingToPricing, setSendingToPricing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [calculation, setCalculation] = useState<ImportCalculation | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const runSearch = useCallback(async (term: string) => {
    const query = term.trim();
    if (query.length < 2) {
      setProducts([]);
      setSubmittedSearch('');
      setPage(1);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await searchImportProducts({
        search: query,
        category: '',
        provider: 'compras_paraguai',
      });
      setProducts(response.results);
      setSubmittedSearch(query);
      setPage(1);
      setLastUpdated(new Date().toISOString());
      setSelectedIds(new Set());
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : 'Nao foi possivel consultar o Compras Paraguai.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (search.trim().length < 2 || search.trim() === submittedSearch) return;
    const timeout = window.setTimeout(() => void runSearch(search), 500);
    return () => window.clearTimeout(timeout);
  }, [runSearch, search, submittedSearch]);

  const options = useMemo(
    () => ({
      categories: uniqueValues(products.map((product) => product.category)),
      brands: uniqueValues(products.map((product) => product.brand)),
      models: uniqueValues(products.map((product) => product.model)),
      colors: uniqueValues(products.map((product) => product.color)),
      capacities: uniqueValues(products.map((product) => product.capacity)),
      stores: uniqueValues(products.map((product) => product.store)),
      cities: uniqueValues(products.map((product) => product.city)),
      availabilities: uniqueValues(products.map((product) => product.availability)),
    }),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const minimum = Number(filters.minPrice) || 0;
    const maximum = Number(filters.maxPrice) || Number.POSITIVE_INFINITY;
    const filtered = products.filter((product) =>
      (!filters.category || product.category === filters.category) &&
      (!filters.brand || product.brand === filters.brand) &&
      (!filters.model || product.model === filters.model) &&
      (!filters.color || product.color === filters.color) &&
      (!filters.capacity || product.capacity === filters.capacity) &&
      (!filters.store || product.store === filters.store) &&
      (!filters.city || product.city === filters.city) &&
      (!filters.availability || product.availability === filters.availability) &&
      product.priceUsd >= minimum &&
      product.priceUsd <= maximum,
    );

    return filtered.sort((left, right) => {
      if (sort === 'highest') return right.priceUsd - left.priceUsd;
      if (sort === 'recent') return dateValue(right.consultedAt) - dateValue(left.consultedAt);
      if (sort === 'stores') return (right.storeCount ?? 0) - (left.storeCount ?? 0);
      if (sort === 'name') return left.name.localeCompare(right.name);
      return left.priceUsd - right.priceUsd;
    });
  }, [filters, products, sort]);

  useEffect(() => setPage(1), [filters, pageSize, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const visibleProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);
  const selectedProduct = products.find((product) => selectedIds.has(product.id));
  const priceValues = filteredProducts.map((product) => product.priceUsd);
  const namedSupplierCount = new Set(
    filteredProducts.flatMap((product) => product.store ? [product.store] : []),
  ).size;
  const supplierCount = Math.max(
    namedSupplierCount,
    ...filteredProducts.map((product) => product.storeCount ?? product.offerCount ?? 0),
  );
  const filterContent = (
    <ParaguayFilters filters={filters} options={options} onChange={setFilters} />
  );

  async function calculate(product?: ImportProduct) {
    const target = product ?? (selectedIds.size === 1 ? selectedProduct : undefined);
    if (!target) return;
    setCalculating(true);
    setError(null);
    try {
      setCalculation(await calculateImportCost(target));
    } catch (calculationError) {
      setError(
        calculationError instanceof Error
          ? calculationError.message
          : 'Nao foi possivel calcular o custo do produto.',
      );
    } finally {
      setCalculating(false);
    }
  }

  async function sendToPricing() {
    if (!calculation) return;

    setSendingToPricing(true);
    setError(null);
    try {
      const payload = buildTemporaryPricingRequest(calculation);
      const pricing = await calculateTemporaryImportPricing(payload);
      window.sessionStorage.setItem(TEMPORARY_IMPORT_PRICING_STORAGE_KEY, JSON.stringify(pricing));
      setCalculation(null);
      router.push('/pricing');
    } catch (pricingError) {
      setError(
        pricingError instanceof Error
          ? pricingError.message
          : 'Nao foi possivel enviar este produto para a Precificacao.',
      );
    } finally {
      setSendingToPricing(false);
    }
  }

  function clearFilters() {
    setFilters(emptyFilters);
    setSelectedIds(new Set());
  }

  return (
    <div className="grid min-w-0 gap-4">
      <section className="rounded-xl border border-inest-line bg-white p-3 shadow-card">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar no Compras Paraguai"
            aria-label="Pesquisar produtos no Compras Paraguai"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <ActionButton variant="secondary" className="min-h-11 lg:hidden" onClick={() => setFiltersOpen(true)}>
              Filtros
            </ActionButton>
            <ActionButton variant="secondary" className="min-h-11" onClick={clearFilters}>
              Limpar
            </ActionButton>
            <ActionButton
              variant="secondary"
              className="min-h-11"
              disabled={loading || search.trim().length < 2}
              onClick={() => void runSearch(search)}
            >
              Atualizar
            </ActionButton>
            <ActionButton
              className="min-h-11"
              disabled={selectedIds.size !== 1 || calculating}
              onClick={() => void calculate()}
              title={selectedIds.size > 1 ? 'Selecione apenas um produto para calcular o custo.' : undefined}
            >
              {calculating ? 'Calculando...' : 'Calcular Custo'}
            </ActionButton>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge tone="blue">PY</StatusBadge>
          <StatusBadge tone="gray">Fonte: Compras Paraguai</StatusBadge>
          <span className="text-xs font-bold text-inest-muted">
            {lastUpdated ? `Consultado em ${formatDateTime(lastUpdated)}` : 'Digite ao menos 2 caracteres para pesquisar'}
          </span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-5" aria-label="Indicadores Paraguai">
        <KpiCard label="Produtos" value={String(filteredProducts.length)} detail="Resultados reais" tone="blue" />
        <KpiCard label="Fornecedores" value={String(supplierCount)} detail="Lojas identificadas" tone="purple" />
        <KpiCard label="Menor preco" value={formatUsd(minimum(priceValues))} detail="Preco publicado" tone="green" />
        <KpiCard label="Preco medio" value={formatUsd(average(priceValues))} detail="Produtos exibidos" tone="blue" />
        <KpiCard label="Maior preco" value={formatUsd(maximum(priceValues))} detail="Preco publicado" tone="amber" />
      </section>

      {error ? (
        <ErrorState
          title="Nao foi possivel atualizar o Radar Paraguai"
          description={error}
          action={<ActionButton onClick={() => void runSearch(search)}>Tentar novamente</ActionButton>}
        />
      ) : null}

      <section className="grid min-w-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <FilterSidebar eyebrow="PY" title="Filtros" className="hidden max-h-[calc(100vh-240px)] lg:block">
          {filterContent}
        </FilterSidebar>

        <div className="min-w-0">
          <div className="mb-3 grid gap-2 rounded-xl border border-inest-line bg-white p-3 shadow-card sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-inest-text">
              <input
                type="checkbox"
                checked={visibleProducts.length > 0 && visibleProducts.every((product) => selectedIds.has(product.id))}
                onChange={(event) => {
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    visibleProducts.forEach((product) => event.target.checked ? next.add(product.id) : next.delete(product.id));
                    return next;
                  });
                }}
                className="h-5 w-5 accent-inest-blue"
              />
              {selectedIds.size ? `${selectedIds.size} selecionados` : 'Selecionar pagina'}
            </label>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortMode)} className="field-control min-h-11" aria-label="Ordenar resultados">
              <option value="lowest">Menor preco</option>
              <option value="highest">Maior preco</option>
              <option value="recent">Mais recentes</option>
              <option value="stores">Mais lojas</option>
              <option value="name">Produto</option>
            </select>
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="field-control min-h-11" aria-label="Itens por pagina">
              <option value={10}>10 por pagina</option>
              <option value={20}>20 por pagina</option>
              <option value={30}>30 por pagina</option>
            </select>
          </div>

          <div className="grid gap-3">
            {loading ? <LoadingState /> : null}
            {!loading && !submittedSearch ? (
              <EmptyState title="Pesquise um produto no Paraguai." description="Informe modelo, capacidade ou categoria para consultar a fonte oficial." />
            ) : null}
            {!loading && submittedSearch && !products.length && !error ? (
              <EmptyState title="Nenhum produto encontrado." description={`A fonte nao retornou resultados para "${submittedSearch}".`} />
            ) : null}
            {!loading && products.length > 0 && !filteredProducts.length ? (
              <EmptyState title="Nenhum resultado para estes filtros." description="Limpe os filtros ou amplie a faixa de preco." action={<ActionButton variant="secondary" onClick={clearFilters}>Limpar filtros</ActionButton>} />
            ) : null}
            {!loading ? visibleProducts.map((product) => (
              <ParaguayProductCard
                key={product.id}
                product={product}
                selected={selectedIds.has(product.id)}
                onSelect={(checked) => setSelectedIds((current) => {
                  const next = new Set(current);
                  if (checked) {
                    next.add(product.id);
                  } else {
                    next.delete(product.id);
                  }
                  return next;
                })}
                onCalculate={() => void calculate(product)}
              />
            )) : null}
          </div>

          <div className="mt-4 rounded-xl border border-inest-line bg-white p-4 shadow-card">
            <Pagination page={page} totalPages={totalPages} totalItems={filteredProducts.length} onPageChange={setPage} />
          </div>
        </div>
      </section>

      <Drawer open={filtersOpen} title="Filtros - Paraguai" onClose={() => setFiltersOpen(false)}>
        <div className="grid gap-3">
          {filterContent}
          <ActionButton variant="secondary" className="min-h-11" onClick={clearFilters}>Limpar filtros</ActionButton>
          <ActionButton className="min-h-11" onClick={() => setFiltersOpen(false)}>Ver resultados</ActionButton>
        </div>
      </Drawer>

      <CalculationModal
        calculation={calculation}
        sending={sendingToPricing}
        onClose={() => setCalculation(null)}
        onSendToPricing={() => void sendToPricing()}
      />
    </div>
  );
}

function ParaguayProductCard({ product, selected, onSelect, onCalculate }: { product: ImportProduct; selected: boolean; onSelect: (checked: boolean) => void; onCalculate: () => void }) {
  return (
    <article className={`grid min-w-0 gap-3 rounded-xl border bg-white p-3 shadow-card transition sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center ${selected ? 'border-inest-blue ring-2 ring-blue-100' : 'border-inest-line hover:border-blue-200'}`}>
      <div
        className="aspect-square w-full max-w-[88px] rounded-lg border border-inest-line bg-contain bg-center bg-no-repeat"
        style={product.imageUrl ? { backgroundImage: `url("${product.imageUrl}")` } : undefined}
        role="img"
        aria-label={`Imagem de ${product.name}`}
      />
      <div className="min-w-0">
        <div className="flex min-w-0 items-start gap-2">
          <input type="checkbox" checked={selected} onChange={(event) => onSelect(event.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-inest-blue" aria-label={`Selecionar ${product.name}`} />
          <div className="min-w-0">
            <h3 className="text-sm font-extrabold text-inest-text sm:text-base">{product.name}</h3>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <StatusBadge tone="blue">PY</StatusBadge>
              {product.category ? <StatusBadge tone="gray">{product.category}</StatusBadge> : null}
              {product.capacity ? <StatusBadge tone="gray">{product.capacity}</StatusBadge> : null}
              {product.color ? <StatusBadge tone="gray">{product.color}</StatusBadge> : null}
            </div>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
          <Info label="Loja" value={product.store || 'Nao informada'} />
          <Info label="Cidade" value={product.city || 'Nao informada'} />
          <Info label="Lojas" value={String(product.storeCount ?? product.offerCount ?? 0)} />
          <Info label="Consulta" value={product.consultedAt ? formatDateTime(product.consultedAt) : 'Agora'} />
        </dl>
      </div>
      <div className="grid gap-2 sm:min-w-44 sm:text-right">
        <div>
          <span className="block text-xs font-bold text-inest-muted">Menor preco</span>
          <strong className="text-xl font-black text-inest-text">{formatUsd(product.minimumPriceUsd ?? product.priceUsd)}</strong>
          {product.averagePriceUsd ? <span className="block text-xs text-inest-muted">Media {formatUsd(product.averagePriceUsd)} - Max {formatUsd(product.maximumPriceUsd)}</span> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <a href={product.productUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-inest-line px-3 text-xs font-extrabold text-inest-text hover:bg-inest-soft">Ver fonte</a>
          <ActionButton className="min-h-11" onClick={onCalculate}>Calcular</ActionButton>
        </div>
      </div>
    </article>
  );
}

function ParaguayFilters({ filters, options, onChange }: { filters: typeof emptyFilters; options: Record<string, string[]>; onChange: (filters: typeof emptyFilters) => void }) {
  const optionKeys: Record<keyof Pick<typeof emptyFilters, 'category' | 'brand' | 'model' | 'color' | 'capacity' | 'store' | 'city' | 'availability'>, string> = {
    category: 'categories',
    brand: 'brands',
    model: 'models',
    color: 'colors',
    capacity: 'capacities',
    store: 'stores',
    city: 'cities',
    availability: 'availabilities',
  };

  return (
    <>
      {(['category', 'brand', 'model', 'color', 'capacity', 'store', 'city', 'availability'] as const).map((key, index) => (
        <FilterSection key={key} title={filterLabels[key]} defaultOpen={index < 3}>
          <select value={filters[key]} onChange={(event) => onChange({ ...filters, [key]: event.target.value })} className="field-control" aria-label={filterLabels[key]}>
            <option value="">Todos</option>
            {options[optionKeys[key]]?.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </FilterSection>
      ))}
      <FilterSection title="Faixa de preco" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" min="0" value={filters.minPrice} onChange={(event) => onChange({ ...filters, minPrice: event.target.value })} className="field-control" placeholder="Minimo" aria-label="Preco minimo em dolar" />
          <input type="number" min="0" value={filters.maxPrice} onChange={(event) => onChange({ ...filters, maxPrice: event.target.value })} className="field-control" placeholder="Maximo" aria-label="Preco maximo em dolar" />
        </div>
      </FilterSection>
    </>
  );
}

function CalculationModal({
  calculation,
  sending,
  onClose,
  onSendToPricing,
}: {
  calculation: ImportCalculation | null;
  sending: boolean;
  onClose: () => void;
  onSendToPricing: () => void;
}) {
  return (
    <Modal open={Boolean(calculation)} title="Custo estimado - Paraguai" onClose={onClose}>
      {calculation ? (
        <div className="grid gap-4">
          <div><strong className="block text-inest-text">{calculation.product.name}</strong><span className="text-sm text-inest-muted">Configuracao Financeira PY - {calculation.matchedProductType}</span></div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Cost label="Preco convertido" value={calculation.breakdown.convertedPrice} />
            <Cost label="Saida CDE" value={calculation.breakdown.cdeExit} />
            <Cost label="Redirecionamento" value={calculation.breakdown.redirectCost} />
            <Cost label="Despacho Brasil" value={calculation.breakdown.brazilDispatch} />
            <Cost label="Nota Fiscal" value={calculation.breakdown.invoiceTax} />
            <Cost label="Etiqueta" value={calculation.breakdown.correiosLabel} />
          </dl>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><span className="block text-xs font-bold uppercase text-blue-700">Total estimado</span><strong className="text-2xl font-black text-blue-950">{formatBrl(calculation.total)}</strong></div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionButton variant="secondary" className="min-h-11" onClick={onClose} disabled={sending}>
              Fechar
            </ActionButton>
            <ActionButton className="min-h-11" onClick={onSendToPricing} disabled={sending}>
              {sending ? 'Preparando...' : 'Enviar para Precificacao'}
            </ActionButton>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function buildTemporaryPricingRequest(calculation: ImportCalculation): TemporaryImportPricingRequest {
  const product = calculation.product;
  return {
    productId: product.id,
    productName: product.name,
    category: product.category || 'Sem categoria',
    supplier: product.store || product.provider,
    store: product.store || product.provider,
    productUrl: product.productUrl,
    priceUsd: product.priceUsd,
    dollarQuote: calculation.dollarQuote,
    convertedPrice: calculation.breakdown.convertedPrice,
    cdeExit: calculation.breakdown.cdeExit,
    redirectCost: calculation.breakdown.redirectCost,
    brazilDispatch: calculation.breakdown.brazilDispatch,
    invoiceTax: calculation.breakdown.invoiceTax,
    correiosLabel: calculation.breakdown.correiosLabel,
    totalCost: calculation.total,
    brand: product.brand,
    model: product.name,
    capacity: product.capacity,
    color: product.color,
    city: product.city,
    matchedProductType: calculation.matchedProductType,
  };
}

const filterLabels = { category: 'Categoria', brand: 'Marca', model: 'Modelo', color: 'Cor', capacity: 'Capacidade', store: 'Loja', city: 'Cidade', availability: 'Disponibilidade' };
function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="font-bold text-inest-muted">{label}</dt><dd className="truncate font-bold text-inest-text" title={value}>{value}</dd></div>; }
function Cost({ label, value }: { label: string; value: number }) { return <div className="rounded-lg border border-inest-line p-3"><dt className="text-inest-muted">{label}</dt><dd className="font-extrabold text-inest-text">{formatBrl(value)}</dd></div>; }
function uniqueValues(values: Array<string | undefined>) { return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b)); }
function minimum(values: number[]) { return values.length ? Math.min(...values) : 0; }
function maximum(values: number[]) { return values.length ? Math.max(...values) : 0; }
function average(values: number[]) { return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0; }
function dateValue(value?: string) { return value ? new Date(value).getTime() : 0; }
function formatUsd(value?: number) { return value ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value) : '--'; }
function formatBrl(value: number) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
