'use client';

import { useCallback, useEffect, useState } from 'react';
import { getDashboard } from '../services/dashboard-service';
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getDashboard(filters));
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

  return { data, filters, setFilters, loading, error };
}
