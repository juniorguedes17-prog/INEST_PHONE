'use client';

import { useState } from 'react';
import {
  ActionButton,
  Drawer,
  EmptyState,
  FilterSection,
  FilterSidebar,
  KpiCard,
  Pagination,
  SearchInput,
  StatusBadge,
} from '@/components/shared';
import { RadarOrigin } from './RadarOriginTabs';

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
  const filters = <PreparedFilters origin={config.name} />;

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-inest-line bg-white p-3 shadow-card">
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
              className="min-h-11 lg:hidden"
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
          <span className="text-xs font-bold text-inest-muted">Estrutura preparada para integracao futura</span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4" aria-label={`Indicadores ${config.name}`}>
        <KpiCard label="Produtos" value="0" detail="Nenhum registro" tone="blue" />
        <KpiCard label="Selecionados" value="0" detail="Selecao multipla" tone="purple" />
        <KpiCard label="Menor custo" value="—" detail="Aguardando dados" tone="green" />
        <KpiCard label="Atualizacao" value="—" detail="Sem sincronizacao" tone="amber" />
      </section>

      <section className="grid min-w-0 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <FilterSidebar eyebrow={config.code} title="Filtros" className="hidden max-h-[calc(100vh-240px)] lg:block">
          {filters}
        </FilterSidebar>

        <div className="min-w-0">
          <div className="mb-3 flex min-h-11 items-center justify-between gap-3 rounded-xl border border-inest-line bg-white px-3 shadow-card">
            <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-inest-text">
              <input type="checkbox" disabled className="h-5 w-5 accent-inest-blue" />
              Selecionar pagina
            </label>
            <span className="text-xs font-bold text-inest-muted">0 resultados</span>
          </div>
          <EmptyState
            title={`Radar ${config.name} preparado.`}
            description="A pesquisa, os filtros, a selecao multipla e o calculo serao ativados quando a fonte oficial de dados estiver integrada."
          />
          <div className="mt-4 rounded-xl border border-inest-line bg-white p-3 shadow-card">
            <Pagination page={1} totalPages={1} totalItems={0} />
            <p className="text-sm text-inest-muted">Nenhum produto disponivel.</p>
          </div>
        </div>
      </section>

      <Drawer open={filtersOpen} title={`Filtros - ${config.name}`} onClose={() => setFiltersOpen(false)}>
        <div className="grid">{filters}</div>
      </Drawer>
    </div>
  );
}

function PreparedFilters({ origin }: { origin: string }) {
  return (
    <>
      <FilterSection title="Categoria"><PreparedSelect label="Categoria" /></FilterSection>
      <FilterSection title="Marca"><PreparedSelect label="Marca" /></FilterSection>
      <FilterSection title="Modelo"><PreparedSelect label="Modelo" /></FilterSection>
      <FilterSection title="Cor" defaultOpen={false}><PreparedSelect label="Cor" /></FilterSection>
      <FilterSection title="Capacidade" defaultOpen={false}><PreparedSelect label="Capacidade" /></FilterSection>
      <FilterSection title="Condicao" defaultOpen={false}><PreparedSelect label="Condicao" /></FilterSection>
      <FilterSection title="Loja" defaultOpen={false}><PreparedSelect label={`Loja no ${origin}`} /></FilterSection>
      <FilterSection title="Faixa de custo" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2">
          <PreparedInput label="Minimo" />
          <PreparedInput label="Maximo" />
        </div>
      </FilterSection>
    </>
  );
}

function PreparedSelect({ label }: { label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <select className="field-control" disabled aria-label={label}>
        <option>Todos</option>
      </select>
    </label>
  );
}

function PreparedInput({ label }: { label: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-inest-muted">{label}</span>
      <input className="field-control" type="number" disabled aria-label={label} />
    </label>
  );
}
