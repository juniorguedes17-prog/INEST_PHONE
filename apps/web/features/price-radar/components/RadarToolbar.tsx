import { ActionButton, SearchInput, StatusBadge } from '@/components/shared';

interface RadarToolbarProps {
  search: string;
  total: number;
  lastUpdated?: string;
  sort: string;
  sortOptions: string[][];
  pageSize: number;
  updating: boolean;
  activeFilterCount: number;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  onClear: () => void;
  onSortChange: (value: string) => void;
  onPageSizeChange: (value: number) => void;
  onOpenFilters: () => void;
}

export function RadarToolbar({
  search,
  total,
  lastUpdated,
  sort,
  sortOptions,
  pageSize,
  updating,
  activeFilterCount,
  onSearchChange,
  onRefresh,
  onClear,
  onSortChange,
  onPageSizeChange,
  onOpenFilters,
}: RadarToolbarProps) {
  return (
    <section
      className="rounded-2xl border border-inest-line/70 bg-inest-surface p-4 shadow-[0_14px_34px_rgba(16,24,40,0.055)]"
      aria-label="Ferramentas do Radar"
    >
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
        <SearchInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Pesquisar produto, modelo ou fornecedor"
          aria-label="Pesquisar no Radar"
          className="min-w-0 flex-1 2xl:max-w-xl"
        />

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone="blue">{total} encontrados</StatusBadge>
          <span className="text-xs font-bold text-inest-muted">
            {lastUpdated ? `Atualizado ${lastUpdated}` : 'Sem atualização'}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-2 border-t border-inest-line/70 pt-3 2xl:ml-auto 2xl:border-l 2xl:border-t-0 2xl:pl-4 2xl:pt-0">
          <ActionButton variant="secondary" onClick={onOpenFilters}>
            Filtros{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </ActionButton>
          <CompactSelect
            label="Ordenação"
            value={sort}
            options={sortOptions}
            onChange={onSortChange}
          />
          <CompactSelect
            label="Itens"
            value={String(pageSize)}
            options={[
              ['10', '10 por pagina'],
              ['20', '20 por pagina'],
              ['50', '50 por pagina'],
            ]}
            onChange={(value) => onPageSizeChange(Number(value))}
          />
          <ActionButton variant="secondary" onClick={onRefresh} disabled={updating}>
            {updating ? 'Atualizando...' : 'Atualizar'}
          </ActionButton>
          <ActionButton variant="ghost" onClick={onClear}>
            Limpar
          </ActionButton>
          <ActionButton variant="secondary" disabled title="Exportacao em preparacao">
            Exportar
          </ActionButton>
        </div>
      </div>
    </section>
  );
}

function CompactSelect({
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
    <label className="min-w-36">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.06em] text-inest-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-inest-line bg-inest-surface px-3 text-sm font-medium text-inest-text outline-none transition focus:border-inest-blue focus:ring-2 focus:ring-inest-blue/20"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}
