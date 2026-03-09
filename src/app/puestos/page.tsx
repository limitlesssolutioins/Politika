"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Upload, MapPin, Building2, ChevronRight, ArrowLeft, FileSpreadsheet, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import DataTable, { type Column } from "@/components/DataTable";
import ImportModal from "@/components/ImportModal";

// Dynamically import map to avoid SSR issues with Leaflet
const MapComponent = dynamic(() => import("@/components/MapComponent"), { ssr: false });

type Nivel = "departamentos" | "municipios" | "puestos";

interface DeptoData {
  id: number;
  nombre: string;
  totalPuestos: number;
  totalEstimado: number;
  totalPosible: number;
  totalMesas: number;
  totalVotosReales: number;
}

interface MuniData {
  id: number;
  nombre: string;
  totalPuestos: number;
  totalEstimado: number;
  totalPosible: number;
  totalMesas: number;
  totalVotosReales: number;
}

interface PuestoData {
  id: number;
  nombre: string;
  zona: string;
  mesas: number;
  estimado: number;
  totalPosible: number;
  votosReales: number;
}

interface SimpleUploadResult {
  success?: boolean;
  actualizados: number;
  noEncontrados: number;
  total: number;
  tipo?: string;
  error?: string;
}

export default function PuestosPage() {
  const [nivel, setNivel] = useState<Nivel>("departamentos");
  const [departamentos, setDepartamentos] = useState<DeptoData[]>([]);
  const [municipios, setMunicipios] = useState<MuniData[]>([]);
  const [puestos, setPuestos] = useState<PuestoData[]>([]);

  const [selectedDepto, setSelectedDepto] = useState<{id: number, nombre: string} | null>(null);
  const [selectedMuni, setSelectedMuni] = useState<{id: number, nombre: string} | null>(null);

  const [loading, setLoading] = useState(true);

  // Estimados import (modal con IA)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // E14 simple upload
  const e14InputRef = useRef<HTMLInputElement>(null);
  const [e14Uploading, setE14Uploading] = useState(false);
  const [e14Result, setE14Result] = useState<SimpleUploadResult | null>(null);

  const fetchDepartamentos = () => {
    setLoading(true);
    fetch("/api/puestos?nivel=departamentos")
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDepartamentos(data);
        } else {
          console.error("API Error:", data);
          setDepartamentos([]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDepartamentos();
  }, []);

  const handleDeptoClick = (id: number, nombre: string) => {
    setSelectedDepto({ id, nombre });
    setSelectedMuni(null);
    setNivel("municipios");
    setLoading(true);
    fetch(`/api/puestos?nivel=municipios&parentId=${id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMunicipios(data);
        } else {
          console.error("API Error:", data);
          setMunicipios([]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleMuniClick = (id: number, nombre: string) => {
    setSelectedMuni({ id, nombre });
    setNivel("puestos");
    setLoading(true);
    fetch(`/api/puestos?nivel=puestos&parentId=${id}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPuestos(data);
        } else {
          console.error("Error from API:", data);
          setPuestos([]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleMapClick = (deptName: string) => {
    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const name = normalize(deptName);
    const dept = departamentos.find(d => normalize(d.nombre).includes(name) || name.includes(normalize(d.nombre)));
    
    if (dept) {
      handleDeptoClick(dept.id, dept.nombre);
    } else {
      alert(`No se encontraron datos para el departamento: ${deptName}`);
    }
  };

  const handleImportSuccess = () => {
    setIsImportModalOpen(false);
    refreshCurrentView();
  };

  const refreshCurrentView = () => {
    if (nivel === "departamentos") fetchDepartamentos();
    else if (nivel === "municipios" && selectedDepto) handleDeptoClick(selectedDepto.id, selectedDepto.nombre);
    else if (nivel === "puestos" && selectedMuni) handleMuniClick(selectedMuni.id, selectedMuni.nombre);
  };

  const handleE14Upload = async (file: File) => {
    setE14Uploading(true);
    setE14Result(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/puestos/upload?tipo=e14", { method: "POST", body: formData });
      const data: SimpleUploadResult = await res.json();
      setE14Result(data);
      if (data.success) refreshCurrentView();
    } catch {
      setE14Result({ error: "Error de conexión", actualizados: 0, noEncontrados: 0, total: 0 });
    } finally {
      setE14Uploading(false);
      if (e14InputRef.current) e14InputRef.current.value = "";
    }
  };

  const columnsPuestos: Column<PuestoData>[] = [
    { key: "zona", header: "Zona" },
    { key: "nombre", header: "Nombre del Puesto" },
    { key: "mesas", header: "Mesas", align: "center" },
    {
      key: "totalPosible",
      header: "Potencial E14 ant.",
      align: "right",
      render: (row) => row.totalPosible > 0 ? (
        <span className="text-slate-600">{row.totalPosible.toLocaleString("es-CO")}</span>
      ) : <span className="text-slate-300">-</span>
    },
    {
      key: "estimado",
      header: "Meta Estimada",
      align: "right",
      render: (row) => row.estimado > 0 ? (
        <span className="font-bold text-indigo-600">{row.estimado.toLocaleString("es-CO")}</span>
      ) : <span className="text-slate-300">-</span>
    },
    {
      key: "votosReales",
      header: "Votos E14 nuevo",
      align: "right",
      render: (row) => row.votosReales > 0 ? (
        <span className="font-bold text-emerald-600">{row.votosReales.toLocaleString("es-CO")}</span>
      ) : <span className="text-slate-300">-</span>
    },
    {
      key: "cumplimiento",
      header: "% vs Meta",
      align: "center",
      render: (row) => {
        if (!row.estimado || row.estimado === 0 || !row.votosReales) return "-";
        const perc = ((row.votosReales / row.estimado) * 100).toFixed(1);
        const color = row.votosReales >= row.estimado ? "text-emerald-600" : "text-amber-600";
        return <span className={`font-semibold ${color}`}>{perc}%</span>;
      }
    },
    {
      key: "cumplimientoPotencial",
      header: "% vs Potencial",
      align: "center",
      render: (row) => {
        if (!row.totalPosible || row.totalPosible === 0 || !row.votosReales) return "-";
        const perc = ((row.votosReales / row.totalPosible) * 100).toFixed(1);
        return <span className="font-semibold text-slate-500">{perc}%</span>;
      }
    }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.24))] md:h-[calc(100vh-theme(spacing.12))]">
      {/* Header & Upload */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 gap-4 flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            {nivel !== "departamentos" && (
              <button 
                onClick={() => {
                  if (nivel === "puestos") {
                    handleDeptoClick(selectedDepto!.id, selectedDepto!.nombre);
                  } else {
                    setNivel("departamentos");
                    setSelectedDepto(null);
                    setSelectedMuni(null);
                  }
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors mr-1"
                title="Volver"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="text-blue-600" />
              Mapa de Puestos de Votación
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {nivel === "departamentos" ? "Selecciona un departamento para ver municipios" : 
             nivel === "municipios" ? `Municipios en ${selectedDepto?.nombre}` : 
             `Puestos de votación en ${selectedMuni?.nombre}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Botón subir estimados (IA) */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <Upload size={16} />
            Subir Estimados
          </button>

          {/* Botón subir E14 nuevo */}
          <button
            onClick={() => e14InputRef.current?.click()}
            disabled={e14Uploading}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            {e14Uploading
              ? <Loader2 size={16} className="animate-spin" />
              : <FileSpreadsheet size={16} />}
            {e14Uploading ? "Procesando..." : "Subir E14"}
          </button>
          <input
            ref={e14InputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleE14Upload(f); }}
          />

          {/* Resultado E14 */}
          {e14Result && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${e14Result.error ? "bg-red-50 text-red-700 border border-red-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
              {e14Result.error
                ? <><AlertCircle size={14} /> {e14Result.error}</>
                : <><CheckCircle2 size={14} /> {e14Result.actualizados} puestos actualizados · {e14Result.noEncontrados} no encontrados</>
              }
              <button onClick={() => setE14Result(null)}><X size={14} /></button>
            </div>
          )}
        </div>
      </div>

      <ImportModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onSuccess={handleImportSuccess} 
      />

      {/* Main Content */}
      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0 overflow-hidden">
        
        {/* Sidebar List (Drill-down) */}
        <div className="w-full lg:w-1/3 flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
          
          {/* Breadcrumbs */}
          <div className="p-3 border-b border-slate-100 bg-slate-50 text-sm font-medium flex items-center gap-1 text-slate-600 overflow-x-auto whitespace-nowrap">
            <button 
              onClick={() => { setNivel("departamentos"); setSelectedDepto(null); setSelectedMuni(null); }}
              className={`hover:text-blue-600 ${nivel === "departamentos" ? "text-slate-900 font-bold" : ""}`}
            >
              Colombia
            </button>
            
            {selectedDepto && (
              <>
                <ChevronRight size={14} className="text-slate-400" />
                <button 
                  onClick={() => { setNivel("municipios"); setSelectedMuni(null); handleDeptoClick(selectedDepto.id, selectedDepto.nombre); }}
                  className={`hover:text-blue-600 ${nivel === "municipios" ? "text-slate-900 font-bold" : ""}`}
                >
                  {selectedDepto.nombre}
                </button>
              </>
            )}

            {selectedMuni && (
              <>
                <ChevronRight size={14} className="text-slate-400" />
                <span className="text-slate-900 font-bold">{selectedMuni.nombre}</span>
              </>
            )}
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
              </div>
            ) : nivel === "departamentos" ? (
              <div className="space-y-1">
                {departamentos.map(d => (
                  <button
                    key={d.id}
                    onClick={() => handleDeptoClick(d.id, d.nombre)}
                    className="w-full text-left p-3 rounded-lg hover:bg-slate-50 flex items-center justify-between group transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{d.nombre}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {d.totalPuestos} puestos | E14 ant: {d.totalPosible > 0 ? d.totalPosible.toLocaleString("es-CO") : "–"}
                      </p>
                      <p className="text-xs mt-0.5 flex gap-2">
                        <span className="text-indigo-500">Meta: {d.totalEstimado > 0 ? d.totalEstimado.toLocaleString("es-CO") : "–"}</span>
                        <span className="text-emerald-600 font-medium">E14 nuevo: {d.totalVotosReales > 0 ? d.totalVotosReales.toLocaleString("es-CO") : "–"}</span>
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </button>
                ))}
              </div>
            ) : nivel === "municipios" ? (
              <div className="space-y-1">
                {municipios.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleMuniClick(m.id, m.nombre)}
                    className="w-full text-left p-3 rounded-lg hover:bg-slate-50 flex items-center justify-between group transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <Building2 size={16} className="text-slate-400 mt-0.5" />
                      <div>
                        <p className="font-semibold text-slate-800 group-hover:text-blue-600">{m.nombre}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {m.totalPuestos} puestos | E14 ant: {m.totalPosible > 0 ? m.totalPosible.toLocaleString("es-CO") : "–"}
                        </p>
                        <p className="text-xs mt-0.5 flex gap-2">
                          <span className="text-indigo-500">Meta: {m.totalEstimado > 0 ? m.totalEstimado.toLocaleString("es-CO") : "–"}</span>
                          <span className="text-emerald-600 font-medium">E14 nuevo: {m.totalVotosReales > 0 ? m.totalVotosReales.toLocaleString("es-CO") : "–"}</span>
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Puestos de Votación</p>
                {puestos.map(p => (
                  <div key={p.id} className="p-3 rounded-lg border border-slate-100 bg-white hover:border-slate-300 transition-colors">
                    <p className="font-semibold text-slate-800 text-sm mb-1">{p.nombre}</p>
                    <p className="text-xs text-slate-400 mb-1.5">Zona {p.zona} · {p.mesas} mesas</p>
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      <div className="text-center bg-slate-50 rounded px-1 py-0.5">
                        <p className="text-slate-400">E14 ant.</p>
                        <p className="font-semibold text-slate-600">{p.totalPosible > 0 ? p.totalPosible.toLocaleString("es-CO") : "–"}</p>
                      </div>
                      <div className="text-center bg-indigo-50 rounded px-1 py-0.5">
                        <p className="text-indigo-400">Meta</p>
                        <p className="font-semibold text-indigo-700">{p.estimado > 0 ? p.estimado.toLocaleString("es-CO") : "–"}</p>
                      </div>
                      <div className="text-center bg-emerald-50 rounded px-1 py-0.5">
                        <p className="text-emerald-500">E14 nuevo</p>
                        <p className="font-semibold text-emerald-700">{p.votosReales > 0 ? p.votosReales.toLocaleString("es-CO") : "–"}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Map Area */}
        <div className="flex-1 h-[400px] lg:h-full relative flex-shrink-0">
          {nivel === "puestos" ? (
             <div className="h-full overflow-y-auto">
               <DataTable 
                 data={puestos}
                 columns={columnsPuestos}
                 searchable
                 exportFileName={`puestos_${selectedMuni?.nombre}`}
               />
             </div>
          ) : (
            <MapComponent data={departamentos} onDepartmentClick={handleMapClick} />
          )}
        </div>
      </div>
    </div>
  );
}
