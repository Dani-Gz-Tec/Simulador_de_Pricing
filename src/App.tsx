import React, { useState } from 'react';
import Uploader from './components/Uploader';
import ColumnMapper from './components/ColumnMapper';
import Dashboard from './components/Dashboard';
import { RawData, MappedColumns } from './types';

type AppState = 'UPLOAD' | 'MAP' | 'DASHBOARD';

function App() {
  const [appState, setAppState] = useState<AppState>('UPLOAD');
  const [rawData, setRawData] = useState<RawData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<MappedColumns | null>(null);

  const handleDataLoaded = (data: RawData[], fileHeaders: string[]) => {
    setRawData(data);
    setHeaders(fileHeaders);
    setAppState('MAP');
  };

  const handleMappingComplete = (config: MappedColumns) => {
    setMapping(config);
    setAppState('DASHBOARD');
  };

  const handleReset = () => {
    setRawData([]);
    setHeaders([]);
    setMapping(null);
    setAppState('UPLOAD');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans overflow-hidden">
      <header className="bg-slate-900 text-white px-8 py-6 flex justify-between items-center shrink-0 border-b border-slate-700">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Simulador de Pricing Avanzado</h1>
          <p className="text-slate-400 text-sm mt-1 uppercase tracking-wider font-semibold">Módulo de Proyecciones de Elasticidad</p>
        </div>
        <div className="flex gap-6 text-right items-center">
          <div>
             <p className="text-xs text-slate-400 uppercase">Modelo Activo</p>
             <p className="font-mono text-emerald-400">BETA_V2.4_ELASTIC</p>
          </div>
          <div className="bg-slate-800 px-4 py-2 rounded border border-slate-700">
            <p className="text-xs text-slate-400 uppercase">Estado</p>
            <p className="font-bold text-sm tracking-wide">
              {appState === 'UPLOAD' && 'PASO 1: IMPORTAR'}
              {appState === 'MAP' && 'PASO 2: MAPEAR'}
              {appState === 'DASHBOARD' && 'PASO 3: ANÁLISIS'}
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-6 overflow-auto">
        {appState === 'UPLOAD' && (
          <Uploader onDataLoaded={handleDataLoaded} />
        )}
        
        {appState === 'MAP' && (
          <ColumnMapper headers={headers} onMappingComplete={handleMappingComplete} />
        )}

        {appState === 'DASHBOARD' && mapping && (
          <Dashboard rawData={rawData} mapping={mapping} onReset={handleReset} />
        )}
      </main>
    </div>
  );
}

export default App;
