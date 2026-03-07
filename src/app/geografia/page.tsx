"use client";

import { useEffect, useState, useCallback } from "react";
import DataTable, { type Column } from "@/components/DataTable";
import LoadingSpinner from "@/components/LoadingSpinner";
import MesaDetailModal from "@/components/MesaDetailModal";
import { ChevronRight, ArrowLeft, MapPin, Eye } from "lucide-react";

type NivelType = "departamentos" | "municipios" | "puestos" | "mesas";

interface Breadcrumb {
  nivel: NivelType;
  parentId?: string;
  label: string;
}

export default function GeografiaPage() {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([
    { nivel: "departamentos", label: "Colombia" },
  ]);
  const [selectedMesaId, setSelectedMesaId] = useState<number | null>(null);

  const currentLevel = breadcrumbs[breadcrumbs.length - 1];

  const fetchData = useCallback(async (nivel: NivelType, parentId?: string) => {
    setLoading(true);
    const params = new URLSearchParams({ nivel });
    if (parentId) params.set("parentId", parentId);
    const res = await fetch(`/api/geografia?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData(currentLevel.nivel, currentLevel.parentId);
  }, [currentLevel, fetchData]);

  const drillDown = (row: Record<string, unknown>, nextNivel: NivelType) => {
    const label = (row.nombre as string) || `Mesa ${row.numero}`;
    setBreadcrumbs((prev) => [
      ...prev,
      { nivel: nextNivel, parentId: String(row.id), label },
    ]);
  };

  const goBack = (index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
  };

  const columnsMap: Record<NivelType, Column<Record<string, unknown>>[]> = {
    departamentos: [
      { key: "codigo", header: "Código" },
      { key: "nombre", header: "Departamento" },
      { key: "totalMunicipios", header: "Municipios", align: "right" },
      {
        key: "totalVotos",
        header: "Total Votos",
        align: "right",
        render: (row) => (row.totalVotos as number).toLocaleString("es-CO"),
      },
      {
        key: "actions",
        header: "",
        sortable: false,
        render: () => <ChevronRight size={16} className="text-slate-400" />,
        align: "center",
      },
    ],
    municipios: [
      { key: "codigo", header: "Código" },
      { key: "nombre", header: "Municipio" },
      { key: "totalZonas", header: "Zonas", align: "right" },
      {
        key: "totalVotos",
        header: "Total Votos",
        align: "right",
        render: (row) => (row.totalVotos as number).toLocaleString("es-CO"),
      },
      {
        key: "actions",
        header: "",
        sortable: false,
        render: () => <ChevronRight size={16} className="text-slate-400" />,
        align: "center",
      },
    ],
    puestos: [
      { key: "codigo", header: "Código" },
      { key: "nombre", header: "Puesto" },
      { key: "zona", header: "Zona" },
      { key: "totalMesas", header: "Mesas", align: "right" },
      {
        key: "totalVotos",
        header: "Total Votos",
        align: "right",
        render: (row) => (row.totalVotos as number).toLocaleString("es-CO"),
      },
      {
        key: "actions",
        header: "",
        sortable: false,
        render: () => <ChevronRight size={16} className="text-slate-400" />,
        align: "center",
      },
    ],
    mesas: [
      { key: "numero", header: "Mesa #" },
      { key: "puesto", header: "Puesto" },
      {
        key: "potencialElectoral",
        header: "Potencial Electoral",
        align: "right",
        render: (row) =>
          row.potencialElectoral
            ? (row.potencialElectoral as number).toLocaleString("es-CO")
            : "N/A",
      },
      {
        key: "totalVotos",
        header: "Total Votos",
        align: "right",
        render: (row) => (row.totalVotos as number).toLocaleString("es-CO"),
      },
      {
        key: "actions",
        header: "",
        sortable: false,
        render: (row) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedMesaId(row.id as number);
            }}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            <Eye size={14} /> Ver detalle
          </button>
        ),
        align: "center",
      },
    ],
  };

  const nextNivelMap: Record<string, NivelType> = {
    departamentos: "municipios",
    municipios: "puestos",
    puestos: "mesas",
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <MapPin size={24} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Geografía Electoral</h1>
        </div>
        <p className="text-sm text-slate-500">
          Navegación jerárquica: Departamentos &rarr; Municipios &rarr; Puestos &rarr; Mesas
        </p>
      </div>

      {/* Breadcrumbs */}
      <div className="flex flex-wrap items-center gap-1 mb-4 text-sm">
        {breadcrumbs.map((bc, i) => (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-slate-300" />}
            <button
              onClick={() => goBack(i)}
              className={`px-2 py-1 rounded-md transition-colors ${
                i === breadcrumbs.length - 1
                  ? "text-blue-600 font-semibold bg-blue-50"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
              }`}
            >
              {bc.label}
            </button>
          </div>
        ))}
      </div>

      {/* Back button */}
      {breadcrumbs.length > 1 && (
        <button
          onClick={() => goBack(breadcrumbs.length - 2)}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors"
        >
          <ArrowLeft size={14} /> Volver
        </button>
      )}

      {/* Data */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          data={data}
          columns={columnsMap[currentLevel.nivel]}
          searchable
          searchPlaceholder="Buscar por nombre..."
          exportFileName={`geografia_${currentLevel.nivel}`}
          onRowClick={
            currentLevel.nivel !== "mesas"
              ? (row) => drillDown(row, nextNivelMap[currentLevel.nivel])
              : undefined
          }
        />
      )}

      {/* Mesa detail modal */}
      {selectedMesaId && (
        <MesaDetailModal
          mesaId={selectedMesaId}
          onClose={() => setSelectedMesaId(null)}
        />
      )}
    </div>
  );
}
