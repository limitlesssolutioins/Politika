"use client";

import { useEffect, useState } from "react";
import { X, Vote, MapPin, Edit2, Check } from "lucide-react";
import BarChartComponent from "@/components/charts/BarChartComponent";

interface MesaVoto {
  id: number;
  totalVotos: number;
  corporacion: { nombre: string };
  partido: { nombre: string; codigo: string };
  candidato: { nombre: string; codigo: string };
}

interface CorporacionGroup {
  corporacion: string;
  votos: MesaVoto[];
  total: number;
}

interface MesaDetail {
  mesa: {
    id: number;
    numero: number;
    potencialElectoral: number | null;
    estimadoVotos: number | null;
    puesto: string;
    zona: string;
    municipio: string;
    departamento: string;
  };
  totalVotos: number;
  totalRegistros: number;
  porCorporacion: CorporacionGroup[];
}

interface MesaDetailModalProps {
  mesaId: number;
  onClose: () => void;
}

export default function MesaDetailModal({ mesaId, onClose }: MesaDetailModalProps) {
  const [data, setData] = useState<MesaDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  
  // States for estimation
  const [isEditingEst, setIsEditingEst] = useState(false);
  const [estValue, setEstValue] = useState<string>("");
  const [isSavingEst, setIsSavingEst] = useState(false);

  useEffect(() => {
    fetch(`/api/mesas/${mesaId}`)
      .then((r) => r.json())
      .then((json) => {
        setData(json);
        setEstValue(json.mesa?.estimadoVotos?.toString() || "");
        if (json.porCorporacion?.length > 0) {
          setActiveTab(json.porCorporacion[0].corporacion);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [mesaId]);

  const handleSaveEstimado = async () => {
    if (!data) return;
    setIsSavingEst(true);
    try {
      const res = await fetch(`/api/mesas/${mesaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimadoVotos: estValue }),
      });
      const json = await res.json();
      if (json.success) {
        setData({
          ...data,
          mesa: { ...data.mesa, estimadoVotos: json.estimadoVotos },
        });
        setIsEditingEst(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingEst(false);
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const activeGroup = data?.porCorporacion.find((g) => g.corporacion === activeTab);

  const chartData = activeGroup
    ? activeGroup.votos
        .filter((v) => v.totalVotos > 0 && !["VOTOS NULOS", "VOTOS EN BLANCO"].includes(v.candidato.nombre))
        .sort((a, b) => b.totalVotos - a.totalVotos)
        .slice(0, 10)
        .map((v) => ({
          name: v.candidato.nombre.length > 20 ? v.candidato.nombre.substring(0, 20) + "..." : v.candidato.nombre,
          value: v.totalVotos,
        }))
    : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white px-6 py-4 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Detalle de Mesa {data?.mesa.numero ?? mesaId}
            </h2>
            {data && (
              <div className="flex items-center gap-1 mt-1 text-sm text-slate-500">
                <MapPin size={14} />
                {data.mesa.departamento} &rarr; {data.mesa.municipio} &rarr; {data.mesa.puesto}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
          </div>
        ) : data ? (
          <div className="p-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              <div className="rounded-lg bg-blue-50 p-3 text-center">
                <p className="text-xs text-blue-500">Total Votos</p>
                <p className="text-xl font-bold text-blue-700">{data.totalVotos.toLocaleString("es-CO")}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-3 text-center">
                <p className="text-xs text-emerald-500">Registros</p>
                <p className="text-xl font-bold text-emerald-700">{data.totalRegistros}</p>
              </div>
              <div className="rounded-lg bg-purple-50 p-3 text-center">
                <p className="text-xs text-purple-500">Corporaciones</p>
                <p className="text-xl font-bold text-purple-700">{data.porCorporacion.length}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-3 text-center">
                <p className="text-xs text-amber-500">Potencial</p>
                <p className="text-xl font-bold text-amber-700">
                  {data.mesa.potencialElectoral?.toLocaleString("es-CO") ?? "N/A"}
                </p>
              </div>
              <div className="rounded-lg bg-indigo-50 p-3 text-center relative group">
                <p className="text-xs text-indigo-500">Votos Estimados</p>
                {isEditingEst ? (
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <input
                      type="number"
                      value={estValue}
                      onChange={(e) => setEstValue(e.target.value)}
                      className="w-16 rounded border border-indigo-200 px-1 py-0.5 text-center text-sm font-bold text-indigo-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 bg-white"
                      disabled={isSavingEst}
                      autoFocus
                    />
                    <button
                      onClick={handleSaveEstimado}
                      disabled={isSavingEst}
                      className="rounded bg-indigo-600 p-1 text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingEst(false);
                        setEstValue(data.mesa.estimadoVotos?.toString() || "");
                      }}
                      disabled={isSavingEst}
                      className="rounded bg-slate-200 p-1 text-slate-600 hover:bg-slate-300 disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <p className="text-xl font-bold text-indigo-700">
                      {data.mesa.estimadoVotos?.toLocaleString("es-CO") ?? "N/A"}
                    </p>
                    <button
                      onClick={() => setIsEditingEst(true)}
                      className="text-indigo-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Edit2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Corporacion tabs */}
            <div className="flex flex-wrap gap-1 mb-4 border-b border-slate-100 pb-3">
              {data.porCorporacion.map((group) => (
                <button
                  key={group.corporacion}
                  onClick={() => setActiveTab(group.corporacion)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    activeTab === group.corporacion
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {group.corporacion} ({group.total.toLocaleString("es-CO")})
                </button>
              ))}
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <div className="mb-4">
                <BarChartComponent
                  data={chartData}
                  title={`Top candidatos - ${activeTab}`}
                  colorful
                  horizontal
                  height={Math.max(200, chartData.length * 28)}
                />
              </div>
            )}

            {/* Table */}
            {activeGroup && (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Candidato</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-slate-600">Partido</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-slate-600">Votos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeGroup.votos
                      .sort((a, b) => b.totalVotos - a.totalVotos)
                      .map((v) => (
                        <tr key={v.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <Vote size={14} className="text-slate-300" />
                              <span className="font-medium text-slate-800">{v.candidato.nombre}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-slate-500">{v.partido.nombre}</td>
                          <td className="px-4 py-2 text-right font-semibold text-slate-700">
                            {v.totalVotos.toLocaleString("es-CO")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <p className="p-6 text-center text-slate-400">No se encontró la mesa</p>
        )}
      </div>
    </div>
  );
}
