'use client';

import { useCallback, useEffect, useState } from 'react';
import { ActionButton, ErrorState, LoadingState, SettingsCard, StatusBadge } from '@/components/shared';
import { listTemplates, updateOfferTemplate } from '@/features/offers/services/offers-service';
import { CommercialTemplate } from '@/features/offers/types/offers';

const officialTemplateNames = [
  'Template Oficial - Produtos Lacrados',
  'Template Oficial - Seminovos',
];

export function OfferTemplatesSettingsCard() {
  const [templates, setTemplates] = useState<CommercialTemplate[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const availableTemplates = await listTemplates();
      setTemplates(
        officialTemplateNames
          .map((name) => availableTemplates.find((template) => template.name === name))
          .filter((template): template is CommercialTemplate => Boolean(template)),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Nao foi possivel carregar os templates comerciais.',
      );
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateContent(id: string, content: string) {
    setTemplates((current) =>
      current.map((template) => (template.id === id ? { ...template, content } : template)),
    );
  }

  async function saveTemplate(template: CommercialTemplate) {
    setSavingId(template.id);
    setError(null);
    setSuccess(null);
    try {
      const updated = await updateOfferTemplate(template.id, template.content);
      setTemplates((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSuccess(`${updated.name} atualizado.`);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Nao foi possivel salvar o template comercial.',
      );
    } finally {
      setSavingId(null);
    }
  }

  if (!templates.length && !error) {
    return <LoadingState />;
  }

  return (
    <div className="grid gap-4">
      {error ? <ErrorState title="Templates indisponiveis" description={error} /> : null}
      {success ? <StatusBadge tone="green">{success}</StatusBadge> : null}
      <section className="grid gap-6 xl:grid-cols-2">
        {templates.map((template) => (
        <SettingsCard
          key={template.id}
          eyebrow="Ofertas"
          title={template.name}
          description="Mensagem comercial usada diretamente pelo Gerador de Ofertas."
        >
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-inest-muted">Estrutura da mensagem</span>
            <textarea
              value={template.content}
              onChange={(event) => updateContent(template.id, event.target.value)}
              rows={13}
              className="w-full resize-y rounded-xl border border-inest-line bg-white px-4 py-3 font-mono text-sm leading-6 outline-none focus:border-inest-blue"
            />
          </label>
          <div className="mt-4 flex justify-end">
            <ActionButton
              onClick={() => void saveTemplate(template)}
              disabled={savingId === template.id}
            >
              {savingId === template.id ? 'Salvando...' : 'Salvar template'}
            </ActionButton>
          </div>
        </SettingsCard>
        ))}
      </section>
    </div>
  );
}
