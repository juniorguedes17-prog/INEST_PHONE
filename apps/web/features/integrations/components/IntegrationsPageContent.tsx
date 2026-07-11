'use client';

import { useState } from 'react';
import {
  ActionButton,
  EmptyState,
  ErrorState,
  ListHeader,
  LoadingState,
  PageHeader,
  SettingsCard,
  StatusBadge,
} from '@/components/shared';
import { IntegrationStatus } from '../types/integrations';
import { useIntegrations } from '../hooks/useIntegrations';

const exportFormats = [
  ['csv', 'CSV'],
  ['excel', 'Excel'],
  ['pdf', 'PDF'],
];

const importSources = [
  ['csv', 'CSV'],
  ['excel', 'Excel'],
  ['google_sheets', 'Google Sheets'],
];

export function IntegrationsPageContent() {
  const integrations = useIntegrations();
  const [exportFormat, setExportFormat] = useState('csv');
  const [exportDataset, setExportDataset] = useState('dashboard');
  const [importSource, setImportSource] = useState('csv');
  const [importContent, setImportContent] = useState('');

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Arquitetura"
        title="Integracoes"
        description="Providers desacoplados para Google Sheets, WhatsApp, Compras Paraguai, importacoes e exportacoes."
        actions={
          <>
            {integrations.success ? (
              <StatusBadge tone="green">{integrations.success}</StatusBadge>
            ) : null}
            <ActionButton variant="secondary" onClick={() => void integrations.clearCache()}>
              Limpar cache
            </ActionButton>
          </>
        }
      />

      {integrations.error ? <ErrorState title="Atencao" description={integrations.error} /> : null}
      {integrations.loading ? <LoadingState /> : null}

      {!integrations.loading ? (
        <div className="grid gap-6">
          <ListHeader
            eyebrow="Providers"
            title={`${integrations.integrations.length} integracoes disponiveis`}
            description="Toda comunicacao externa passa por interfaces e providers."
          />

          <div className="grid gap-4 xl:grid-cols-3">
            {integrations.integrations.map((integration) => (
              <IntegrationCard
                key={integration.key}
                integration={integration}
                saving={integrations.saving}
                onTest={() => void integrations.test(integration.key)}
                onSync={() => void integrations.sync(integration.key)}
              />
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <SettingsCard
              eyebrow="Exportacoes"
              title="Gerar arquivo"
              description="Exportacao centralizada para CSV, Excel e PDF."
            >
              <div className="grid gap-4">
                <SelectInput
                  label="Formato"
                  value={exportFormat}
                  options={exportFormats}
                  onChange={setExportFormat}
                />
                <TextInput label="Dataset" value={exportDataset} onChange={setExportDataset} />
                <ActionButton
                  onClick={() => void integrations.exportData(exportFormat, exportDataset)}
                >
                  Exportar
                </ActionButton>
                {integrations.lastArtifact ? (
                  <p className="text-sm text-inest-muted">
                    Ultimo arquivo: {integrations.lastArtifact.filename}
                  </p>
                ) : null}
              </div>
            </SettingsCard>

            <SettingsCard
              eyebrow="Importacoes"
              title="Preparar entrada"
              description="Entrada centralizada para CSV, Excel e Google Sheets."
            >
              <div className="grid gap-4">
                <SelectInput
                  label="Origem"
                  value={importSource}
                  options={importSources}
                  onChange={setImportSource}
                />
                <TextArea label="Conteudo" value={importContent} onChange={setImportContent} />
                <ActionButton
                  onClick={() => void integrations.importData(importSource, importContent)}
                >
                  Importar
                </ActionButton>
              </div>
            </SettingsCard>

            <SettingsCard
              eyebrow="Scheduler"
              title="Jobs preparados"
              description="Rotinas prontas para agendamento futuro, sem execucao automatica."
            >
              <div className="grid gap-3">
                {integrations.jobs.map((job) => (
                  <div
                    key={job.key}
                    className="flex items-center justify-between border-t border-inest-line pt-3"
                  >
                    <span className="text-sm font-bold text-inest-muted">{job.name}</span>
                    <StatusBadge tone="blue">{job.status}</StatusBadge>
                  </div>
                ))}
              </div>
            </SettingsCard>
          </div>

          <SettingsCard
            eyebrow="Historico"
            title="Auditoria de integracoes"
            description="Chamadas, sincronizacoes, importacoes e exportacoes registradas."
          >
            {integrations.history.length ? (
              <p className="text-sm text-inest-muted">
                {integrations.history.length} eventos recentes registrados para integracoes.
              </p>
            ) : (
              <EmptyState
                title="Sem historico."
                description="Execute um teste, sync ou exportacao."
              />
            )}
          </SettingsCard>
        </div>
      ) : null}
    </div>
  );
}

function IntegrationCard({
  integration,
  saving,
  onTest,
  onSync,
}: {
  integration: IntegrationStatus;
  saving: boolean;
  onTest: () => void;
  onSync: () => void;
}) {
  return (
    <SettingsCard
      eyebrow={integration.type}
      title={integration.name}
      description={integration.status.message}
    >
      <div className="grid gap-4">
        <StatusBadge tone={integration.status.success ? 'green' : 'amber'}>
          {integration.status.success ? 'Disponivel' : 'Atencao'}
        </StatusBadge>
        <div className="grid gap-3 sm:grid-cols-2">
          <ActionButton variant="secondary" disabled={saving} onClick={onTest}>
            Testar
          </ActionButton>
          <ActionButton disabled={saving} onClick={onSync}>
            Sincronizar
          </ActionButton>
        </div>
      </div>
    </SettingsCard>
  );
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
        className="field-control"
      />
    </label>
  );
}

function TextArea({
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
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="w-full rounded-xl border border-inest-line bg-white px-4 py-3 outline-none focus:border-inest-blue"
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
        className="field-control"
      >
        {options.map(([valueOption, labelOption]) => (
          <option key={valueOption} value={valueOption}>
            {labelOption}
          </option>
        ))}
      </select>
    </label>
  );
}
