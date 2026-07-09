'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
} from '../services/suppliers-service';
import { SupplierFilters, SupplierFormPayload, SupplierItem } from '../types/suppliers';

const initialFilters: SupplierFilters = {
  search: '',
  source: '',
  status: '',
};

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [filters, setFilters] = useState<SupplierFilters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSuppliers(await listSuppliers(filters));
    } catch (supplierError) {
      setError(
        supplierError instanceof Error
          ? supplierError.message
          : 'Nao foi possivel carregar fornecedores.',
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const sources = useMemo(
    () =>
      Array.from(new Set(suppliers.map((supplier) => supplier.source).filter(Boolean))) as string[],
    [suppliers],
  );

  async function save(payload: SupplierFormPayload, id?: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (id) {
        await updateSupplier(id, payload);
        setSuccess('Fornecedor atualizado com sucesso.');
      } else {
        await createSupplier(payload);
        setSuccess('Fornecedor cadastrado com sucesso.');
      }
      await load();
    } catch (supplierError) {
      setError(
        supplierError instanceof Error
          ? supplierError.message
          : 'Nao foi possivel salvar fornecedor.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteSupplier(id);
      setSuccess('Fornecedor removido com exclusao logica.');
      await load();
    } catch (supplierError) {
      setError(
        supplierError instanceof Error
          ? supplierError.message
          : 'Nao foi possivel remover fornecedor.',
      );
    } finally {
      setSaving(false);
    }
  }

  return {
    suppliers,
    filters,
    setFilters,
    sources,
    loading,
    saving,
    error,
    success,
    save,
    remove,
  };
}
