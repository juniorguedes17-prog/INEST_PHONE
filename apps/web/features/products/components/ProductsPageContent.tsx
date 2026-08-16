'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  ListHeader,
  LoadingState,
  Modal,
  PageHeader,
  ProductCard,
  SearchInput,
  StatusBadge,
} from '@/components/shared';
import { useProducts } from '../hooks/useProducts';
import { ProductFormPayload, ProductItem } from '../types/products';
import { ProductFacetsDrawer } from '@/features/price-radar/components/ProductFacetsDrawer';
import { buildCanonicalModelFacetOptions } from '@/features/price-radar/utils/brazil-radar-facets';
import { getProductCardPresentation } from '@/utils/product-card-presentation';

const productTypes = [
  ['IPHONE_SEALED', 'Novo'],
  ['IPHONE_USED', 'Seminovo'],
  ['APPLE_CPO', 'CPO'],
  ['MACBOOK', 'MacBook'],
  ['IPAD', 'iPad'],
  ['APPLE_WATCH', 'Apple Watch'],
  ['AIRPODS', 'AirPods'],
  ['ACCESSORY', 'Acessorio'],
];

const statuses = [
  ['ACTIVE', 'Ativo'],
  ['INACTIVE', 'Inativo'],
  ['APPROVED', 'Aprovado'],
  ['PENDING_REVIEW', 'Pendente'],
  ['REJECTED', 'Rejeitado'],
];

export function ProductsPageContent() {
  const {
    products,
    allProducts,
    references,
    filters,
    setFilters,
    loading,
    saving,
    error,
    success,
    save,
    remove,
    setActive,
  } = useProducts();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => key !== 'search' && Boolean(value)).length;
  const modelOptions = useMemo(
    () => buildCanonicalModelFacetOptions(allProducts.map(toProductFacetSource)),
    [allProducts],
  );

  const initialForm = useMemo<ProductFormPayload>(() => {
    const categoryId = editingProduct?.categoryId ?? references.categories[0]?.id ?? '';
    const firstModel = references.models.find((model) => model.categoryId === categoryId);

    return {
      categoryId,
      modelId: editingProduct?.modelId ?? firstModel?.id ?? '',
      colorId: editingProduct?.colorId ?? '',
      storageId: editingProduct?.storageId ?? '',
      productType: editingProduct?.productType ?? 'IPHONE_SEALED',
      status: editingProduct?.status ?? 'ACTIVE',
      qualityGrade: editingProduct?.qualityGrade ?? '',
      criticalNotes: editingProduct?.criticalNotes ?? '',
      productDescription: editingProduct?.productDescription ?? '',
      profitCondition: editingProduct?.profitCondition ?? 'NOVO',
      netProfit: formatProfitForInput(editingProduct?.netProfit),
    };
  }, [editingProduct, references.categories, references.models]);

  function openCreateModal() {
    setEditingProduct(null);
    setModalOpen(true);
  }

  function openEditModal(product: ProductItem) {
    setEditingProduct(product);
    setModalOpen(true);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Catalogo"
        title="Produtos"
        description="Catalogo mestre para modelos, categorias, cores, capacidades e produtos da iNest Phone."
        actions={
          <>
            {success ? <StatusBadge tone="green">{success}</StatusBadge> : null}
            <ActionButton onClick={openCreateModal}>Novo produto</ActionButton>
          </>
        }
      />

      {error ? <ErrorState title="Atencao" description={error} /> : null}

      <section className="min-h-[calc(100vh-220px)]">
        <div className="mb-3 flex flex-col gap-2 rounded-xl border border-inest-line bg-white p-3 shadow-card sm:flex-row sm:items-center">
          <SearchInput value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Pesquisar produto" aria-label="Pesquisar produtos" className="min-w-0 flex-1" />
          <ActionButton variant="secondary" onClick={() => setFiltersOpen(true)}>{activeFilterCount ? `Filtros (${activeFilterCount})` : 'Filtros'}</ActionButton>
        </div>
        <div className="min-h-0 overflow-y-auto pr-1 scrollbar-stable">
          <ListHeader
            sticky
            eyebrow="Catalogo inteligente"
            title={`${products.length} produtos encontrados`}
            description="Lista centralizada para os proximos modulos consumirem como fonte unica."
          />

          <div className="mt-4 grid gap-3">
            {loading ? <LoadingState /> : null}
            {!loading && !products.length ? (
              <EmptyState
                title="Nenhum produto encontrado."
                description="Ajuste os filtros ou cadastre um novo produto no catalogo."
              />
            ) : null}
            {!loading
              ? products.map((product) => (
                  <ProductCard
                    key={product.id}
                    title={getProductTitle(product)}
                    status={translateStatus(product.status)}
                    tags={
                      getProductCardPresentation({
                        canonicalDescription: product.productDescription,
                        rawDescription: getProductTitle(product),
                        capacity: product.storage?.displayName,
                        color: product.color?.name,
                      }).attributes
                    }
                    meta={product.criticalNotes ?? undefined}
                    supplier={{
                      name: 'Catalogo iNest',
                      location: 'Fonte oficial',
                      delivery: product.qualityGrade ?? undefined,
                    }}
                    price={formatCurrency(product.netProfit)}
                    actions={[
                      {
                        label: 'Editar',
                        variant: 'secondary',
                        onClick: () => openEditModal(product),
                      },
                      {
                        label: 'Remover',
                        variant: 'danger',
                        onClick: () => void remove(product.id),
                      },
                      {
                        label: product.active === false ? 'Ativar' : 'Desativar',
                        variant: 'secondary',
                        onClick: () => void setActive(product.id, product.active === false),
                      },
                    ]}
                  />
                ))
              : null}
          </div>
        </div>
      </section>

      <ProductFacetsDrawer
        open={filtersOpen}
        ariaLabel="Filtros de produtos"
        resultCount={products.length}
        categories={referenceGroup('Categoria', references.categories, filters.categoryId, (categoryId) => setFilters((current) => ({ ...current, categoryId, modelId: '' })))}
        models={{
          title: 'Modelo',
          options: modelOptions,
          selected: filters.modelId ? [filters.modelId] : [],
          onToggle: (modelId) => setFilters((current) => ({
            ...current,
            modelId: modelId === current.modelId ? '' : modelId,
          })),
          collapsible: true,
        }}
        colors={referenceGroup('Cor', references.colors, filters.colorId, (colorId) => setFilters((current) => ({ ...current, colorId })))}
        capacities={referenceGroup('Armazenamento / Capacidade', references.storages, filters.storageId, (storageId) => setFilters((current) => ({ ...current, storageId })))}
        additionalGroups={[pairGroup('Tipo', productTypes, filters.productType, (productType) => setFilters((current) => ({ ...current, productType }))), pairGroup('Status', statuses, filters.status, (status) => setFilters((current) => ({ ...current, status })))]}
        onClear={() => setFilters((current) => ({ ...current, search: '', categoryId: '', modelId: '', colorId: '', storageId: '', productType: '', status: '' }))}
        onClose={() => setFiltersOpen(false)}
      />

      <ProductFormModal
        open={modalOpen}
        product={editingProduct}
        initialForm={initialForm}
        references={references}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={async (payload) => {
          await save(payload, editingProduct?.id);
          setModalOpen(false);
        }}
      />
    </div>
  );
}

function getProductTitle(product: ProductItem) {
  return getProductCardPresentation({
    canonicalDescription: product.productDescription,
    rawDescription: [
      product.category?.name,
      product.model?.name,
      product.storage?.displayName,
      product.color?.name,
    ]
      .filter(Boolean)
      .join(' '),
    capacity: product.storage?.displayName,
    color: product.color?.name,
  }).title;
}

function toProductFacetSource(product: ProductItem) {
  return {
    productDescription: product.productDescription,
    category: product.category?.name,
    model: product.model?.name,
    color: product.color?.name,
    capacity: product.storage?.displayName,
    quality: product.qualityGrade,
    productType: product.productType,
    notes: product.criticalNotes,
  };
}

function translateStatus(status: string) {
  return statuses.find(([value]) => value === status)?.[1] ?? status;
}

function referenceGroup(
  title: string,
  items: Array<{ id?: string; name?: string | null; displayName?: string | null }>,
  value: string,
  onChange: (value: string) => void,
) {
  return {
    title,
    options: items
      .filter((item): item is { id: string; name?: string | null; displayName?: string | null } => Boolean(item.id))
      .map((item) => ({
        value: item.id,
        label: item.displayName ?? item.name ?? item.id,
        count: 1,
      })),
    selected: value ? [value] : [],
    onToggle: (nextValue: string) => onChange(nextValue === value ? '' : nextValue),
  };
}

function pairGroup(
  title: string,
  items: string[][],
  value: string,
  onChange: (value: string) => void,
) {
  return {
    title,
    options: items
      .filter(([optionValue]) => Boolean(optionValue))
      .map(([optionValue, label]) => ({
        value: optionValue ?? '',
        label: label ?? optionValue ?? '',
        count: 1,
      })),
    selected: value ? [value] : [],
    onToggle: (nextValue: string) => onChange(nextValue === value ? '' : nextValue),
  };
}

interface ProductFormModalProps {
  open: boolean;
  product: ProductItem | null;
  initialForm: ProductFormPayload;
  references: ReturnType<typeof useProducts>['references'];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: ProductFormPayload) => Promise<void>;
}

function ProductFormModal({
  open,
  product,
  initialForm,
  references,
  saving,
  onClose,
  onSave,
}: ProductFormModalProps) {
  const [form, setForm] = useState(initialForm);
  const availableModels = useMemo(
    () => references.models.filter((item) => item.categoryId === form.categoryId),
    [form.categoryId, references.models],
  );

  useEffect(() => {
    setForm(initialForm);
  }, [initialForm]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave({
      ...form,
      colorId: form.colorId || undefined,
      storageId: form.storageId || undefined,
    });
  }

  return (
    <Modal open={open} title={product ? 'Editar produto' : 'Novo produto'} onClose={onClose}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <SelectInput
          label="Categoria"
          value={form.categoryId}
          options={references.categories.map((item) => [item.id, item.name ?? item.id])}
          onChange={(value) => setForm((current) => ({
            ...current,
            categoryId: value,
            modelId: references.models.some((item) => item.id === current.modelId && item.categoryId === value)
              ? current.modelId
              : references.models.find((item) => item.categoryId === value)?.id ?? '',
          }))}
        />
        <TextInput
          label="Descricao do produto"
          value={form.productDescription}
          onChange={(value) => setForm((current) => ({ ...current, productDescription: value }))}
          required
        />
        <div className="grid gap-4 md:grid-cols-2">
          <SelectInput
            label="Condicao"
            value={form.profitCondition}
            options={[
              ['NOVO', 'Novo'],
              ['SEMINOVO', 'Seminovo'],
              ['CPO', 'CPO'],
            ]}
            onChange={(value) => setForm((current) => ({ ...current, profitCondition: value as ProductFormPayload['profitCondition'] }))}
          />
          <NumberInput
            label="Lucro liquido"
            value={form.netProfit}
            onChange={(value) => setForm((current) => ({ ...current, netProfit: value }))}
          />
        </div>
        <SelectInput
          label="Modelo"
          value={form.modelId}
          options={availableModels.map((item) => [item.id, item.name ?? item.id])}
          onChange={(value) => setForm((current) => ({ ...current, modelId: value }))}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <SelectInput
            label="Cor"
            value={form.colorId ?? ''}
            options={[
              ['', 'Nao informado'],
              ...references.colors.map((item) => [item.id, item.name ?? item.id]),
            ]}
            onChange={(value) => setForm((current) => ({ ...current, colorId: value }))}
          />
          <SelectInput
            label="Capacidade"
            value={form.storageId ?? ''}
            options={[
              ['', 'Nao informado'],
              ...references.storages.map((item) => [item.id, item.displayName ?? item.id]),
            ]}
            onChange={(value) => setForm((current) => ({ ...current, storageId: value }))}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectInput
            label="Tipo"
            value={form.productType}
            options={productTypes}
            onChange={(value) => setForm((current) => ({ ...current, productType: value }))}
          />
          <SelectInput
            label="Status"
            value={form.status}
            options={statuses}
            onChange={(value) => setForm((current) => ({ ...current, status: value }))}
          />
        </div>
        <TextInput
          label="Grade / Estado"
          value={form.qualityGrade ?? ''}
          onChange={(value) => setForm((current) => ({ ...current, qualityGrade: value }))}
        />
        <TextArea
          label="Observacoes"
          value={form.criticalNotes ?? ''}
          onChange={(value) => setForm((current) => ({ ...current, criticalNotes: value }))}
        />
        <div className="flex justify-end gap-3">
          <ActionButton variant="secondary" onClick={onClose}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </ActionButton>
        </div>
      </form>
    </Modal>
  );
}

function TextInput({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="field-control"
      />
    </label>
  );
}

function TextArea({
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
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-xl border border-inest-line bg-white px-4 py-3 outline-none focus:border-inest-blue"
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
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="field-control"
      />
    </label>
  );
}

function formatCurrency(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Nao informado';
}

function formatProfitForInput(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount)
    ? amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';
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
