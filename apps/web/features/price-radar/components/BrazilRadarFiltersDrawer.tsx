'use client';

import { ProductFacetsDrawer } from './ProductFacetsDrawer';
import { BrazilRadarFacets, BrazilRadarFacetState } from '../utils/brazil-radar-facets';

interface BrazilRadarFiltersDrawerProps {
  open: boolean;
  filters: BrazilRadarFacetState;
  facets: BrazilRadarFacets;
  resultCount: number;
  onChange: (filters: BrazilRadarFacetState) => void;
  onClear: () => void;
  onClose: () => void;
}

export function BrazilRadarFiltersDrawer({ open, filters, facets, resultCount, onChange, onClear, onClose }: BrazilRadarFiltersDrawerProps) {
  return (
    <ProductFacetsDrawer
      open={open}
      ariaLabel="Filtros do Radar Brasil"
      resultCount={resultCount}
      categories={{ title: 'Categoria', options: facets.categories, selected: filters.categories, onToggle: (value) => onChange({ ...filters, categories: toggleValue(filters.categories, value) }) }}
      models={{ title: 'Modelo', options: facets.models, selected: filters.models, collapsible: true, onToggle: (value) => onChange({ ...filters, models: toggleValue(filters.models, value) }) }}
      condition={{ options: facets.conditions, value: filters.condition, onChange: (condition) => onChange({ ...filters, condition }) }}
      colors={{ title: 'Cor', options: facets.colors, selected: filters.colors, onToggle: (value) => onChange({ ...filters, colors: toggleValue(filters.colors, value) }) }}
      capacities={{ title: 'Armazenamento / Capacidade', options: facets.capacities, selected: filters.capacities, onToggle: (value) => onChange({ ...filters, capacities: toggleValue(filters.capacities, value) }) }}
      price={{ min: facets.priceMin, max: facets.priceMax, minValue: filters.minPrice, maxValue: filters.maxPrice, onMinChange: (minPrice) => onChange({ ...filters, minPrice }), onMaxChange: (maxPrice) => onChange({ ...filters, maxPrice }) }}
      onClear={onClear}
      onClose={onClose}
    />
  );
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}
