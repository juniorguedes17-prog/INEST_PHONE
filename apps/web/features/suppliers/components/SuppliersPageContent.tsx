'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  ActionButton,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Modal,
  PageHeader,
  StatusBadge,
} from '@/components/shared';
import { useSupplierContacts } from '../hooks/useSupplierContacts';
import { SupplierContactFormPayload, SupplierContactItem } from '../types/suppliers';

const emptyForm: SupplierContactFormPayload = {
  supplierName: '',
  whatsappNumber: '',
  address: '',
};

export function SuppliersPageContent() {
  const {
    contacts,
    filters,
    setFilters,
    loading,
    saving,
    error,
    success,
    load,
    save,
    toggleActive,
  } = useSupplierContacts();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<SupplierContactItem | null>(null);

  function openCreateModal() {
    setEditingContact(null);
    setModalOpen(true);
  }

  function openEditModal(contact: SupplierContactItem) {
    setEditingContact(contact);
    setModalOpen(true);
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Automacao do Radar Brasil"
        title="Fornecedores"
        description="Contatos operacionais identificados pelo WhatsApp. Apenas contatos ativos serao processados pela automacao."
        actions={
          <>
            {success ? <StatusBadge tone="green">{success}</StatusBadge> : null}
            <ActionButton variant="secondary" onClick={() => void load()} disabled={loading}>
              Atualizar
            </ActionButton>
            <ActionButton onClick={openCreateModal}>Novo contato</ActionButton>
          </>
        }
      />

      {error ? <ErrorState title="Atencao" description={error} /> : null}

      <section className="grid gap-4 rounded-2xl border border-inest-line/70 bg-inest-surface p-5 shadow-[0_14px_34px_rgba(16,24,40,0.055)] lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-inest-muted">
            Buscar fornecedor, telefone ou endereco
          </span>
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
            className="field-control"
            placeholder="Ex.: Elite Shop ou 5511943020886"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold text-inest-muted">Status</span>
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value as typeof current.status,
              }))
            }
            className="field-control"
          >
            <option value="all">Todos os contatos</option>
            <option value="active">Ativos</option>
            <option value="inactive">Inativos</option>
          </select>
        </label>
      </section>

      <section className="grid gap-3" aria-live="polite">
        {!loading ? (
          <p className="text-sm font-bold text-inest-muted">
            {contacts.length}{' '}
            {contacts.length === 1 ? 'contato encontrado' : 'contatos encontrados'}
          </p>
        ) : null}
        {loading ? <LoadingState /> : null}
        {!loading && !contacts.length ? (
          <EmptyState
            title="Nenhum contato encontrado."
            description="Cadastre um numero de WhatsApp para habilitar a identificacao automatica do fornecedor."
            action={<ActionButton onClick={openCreateModal}>Cadastrar contato</ActionButton>}
          />
        ) : null}
        {contacts.map((contact) => (
          <Card key={contact.id} className="p-5">
            <article className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)_auto] md:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-card-title">{contact.supplierName}</h3>
                  <StatusBadge tone={contact.isActive ? 'green' : 'gray'}>
                    {contact.isActive ? 'Ativo' : 'Inativo'}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-sm text-inest-muted">
                  {contact.address || 'Endereco nao informado'}
                </p>
              </div>
              <div className="border-t border-inest-line/70 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-inest-muted">
                  WhatsApp identificado
                </p>
                <a
                  href={`https://wa.me/${contact.whatsappNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex text-sm font-black text-inest-blue hover:underline"
                >
                  +{formatPhone(contact.whatsappNumber)}
                </a>
                <p className="mt-1 text-xs text-inest-muted">
                  Somente digitos: {contact.whatsappNumber}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                <ActionButton
                  variant="secondary"
                  onClick={() => openEditModal(contact)}
                  disabled={saving}
                >
                  Editar
                </ActionButton>
                <ActionButton
                  variant={contact.isActive ? 'danger' : 'success'}
                  onClick={() => void toggleActive(contact)}
                  disabled={saving}
                >
                  {contact.isActive ? 'Desativar' : 'Ativar'}
                </ActionButton>
              </div>
            </article>
          </Card>
        ))}
      </section>

      <SupplierContactFormModal
        open={modalOpen}
        contact={editingContact}
        saving={saving}
        onClose={() => setModalOpen(false)}
        onSave={async (payload) => {
          const saved = await save(payload, editingContact?.id);
          if (saved) {
            setModalOpen(false);
          }
        }}
      />
    </div>
  );
}

function SupplierContactFormModal({
  open,
  contact,
  saving,
  onClose,
  onSave,
}: {
  open: boolean;
  contact: SupplierContactItem | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: SupplierContactFormPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<SupplierContactFormPayload>(emptyForm);

  useEffect(() => {
    setForm(
      contact
        ? {
            supplierName: contact.supplierName,
            whatsappNumber: contact.whatsappNumber,
            address: contact.address || '',
          }
        : emptyForm,
    );
  }, [contact, open]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSave(form);
  }

  return (
    <Modal open={open} title={contact ? 'Editar contato' : 'Novo contato'} onClose={onClose}>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <TextInput
          label="Fornecedor"
          value={form.supplierName}
          required
          onChange={(supplierName) => setForm((current) => ({ ...current, supplierName }))}
        />
        <TextInput
          label="WhatsApp"
          hint="Pode colar com +, espacos ou parenteses. O sistema salva apenas os digitos."
          value={form.whatsappNumber}
          required
          onChange={(whatsappNumber) => setForm((current) => ({ ...current, whatsappNumber }))}
        />
        <TextInput
          label="Endereco"
          value={form.address || ''}
          onChange={(address) => setForm((current) => ({ ...current, address }))}
        />
        <div className="flex justify-end gap-3">
          <ActionButton variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </ActionButton>
          <ActionButton type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar contato'}
          </ActionButton>
        </div>
      </form>
    </Modal>
  );
}

function TextInput({
  label,
  hint,
  required,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <input
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="field-control"
      />
      {hint ? <span className="mt-1 block text-xs text-inest-muted">{hint}</span> : null}
    </label>
  );
}

function formatPhone(phone: string) {
  if (phone.length === 13 && phone.startsWith('55')) {
    return `${phone.slice(0, 2)} (${phone.slice(2, 4)}) ${phone.slice(4, 9)}-${phone.slice(9)}`;
  }
  return phone;
}
