"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Upload, MapPin, Building2, ChevronRight, CheckCircle2, ArrowLeft } from "lucide-react";
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
}

interface MuniData {
  id: number;
  nombre: string;
  totalPuestos: number;
  totalEstimado: number;
  totalPosible: number;
  totalMesas: number;
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

interface UploadResult {
  actualizados: number;
  noEncontrados: number;
  total: number;
}

export default function PuestosPage() {
  const [nivel, setNivel] = useState<Nivel>("departamentos");
  const [departamentos, setDepartamentos] = useState<DeptoData[]>([]);
  const [municipios, setMunicipios] = useState<MuniData[]>([]);
  const [puestos, setPuestos] = useState<PuestoData[]>([]);
  
  const [selectedDepto, setSelectedDepto] = useState<{id: number, nombre: string} | null>(null);
  const [selectedMuni, setSelectedMuni] = useState<{id: number, nombre: string} | null>(null);

  const [loading, setLoading] = useState(true);
  
  // Upload states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

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
    // Refresh current view
    if (nivel === "departamentos") fetchDepartamentos();
    else if (nivel === "municipios" && selectedDepto) handleDeptoClick(selectedDepto.id, selectedDepto.nombre);
    else if (nivel === "puestos" && selectedMuni) handleMuniClick(selectedMuni.id, selectedMuni.nombre);
  };

  const columnsPuestos: Column<PuestoData>[] = [
    { key: "zona", header: "Zona" },
    { key: "nombre", header: "Nombre del Puesto" },
    { key: "mesas", header: "Mesas", align: "center" },
    { 
      key: "totalPosible", 
      header: "Potencial (Total Posible)", 
      align: "right",
      render: (row) => row.totalPosible > 0 ? (
        <span className="text-slate-600">{row.totalPosible.toLocaleString("es-CO")}</span>
      ) : "-"
    },
    { 
      key: "estimado", 
      header: "Votos Estimados", 
      align: "right",
      render: (row) => row.estimado > 0 ? (
        <span className="font-bold text-indigo-600">{row.estimado.toLocaleString("es-CO")}</span>
      ) : "-"
    },
    {
      key: "cumplimiento",
      header: "% del Potencial",
      align: "center",
      render: (row) => {
        if (!row.totalPosible || row.totalPosible === 0 || !row.estimado) return "-";
        const perc = ((row.estimado / row.totalPosible) * 100).toFixed(2);
        return <span className="font-semibold text-slate-600">{perc}%</span>;
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

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors hover:bg-slate-800"
          >
            <Upload size={16} />
            Importar Datos
          </button>
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
                        {d.totalPuestos} puestos | Est: {d.totalEstimado.toLocaleString("es-CO")} | Pot: {d.totalPosible.toLocaleString("es-CO")}
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
                          {m.totalPuestos} puestos | Est: {m.totalEstimado.toLocaleString("es-CO")} | Pot: {m.totalPosible.toLocaleString("es-CO")}
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
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="text-slate-500">Zona {p.zona} | {p.mesas} mesas | Pot: {p.totalPosible.toLocaleString("es-CO")}</span>
                      <span className="font-medium px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded">
                        Est: {p.estimado.toLocaleString("es-CO")}
                      </span>
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
