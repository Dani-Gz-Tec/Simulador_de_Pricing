import React, { useState } from 'react';
import Papa from 'papaparse';
import { Upload, FileType, AlertCircle } from 'lucide-react';

interface UploaderProps {
  onDataLoaded: (data: any[], headers: string[]) => void;
}

export default function Uploader({ onDataLoaded }: UploaderProps) {
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Por favor, selecciona un archivo CSV válido.');
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setError('Ocurrió un error leyendo el archivo.');
          console.error(results.errors);
          return;
        }
        const headers = results.meta.fields || [];
        onDataLoaded(results.data, headers);
      },
      error: (err) => {
        setError(err.message);
      }
    });
  };

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center shrink-0">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 text-blue-600 mb-6">
          <FileType className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Simulador de Pricing</h2>
        <p className="text-slate-500 mb-8 text-sm leading-relaxed">
          Sube tu archivo CSV con datos transaccionales o por SKU para estimar el impacto de cambios de precio.
        </p>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded border border-red-100 flex items-start gap-3 text-left text-sm font-bold">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <label className="relative flex flex-col items-center justify-center w-full h-40 border-2 border-slate-300 border-dashed rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100 transition-colors">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-8 h-8 text-slate-400 mb-4" />
            <p className="mb-2 text-sm text-slate-600"><span className="font-bold">Haz clic para subir</span> o arrastra y suelta</p>
            <p className="text-[11px] uppercase tracking-widest font-bold text-slate-400">Solo archivos .CSV</p>
          </div>
          <input 
            type="file" 
            className="hidden" 
            accept=".csv, text/csv" 
            onChange={handleFileUpload}
          />
        </label>
      </div>
    </div>
  );
}
