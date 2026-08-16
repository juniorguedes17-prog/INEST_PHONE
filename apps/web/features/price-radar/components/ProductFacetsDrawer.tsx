'use client';

import { ReactNode, useEffect, useState } from 'react';
import { ActionButton } from '@/components/shared';
import { FacetOption } from '../utils/brazil-radar-facets';

export interface ProductFacetGroup {
  title: string;
  options: FacetOption[];
  selected: string[];
  onToggle: (value: string) => void;
  columns?: boolean;
  collapsible?: boolean;
  presentation?: 'list' | 'colors';
}

interface ProductFacetsDrawerProps {
  open: boolean;
  ariaLabel: string;
  resultCount: number;
  categories?: ProductFacetGroup;
  models?: ProductFacetGroup;
  condition?: {
    options: FacetOption[];
    value: string;
    onChange: (value: string) => void;
  };
  colors?: ProductFacetGroup;
  capacities?: ProductFacetGroup;
  additionalGroups?: ProductFacetGroup[];
  price?: {
    min: number;
    max: number;
    minValue: string;
    maxValue: string;
    currencyLabel?: string;
    onMinChange: (value: string) => void;
    onMaxChange: (value: string) => void;
  };
  onClear: () => void;
  onClose: () => void;
}

export function ProductFacetsDrawer({
  open,
  ariaLabel,
  resultCount,
  categories,
  models,
  condition,
  colors,
  capacities,
  additionalGroups = [],
  price,
  onClear,
  onClose,
}: ProductFacetsDrawerProps) {
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

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/45" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar filtros" onClick={onClose} />
      <aside className="relative ml-auto flex h-full w-[min(94vw,430px)] flex-col bg-white shadow-panel">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-inest-line px-5">
          <h2 className="font-display text-xl font-black text-inest-text">Filtros</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={onClear} className="min-h-11 px-3 text-sm font-black text-inest-blue hover:text-blue-700">
              Limpar tudo
            </button>
            <button type="button" aria-label="Fechar filtros" title="Fechar" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-lg border border-inest-line text-xl font-bold text-inest-muted hover:bg-inest-soft">
              X
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6 scrollbar-stable">
          {categories ? <FacetGroup group={categories} /> : null}
          {models ? <FacetGroup group={models} showAll={showAllModels} onToggleShowAll={() => setShowAllModels((current) => !current)} /> : null}
          {condition ? <ConditionGroup {...condition} /> : null}
          {colors ? <FacetGroup group={{ ...colors, presentation: 'colors' }} /> : null}
          {capacities ? <FacetGroup group={{ ...capacities, columns: true }} /> : null}
          {additionalGroups.map((group) => <FacetGroup key={group.title} group={group} />)}
          {price ? <PriceGroup {...price} /> : null}
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

export function buildFacetOptions(values: Array<string | null | undefined>, label?: (value: string) => string): FacetOption[] {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    if (!value) return;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return Array.from(counts, ([value, count]) => ({ value, label: label?.(value) ?? value, count }))
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
}

function FacetGroup({ group, showAll, onToggleShowAll }: { group: ProductFacetGroup; showAll?: boolean; onToggleShowAll?: () => void }) {
  const visibleOptions = group.collapsible && !showAll ? group.options.slice(0, 8) : group.options;
  return (
    <FacetSection title={group.title}>
      {group.presentation === 'colors' ? (
        <div className="grid grid-cols-3 gap-2">
          {visibleOptions.map((option) => {
            const selected = group.selected.includes(option.value);
            return (
              <button key={option.value} type="button" aria-pressed={selected} onClick={() => group.onToggle(option.value)} className={`grid min-h-[76px] place-items-center gap-1 rounded-lg border p-2 text-center text-xs font-bold transition-colors ${selected ? 'border-inest-blue bg-blue-50 text-inest-blue' : 'border-inest-line text-inest-muted hover:bg-inest-soft'}`}>
                <span className="h-7 w-7 rounded-full border border-slate-300 shadow-sm" style={{ backgroundColor: option.swatch ?? colorSwatch(option.value) }} />
                <span>{option.label}</span>
                <span className="text-[10px]">{option.count}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className={group.columns ? 'grid grid-cols-2 gap-x-4' : 'grid'}>
          {visibleOptions.map((option) => (
            <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold text-inest-text">
              <input type="checkbox" checked={group.selected.includes(option.value)} onChange={() => group.onToggle(option.value)} className="h-5 w-5 rounded border-inest-line accent-inest-blue" />
              <span className="min-w-0 flex-1">{option.label}</span>
              <FacetCount count={option.count} />
            </label>
          ))}
        </div>
      )}
      {!visibleOptions.length ? <p className="text-sm text-inest-muted">Nenhuma opcao disponivel.</p> : null}
      {group.collapsible && group.options.length > 8 ? (
        <button type="button" onClick={onToggleShowAll} className="min-h-11 text-sm font-black text-inest-blue">
          {showAll ? 'Ver menos' : `Ver mais (${group.options.length - 8})`}
        </button>
      ) : null}
    </FacetSection>
  );
}

function ConditionGroup({ options, value, onChange }: NonNullable<ProductFacetsDrawerProps['condition']>) {
  return (
    <FacetSection title="Condicao">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold text-inest-text">
        <input type="radio" name="product-facet-condition" checked={!value} onChange={() => onChange('')} className="h-5 w-5 accent-inest-blue" />
        <span className="flex-1">Todos</span>
      </label>
      {options.map((option) => (
        <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-bold text-inest-text">
          <input type="radio" name="product-facet-condition" checked={value === option.value} onChange={() => onChange(option.value)} className="h-5 w-5 accent-inest-blue" />
          <span className="flex-1">{option.label}</span>
          <FacetCount count={option.count} />
        </label>
      ))}
      {!options.length ? <p className="text-sm text-inest-muted">Nenhuma opcao disponivel.</p> : null}
    </FacetSection>
  );
}

function PriceGroup({ min, max, minValue, maxValue, currencyLabel, onMinChange, onMaxChange }: NonNullable<ProductFacetsDrawerProps['price']>) {
  const maxBound = Math.max(max, min + 1);
  const selectedMin = clamp(Number(minValue || min), min, maxBound);
  const selectedMax = clamp(Number(maxValue || maxBound), min, maxBound);
  return (
    <FacetSection title={currencyLabel ? `Faixa de preco (${currencyLabel})` : 'Faixa de preco'}>
      <div className="grid gap-3">
        <input type="range" min={min} max={maxBound} step="1" value={selectedMin} aria-label="Preco minimo" onChange={(event) => onMinChange(String(Math.min(Number(event.target.value), selectedMax)))} className="w-full accent-inest-blue" />
        <input type="range" min={min} max={maxBound} step="1" value={selectedMax} aria-label="Preco maximo" onChange={(event) => onMaxChange(String(Math.max(Number(event.target.value), selectedMin)))} className="w-full accent-inest-blue" />
        <div className="grid grid-cols-2 gap-3">
          <PriceInput label="Min" value={minValue} placeholder={String(min)} onChange={onMinChange} />
          <PriceInput label="Max" value={maxValue} placeholder={String(maxBound)} onChange={onMaxChange} />
        </div>
      </div>
    </FacetSection>
  );
}

function FacetSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="border-b border-inest-line py-5 last:border-b-0"><h3 className="mb-3 text-sm font-black uppercase text-inest-text">{title}</h3><div className="grid gap-1">{children}</div></section>;
}

function FacetCount({ count }: { count: number }) {
  return <span className="rounded-md bg-inest-soft px-2 py-1 text-[10px] font-black text-inest-muted">{count}</span>;
}

function PriceInput({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return <label><span className="mb-1 block text-xs font-bold text-inest-muted">{label}</span><input type="number" min="0" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="field-control" /></label>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(Number.isFinite(value) ? value : min, min), max);
}

function colorSwatch(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes('preto') || normalized.includes('black') || normalized.includes('midnight')) return '#111827';
  if (normalized.includes('branco') || normalized.includes('white') || normalized.includes('silver')) return '#f8fafc';
  if (normalized.includes('azul') || normalized.includes('blue')) return '#3b82f6';
  if (normalized.includes('verde') || normalized.includes('green')) return '#22c55e';
  if (normalized.includes('rosa') || normalized.includes('pink')) return '#f472b6';
  if (normalized.includes('roxo') || normalized.includes('purple')) return '#8b5cf6';
  if (normalized.includes('laranja') || normalized.includes('orange')) return '#f97316';
  if (normalized.includes('cinza') || normalized.includes('gray') || normalized.includes('grey')) return '#64748b';
  if (normalized.includes('natural')) return '#c7b79d';
  return '#cbd5e1';
}
