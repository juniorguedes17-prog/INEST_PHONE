'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  clearIntegrationCache,
  exportIntegration,
  getIntegrationHistory,
  getIntegrationJobs,
  getIntegrationStatus,
  importIntegration,
  syncIntegration,
  testIntegration,
} from '../services/integrations-service';
import { ExportArtifact, IntegrationJob, IntegrationStatus } from '../types/integrations';

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [jobs, setJobs] = useState<IntegrationJob[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [lastArtifact, setLastArtifact] = useState<ExportArtifact | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextIntegrations, nextJobs, nextHistory] = await Promise.all([
        getIntegrationStatus(),
        getIntegrationJobs(),
        getIntegrationHistory(),
      ]);
      setIntegrations(nextIntegrations);
      setJobs(nextJobs);
      setHistory(nextHistory);
    } catch (integrationError) {
      setError(
        integrationError instanceof Error
          ? integrationError.message
          : 'Nao foi possivel carregar integracoes.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<{ message?: string }>) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await action();
      setSuccess(result.message ?? 'Operacao concluida.');
      await load();
    } catch (integrationError) {
      setError(
        integrationError instanceof Error
          ? integrationError.message
          : 'Nao foi possivel concluir a operacao.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function test(provider: string) {
    await run(() => testIntegration(provider));
  }

  async function sync(provider: string) {
    await run(() => syncIntegration(provider));
  }

  async function clearCache() {
    await run(clearIntegrationCache);
  }

  async function importData(source: string, content: string) {
    await run(() => importIntegration(source, content));
  }

  async function exportData(format: string, dataset: string) {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const artifact = await exportIntegration(format, dataset);
      setLastArtifact(artifact);
      setSuccess(`Exportacao gerada: ${artifact.filename}`);
      await load();
    } catch (integrationError) {
      setError(
        integrationError instanceof Error
          ? integrationError.message
          : 'Nao foi possivel gerar a exportacao.',
      );
    } finally {
      setSaving(false);
    }
  }

  return {
    integrations,
    jobs,
    history,
    lastArtifact,
    loading,
    saving,
    error,
    success,
    test,
    sync,
    clearCache,
    importData,
    exportData,
  };
}
