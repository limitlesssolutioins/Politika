"use client";

import { useState } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function ImportarEstimadosPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (files.length === 0) return;
    
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/estimados/import', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar los archivos');
      }
      
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 pb-20 max-w-4xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-2">Subir Excel de Estimados</h1>
      <p className="text-slate-400 mb-8">
        Sube archivos Excel (.xlsx) con las bases de datos de votantes. El sistema cruzará la información usando la columna de Puesto de Votación y actualizará las estimaciones por puesto.
      </p>

      <div className="bg-slate-900 border border-white/10 rounded-xl p-6 mb-8">
        <div className="flex flex-col items-center justify-center w-full">
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer bg-slate-800 hover:bg-slate-700 transition">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <UploadCloud className="w-10 h-10 mb-3 text-slate-400" />
              <p className="mb-2 text-sm text-slate-300">
                <span className="font-semibold">Haz clic para subir</span> o arrastra y suelta
              </p>
              <p className="text-xs text-slate-500">Archivos Excel (.xlsx, .xls)</p>
            </div>
            <input 
              type="file" 
              className="hidden" 
              multiple 
              accept=".xlsx, .xls"
              onChange={handleFileChange}
            />
          </label>
        </div>
        
        {files.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-slate-300 mb-2">Archivos seleccionados ({files.length}):</h4>
            <ul className="text-sm text-slate-400 list-disc list-inside">
              {files.map((file, i) => (
                <li key={i}>{file.name}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
            {loading ? 'Procesando...' : 'Iniciar Importación'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-4 rounded-lg flex items-start gap-3 mb-8">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="space-y-6">
          <div className="bg-green-900/20 border border-green-500/50 rounded-xl p-6">
            <div className="flex items-center gap-3 text-green-400 mb-4">
              <CheckCircle2 className="w-6 h-6" />
              <h2 className="text-xl font-semibold">Importación Completada</h2>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-slate-800 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold text-white">{result.totalRows}</p>
                <p className="text-xs text-slate-400 mt-1">Registros Leídos</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold text-blue-400">{result.totalMatched}</p>
                <p className="text-xs text-slate-400 mt-1">Registros Cruzados</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold text-red-400">{result.totalUnmatched}</p>
                <p className="text-xs text-slate-400 mt-1">Sin Encontrar</p>
              </div>
              <div className="bg-slate-800 p-4 rounded-lg text-center">
                <p className="text-3xl font-bold text-green-400">{result.updatedPuestos}</p>
                <p className="text-xs text-slate-400 mt-1">Puestos Actualizados</p>
              </div>
            </div>

            {result.unmatchedPuestos?.length > 0 && (
              <div className="bg-slate-800 p-4 rounded-lg">
                <h3 className="font-semibold text-white mb-2">Puestos no encontrados (Top 50)</h3>
                <p className="text-sm text-slate-400 mb-3">Los siguientes puestos en el Excel no coincidieron con ninguno en la base de datos:</p>
                <div className="max-h-64 overflow-y-auto pr-2">
                  <ul className="space-y-1">
                    {result.unmatchedPuestos.map((item: any, i: number) => (
                      <li key={i} className="flex justify-between text-sm py-1 border-b border-white/5 last:border-0">
                        <span className="text-slate-300 truncate mr-2">{item.name || '(Vacío)'}</span>
                        <span className="text-slate-500">{item.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
