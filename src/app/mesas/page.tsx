"use client";

import { useEffect, useState, useCallback } from "react";
import DataTable, { type Column } from "@/components/DataTable";
import LoadingSpinner from "@/components/LoadingSpinner";
import MesaDetailModal from "@/components/MesaDetailModal";
import FilterPanel, { type FilterConfig } from "@/components/FilterPanel";
import { Eye, Hash } from "lucide-react";

interface MesaResult {
  id: number;
  numero: number;
  potencialElectoral: number | null;
  estimadoVotos: number | null;
  puesto: string;
  zona: string;
  municipio: string;
  departamento: string;
  totalVotos: number;
}

export default function MesasPage() {
  const [data, setData] = useState<MesaResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMesaId, setSelectedMesaId] = useState<number | null>(null);

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [departamentos, setDepartamentos] = useState<{ id: number; nombre: string }[]>([]);
  const [municipios, setMunicipios] = useState<{ id: number; nombre: string }[]>([]);

  useEffect(() => {
    fetch("/api/geografia?nivel=departamentos")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDepartamentos(data);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (filters.departamentoId) {
      fetch(`/api/geografia?nivel=municipios&parentId=${filters.departamentoId}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setMunicipios(data);
          }
        })
        .catch(console.error);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMunicipios([]);
    }
  }, [filters.departamentoId]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "500" });
    if (filters.departamentoId) params.append("departamentoId", filters.departamentoId);
    if (filters.municipioId) params.append("municipioId", filters.municipioId);

    const res = await fetch(`/api/mesas?${params}`);
    const json = await res.json();
    setData(json.data || []);
    setLoading(false);
  }, [filters.departamentoId, filters.municipioId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => {
      const newFilters = { ...prev, [key]: value };
      if (key === "departamentoId" && prev.departamentoId !== value) {
        newFilters.municipioId = "";
      }
      return newFilters;
    });
  };

  const handleClearFilters = () => {
    setFilters({});
  };

  const filterConfig: FilterConfig[] = [
    {
      key: "departamentoId",
      label: "Departamento",
      placeholder: "Todos los departamentos",
      options: departamentos.map((d) => ({
        value: d.id.toString(),
        label: d.nombre,
      })),
    },
    {
      key: "municipioId",
      label: "Municipio",
      placeholder: "Todos los municipios",
      options: municipios.map((m) => ({
        value: m.id.toString(),
        label: m.nombre,
      })),
    },
  ];

  const columns: Column<Record<string, unknown>>[] = [
    { key: "departamento", header: "Departamento" },
    { key: "municipio", header: "Municipio" },
    { key: "puesto", header: "Puesto" },
    { key: "numero", header: "Mesa #", align: "center" },
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
      key: "estimadoVotos",
      header: "Votos Estimados",
      align: "right",
      render: (row) =>
        row.estimadoVotos != null
          ? (row.estimadoVotos as number).toLocaleString("es-CO")
          : "-",
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
  ];

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Hash size={24} className="text-blue-600" />
          <h1 className="text-2xl font-bold text-slate-900">Potencial por Mesas</h1>
        </div>
        <p className="text-sm text-slate-500">
          Consulta y busca información detallada sobre el potencial electoral de las mesas en el país. Limitado a los primeros 500 resultados por búsqueda.
        </p>
      </div>

      <div className="mb-6">
        <FilterPanel
          filters={filterConfig}
          values={filters}
          onChange={handleFilterChange}
          onClear={handleClearFilters}
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <DataTable
          data={data as unknown as Record<string, unknown>[]}
          columns={columns}
          searchable
          searchPlaceholder="Buscar por nombre de puesto o número de mesa..."
          exportFileName="potencial_mesas"
        />
      )}

      {selectedMesaId && (
        <MesaDetailModal
          mesaId={selectedMesaId}
          onClose={() => setSelectedMesaId(null)}
        />
      )}
    </div>
  );
}
