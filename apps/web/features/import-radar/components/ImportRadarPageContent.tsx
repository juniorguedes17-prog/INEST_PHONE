'use client';

import {
  EmptyState,
  ErrorState,
  FilterSection,
  FilterSidebar,
  InfoTag,
  ListHeader,
  LoadingState,
  PageHeader,
  ProductCard,
  SettingsCard,
  StatusBadge,
} from '@/components/shared';
import { ImportCalculation, ImportProduct } from '../types/import-radar';
import { useImportRadar } from '../hooks/useImportRadar';

const providers = [
  ['mock', 'Mock Provider'],
  ['compras_paraguai', 'Compras Paraguai'],
];

export function ImportRadarPageContent() {
  const radar = useImportRadar();

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Importacao"
        title="Radar de Importacao"
        description="Pesquisa internacional simulada com calculo automatico de custo estimado."
        actions={
          <>
            <StatusBadge tone="blue">Dolar {formatCurrency(radar.dollarQuote)}</StatusBadge>
            <StatusBadge tone="green">{radar.history.length} eventos registrados</StatusBadge>
          </>
        }
      />

      {radar.error ? <ErrorState title="Atencao" description={radar.error} /> : null}

      <section className="grid min-h-[calc(100vh-220px)] grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <FilterSidebar eyebrow="Radar" title="Filtros">
          <FilterSection title="Pesquisa">
            <TextInput
              label="Buscar produto"
              value={radar.filters.search}
              onChange={(value) => radar.setFilters((current) => ({ ...current, search: value }))}
            />
          </FilterSection>

          <FilterSection title="Provider">
            <SelectInput
              label="Origem"
              value={radar.filters.provider}
              options={providers}
              onChange={(value) => radar.setFilters((current) => ({ ...current, provider: value }))}
            />
          </FilterSection>

          <FilterSection title="Categoria">
            <SelectInput
              label="Categoria"
              value={radar.filters.category}
              options={[['', 'Todas'], ...radar.categories.map((category) => [category, category])]}
              onChange={(value) => radar.setFilters((current) => ({ ...current, category: value }))}
            />
          </FilterSection>

          <FilterSection title="Cambio">
            <div className="rounded-2xl border border-inest-line bg-inest-soft p-4">
              <p className="text-sm font-bold text-inest-muted">Cotacao cadastrada</p>
              <strong className="mt-1 block font-display text-3xl font-black text-inest-text">
                {formatCurrency(radar.dollarQuote)}
              </strong>
              <p className="mt-2 text-sm text-inest-muted">
                Valor consumido de Custos Operacionais de Importacao.
              </p>
            </div>
          </FilterSection>
        </FilterSidebar>

        <div className="min-h-0 overflow-y-auto pr-1 scrollbar-stable">
          <ListHeader
            sticky
            eyebrow="Produtos internacionais"
            title={`${radar.products.length} produtos encontrados`}
            description="Provider desacoplado preparado para Compras Paraguai e novos marketplaces."
          />

          <div className="mt-5 grid gap-4">
            {radar.loading ? <LoadingState /> : null}
            {!radar.loading && !radar.products.length ? (
              <EmptyState
                title="Nenhum produto encontrado."
                description="Digite um termo de busca ou altere a categoria selecionada."
              />
            ) : null}
            {!radar.loading
              ? radar.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    title={product.name}
                    status={product.category}
                    tags={[product.store, product.provider, product.productUrl].filter(Boolean)}
                    meta={`Preco em dolar: ${formatUsd(product.priceUsd)} - Convertido: ${formatCurrency(
                      product.priceBrl,
                    )}`}
                    supplier={{
                      name: product.store,
                      location: 'Marketplace internacional',
                      delivery: 'Calculo sob demanda',
                    }}
                    price={formatCurrency(product.priceBrl)}
                    priceLabel={formatUsd(product.priceUsd)}
                    actions={[
                      {
                        label: 'Selecionar',
                        variant: 'success',
                        onClick: () => void radar.selectProduct(product),
                      },
                      {
                        label: 'Abrir link',
                        variant: 'secondary',
                        onClick: () => window.open(product.productUrl, '_blank'),
                      },
                    ]}
                  />
                ))
              : null}
          </div>
        </div>

        <CalculationPanel
          product={radar.selectedProduct}
          calculation={radar.calculation}
          loading={radar.saving}
        />
      </section>
    </div>
  );
}

function CalculationPanel({
  product,
  calculation,
  loading,
}: {
  product: ImportProduct | null;
  calculation: ImportCalculation | null;
  loading: boolean;
}) {
  return (
    <aside className="min-h-0 overflow-y-auto scrollbar-stable">
      <SettingsCard
        eyebrow="Calculo"
        title="Custo estimado"
        description="Detalhamento baseado nas configuracoes operacionais de importacao."
      >
        {loading ? <LoadingState /> : null}
        {!product && !loading ? (
          <EmptyState
            title="Selecione um produto."
            description="O total estimado aparecera aqui automaticamente."
          />
        ) : null}
        {product && calculation ? (
          <div className="grid gap-4">
            <div>
              <strong className="font-display text-xl text-inest-text">{product.name}</strong>
              <div className="mt-3 flex flex-wrap gap-2">
                <InfoTag>{calculation.matchedProductType}</InfoTag>
                <InfoTag>Dolar {formatCurrency(calculation.dollarQuote)}</InfoTag>
              </div>
            </div>

            <BreakdownRow label="Produto convertido" value={calculation.breakdown.convertedPrice} />
            <BreakdownRow label="Saida CDE" value={calculation.breakdown.cdeExit} />
            <BreakdownRow label="Redirecionamento" value={calculation.breakdown.redirectCost} />
            <BreakdownRow label="Despacho Brasil" value={calculation.breakdown.brazilDispatch} />
            <BreakdownRow label="Nota Fiscal" value={calculation.breakdown.invoiceTax} />
            <BreakdownRow label="Etiqueta Correios" value={calculation.breakdown.correiosLabel} />

            <div className="rounded-2xl bg-inest-text p-5 text-white">
              <p className="text-xs font-black uppercase tracking-wide text-white/70">
                Total estimado de importacao
              </p>
              <strong className="mt-2 block font-display text-4xl font-black">
                {formatCurrency(calculation.total)}
              </strong>
            </div>
          </div>
        ) : null}
      </SettingsCard>
    </aside>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-inest-line pt-3">
      <span className="text-sm font-bold text-inest-muted">{label}</span>
      <strong className="text-inest-text">{formatCurrency(value)}</strong>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatUsd(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <input
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
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
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
