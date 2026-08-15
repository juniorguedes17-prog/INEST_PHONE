'use client';

import { ReactNode, useEffect, useState } from 'react';
import { ActionButton } from '@/components/shared';
import {
  BrazilRadarFacets,
  BrazilRadarFacetState,
  FacetOption,
} from '../utils/brazil-radar-facets';

interface BrazilRadarFiltersDrawerProps {
  open: boolean;
  filters: BrazilRadarFacetState;
  facets: BrazilRadarFacets;
  resultCount: number;
  onChange: (filters: BrazilRadarFacetState) => void;
  onClear: () => void;
  onClose: () => void;
}

export function BrazilRadarFiltersDrawer({
  open,
  filters,
  facets,
  resultCount,
  onChange,
  onClear,
  onClose,
}: BrazilRadarFiltersDrawerProps) {
  const [showAllModels, setShowAllModels] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const visibleModels = showAllModels ? facets.models : facets.models.slice(0, 8);
  const minBound = facets.priceMin;
  const maxBound = Math.max(facets.priceMax, minBound + 1);
  const selectedMin = clamp(Number(filters.minPrice || minBound), minBound, maxBound);
  const selectedMax = clamp(Number(filters.maxPrice || maxBound), minBound, maxBound);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45" role="dialog" aria-modal="true" aria-label="Filtros do Radar Brasil">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar filtros" onClick={onClose} />
      <aside className="relative ml-auto flex h-full w-[min(94vw,430px)] flex-col bg-white shadow-panel">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-inest-line px-5">
          <h2 className="font-display text-xl font-black text-inest-text">Filtros</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={onClear} className="min-h-11 px-3 text-sm font-black text-inest-blue hover:text-blue-700">
              Limpar tudo
            </button>
            <button
              type="button"
              aria-label="Fechar filtros"
              title="Fechar"
              onClick={onClose}
              className="grid h-11 w-11 place-items-center rounded-lg border border-inest-line text-xl font-bold text-inest-muted hover:bg-inest-soft"
            >
              X
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 scrollbar-stable">
          <FacetSection title="Categoria">
            <FacetCheckboxList
              options={facets.categories}
              selected={filters.categories}
              onToggle={(value) => onChange({ ...filters, categories: toggleValue(filters.categories, value) })}
            />
          </FacetSection>

          <FacetSection title="Modelo">
            <FacetCheckboxList
              options={visibleModels}
              selected={filters.models}
              onToggle={(value) => onChange({ ...filters, models: toggleValue(filters.models, value) })}
            />
            {facets.models.length > 8 ? (
              <button type="button" onClick={() => setShowAllModels((current) => !current)} className="min-h-11 text-sm font-black text-inest-blue">
                {showAllModels ? 'Ver menos' : `Ver mais (${facets.models.length - 8})`}
              </button>
            ) : null}
          </FacetSection>

          <FacetSection title="Condicao">
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold text-inest-text">
              <input
                type="radio"
                name="radar-condition"
                checked={!filters.condition}
                onChange={() => onChange({ ...filters, condition: '' })}
                className="h-5 w-5 accent-inest-blue"
              />
              <span className="flex-1">Todos</span>
            </label>
            {facets.conditions.map((option) => (
              <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold text-inest-text">
                <input
                  type="radio"
                  name="radar-condition"
                  checked={filters.condition === option.value}
                  onChange={() => onChange({ ...filters, condition: option.value })}
                  className="h-5 w-5 accent-inest-blue"
                />
                <span className="flex-1">{option.label}</span>
                <FacetCount count={option.count} />
              </label>
            ))}
          </FacetSection>

          <FacetSection title="Cor">
            <div className="grid grid-cols-3 gap-2">
              {facets.colors.map((option) => {
                const selected = filters.colors.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onChange({ ...filters, colors: toggleValue(filters.colors, option.value) })}
                    className={`grid min-h-[76px] place-items-center gap-1 rounded-lg border p-2 text-center text-xs font-bold transition-colors ${
                      selected ? 'border-inest-blue bg-blue-50 text-inest-blue' : 'border-inest-line text-inest-muted hover:bg-inest-soft'
                    }`}
                  >
                    <span
                      className="h-7 w-7 rounded-full border border-slate-300 shadow-sm"
                      style={{ backgroundColor: option.swatch ?? '#cbd5e1' }}
                    />
                    <span>{option.label}</span>
                    <span className="text-[10px]">{option.count}</span>
                  </button>
                );
              })}
            </div>
          </FacetSection>

          <FacetSection title="Armazenamento / Capacidade">
            <FacetCheckboxList
              options={facets.capacities}
              selected={filters.capacities}
              onToggle={(value) => onChange({ ...filters, capacities: toggleValue(filters.capacities, value) })}
              columns
            />
          </FacetSection>

          <FacetSection title="Faixa de preco">
            <div className="grid gap-3">
              <input
                type="range"
                min={minBound}
                max={maxBound}
                step="1"
                value={selectedMin}
                aria-label="Preco minimo"
                onChange={(event) => {
                  const value = Math.min(Number(event.target.value), selectedMax);
                  onChange({ ...filters, minPrice: String(value) });
                }}
                className="w-full accent-inest-blue"
              />
              <input
                type="range"
                min={minBound}
                max={maxBound}
                step="1"
                value={selectedMax}
                aria-label="Preco maximo"
                onChange={(event) => {
                  const value = Math.max(Number(event.target.value), selectedMin);
                  onChange({ ...filters, maxPrice: String(value) });
                }}
                className="w-full accent-inest-blue"
              />
              <div className="grid grid-cols-2 gap-3">
                <PriceInput
                  label="Min"
                  value={filters.minPrice}
                  placeholder={String(minBound)}
                  onChange={(value) => onChange({ ...filters, minPrice: value })}
                />
                <PriceInput
                  label="Max"
                  value={filters.maxPrice}
                  placeholder={String(maxBound)}
                  onChange={(value) => onChange({ ...filters, maxPrice: value })}
                />
              </div>
            </div>
          </FacetSection>
        </div>

        <footer className="border-t border-inest-line bg-white p-4 shadow-[0_-10px_30px_rgba(15,23,42,0.08)]">
          <ActionButton className="h-12 w-full" onClick={onClose}>
            Ver {resultCount} {resultCount === 1 ? 'resultado' : 'resultados'}
          </ActionButton>
        </footer>
      </aside>
    </div>
  );
}

function FacetSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-inest-line py-5 last:border-b-0">
      <h3 className="mb-3 text-sm font-black uppercase text-inest-text">{title}</h3>
      <div className="grid gap-1">{children}</div>
    </section>
  );
}

function FacetCheckboxList({
  options,
  selected,
  onToggle,
  columns = false,
}: {
  options: FacetOption[];
  selected: string[];
  onToggle: (value: string) => void;
  columns?: boolean;
}) {
  return (
    <div className={columns ? 'grid grid-cols-2 gap-x-4' : 'grid'}>
      {options.map((option) => (
        <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold text-inest-text">
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={() => onToggle(option.value)}
            className="h-5 w-5 rounded border-inest-line accent-inest-blue"
          />
          <span className="min-w-0 flex-1">{option.label}</span>
          <FacetCount count={option.count} />
        </label>
      ))}
    </div>
  );
}

function FacetCount({ count }: { count: number }) {
  return <span className="rounded-md bg-inest-soft px-2 py-1 text-[10px] font-black text-inest-muted">{count}</span>;
}

function PriceInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-xs font-bold text-inest-muted">{label}</span>
      <input
        type="number"
        min="0"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="field-control"
      />
    </label>
  );
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}
