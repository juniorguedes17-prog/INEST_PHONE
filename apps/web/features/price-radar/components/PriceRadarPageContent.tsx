'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  FilterSection,
  FilterSidebar,
  KpiCard,
  ListHeader,
  LoadingState,
  Modal,
  PageHeader,
  ProductCard,
  StatusBadge,
} from '@/components/shared';
import { listProducts } from '@/features/products/services/products-service';
import { ProductItem } from '@/features/products/types/products';
import { listSuppliers } from '@/features/suppliers/services/suppliers-service';
import { SupplierItem } from '@/features/suppliers/types/suppliers';
import { usePriceRadar } from '../hooks/usePriceRadar';
import { PriceQuoteFormPayload, PriceQuoteItem } from '../types/price-radar';

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

export function PriceRadarPageContent() {
  const radar = usePriceRadar();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [quoteModalOpen, setQuoteModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<PriceQuoteItem | null>(null);

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

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Inteligencia comercial"
        title="Radar de Precos"
        description="Central de custos de fornecedores para identificar melhores oportunidades."
        actions={
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
        }
      />

      {radar.error ? <ErrorState title="Atencao" description={radar.error} /> : null}

      <section className="grid min-h-[calc(100vh-220px)] grid-cols-1 gap-4 xl:grid-cols-[288px_minmax(0,1fr)]">
        <FilterSidebar eyebrow="Radar" title="Filtros">
          <FilterSection title="Busca">
            <TextInput
              label="Pesquisar"
              value={radar.filters.search}
              onChange={(value) => radar.setFilters((current) => ({ ...current, search: value }))}
            />
          </FilterSection>

          <FilterSection title="Produto">
            <SelectInput
              label="Produto"
              value={radar.filters.productId}
              options={[
                ['', 'Todos'],
                ...products.map((product) => [product.id, getProductTitle(product)]),
              ]}
              onChange={(value) =>
                radar.setFilters((current) => ({ ...current, productId: value }))
              }
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
              onChange={(value) =>
                radar.setFilters((current) => ({ ...current, supplierId: value }))
              }
            />
          </FilterSection>

          <FilterSection title="Cidade">
            <SelectInput
              label="Cidade"
              value={radar.filters.city}
              options={[['', 'Todas'], ...cities.map((city) => [city, city])]}
              onChange={(value) => radar.setFilters((current) => ({ ...current, city: value }))}
            />
          </FilterSection>

          <FilterSection title="Qualidade">
            <SelectInput
              label="Estado / qualidade"
              value={radar.filters.quality}
              options={[['', 'Todas'], ...qualities.map((quality) => [quality, quality])]}
              onChange={(value) => radar.setFilters((current) => ({ ...current, quality: value }))}
            />
          </FilterSection>

          <FilterSection title="Prazo">
            <SelectInput
              label="Prazo de entrega"
              value={radar.filters.deliveryTime}
              options={[['', 'Todos'], ...deliveryTimes.map((delivery) => [delivery, delivery])]}
              onChange={(value) =>
                radar.setFilters((current) => ({ ...current, deliveryTime: value }))
              }
            />
          </FilterSection>

          <FilterSection title="Status">
            <SelectInput
              label="Status"
              value={radar.filters.status}
              options={statusOptions}
              onChange={(value) => radar.setFilters((current) => ({ ...current, status: value }))}
            />
          </FilterSection>
        </FilterSidebar>

        <div className="min-h-0 overflow-y-auto pr-1 scrollbar-stable">
          <div className="mb-4 grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
            <KpiCard
              label="Menor preco valido"
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
              detail="Apenas registros validos"
              tone="purple"
            />
            <KpiCard
              label="Produtos ocultados"
              value={String(radar.kpis.hiddenCount)}
              detail="Reprovados ou ocultados"
              tone="amber"
            />
          </div>
          <ListHeader
            sticky
            eyebrow="Cotacoes de fornecedores"
            title={`${radar.quotes.length} produtos encontrados`}
            description="Filtros, ordenacao e ocultacao preservam as regras do BRD."
            actions={
              <SelectInput
                label="Ordenacao"
                value={radar.filters.sort}
                options={sortOptions}
                onChange={(value) => radar.setFilters((current) => ({ ...current, sort: value }))}
                compact
              />
            }
          />

          <div className="mt-4 grid gap-3">
            {radar.loading ? <LoadingState /> : null}
            {!radar.loading && !radar.quotes.length ? (
              <EmptyState
                title="Nenhuma cotacao encontrada."
                description="Ajuste os filtros, cadastre uma cotacao ou importe uma lista CSV."
              />
            ) : null}
            {!radar.loading
              ? radar.quotes.map((quote) => (
                  <ProductCard
                    key={quote.id}
                    title={quote.productName}
                    status={quote.status === 'hidden' ? 'Ocultado' : quote.quality || 'Valido'}
                    tags={
                      [
                        quote.category,
                        quote.color,
                        quote.capacity,
                        quote.productType,
                        quote.inconsistencies.length ? 'Pendente de revisao' : null,
                      ].filter(Boolean) as string[]
                    }
                    meta={`Atualizado em ${formatDateTime(quote.updatedAt)}${
                      quote.notes ? ` - ${quote.notes}` : ''
                    }`}
                    supplier={{
                      name: quote.supplier.name,
                      location: quote.city || quote.supplier.source || 'Local nao informado',
                      delivery: quote.deliveryTime || 'Prazo nao informado',
                    }}
                    price={formatCurrency(quote.costProduct)}
                    priceLabel="Preco do fornecedor"
                    actions={[
                      {
                        label: 'WhatsApp',
                        variant: 'success',
                        onClick: () => openWhatsapp(quote),
                      },
                      {
                        label: 'Editar',
                        variant: 'secondary',
                        onClick: () => {
                          setEditingQuote(quote);
                          setQuoteModalOpen(true);
                        },
                      },
                      {
                        label: 'Ocultar',
                        variant: 'danger',
                        onClick: () => void radar.hide(quote.id),
                      },
                    ]}
                  />
                ))
              : null}
          </div>
        </div>
      </section>

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
