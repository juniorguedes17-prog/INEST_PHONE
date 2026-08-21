import { ActionButton, SearchInput, StatusBadge } from '@/components/shared';

interface OffersToolbarProps {
  search: string;
  total: number;
  sort: string;
  pageSize: number;
  activeFilterCount: number;
  onSearchChange: (value: string) => void;
  onClear: () => void;
  onSortChange: (value: string) => void;
  onPageSizeChange: (value: number) => void;
  onOpenFilters: () => void;
}

export function OffersToolbar({
  search,
  total,
  sort,
  pageSize,
  activeFilterCount,
  onSearchChange,
  onClear,
  onSortChange,
  onPageSizeChange,
  onOpenFilters,
}: OffersToolbarProps) {
  return (
    <section
      className="rounded-2xl border border-inest-line/70 bg-inest-surface p-4 shadow-[0_14px_34px_rgba(16,24,40,0.055)]"
      aria-label="Ferramentas do Gerador de Ofertas"
    >
      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
        <SearchInput
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Pesquisar produto, modelo ou template"
          aria-label="Pesquisar ofertas"
          className="min-w-0 flex-1 2xl:max-w-xl"
        />

        <StatusBadge tone="blue">{total} ofertas</StatusBadge>

        <div className="flex flex-wrap items-end gap-2 border-t border-inest-line/70 pt-3 2xl:ml-auto 2xl:border-l 2xl:border-t-0 2xl:pl-4 2xl:pt-0">
          <CompactSelect
            label="Ordenacao"
            value={sort}
            options={[
              ['recent', 'Mais recentes'],
              ['oldest', 'Mais antigas'],
              ['highest_price', 'Maior preco'],
              ['lowest_price', 'Menor preco'],
            ]}
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
          <ActionButton variant="secondary" onClick={onOpenFilters}>
            {activeFilterCount ? `Filtros (${activeFilterCount})` : 'Filtros'}
          </ActionButton>
          <ActionButton variant="ghost" onClick={onClear}>
            Limpar filtros
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
