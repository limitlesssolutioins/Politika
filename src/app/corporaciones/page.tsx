"use client";

import { useEffect, useState, useCallback } from "react";
import DataTable, { type Column } from "@/components/DataTable";
import FilterPanel, { type FilterConfig, type FilterOption } from "@/components/FilterPanel";
import BarChartComponent from "@/components/charts/BarChartComponent";
import PieChartComponent from "@/components/charts/PieChartComponent";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Building2 } from "lucide-react";

interface CorpData {
  corporacion: { id: number; nombre: string; codigo: string };
  totalVotos: number;
}

export default function CorporacionesPage() {
  const [corpData, setCorpData] = useState<CorpData[]>([]);
  const [detailData, setDetailData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [corporaciones, setCorporaciones] = useState<FilterOption[]>([]);
  const [departamentos, setDepartamentos] = useState<FilterOption[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({
    corporacionId: "",
    departamentoId: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/resultados?tipo=por-corporacion").then((r) => r.json()),
      fetch("/api/geografia?nivel=departamentos").then((r) => r.json()),
    ]).then(([corpRes, depts]) => {
      setCorpData(corpRes.data || []);
      setCorporaciones(
        (corpRes.data || []).map((c: CorpData) => ({
          value: String(c.corporacion.id),
          label: c.corporacion.nombre,
        }))
      );
      setDepartamentos(
        (depts || []).map((d: { id: number; nombre: string }) => ({
          value: String(d.id),
          label: d.nombre,
        }))
      );
      setLoading(false);
    });
  }, []);

  const fetchDetail = useCallback(async () => {
    if (!filters.corporacionId) {
      setDetailData([]);
      return;
    }
    setDetailLoading(true);
    const params = new URLSearchParams({
      tipo: "por-partido",
      corporacionId: filters.corporacionId,
      limit: "100",
    });
    if (filters.departamentoId) params.set("departamentoId", filters.departamentoId);

    const res = await fetch(`/api/resultados?${params}`);
    const json = await res.json();
    setDetailData(
      (json.data || []).map((d: { partido: { nombre: string; codigo: string }; totalVotos: number }) => ({
        nombre: d.partido.nombre,
        codigo: d.partido.codigo,
        totalVotos: d.totalVotos,
      }))
    );
    setDetailLoading(false);
  }, [filters]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const filterConfigs: FilterConfig[] = [
    { key: "corporacionId", label: "Corporación", options: corporaciones, placeholder: "Seleccionar corporación" },
    { key: "departamentoId", label: "Departamento", options: departamentos, placeholder: "Todos los departamentos" },
  ];

  const detailColumns: Column<Record<string, unknown>>[] = [
    { key: "nombre", header: "Partido" },
    { key: "codigo", header: "Código" },
    {
      key: "totalVotos",
      header: "Total Votos",
      align: "right",
      render: (row) => (row.totalVotos as number).toLocaleString("es-CO"),
    },
  ];

  const pieData = corpData.map((c) => ({
    name: c.corporacion.nombre,
    value: c.totalVotos,
  }));

  const detailChart = detailData.slice(0, 10).map((d) => ({
    name: String(d.nombre).length > 20 ? String(d.nombre).substring(0, 20) + "..." : String(d.nombre),
    value: d.totalVotos as number,
  }));

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Building2 size={24} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Análisis por Corporación</h1>
        </div>
        <p className="text-sm text-slate-500">
          Gobernador, Alcalde, Asamblea, Concejo, JAL
        </p>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <PieChartComponent data={pieData} title="Distribución de votos por corporación" />
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-slate-700">Resumen por Corporación</h3>
          <div className="space-y-3">
            {corpData.map((c) => (
              <div
                key={c.corporacion.id}
                className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0"
              >
                <span className="text-sm font-medium text-slate-700">{c.corporacion.nombre}</span>
                <span className="text-sm font-semibold text-blue-600">
                  {c.totalVotos.toLocaleString("es-CO")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detail filters */}
      <div className="mb-4">
        <FilterPanel
          filters={filterConfigs}
          values={filters}
          onChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
          onClear={() => setFilters({ corporacionId: "", departamentoId: "" })}
        />
      </div>

      {filters.corporacionId && (
        detailLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {detailChart.length > 0 && (
              <div className="mb-6">
                <BarChartComponent
                  data={detailChart}
                  title={`Top partidos - ${corporaciones.find((c) => c.value === filters.corporacionId)?.label || ""}`}
                  colorful
                  horizontal
                  height={Math.max(280, detailChart.length * 30)}
                />
              </div>
            )}
            <DataTable
              data={detailData}
              columns={detailColumns}
              searchable
              exportFileName={`corporacion_${filters.corporacionId}`}
            />
          </>
        )
      )}

      {!filters.corporacionId && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <Building2 size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-400">Selecciona una corporación para ver el detalle de resultados</p>
        </div>
      )}
    </div>
  );
}
