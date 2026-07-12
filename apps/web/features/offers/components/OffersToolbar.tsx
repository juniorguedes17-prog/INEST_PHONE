import { ActionButton, SearchInput, StatusBadge } from '@/components/shared';

interface OffersToolbarProps {
  search: string;
  total: number;
  sort: string;
  pageSize: number;
  onSearchChange: (value: string) => void;
  onClear: () => void;
  onSortChange: (value: string) => void;
  onPageSizeChange: (value: number) => void;
}

export function OffersToolbar({
  search,
  total,
  sort,
  pageSize,
  onSearchChange,
  onClear,
  onSortChange,
  onPageSizeChange,
}: OffersToolbarProps) {
  return (
    <section
      className="rounded-xl border border-inest-line bg-white p-3 shadow-card"
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

        <div className="flex flex-wrap items-end gap-2 2xl:ml-auto">
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
      <span className="mb-1 block text-[10px] font-black uppercase text-inest-muted">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-inest-line bg-white px-3 text-sm font-bold text-inest-text outline-none focus:border-inest-blue focus:ring-2 focus:ring-inest-blue/20"
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
