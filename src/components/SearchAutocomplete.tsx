"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X } from "lucide-react";

interface Option {
  id: number;
  label: string;
  sublabel?: string;
}

interface SearchAutocompleteProps {
  placeholder?: string;
  apiUrl: string;
  onSelect: (option: Option) => void;
  value?: Option | null;
  onClear?: () => void;
}

export default function SearchAutocomplete({
  placeholder = "Buscar...",
  apiUrl,
  onSelect,
  value,
  onClear,
}: SearchAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(null);

  const fetchOptions = useCallback(
    async (search: string) => {
      if (search.length < 2) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`${apiUrl}?search=${encodeURIComponent(search)}&limit=20`);
        const json = await res.json();
        const items = (json.data || []).map((item: Record<string, unknown>) => ({
          id: item.id as number,
          label: (item.nombre as string) || "",
          sublabel: item.partido
            ? (item.partido as { nombre: string }).nombre
            : (item.codigo as string) || undefined,
        }));
        setOptions(items);
      } catch {
        setOptions([]);
      }
      setLoading(false);
    },
    [apiUrl]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchOptions(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchOptions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
        <span className="font-medium text-blue-800">{value.label}</span>
        {value.sublabel && (
          <span className="text-xs text-blue-500">({value.sublabel})</span>
        )}
        <button
          onClick={() => {
            onClear?.();
            setQuery("");
          }}
          className="ml-auto p-0.5 text-blue-400 hover:text-blue-600"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500"></div>
          </div>
        )}
      </div>

      {isOpen && options.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-60 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                onSelect(opt);
                setQuery("");
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-blue-50 transition-colors"
            >
              <span className="font-medium text-slate-800">{opt.label}</span>
              {opt.sublabel && (
                <span className="text-xs text-slate-400">({opt.sublabel})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && options.length === 0 && !loading && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-center text-sm text-slate-400 shadow-lg">
          Sin resultados
        </div>
      )}
    </div>
  );
}
