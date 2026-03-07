"use client";

import { useEffect, useState, useCallback } from "react";
import DataTable, { type Column } from "@/components/DataTable";
import FilterPanel, { type FilterConfig, type FilterOption } from "@/components/FilterPanel";
import SearchAutocomplete from "@/components/SearchAutocomplete";
import BarChartComponent from "@/components/charts/BarChartComponent";
import LoadingSpinner from "@/components/LoadingSpinner";
import { UserCheck } from "lucide-react";

interface CandidatoResult {
  candidato: { id: number; nombre: string; codigo: string; partido: string };
  corporacion?: { id: number; nombre: string };
  totalVotos: number;
}

interface Selected {
  id: number;
  label: string;
  sublabel?: string;
}

export default function CandidatosPage() {
  const [data, setData] = useState<CandidatoResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [corporaciones, setCorporaciones] = useState<FilterOption[]>([]);
  const [selectedPartido, setSelectedPartido] = useState<Selected | null>(null);
  const [selectedCandidato, setSelectedCandidato] = useState<Selected | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({
    corporacionId: "",
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
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ tipo: "por-candidato", limit: "100" });
    if (filters.corporacionId) params.set("corporacionId", filters.corporacionId);
    if (selectedPartido) params.set("partidoId", String(selectedPartido.id));
    if (selectedCandidato) params.set("candidatoId", String(selectedCandidato.id));

    const res = await fetch(`/api/resultados?${params}`);
    const json = await res.json();
    setData(json.data || []);
    setLoading(false);
  }, [filters, selectedPartido, selectedCandidato]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filterConfigs: FilterConfig[] = [
    { key: "corporacionId", label: "Corporación", options: corporaciones, placeholder: "Todas las corporaciones" },
  ];

  const columns: Column<Record<string, unknown>>[] = [
    {
      key: "candidato",
      header: "Candidato",
      render: (row) => {
        const c = row.candidato as { nombre: string; codigo: string };
        return (
          <div>
            <span className="font-medium text-slate-800">{c.nombre}</span>
            <span className="ml-2 text-xs text-slate-400">({c.codigo})</span>
          </div>
        );
      },
    },
    {
      key: "partido",
      header: "Partido",
      render: (row) => {
        const c = row.candidato as { partido: string };
        return <span className="text-sm text-slate-600">{c.partido}</span>;
      },
    },
    {
      key: "corporacion",
      header: "Corporación",
      render: (row) => {
        const c = row.corporacion as { nombre: string } | undefined;
        return c?.nombre || "—";
      },
    },
    {
      key: "totalVotos",
      header: "Total Votos",
      align: "right",
      render: (row) => (row.totalVotos as number).toLocaleString("es-CO"),
    },
  ];

  const chartData = data
    .filter((d) => !["VOTOS NULOS", "VOTOS EN BLANCO", "CANDIDATOS TOTALES"].includes(d.candidato.nombre))
    .slice(0, 15)
    .map((d) => ({
      name: d.candidato.nombre.length > 25 ? d.candidato.nombre.substring(0, 25) + "..." : d.candidato.nombre,
      value: d.totalVotos,
    }));

  const tableData = data.map((d) => ({
    candidato: d.candidato,
    corporacion: d.corporacion,
    totalVotos: d.totalVotos,
    nombre: d.candidato.nombre,
  }));

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <UserCheck size={24} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Análisis por Candidato</h1>
        </div>
        <p className="text-sm text-slate-500">Resultados electorales por candidato individual</p>
      </div>

      {/* Search boxes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-2">Filtrar por partido</p>
          <SearchAutocomplete
            placeholder="Buscar partido..."
            apiUrl="/api/partidos"
            onSelect={(opt) => setSelectedPartido(opt)}
            value={selectedPartido}
            onClear={() => setSelectedPartido(null)}
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 mb-2">Buscar candidato</p>
          <SearchAutocomplete
            placeholder="Buscar candidato por nombre..."
            apiUrl="/api/candidatos"
            onSelect={(opt) => setSelectedCandidato(opt)}
            value={selectedCandidato}
            onClear={() => setSelectedCandidato(null)}
          />
        </div>
      </div>

      <div className="mb-4">
        <FilterPanel
          filters={filterConfigs}
          values={filters}
          onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
          onClear={() => setFilters({ corporacionId: "" })}
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
                title="Top 15 candidatos por votos"
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
            searchPlaceholder="Buscar candidato..."
            exportFileName="resultados_candidatos"
          />
        </>
      )}
    </div>
  );
}
