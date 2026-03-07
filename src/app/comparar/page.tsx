"use client";

import { useEffect, useState, useCallback } from "react";
import SearchAutocomplete from "@/components/SearchAutocomplete";
import BarChartComponent from "@/components/charts/BarChartComponent";
import LineChartComponent from "@/components/charts/LineChartComponent";
import LoadingSpinner from "@/components/LoadingSpinner";
import FilterPanel, { type FilterConfig, type FilterOption } from "@/components/FilterPanel";
import { GitCompareArrows, X, Plus } from "lucide-react";

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

interface SelectedPartido {
  id: number;
  label: string;
  sublabel?: string;
}

interface CompareData {
  partidos: { id: number; nombre: string }[];
  totalesNacionales: { partidoId: number; nombre: string; totalVotos: number }[];
  porDepartamento: Record<string, unknown>[];
  porCorporacion: Record<string, unknown>[];
}

export default function CompararPage() {
  const [selected, setSelected] = useState<SelectedPartido[]>([]);
  const [data, setData] = useState<CompareData | null>(null);
  const [loading, setLoading] = useState(false);
  const [corporaciones, setCorporaciones] = useState<FilterOption[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({ corporacionId: "" });

  useEffect(() => {
    fetch("/api/estadisticas")
      .then((r) => r.json())
      .then((stats) => {
        setCorporaciones(
          stats.corporaciones.map((c: { id: number; nombre: string }) => ({
            value: String(c.id),
            label: c.nombre,
          }))
        );
      });
  }, []);

  const fetchComparison = useCallback(async () => {
    if (selected.length < 2) {
      setData(null);
      return;
    }
    setLoading(true);
    const params = new URLSearchParams({
      partidoIds: selected.map((s) => s.id).join(","),
    });
    if (filters.corporacionId) params.set("corporacionId", filters.corporacionId);

    const res = await fetch(`/api/comparar?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [selected, filters]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  const removePartido = (id: number) => {
    setSelected((prev) => prev.filter((p) => p.id !== id));
  };

  const filterConfigs: FilterConfig[] = [
    { key: "corporacionId", label: "Corporación", options: corporaciones, placeholder: "Todas las corporaciones" },
  ];

  // Build chart data
  const totalesChart = data
    ? data.totalesNacionales.map((t, i) => ({
        name: t.nombre.length > 25 ? t.nombre.substring(0, 25) + "..." : t.nombre,
        value: t.totalVotos,
        color: COLORS[i % COLORS.length],
      }))
    : [];

  const partidoNames = data?.partidos.map((p) => p.nombre) || [];

  const lineChartLines = partidoNames.map((name, i) => ({
    key: name,
    name: name.length > 25 ? name.substring(0, 25) + "..." : name,
    color: COLORS[i % COLORS.length],
  }));

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <GitCompareArrows size={24} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Comparar Partidos</h1>
        </div>
        <p className="text-sm text-slate-500">Selecciona 2 o más partidos para comparar sus resultados</p>
      </div>

      {/* Party selector */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-slate-700">
          <Plus size={16} /> Agregar partidos a comparar
        </div>

        <div className="max-w-md mb-4">
          <SearchAutocomplete
            placeholder="Buscar partido por nombre..."
            apiUrl="/api/partidos"
            onSelect={(opt) => {
              if (!selected.find((s) => s.id === opt.id) && selected.length < 5) {
                setSelected((prev) => [...prev, opt]);
              }
            }}
          />
        </div>

        {/* Selected pills */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selected.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-white"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              >
                <span>{p.label}</span>
                <button
                  onClick={() => removePartido(p.id)}
                  className="p-0.5 rounded-full hover:bg-white/20"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {selected.length < 2 && (
          <p className="mt-3 text-xs text-slate-400">
            Selecciona al menos 2 partidos ({selected.length}/5)
          </p>
        )}
      </div>

      {/* Filter */}
      {selected.length >= 2 && (
        <div className="mb-4">
          <FilterPanel
            filters={filterConfigs}
            values={filters}
            onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
            onClear={() => setFilters({ corporacionId: "" })}
          />
        </div>
      )}

      {/* Results */}
      {loading ? (
        <LoadingSpinner text="Comparando partidos..." />
      ) : data ? (
        <div className="space-y-6">
          {/* Total nacional comparison */}
          <BarChartComponent
            data={totalesChart}
            title="Total de votos a nivel nacional"
            colorful
            height={200}
          />

          {/* Per corporacion */}
          {data.porCorporacion.length > 0 && !filters.corporacionId && (
            <LineChartComponent
              data={data.porCorporacion}
              lines={lineChartLines}
              xKey="corporacion"
              title="Votos por corporación"
              height={350}
            />
          )}

          {/* Per department */}
          {data.porDepartamento.length > 0 && (
            <LineChartComponent
              data={data.porDepartamento}
              lines={lineChartLines}
              xKey="departamento"
              title="Comparación por departamento (Top 15)"
              height={400}
            />
          )}

          {/* Detail table */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-semibold text-slate-700">Detalle por departamento</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Departamento</th>
                    {partidoNames.map((name, i) => (
                      <th key={name} className="px-4 py-2.5 text-right font-semibold" style={{ color: COLORS[i % COLORS.length] }}>
                        {name.length > 20 ? name.substring(0, 20) + "..." : name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.porDepartamento.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-2 font-medium text-slate-700">{String(row.departamento)}</td>
                      {partidoNames.map((name) => (
                        <td key={name} className="px-4 py-2 text-right text-slate-600">
                          {((row[name] as number) || 0).toLocaleString("es-CO")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : selected.length >= 2 ? (
        <LoadingSpinner />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <GitCompareArrows size={48} className="mx-auto mb-4 text-slate-300" />
          <p className="text-slate-400">Busca y selecciona partidos para comenzar la comparación</p>
        </div>
      )}
    </div>
  );
}
