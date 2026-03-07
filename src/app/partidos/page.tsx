"use client";

import { useEffect, useState, useCallback } from "react";
import DataTable, { type Column } from "@/components/DataTable";
import FilterPanel, { type FilterConfig, type FilterOption } from "@/components/FilterPanel";
import SearchAutocomplete from "@/components/SearchAutocomplete";
import BarChartComponent from "@/components/charts/BarChartComponent";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Users } from "lucide-react";

interface PartidoResult {
  partido: { id: number; codigo: string; nombre: string };
  corporacion?: { id: number; nombre: string };
  totalVotos: number;
}

interface SelectedPartido {
  id: number;
  label: string;
  sublabel?: string;
}

export default function PartidosPage() {
  const [data, setData] = useState<PartidoResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [corporaciones, setCorporaciones] = useState<FilterOption[]>([]);
  const [departamentos, setDepartamentos] = useState<FilterOption[]>([]);
  const [selectedPartido, setSelectedPartido] = useState<SelectedPartido | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({
    corporacionId: "",
    departamentoId: "",
  });

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

    fetch("/api/geografia?nivel=departamentos")
      .then((r) => r.json())
      .then((deps: { id: number; nombre: string }[]) => {
        setDepartamentos(
          deps.map((d) => ({ value: String(d.id), label: d.nombre }))
        );
      });
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ tipo: "por-partido", limit: "200" });
    if (filters.corporacionId) params.set("corporacionId", filters.corporacionId);
    if (filters.departamentoId) params.set("departamentoId", filters.departamentoId);

    const res = await fetch(`/api/resultados?${params}`);
    const json = await res.json();
    let results = json.data || [];

    // Filter by selected partido if any
    if (selectedPartido) {
      results = results.filter((d: PartidoResult) => d.partido.id === selectedPartido.id);
    }

    setData(results);
    setLoading(false);
  }, [filters, selectedPartido]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filterConfigs: FilterConfig[] = [
    { key: "corporacionId", label: "Corporación", options: corporaciones, placeholder: "Todas las corporaciones" },
    { key: "departamentoId", label: "Departamento", options: departamentos, placeholder: "Todos los departamentos" },
  ];

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "partido",
      header: "Partido",
      render: (row) => {
        const p = row.partido as { nombre: string; codigo: string };
        return (
          <div>
            <span className="font-medium text-slate-800">{p.nombre}</span>
            <span className="ml-2 text-xs text-slate-400">({p.codigo})</span>
          </div>
        );
      },
    },
    ...(filters.corporacionId || filters.departamentoId
      ? [{
          key: "corporacion",
          header: "Corporación",
          render: (row: Record<string, unknown>) => {
            const c = row.corporacion as { nombre: string } | undefined;
            return c?.nombre || "—";
          },
        }]
      : []),
    {
      key: "totalVotos",
      header: "Total Votos",
      align: "right" as const,
      render: (row) => (row.totalVotos as number).toLocaleString("es-CO"),
    },
  ];

  const chartData = data.slice(0, 15).map((d) => ({
    name: d.partido.nombre.length > 25 ? d.partido.nombre.substring(0, 25) + "..." : d.partido.nombre,
    value: d.totalVotos,
  }));

  const tableData = data.map((d) => ({
    partido: d.partido,
    corporacion: d.corporacion,
    totalVotos: d.totalVotos,
    nombre: d.partido.nombre,
  }));

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Users size={24} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Análisis por Partido</h1>
        </div>
        <p className="text-sm text-slate-500">Resultados electorales por partido político</p>
      </div>

      {/* Search partido */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm mb-4">
        <p className="text-xs font-semibold text-slate-500 mb-2">Buscar partido específico</p>
        <div className="max-w-md">
          <SearchAutocomplete
            placeholder="Buscar entre 3,156 partidos..."
            apiUrl="/api/partidos"
            onSelect={(opt) => setSelectedPartido(opt)}
            value={selectedPartido}
            onClear={() => setSelectedPartido(null)}
          />
        </div>
      </div>

      <div className="mb-4">
        <FilterPanel
          filters={filterConfigs}
          values={filters}
          onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
          onClear={() => setFilters({ corporacionId: "", departamentoId: "" })}
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {chartData.length > 0 && (
            <div className="mb-6">
              <BarChartComponent
                data={chartData}
                title="Distribución de votos por partido"
                colorful
                horizontal
                height={Math.max(300, chartData.length * 30)}
              />
            </div>
          )}

          <DataTable
            data={tableData}
            columns={columns}
            searchable
            searchPlaceholder="Buscar partido..."
            exportFileName="resultados_partidos"
          />
        </>
      )}
    </div>
  );
}
