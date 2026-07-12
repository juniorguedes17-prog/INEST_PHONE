'use client';

import { useCallback, useEffect, useState } from 'react';
import { getDashboard, syncDashboardSource } from '../services/dashboard-service';
import { DashboardData, DashboardFilters } from '../types/dashboard';

const initialFilters: DashboardFilters = {
  startDate: '',
  endDate: '',
  category: '',
  productId: '',
  supplierId: '',
  userId: '',
};

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getDashboard(filters));
      setLastUpdated(new Date());
    } catch (dashboardError) {
      setError(
        dashboardError instanceof Error
          ? dashboardError.message
          : 'Nao foi possivel carregar o Dashboard.',
      );
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    setError(null);
    try {
      await syncDashboardSource();
      await load();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Nao foi possivel sincronizar.');
    } finally {
      setSyncing(false);
    }
  };

  return { data, filters, setFilters, loading, syncing, error, lastUpdated, load, sync };
}
