"use client";

import { useState, useCallback } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, Loader2, FileText, Image as ImageIcon, X, File } from "lucide-react";
import { useDropzone } from "react-dropzone";

export default function ImportarEstimadosPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg']
    }
  });

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const getFileIcon = (type: string, name: string) => {
    if (type.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-blue-400" />;
    if (type === 'application/pdf' || name.endsWith('.pdf')) return <FileText className="w-5 h-5 text-red-400" />;
    return <File className="w-5 h-5 text-green-400" />;
  };

  const processFiles = async (action: 'preview' | 'commit') => {
    if (files.length === 0) return;
    
    setLoading(true);
    setError(null);
    if (action === 'preview') setResult(null);

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });
    formData.append('action', action);

    try {
      const response = await fetch('/api/estimados/import', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar los archivos');
      }
      
      if (action === 'preview') {
        setPreviewData(data);
        setShowModal(true);
      } else {
        setResult(data);
        setShowModal(false);
        setPreviewData(null);
        setFiles([]); // Clear files on success
      }
    } catch (err: any) {
      setError(err.message);
      setShowModal(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 pb-20 max-w-5xl mx-auto text-white">
      <h1 className="text-3xl font-bold mb-2">Importador Inteligente de Votantes</h1>
      <p className="text-slate-400 mb-8">
        Sube bases de datos en Excel, CSV, PDF o incluso fotos de listados físicos. 
        Nuestra IA extraerá la información y cruzará los puestos de votación automáticamente.
      </p>

      <div className="bg-slate-900 border border-white/10 rounded-xl p-6 mb-8">
        <div 
          {...getRootProps()} 
          className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition
            ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-slate-600 bg-slate-800 hover:bg-slate-700'}`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
            <UploadCloud className={`w-12 h-12 mb-3 ${isDragActive ? 'text-blue-400' : 'text-slate-400'}`} />
            <p className="mb-2 text-sm text-slate-300">
              <span className="font-semibold">Haz clic para seleccionar</span> o arrastra y suelta aquí
            </p>
            <p className="text-xs text-slate-500">Soporta: Excel (.xlsx, .csv), PDF y Fotos (.jpg, .png)</p>
          </div>
        </div>
        
        {files.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-slate-300 mb-3">Archivos listos para procesar ({files.length}):</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-white/5">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {getFileIcon(file.type, file.name)}
                    <span className="text-sm text-slate-300 truncate">{file.name}</span>
                  </div>
                  <button onClick={() => removeFile(i)} className="text-slate-500 hover:text-red-400 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            onClick={() => processFiles('preview')}
            disabled={files.length === 0 || loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition font-medium"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {loading ? 'Analizando con IA...' : 'Analizar y Previsualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-500/50 text-red-200 p-4 rounded-lg flex items-start gap-3 mb-8">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* MODAL DE PREVISUALIZACIÓN */}
      {showModal && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-white">Previsualización de Resultados</h2>
                <p className="text-sm text-slate-400 mt-1">Revisa cómo la IA cruzó los datos antes de guardarlos.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-800 p-4 rounded-lg text-center">
                  <p className="text-3xl font-bold text-white">{previewData.totalRows}</p>
                  <p className="text-xs text-slate-400 mt-1">Filas Detectadas</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg text-center">
                  <p className="text-3xl font-bold text-green-400">{previewData.totalMatched}</p>
                  <p className="text-xs text-slate-400 mt-1">Puestos Encontrados</p>
                </div>
                <div className="bg-slate-800 p-4 rounded-lg text-center">
                  <p className="text-3xl font-bold text-red-400">{previewData.totalUnmatched}</p>
                  <p className="text-xs text-slate-400 mt-1">No Coinciden</p>
                </div>
              </div>

              <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" />
                Muestra de datos extraídos (Primeros 50)
              </h3>
              
              <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/50 text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="px-4 py-3 font-medium">Extraído del Archivo</th>
                      <th className="px-4 py-3 font-medium">Cruce en Base de Datos</th>
                      <th className="px-4 py-3 font-medium text-right">Votos a Sumar</th>
                      <th className="px-4 py-3 font-medium text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {previewData.previewData?.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-slate-700/30 transition">
                        <td className="px-4 py-3 text-slate-300">{row.original}</td>
                        <td className="px-4 py-3 text-slate-300">{row.matched}</td>
                        <td className="px-4 py-3 text-right font-mono text-blue-400">+{row.votos}</td>
                        <td className="px-4 py-3 text-center">
                          {row.status === 'ok' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-400 text-xs font-medium">
                              <CheckCircle2 className="w-3 h-3" /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-medium">
                              <AlertCircle className="w-3 h-3" /> Fallo
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {previewData.previewData?.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          No se extrajeron datos para mostrar.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3 rounded-b-xl">
              <button 
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={() => processFiles('commit')}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition font-medium"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {loading ? 'Guardando...' : 'Aprobar y Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULTADO FINAL */}
      {result && !showModal && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-green-900/20 border border-green-500/50 rounded-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 text-green-400 mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">¡Datos Importados con Éxito!</h2>
            <p className="text-slate-400 max-w-lg mx-auto mb-6">
              Se han actualizado las estimaciones de los puestos de votación en la base de datos según los archivos procesados.
            </p>
            
            <div className="flex justify-center gap-8 mb-2">
              <div>
                <p className="text-4xl font-bold text-white">{result.updatedPuestos}</p>
                <p className="text-sm text-slate-400 mt-1">Puestos Actualizados</p>
              </div>
              <div className="w-px bg-white/10"></div>
              <div>
                <p className="text-4xl font-bold text-green-400">{result.totalMatched}</p>
                <p className="text-sm text-slate-400 mt-1">Votos Registrados</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
