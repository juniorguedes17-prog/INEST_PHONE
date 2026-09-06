'use client';

import { FormEvent, useCallback, useState } from 'react';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  LoadingState,
  SearchInput,
  StatusBadge,
} from '@/components/shared';
import { searchUsaSourceProducts } from '@/features/import-radar/services/import-radar-service';
import { UsaSourceProduct } from '@/features/import-radar/types/import-radar';

export function UsaRadarOrigin() {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<UsaSourceProduct[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<UsaSourceProduct | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const normalizedQuery = query.trim();
      if (normalizedQuery.length < 2) {
        setProducts([]);
        setSelectedProduct(null);
        setSearched(false);
        setError('Digite pelo menos 2 caracteres para pesquisar.');
        return;
      }

      setLoading(true);
      setError(null);
      setSelectedProduct(null);
      try {
        setProducts(await searchUsaSourceProducts(normalizedQuery));
        setSearched(true);
      } catch (searchError) {
        setProducts([]);
        setSearched(true);
        setError(
          searchError instanceof Error
            ? searchError.message
            : 'Não foi possível consultar os providers USA.',
        );
      } finally {
        setLoading(false);
      }
    },
    [query],
  );

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-inest-line/70 bg-inest-surface p-4 shadow-[0_14px_34px_rgba(16,24,40,0.055)]">
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={search}>
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar iPhone, MacBook, Canon..."
            aria-label="Pesquisar produtos nos EUA"
          />
          <ActionButton type="submit" className="min-h-11" disabled={loading}>
            {loading ? 'Buscando...' : 'Buscar nos EUA'}
          </ActionButton>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge tone="blue">US</StatusBadge>
          <StatusBadge tone="gray">Apple · Amazon · UPCitemdb</StatusBadge>
          <span className="text-xs font-bold text-inest-muted">
            Resultados em USD, sem cálculo nesta etapa.
          </span>
        </div>
      </section>

      {error ? <ErrorState title="Busca USA" description={error} /> : null}
      {loading ? <LoadingState /> : null}
      {!loading && searched && !error && !products.length ? (
        <EmptyState title="Nenhum produto encontrado." description="Tente outro termo de busca." />
      ) : null}

      {!loading && products.length ? (
        <section className="grid gap-3" aria-label="Resultados da busca USA">
          <div className="flex items-center justify-between rounded-2xl border border-inest-line/70 bg-inest-surface px-4 py-3">
            <span className="text-sm font-bold text-inest-text">{products.length} resultados</span>
            <span className="text-xs text-inest-muted">Selecione um produto para continuar</span>
          </div>
          {products.map((product) => (
            <UsaProductCard
              key={`${product.providerName}:${product.sourceProductId}`}
              product={product}
              selected={
                selectedProduct?.sourceProductId === product.sourceProductId &&
                selectedProduct.providerName === product.providerName
              }
              onSelect={setSelectedProduct}
            />
          ))}
        </section>
      ) : null}

      {selectedProduct ? (
        <section
          className="rounded-2xl border border-inest-blue/30 bg-blue-50/50 p-4"
          aria-live="polite"
        >
          <p className="text-xs font-black uppercase tracking-wide text-inest-blue">
            Produto selecionado
          </p>
          <h3 className="mt-1 text-lg font-black text-inest-text">{selectedProduct.sourceName}</h3>
          <p className="mt-1 text-sm text-inest-muted">
            {selectedProduct.providerName} · {selectedProduct.retailer ?? 'Loja não informada'} ·{' '}
            {selectedProduct.sourceProductId}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function UsaProductCard({
  product,
  selected,
  onSelect,
}: {
  product: UsaSourceProduct;
  selected: boolean;
  onSelect: (product: UsaSourceProduct) => void;
}) {
  const attributes = [product.model, product.capacity, product.color, product.condition].filter(
    Boolean,
  );
  return (
    <article
      className={`grid gap-4 rounded-2xl border bg-inest-surface p-5 shadow-[0_14px_34px_rgba(16,24,40,0.055)] lg:grid-cols-[72px_minmax(0,1fr)_190px_auto] lg:items-center ${selected ? 'border-inest-blue bg-blue-50/40' : 'border-inest-line/70'}`}
    >
      <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-xl bg-inest-soft text-xs font-black text-inest-muted">
        {product.imageUrl ? (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(product.imageUrl)})` }}
          />
        ) : (
          'US'
        )}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="line-clamp-2 text-base font-black text-inest-text">
            {product.sourceName}
          </h3>
          <StatusBadge tone="green">US</StatusBadge>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {attributes.map((attribute) => (
            <span
              key={attribute}
              className="rounded-md bg-inest-soft px-2 py-1 text-xs font-semibold text-inest-muted"
            >
              {attribute}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-inest-muted">Provider: {product.providerName}</p>
        <p className="text-xs text-inest-muted">Retailer: {product.retailer ?? 'Não informado'}</p>
      </div>
      <div className="border-t border-inest-line/70 pt-3 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0 lg:text-right">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-inest-muted">
          Preço da fonte
        </span>
        <strong className="mt-1 block font-display text-2xl font-black text-inest-text">
          {formatUsd(product.priceUsd)}
        </strong>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        {product.sourceUrl ? (
          <a
            className="inline-flex min-h-11 items-center rounded-xl border border-inest-line px-3 text-sm font-bold text-inest-text"
            href={product.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            Abrir fonte
          </a>
        ) : null}
        <ActionButton
          variant={selected ? 'secondary' : 'success'}
          className="min-h-11"
          onClick={() => onSelect(product)}
        >
          {selected ? 'Selecionado' : 'Selecionar'}
        </ActionButton>
      </div>
    </article>
  );
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}
