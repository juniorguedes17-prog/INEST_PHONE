'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createSupplierContact,
  listSupplierContacts,
  setSupplierContactActive,
  updateSupplierContact,
} from '../services/supplier-contacts-service';
import {
  SupplierContactFilters,
  SupplierContactFormPayload,
  SupplierContactItem,
} from '../types/suppliers';

const initialFilters: SupplierContactFilters = { search: '', status: 'all' };

export function useSupplierContacts() {
  const [contacts, setContacts] = useState<SupplierContactItem[]>([]);
  const [filters, setFilters] = useState<SupplierContactFilters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const apiFilters = useMemo(
    () => ({
      search: filters.search.trim(),
      isActive:
        filters.status === 'all' ? undefined : filters.status === 'active',
    }),
    [filters],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setContacts(await listSupplierContacts(apiFilters));
    } catch (contactError) {
      setError(
        contactError instanceof Error
          ? contactError.message
          : 'Nao foi possivel carregar os contatos de fornecedores.',
      );
    } finally {
      setLoading(false);
    }
  }, [apiFilters]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(payload: SupplierContactFormPayload, id?: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (id) {
        await updateSupplierContact(id, payload);
        setSuccess('Contato atualizado com sucesso.');
      } else {
        await createSupplierContact(payload);
        setSuccess('Contato cadastrado com sucesso.');
      }
      await load();
      return true;
    } catch (contactError) {
      setError(
        contactError instanceof Error
          ? contactError.message
          : 'Nao foi possivel salvar o contato.',
      );
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(contact: SupplierContactItem) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await setSupplierContactActive(contact.id, !contact.isActive);
      setSuccess(contact.isActive ? 'Contato desativado.' : 'Contato ativado.');
      await load();
    } catch (contactError) {
      setError(
        contactError instanceof Error
          ? contactError.message
          : 'Nao foi possivel atualizar o status do contato.',
      );
    } finally {
      setSaving(false);
    }
  }

  return {
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
  };
}
