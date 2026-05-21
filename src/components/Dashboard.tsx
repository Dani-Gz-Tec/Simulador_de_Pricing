import React, { useMemo, useState } from 'react';
import { RawData, MappedColumns, ProductData, SimulationOutput } from '../types';
import { simularProducto, ESCENARIOS_OBLIGATORIOS } from '../utils/simulator';
import { TrendingUp, TrendingDown, MinusCircle, AlertTriangle, Download, ArrowLeft, SlidersHorizontal, Search } from 'lucide-react';

interface DashboardProps {
  rawData: RawData[];
  mapping: MappedColumns;
  onReset: () => void;
}

export default function Dashboard({ rawData, mapping, onReset }: DashboardProps) {
  const [selectedDepto, setSelectedDepto] = useState<string>('Todos');
  const [globalElasticity, setGlobalElasticity] = useState<number>(-1.5);
  const [searchSku, setSearchSku] = useState<string>('');

  // Procesamiento de datos y simulación
  const { simulatedData, departamentos, hasDatasetElasticity } = useMemo(() => {
    const aggregatedData: Record<string, any> = {};
    const deptos = new Set<string>();
    let hasMappedData = false;

    rawData.forEach(row => {
      // Intentar extraer valores usando el mapeo. Ignorar si faltan datos vitales.
      const sku = row[mapping.sku]?.toString();
      if (!sku) return;

      const precio = parseFloat(row[mapping.precio_base]) || 0;
      const unidades = parseFloat(row[mapping.unidades_base]) || 0;
      const costo = parseFloat(row[mapping.costo_unitario]) || 0;
      
      let elasticidad = globalElasticity;
      if (mapping.elasticidad && row[mapping.elasticidad] !== undefined && row[mapping.elasticidad] !== '') {
        const val = parseFloat(row[mapping.elasticidad]);
        if (!isNaN(val)) {
           elasticidad = val;
           hasMappedData = true;
        }
      }

      const departamento = row[mapping.departamento]?.toString() || 'Sin Categoría';
      const nombre_producto = row[mapping.nombre_producto]?.toString() || sku;

      deptos.add(departamento);

      if (!aggregatedData[sku]) {
        aggregatedData[sku] = {
          sku,
          departamento,
          nombre_producto,
          elasticidad,
          _totalUnidades: 0,
          _totalIngreso: 0,
          _totalCosto: 0,
          raw: row
        };
      }

      const p = aggregatedData[sku];
      p._totalUnidades += unidades;
      p._totalIngreso += (precio * unidades);
      p._totalCosto += (costo * unidades);

      // Si leímos elasticidad de esta fila, la guardamos. Si agregamos varias, usamos la última válida encontrada.
      if (hasMappedData) {
        p.elasticidad = elasticidad;
      } else {
        p.elasticidad = globalElasticity;
      }
    });

    const parsedData: ProductData[] = Object.values(aggregatedData).map(p => {
      const unidades_base = p._totalUnidades;
      const ingreso_base = p._totalIngreso;
      const precio_base = unidades_base > 0 ? ingreso_base / unidades_base : 0;
      const costo_unitario = unidades_base > 0 ? p._totalCosto / unidades_base : 0;
      const margen_base = ingreso_base - p._totalCosto;

      return {
        sku: p.sku,
        departamento: p.departamento,
        nombre_producto: p.nombre_producto,
        precio_base,
        unidades_base,
        costo_unitario,
        elasticidad: p.elasticidad,
        ingreso_base,
        margen_base,
        raw: p.raw
      };
    });

    const simulated = parsedData.map(p => simularProducto(p));
    
    // Sort by descending base revenue by default
    simulated.sort((a, b) => b.base.ingreso_base - a.base.ingreso_base);

    return { simulatedData: simulated, departamentos: Array.from(deptos).sort(), hasDatasetElasticity: hasMappedData };
  }, [rawData, mapping, globalElasticity]);

  // Filtrado
  const filteredData = useMemo(() => {
    let res = simulatedData;
    if (selectedDepto !== 'Todos') {
      res = res.filter(d => d.base.departamento === selectedDepto);
    }
    if (searchSku.trim() !== '') {
      const term = searchSku.toLowerCase();
      res = res.filter(d => 
        d.base.sku.toLowerCase().includes(term) || 
        d.base.nombre_producto.toLowerCase().includes(term)
      );
    }
    return res;
  }, [simulatedData, selectedDepto, searchSku]);

  // Derivación de Top 5
  const { topSubir, topBajar, topMantener, noRecomendables } = useMemo(() => {
    const clasificados = {
      subir: filteredData.filter(d => d.recomendacion === 'SUBIR PRECIO'),
      bajar: filteredData.filter(d => d.recomendacion === 'BAJAR PRECIO / PROMOVER'),
      mantener: filteredData.filter(d => d.recomendacion === 'MANTENER PRECIO'),
      noReco: filteredData.filter(d => d.recomendacion === 'NO RECOMENDAR'),
    };

    // Ordenar los mejores candidatos por magnitud de mejora en ingreso (simplificación)
    const sortByMejora = (a: SimulationOutput, b: SimulationOutput) => {
      const mejA = Math.max(...Object.values(a.scenarios).map(s => s.cambio_ingreso_pct));
      const mejB = Math.max(...Object.values(b.scenarios).map(s => s.cambio_ingreso_pct));
      return mejB - mejA;
    };

    return {
      topSubir: clasificados.subir.sort(sortByMejora).slice(0, 5),
      topBajar: clasificados.bajar.sort(sortByMejora).slice(0, 5),
      topMantener: clasificados.mantener.slice(0, 5), // El orden aquí importa menos
      noRecomendables: clasificados.noReco
    };
  }, [filteredData]);

  // Utilidades para UI
  const formatCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);
  const formatNumber = (val: number) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(val);
  const formatPct = (val: number) => (val * 100).toFixed(1) + '%';

  const handleDownload = () => {
    const text = `SIMULADOR DE PRICING - CONCLUSIÓN EJECUTIVA
Generado el: ${new Date().toLocaleDateString()}
Departamento Analizado: ${selectedDepto}
Total SKUs Analizados: ${filteredData.length}

--------------------------------------------------
RESUMEN DE RECOMENDACIONES:
- Subir Precio: ${filteredData.filter(d => d.recomendacion === 'SUBIR PRECIO').length}
- Bajar Precio / Promover: ${filteredData.filter(d => d.recomendacion === 'BAJAR PRECIO / PROMOVER').length}
- Mantener Precio: ${filteredData.filter(d => d.recomendacion === 'MANTENER PRECIO').length}
- No Recomendar: ${noRecomendables.length}

--------------------------------------------------
TOP CÓDIGOS PARA SUBIR PRECIO:
${topSubir.map(s => `* [${s.base.sku}] ${s.base.nombre_producto} (Mejora est. margen: +${(s.mejor_escenario_margen*100).toFixed(0)}%)`).join('\n')}

TOP CÓDIGOS PARA PROMOCIONAR:
${topBajar.map(s => `* [${s.base.sku}] ${s.base.nombre_producto} (Descuento est. óptimo: ${(s.mejor_escenario_ingreso*100).toFixed(0)}%)`).join('\n')}

--------------------------------------------------
NOTA EXPLORATORIA:
Los resultados son exploratorios dado que toda simulación basada en elasticidad asume comportamientos de demanda constantes. Se requiere validación práctica y confirmación certera de los costos unitarios para dar por definitivos los márgenes proyectados.
`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Conclusion_Pricing_${selectedDepto.replace(/\s+/g, '_')}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const RecBadge = ({ rec }: { rec: string }) => {
    if (rec === 'SUBIR PRECIO') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-100 text-emerald-700"><TrendingUp className="w-3 h-3"/> Subir</span>;
    if (rec === 'BAJAR PRECIO / PROMOVER') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-amber-100 text-amber-700"><TrendingDown className="w-3 h-3"/> Bajar</span>;
    if (rec === 'MANTENER PRECIO') return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-slate-100 text-slate-700"><MinusCircle className="w-3 h-3"/> Mantener</span>;
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3"/> No Recomendar</span>;
  };

  const getCellColor = (val: number) => {
    if (val > 0.05) return 'text-emerald-700 bg-emerald-100 font-bold';
    if (val < -0.05) return 'text-red-700 bg-red-100 font-bold';
    return 'text-slate-600 bg-slate-100 font-bold';
  };

  return (
    <div className="w-full max-w-[1400px] mx-auto p-2 md:p-6 space-y-6 flex flex-col flex-1 overflow-hidden">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div>
          <button onClick={onReset} className="text-sm flex items-center gap-1 text-slate-500 hover:text-slate-900 mb-2 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Volver a importar
          </button>
          <h1 className="text-xl font-bold text-slate-800">Panel de Resultados y Simulación</h1>
          <p className="text-sm text-slate-500 mt-1">
            Analizando {simulatedData.length} SKUs. Los resultados son exploratorios y deben validarse.
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto bg-slate-50 p-3 rounded-lg border border-slate-200">
          {!hasDatasetElasticity && (
            <div className="flex items-center gap-3 w-full md:w-auto md:mr-4 md:pr-4 border-b md:border-b-0 md:border-r border-slate-200 pb-2 md:pb-0">
              <label className="text-[10px] font-bold text-slate-600 shrink-0 uppercase tracking-wider flex items-center gap-1"><SlidersHorizontal className="w-3 h-3"/> Beta <span className="hidden lg:inline">(Elast.)</span></label>
              <div className="flex items-center gap-2">
                <input 
                  type="range" 
                  min="-3" max="0" step="0.1" 
                  value={globalElasticity}
                  onChange={e => setGlobalElasticity(parseFloat(e.target.value))}
                  className="w-24 md:w-32 accent-blue-600"
                />
                <span className="font-mono font-bold text-blue-600 text-sm w-12">{globalElasticity.toFixed(1)}</span>
              </div>
            </div>
          )}
          
          <div className="flex items-center gap-2 w-full md:w-auto md:border-r border-slate-200 md:pr-4">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Buscar SKU o nombre..."
              value={searchSku}
              onChange={e => setSearchSku(e.target.value)}
              className="border-slate-300 rounded text-sm bg-white py-1.5 px-3 focus:ring-blue-500 focus:border-blue-500 w-full md:w-48 shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
            <label className="text-sm font-bold text-slate-600 shrink-0 uppercase tracking-wider text-[10px]">Depto</label>
            <select 
              value={selectedDepto} 
              onChange={e => setSelectedDepto(e.target.value)}
              className="border-slate-300 rounded text-sm bg-white py-1.5 pl-3 pr-8 focus:ring-blue-500 focus:border-blue-500 w-full md:w-48 shadow-sm"
            >
              <option value="Todos">Todos</option>
              {departamentos.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center shrink-0">
          <h3 className="font-bold text-slate-800">Simulación de Escenarios Operativos</h3>
          <div className="flex gap-2">
             <span className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-600 shadow-sm">{filteredData.length} SKUs</span>
          </div>
        </div>
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold tracking-widest sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 border-b border-slate-200">Producto</th>
                <th className="px-6 py-4 border-b border-slate-200">Base Actual</th>
                {ESCENARIOS_OBLIGATORIOS.filter(e => e !== 0).map(es => (
                  <th key={es} className="px-6 py-4 border-b border-slate-200 text-center">
                    Escenario {es > 0 ? '+' : ''}{es * 100}%
                  </th>
                ))}
                <th className="px-6 py-4 border-b border-slate-200">Recomendación</th>
              </tr>
            </thead>
            <tbody className="text-sm font-mono">
              {filteredData.slice(0, 100).map((row) => (
                <tr key={row.base.sku} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 border-b border-slate-100">
                    <p className="font-sans font-medium text-slate-900 truncate max-w-[200px]" title={row.base.nombre_producto}>{row.base.nombre_producto}</p>
                    <p className="text-[11px] text-slate-500">SKU: {row.base.sku} | ε: {row.base.elasticidad}</p>
                  </td>
                  <td className="px-6 py-4 border-b border-slate-100 text-[13px]">
                    <div className="text-slate-900 font-bold">P: {formatCurrency(row.base.precio_base)}</div>
                    <div className="text-slate-500">V: {formatNumber(row.base.unidades_base)}</div>
                    <div className="text-slate-500">I: {formatCurrency(row.base.ingreso_base)}</div>
                  </td>
                  
                  {ESCENARIOS_OBLIGATORIOS.filter(e => e !== 0).map(es => {
                    const esc = row.scenarios[es];
                    return (
                      <td key={es} className="px-6 py-4 border-b border-slate-100 text-[13px] border-l border-slate-50">
                         <div className="flex justify-between items-center mb-1">
                           <span className="font-bold text-slate-900">{formatCurrency(esc.precio_nuevo)}</span>
                           <span className="text-slate-500">{formatNumber(esc.unidades_simuladas)}</span>
                         </div>
                         <div className="grid grid-cols-2 gap-2 text-[10px]">
                           <div className={`px-2 py-1 rounded text-center leading-none flex flex-col justify-center ${getCellColor(esc.cambio_ingreso_pct)}`}>
                             <span className="opacity-70 text-[8px] uppercase tracking-wider mb-0.5">Ingreso</span>
                             <span>{esc.cambio_ingreso_pct > 0 ? '+' : ''}{formatPct(esc.cambio_ingreso_pct)}</span>
                           </div>
                           <div className={`px-2 py-1 rounded text-center leading-none flex flex-col justify-center ${getCellColor(esc.cambio_margen_pct)}`}>
                             <span className="opacity-70 text-[8px] uppercase tracking-wider mb-0.5">Margen</span>
                             <span>{esc.cambio_margen_pct > 0 ? '+' : ''}{formatPct(esc.cambio_margen_pct)}</span>
                           </div>
                         </div>
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 border-b border-slate-100 border-l border-slate-50 align-top">
                    <RecBadge rec={row.recomendacion} />
                    <p className="text-[11px] font-sans text-slate-500 mt-2 max-w-[250px] leading-relaxed" title={row.razon_recomendacion}>
                      {row.razon_recomendacion}
                    </p>
                  </td>
                </tr>
              ))}
              {filteredData.length > 100 && (
                <tr>
                   <td colSpan={7} className="px-6 py-4 text-center text-sm font-sans text-slate-500 bg-slate-50 border-b border-slate-100">
                     Mostrando 100 de {filteredData.length} resultados. Usa los filtros para ver más.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top 5 y Listas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 5 Subir */}
        <div className="bg-white rounded-xl border border-emerald-500/20 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><TrendingUp className="w-4 h-4 text-emerald-500"/> Subir Precio</h3>
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Mejores 5</span>
          </div>
          <div className="p-4 flex-1">
            {topSubir.length === 0 ? <p className="text-sm text-slate-400 italic">No hay candidatos.</p> : (
              <ul className="space-y-4">
                {topSubir.map((s, i) => (
                  <li key={s.base.sku} className="text-sm flex justify-between items-start border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div>
                       <span className="font-bold text-slate-800 font-mono text-xs">{i+1}. {s.base.nombre_producto}</span>
                       <span className="block text-xs text-slate-500 mt-1">Margen Est. <span className="font-bold text-emerald-600 ml-1">+{formatPct(s.mejor_escenario_margen * 1)}</span></span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Top 5 Bajar */}
        <div className="bg-white rounded-xl border border-amber-500/20 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><TrendingDown className="w-4 h-4 text-amber-500"/> Promover / Bajar</h3>
             <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">Mejores 5</span>
          </div>
          <div className="p-4 flex-1">
            {topBajar.length === 0 ? <p className="text-sm text-slate-400 italic">No hay candidatos.</p> : (
              <ul className="space-y-4">
                {topBajar.map((s, i) => (
                  <li key={s.base.sku} className="text-sm flex justify-between items-start border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div>
                       <span className="font-bold text-slate-800 font-mono text-xs">{i+1}. {s.base.nombre_producto}</span>
                       <span className="block text-xs text-slate-500 mt-1">Ingreso Est. <span className="font-bold text-amber-600 ml-1">{formatPct(s.mejor_escenario_ingreso * 1)}</span></span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Top 5 Mantener */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-slate-50 p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2"><MinusCircle className="w-4 h-4 text-slate-400"/> Mantener</h3>
          </div>
          <div className="p-4 flex-1">
            {topMantener.length === 0 ? <p className="text-sm text-slate-400 italic">No hay candidatos.</p> : (
              <ul className="space-y-4">
                {topMantener.map((s, i) => (
                  <li key={s.base.sku} className="text-sm flex justify-between items-start border-b border-slate-100 pb-3 last:border-0 last:pb-0">
                    <div>
                       <span className="font-bold text-slate-800 font-mono text-xs">{i+1}. {s.base.nombre_producto}</span>
                       <span className="block text-[11px] text-slate-500 mt-1 leading-relaxed">{s.razon_recomendacion}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

       {/* Conclusión Ejecutiva */}
       <div className="bg-slate-900 rounded-xl shadow-xl overflow-hidden text-white border border-slate-800">
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Download className="w-4 h-4 hidden md:block" />
              Conclusión Ejecutiva Generada
            </h2>
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              Descargar Informe (.txt)
            </button>
          </div>

          <div className="bg-slate-800 rounded p-5 font-mono text-[13px] leading-relaxed text-slate-300 border-l-4 border-slate-600 shadow-inner space-y-4">
            <p>
              En el departamento <span className="font-bold text-blue-400">"{selectedDepto}"</span>, simulamos cambios de precio de -10% a +10% para los {filteredData.length} SKUs seleccionados.
            </p>
            <p>
              Encontramos que <span className="font-bold text-emerald-400 bg-emerald-900/30 px-1 py-0.5 rounded">{filteredData.filter(d => d.recomendacion === 'SUBIR PRECIO').length}</span> productos podrían tolerar una subida de precio, <span className="font-bold text-amber-400 bg-amber-900/30 px-1 py-0.5 rounded">{filteredData.filter(d => d.recomendacion === 'BAJAR PRECIO / PROMOVER').length}</span> productos parecen más adecuados para promoción/descuento, y <span className="font-bold text-red-400 bg-red-900/30 px-1 py-0.5 rounded">{noRecomendables.length}</span> productos no deben recomendarse por baja calidad de datos o elasticidad anómala.
            </p>
            <p className="text-slate-400 text-xs mt-2 border-t border-slate-700/50 pt-3">
              Los resultados son exploratorios porque toda simulación basada en elasticidad histórica asume comportamientos constantes; se requiere validación y la confirmación de estructura de costos para dar por definitivos los márgenes proyectados.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
