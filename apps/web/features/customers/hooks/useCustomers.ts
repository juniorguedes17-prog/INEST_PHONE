'use client';
import { useCallback, useEffect, useState } from 'react';
import { getCustomers, syncCustomers } from '../services/customers-service';
import { CustomersResponse } from '../types/customers';

export function useCustomers() {
  const [data, setData] = useState<CustomersResponse | null>(null);
  const [search, setSearch] = useState(''); const [origin, setOrigin] = useState('');
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true); const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { setLoading(true); setError(null); try { setData(await getCustomers({ search, origin, page, pageSize })); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Nao foi possivel carregar clientes.'); } finally { setLoading(false); } }, [origin, page, pageSize, search]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [load]);
  const sync = async () => { setSyncing(true); setError(null); try { await syncCustomers(); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Nao foi possivel sincronizar.'); } finally { setSyncing(false); } };
  return { data, search, setSearch, origin, setOrigin, page, setPage, pageSize, setPageSize, loading, syncing, error, sync };
}
