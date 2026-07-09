'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSettings, resetSettingsDefaults, updateSettings } from '../services/settings-service';
import { SettingsPayload } from '../types/settings';

export function useSettings() {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setSettings(await getSettings());
    } catch (settingsError) {
      setError(
        settingsError instanceof Error
          ? settingsError.message
          : 'Nao foi possivel carregar as configuracoes.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function save(nextSettings: SettingsPayload) {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const savedSettings = await updateSettings(nextSettings);
      setSettings(savedSettings);
      setSuccess('Configuracoes salvas com sucesso.');
    } catch (settingsError) {
      setError(
        settingsError instanceof Error
          ? settingsError.message
          : 'Nao foi possivel salvar as configuracoes.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const savedSettings = await resetSettingsDefaults();
      setSettings(savedSettings);
      setSuccess('Valores padrao restaurados.');
    } catch (settingsError) {
      setError(
        settingsError instanceof Error
          ? settingsError.message
          : 'Nao foi possivel restaurar os valores padrao.',
      );
    } finally {
      setSaving(false);
    }
  }

  return {
    settings,
    setSettings,
    loading,
    saving,
    error,
    success,
    reload: loadSettings,
    save,
    resetDefaults,
  };
}
