"use client";

import { Filter } from "lucide-react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterConfig {
  key: string;
  label: string;
  options: FilterOption[];
  placeholder?: string;
}

interface FilterPanelProps {
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
}

export default function FilterPanel({ filters, values, onChange, onClear }: FilterPanelProps) {
  const hasActiveFilters = Object.values(values).some((v) => v !== "");

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Filter size={16} />
          Filtros
        </div>
        {hasActiveFilters && (
          <button
            onClick={onClear}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Limpiar filtros
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {filters.map((filter) => (
          <select
            key={filter.key}
            value={values[filter.key] || ""}
            onChange={(e) => onChange(filter.key, e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 bg-white min-w-[180px]"
          >
            <option value="">{filter.placeholder || `Todos - ${filter.label}`}</option>
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
}
