import React, { useState, useEffect } from 'react';
import { MappedColumns } from '../types';
import { ArrowRight, Settings } from 'lucide-react';

interface ColumnMapperProps {
  headers: string[];
  onMappingComplete: (mapping: MappedColumns) => void;
}

const REQUIRED_FIELDS: { key: keyof MappedColumns, label: string, description: string, hint?: string }[] = [
  { key: 'sku', label: 'SKU / ID Producto', description: 'Identificador único del producto.' },
  { key: 'departamento', label: 'Departamento / Categoría', description: 'Agrupación de productos.' },
  { key: 'nombre_producto', label: 'Nombre del Producto', description: 'Nombre legible.' },
  { key: 'precio_base', label: 'Precio Base Unitario', description: 'Precio actual del producto.' },
  { key: 'costo_unitario', label: 'Costo Unitario', description: 'Costo de producción o compra por unidad.' },
  { key: 'unidades_base', label: 'Unidades Base', description: 'Volumen de venta en unidades actual.' }
];

const OPTIONAL_FIELDS: { key: keyof MappedColumns, label: string, description: string, hint?: string }[] = [
  { key: 'elasticidad', label: 'Elasticidad (Opcional)', description: 'Elasticidad precio de la demanda.', hint: 'Si no la mapeas, el simulador usará un valor global ajustable.' }
];

export default function ColumnMapper({ headers, onMappingComplete }: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Partial<MappedColumns>>({});
  const [isReady, setIsReady] = useState(false);

  // Intentar pre-seleccionar automáticamente basado en nombres comunes
  useEffect(() => {
    const autoMap: Partial<MappedColumns> = {};
    const norm = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].forEach(field => {
      const fieldNorm = norm(field.key);
      const match = headers.find(h => norm(h).includes(fieldNorm) || fieldNorm.includes(norm(h)));
      if (match) {
        autoMap[field.key] = match;
      }
    });

    // Casos especiales frecuentes
    if (!autoMap.sku) autoMap.sku = headers.find(h => norm(h) === 'prodnbr' || norm(h) === 'id');
    if (!autoMap.unidades_base) autoMap.unidades_base = headers.find(h => norm(h).includes('qty') || norm(h).includes('cantidad'));
    if (!autoMap.costo_unitario) autoMap.costo_unitario = headers.find(h => norm(h) === 'costo2' || norm(h).includes('costo'));
    if (!autoMap.precio_base) autoMap.precio_base = headers.find(h => norm(h).includes('precio') || norm(h) === 'price');

    setMapping(prev => ({ ...autoMap, ...prev }));
  }, [headers]);

  useEffect(() => {
    // Validar si todos los campos están seleccionados
    const allSelected = REQUIRED_FIELDS.every(field => mapping[field.key] && mapping[field.key] !== '');
    setIsReady(allSelected);
  }, [mapping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReady) {
      onMappingComplete(mapping as MappedColumns);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-white rounded-xl shadow-sm border border-slate-200 mt-10 shrink-0">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
        <div className="p-2 bg-slate-900 text-white rounded">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Mapeo de Columnas</h2>
          <p className="text-sm text-slate-500 mt-1">Asigna las columnas de tu CSV a los campos requeridos por el simulador.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4 mb-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest pl-2 mb-2 border-l-4 border-slate-300">Campos Obligatorios</h3>
          {REQUIRED_FIELDS.map((field) => (
            <div key={field.key} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-3 hover:bg-slate-50 rounded border border-transparent hover:border-slate-200 transition-colors">
              <div>
                <label className="block text-sm font-bold text-slate-800">{field.label}</label>
                <span className="block text-xs text-slate-500 mt-1 leading-relaxed">{field.description}</span>
                {field.hint && <span className="block text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-wider">{field.hint}</span>}
              </div>
              <div>
                <select
                  value={mapping[field.key] || ''}
                  onChange={(e) => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full text-sm font-mono border-slate-300 rounded shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 pl-3 pr-10 border bg-white text-slate-800"
                >
                  <option value="" disabled>-- Selecciona una columna --</option>
                  {headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4 mb-8">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest pl-2 mb-2 border-l-4 border-emerald-300 mt-8">Campos Opcionales</h3>
          {OPTIONAL_FIELDS.map((field) => (
            <div key={field.key} className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center p-3 hover:bg-slate-50 rounded border border-transparent hover:border-slate-200 transition-colors bg-slate-50/50">
              <div>
                <label className="block text-sm font-bold text-slate-800">{field.label}</label>
                <span className="block text-xs text-slate-500 mt-1 leading-relaxed">{field.description}</span>
                {field.hint && <span className="block text-[10px] font-bold text-blue-600 mt-1 uppercase tracking-wider">{field.hint}</span>}
              </div>
              <div>
                <select
                  value={mapping[field.key] || ''}
                  onChange={(e) => setMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full text-sm font-mono border-slate-300 rounded shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5 pl-3 pr-10 border bg-white text-slate-800"
                >
                  <option value="">-- No mapear (usar simulador) --</option>
                  {headers.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            disabled={!isReady}
            className={`flex items-center gap-2 px-6 py-2.5 rounded font-bold uppercase text-[11px] tracking-wider transition-all ${
              isReady 
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            Continuar al Simulador
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
