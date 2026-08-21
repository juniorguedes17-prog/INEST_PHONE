'use client';

import { useState } from 'react';
import {
  ActionButton,
  EmptyState,
  KpiCard,
  Pagination,
  SearchInput,
  StatusBadge,
} from '@/components/shared';
import { RadarOrigin } from './RadarOriginTabs';
import { ProductFacetsDrawer } from './ProductFacetsDrawer';

interface PreparedRadarOriginProps {
  origin: Exclude<RadarOrigin, 'brasil'>;
}

const originLabels = {
  paraguai: { name: 'Paraguai', code: 'PY' },
  eua: { name: 'EUA', code: 'US' },
};

export function PreparedRadarOrigin({ origin }: PreparedRadarOriginProps) {
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const config = originLabels[origin];
  const emptyGroup = (title: string) => ({
    title,
    options: [],
    selected: [],
    onToggle: () => undefined,
  });

  return (
    <div className="grid gap-4">
      <section className="rounded-2xl border border-inest-line/70 bg-inest-surface p-4 shadow-[0_14px_34px_rgba(16,24,40,0.055)]">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <SearchInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Pesquisar produtos no Radar ${config.name}`}
            aria-label={`Pesquisar no Radar ${config.name}`}
          />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <ActionButton
              variant="secondary"
              className="min-h-11"
              onClick={() => setFiltersOpen(true)}
            >
              Filtros
            </ActionButton>
            <ActionButton className="min-h-11" disabled title="Calculo preparado para etapa futura">
              Calcular Custo
            </ActionButton>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge tone="blue">{config.code}</StatusBadge>
          <StatusBadge tone="gray">0 produtos</StatusBadge>
          <span className="text-xs font-bold text-inest-muted">
            Estrutura preparada para integracao futura
          </span>
        </div>
      </section>

      <section
        className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4"
        aria-label={`Indicadores ${config.name}`}
      >
        <KpiCard label="Produtos" value="0" detail="Nenhum registro" tone="blue" />
        <KpiCard label="Selecionados" value="0" detail="Selecao multipla" tone="purple" />
        <KpiCard label="Menor custo" value="â€”" detail="Aguardando dados" tone="green" />
        <KpiCard label="Atualizacao" value="â€”" detail="Sem sincronizacao" tone="amber" />
      </section>

      <section className="min-w-0">
        <div className="min-w-0">
          <div className="mb-3 flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-inest-line/70 bg-inest-surface px-4 shadow-[0_14px_34px_rgba(16,24,40,0.055)]">
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-inest-text">
              <input type="checkbox" disabled className="h-5 w-5 accent-inest-blue" />
              Selecionar pagina
            </label>
            <span className="text-xs font-medium text-inest-muted">0 resultados</span>
          </div>
          <EmptyState
            title={`Radar ${config.name} preparado.`}
            description="A pesquisa, os filtros, a selecao multipla e o calculo serao ativados quando a fonte oficial de dados estiver integrada."
          />
          <div className="mt-4 rounded-2xl border border-inest-line/70 bg-inest-surface p-5 shadow-[0_14px_34px_rgba(16,24,40,0.055)]">
            <Pagination page={1} totalPages={1} totalItems={0} />
            <p className="text-sm text-inest-muted">Nenhum produto disponivel.</p>
          </div>
        </div>
      </section>

      <ProductFacetsDrawer
        open={filtersOpen}
        ariaLabel={`Filtros do Radar ${config.name}`}
        resultCount={0}
        categories={emptyGroup('Categoria')}
        models={{ ...emptyGroup('Modelo'), collapsible: true }}
        colors={emptyGroup('Cor')}
        capacities={emptyGroup('Armazenamento / Capacidade')}
        additionalGroups={[
          emptyGroup('Chip / Geracao'),
          emptyGroup('Tamanho da tela'),
          emptyGroup('Memoria RAM'),
          emptyGroup('GPS / Cellular'),
        ]}
        onClear={() => undefined}
        onClose={() => setFiltersOpen(false)}
      />
    </div>
  );
}
