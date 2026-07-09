'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  FilterSection,
  FilterSidebar,
  InfoTag,
  ListHeader,
  LoadingState,
  Modal,
  PageHeader,
  SettingsCard,
  StatusBadge,
} from '@/components/shared';
import { useSuppliers } from '../hooks/useSuppliers';
import { SupplierFormPayload, SupplierItem } from '../types/suppliers';

const supplierTypes = ['Nacional', 'Paraguai', 'Estados Unidos', 'Distribuidor', 'Marketplace'];
const statuses = [
  ['ACTIVE', 'Ativo'],
  ['INACTIVE', 'Inativo'],
];

export function SuppliersPageContent() {
  const { suppliers, filters, setFilters, sources, loading, saving, error, success, save, remove } =
    useSuppliers();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);

  const initialForm = useMemo<SupplierFormPayload>(
    () => ({
      name: editingSupplier?.name ?? '',
      contact: editingSupplier?.contact ?? '',
      phone: editingSupplier?.phone ?? '',
      source: editingSupplier?.source ?? 'Nacional',
      status: editingSupplier?.status ?? 'ACTIVE',
      whatsappLink: editingSupplier?.whatsappLink ?? '',
    }),
    [editingSupplier],
  );

  function openCreateModal() {
    setEditingSupplier(null);
    setModalOpen(true);
  }

  function openEditModal(supplier: SupplierItem) {
    setEditingSupplier(supplier);
    setModalOpen(true);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Cadastro"
        title="Fornecedores"
        description="Fonte oficial de contatos, origem e status dos fornecedores da iNest Phone."
        actions={
          <>
            {success ? <StatusBadge tone="green">{success}</StatusBadge> : null}
            <ActionButton onClick={openCreateModal}>Novo fornecedor</ActionButton>
          </>
        }
      />

      {error ? <ErrorState title="Atencao" description={error} /> : null}

      <section className="grid min-h-[calc(100vh-220px)] grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <FilterSidebar eyebrow="Fornecedores" title="Filtros">
          <FilterSection title="Busca">
            <TextInput
              label="Pesquisar"
              value={filters.search}
              onChange={(value) => setFilters((current) => ({ ...current, search: value }))}
            />
          </FilterSection>
          <FilterSection title="Tipo">
            <SelectInput
              label="Tipo"
              value={filters.source}
              options={[
                ['', 'Todos'],
                ...Array.from(new Set([...supplierTypes, ...sources])).map((item) => [item, item]),
              ]}
              onChange={(value) => setFilters((current) => ({ ...current, source: value }))}
            />
          </FilterSection>
          <FilterSection title="Status">
            <SelectInput
              label="Status"
              value={filters.status}
              options={[['', 'Todos'], ...statuses]}
              onChange={(value) => setFilters((current) => ({ ...current, status: value }))}
            />
          </FilterSection>
        </FilterSidebar>

        <div className="min-h-0 overflow-y-auto pr-1 scrollbar-stable">
          <ListHeader
            sticky
            eyebrow="Cadastro centralizado"
            title={`${suppliers.length} fornecedores encontrados`}
            description="Dados preparados para Radar de Precos, Radar de Importacao e futuras integracoes."
          />

          <div className="mt-5 grid gap-4">
            {loading ? <LoadingState /> : null}
            {!loading && !suppliers.length ? (
              <EmptyState
                title="Nenhum fornecedor encontrado."
                description="Ajuste os filtros ou cadastre um novo fornecedor."
              />
            ) : null}
            {!loading
              ? suppliers.map((supplier) => (
                  <SettingsCard
                    key={supplier.id}
                    eyebrow={supplier.source ?? 'Fornecedor'}
                    title={supplier.name}
                    description={
                      supplier.contact
                        ? `Contato principal: ${supplier.contact}`
                        : 'Contato nao informado'
                    }
                  >
                    <div className="grid gap-5 lg:grid-cols-[1fr_280px] lg:items-center">
                      <div className="flex flex-wrap gap-2">
                        <InfoTag>{supplier.phone ?? 'Telefone nao informado'}</InfoTag>
                        <InfoTag>{supplier.whatsappLink ?? 'WhatsApp nao cadastrado'}</InfoTag>
                        <StatusBadge tone={supplier.status === 'ACTIVE' ? 'green' : 'gray'}>
                          {translateStatus(supplier.status)}
                        </StatusBadge>
                      </div>
                      <div className="flex flex-wrap justify-start gap-3 lg:justify-end">
                        {supplier.whatsappLink ? (
                          <a
                            href={supplier.whatsappLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-11 items-center rounded-xl bg-inest-green px-4 text-sm font-black text-white"
                          >
                            WhatsApp
                          </a>
                        ) : null}
                        <Link
                          href={`/suppliers/${supplier.id}`}
                          className="inline-flex h-11 items-center rounded-xl border border-inest-line bg-white px-4 text-sm font-black text-inest-text"
                        >
                          Ver fornecedor
                        </Link>
                        <ActionButton variant="secondary" onClick={() => openEditModal(supplier)}>
                          Editar
                        </ActionButton>
                        <ActionButton variant="danger" onClick={() => void remove(supplier.id)}>
                          Remover
                        </ActionButton>
                      </div>
                    </div>
                  </SettingsCard>
                ))
              : null}
          </div>
        </div>
      </section>

      <SupplierFormModal
        open={modalOpen}
        supplier={editingSupplier}
        initialForm={initialForm}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={async (payload) => {
          await save(payload, editingSupplier?.id);
          setModalOpen(false);
        }}
      />
    </div>
  );
}

function translateStatus(status: string) {
  return statuses.find(([value]) => value === status)?.[1] ?? status;
}

function SupplierFormModal({
  open,
  supplier,
  initialForm,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  supplier: SupplierItem | null;
  initialForm: SupplierFormPayload;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: SupplierFormPayload) => Promise<void>;
}) {
  const [form, setForm] = useState(initialForm);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(form);
  }

  return (
    <Modal open={open} title={supplier ? 'Editar fornecedor' : 'Novo fornecedor'} onClose={onClose}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <TextInput
          label="Nome fantasia"
          value={form.name}
          onChange={(value) => setForm((current) => ({ ...current, name: value }))}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <SelectInput
            label="Tipo"
            value={form.source ?? ''}
            options={supplierTypes.map((item) => [item, item])}
            onChange={(value) => setForm((current) => ({ ...current, source: value }))}
          />
          <SelectInput
            label="Status"
            value={form.status ?? 'ACTIVE'}
            options={statuses}
            onChange={(value) => setForm((current) => ({ ...current, status: value }))}
          />
        </div>
        <TextInput
          label="Nome do contato"
          value={form.contact ?? ''}
          onChange={(value) => setForm((current) => ({ ...current, contact: value }))}
        />
        <TextInput
          label="WhatsApp / Telefone"
          value={form.phone ?? ''}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              phone: value,
              whatsappLink: buildWhatsappLink(value),
            }))
          }
        />
        <TextInput
          label="Link direto do WhatsApp"
          value={form.whatsappLink ?? ''}
          onChange={(value) => setForm((current) => ({ ...current, whatsappLink: value }))}
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

function buildWhatsappLink(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
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
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}
