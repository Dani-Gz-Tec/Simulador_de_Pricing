import { ProductData, ScenarioResult, SimulationOutput, Recommendation } from '../types';

export const ESCENARIOS = [-0.15, -0.10, -0.05, 0, 0.05, 0.10, 0.15];
export const ESCENARIOS_OBLIGATORIOS = [-0.10, -0.05, 0, 0.05, 0.10];

export function calcularEscenario(base: ProductData, pctCambio: number): ScenarioResult {
  // FORMULA 1 - PRECIO NUEVO
  const precio_nuevo = base.precio_base * (1 + pctCambio);
  
  // FORMULA 2 - UNIDADES SIMULADAS
  // formula: unidades_simuladas = unidades_base * (precio_nuevo / precio_base)^elasticidad
  const ratio_precio = precio_nuevo / base.precio_base;
  const unidades_simuladas = base.unidades_base * Math.pow(ratio_precio, base.elasticidad);

  // FORMULA 3 - INGRESO Y MARGEN
  const ingreso_simulado = precio_nuevo * unidades_simuladas;
  const margen_simulado = (precio_nuevo - base.costo_unitario) * unidades_simuladas;

  const cambio_ingreso_pct = base.ingreso_base > 0 
    ? ((ingreso_simulado - base.ingreso_base) / base.ingreso_base) 
    : 0;
  
  const cambio_margen_pct = base.margen_base !== 0 
    ? ((margen_simulado - base.margen_base) / Math.abs(base.margen_base)) 
    : (margen_simulado > 0 ? 1 : (margen_simulado < 0 ? -1 : 0));

  return {
    pct_cambio: pctCambio,
    precio_nuevo,
    unidades_simuladas,
    ingreso_simulado,
    margen_simulado,
    cambio_ingreso_pct,
    cambio_margen_pct
  };
}

export function simularProducto(base: ProductData): SimulationOutput {
  const scenarios: Record<number, ScenarioResult> = {};
  
  let mejorIngresoVal = -Infinity;
  let mejorIngresoPct = 0;
  
  let mejorMargenVal = -Infinity;
  let mejorMargenPct = 0;

  ESCENARIOS.forEach(pct => {
    const res = calcularEscenario(base, pct);
    scenarios[pct] = res;
    
    // Solo consideramos los escenarios configurados
    if (res.ingreso_simulado > mejorIngresoVal) {
      mejorIngresoVal = res.ingreso_simulado;
      mejorIngresoPct = pct;
    }
    
    if (res.margen_simulado > mejorMargenVal) {
      mejorMargenVal = res.margen_simulado;
      mejorMargenPct = pct;
    }
  });

  // LOGICA PARA RECOMENDACION (Basada en slide 13)
  let recomendacion: Recommendation = 'MANTENER PRECIO';
  let razon_recomendacion = 'No hay ganancia clara en mover el precio.';

  if (base.precio_base <= 0) {
    recomendacion = 'NO RECOMENDAR';
    razon_recomendacion = 'Precio base inválido (0 o negativo).';
  } else if (base.elasticidad > 0) {
    recomendacion = 'NO RECOMENDAR';
    razon_recomendacion = 'Resultado sospechoso (Elasticidad Positiva).';
  } else if (base.unidades_base < 5) {
     recomendacion = 'NO RECOMENDAR';
     razon_recomendacion = 'La falta de observaciones hace que la simulación no sea confiable.';
  } else if (base.costo_unitario > base.precio_base) {
    recomendacion = 'NO RECOMENDAR';
    razon_recomendacion = 'Recomendación exploratoria: Costo > Precio. No definitiva, requiere revisión.';
  } else {
    // Evaluamos mejoras basadas en escenarios
    const margenMejoraSubiendoPoco = scenarios[0.05].margen_simulado > base.margen_base;
    const caidaUnidadesPct = (base.unidades_base - scenarios[0.05].unidades_simuladas) / base.unidades_base;
    const UMBRAL_CAIDA_VOLUMEN = 0.15; // Límite de tolerancia a la pérdida de volumen de ventas para evitar pérdida de market share
    const caidaLeveUnidades = caidaUnidadesPct <= UMBRAL_CAIDA_VOLUMEN;
    
    const ingresoMejoraBajando = scenarios[-0.05].ingreso_simulado > base.ingreso_base || scenarios[-0.10].ingreso_simulado > base.ingreso_base;
    
    if (base.elasticidad >= -1 && base.elasticidad <= 0) { // Inelástica
      if (margenMejoraSubiendoPoco) {
        recomendacion = 'SUBIR PRECIO';
        razon_recomendacion = 'Demanda inelástica: Soporta alza de precio. El margen repunta porque el volumen decae en menor proporción.';
      }
    } else if (base.elasticidad < -1) { // Elástica
       if (ingresoMejoraBajando) {
         recomendacion = 'BAJAR PRECIO / PROMOVER';
         razon_recomendacion = 'Demanda elástica: Candidato a promoción. Bajar el precio estimula suficiente volumen para potenciar el ingreso global.';
       } else if (margenMejoraSubiendoPoco && caidaLeveUnidades) {
           recomendacion = 'SUBIR PRECIO';
           razon_recomendacion = `Demanda elástica: La ganancia de margen unitario compensa la caída de volumen (estimada en ${(caidaUnidadesPct*100).toFixed(1)}%, dentro del margen tolerable del 15%).`;
       } else if (margenMejoraSubiendoPoco && !caidaLeveUnidades) {
           recomendacion = 'MANTENER PRECIO';
           razon_recomendacion = `Precaución al subir precio: Aunque el margen mejora teóricamente, la pérdida de volumen es significativa (${(caidaUnidadesPct*100).toFixed(1)}% > 15%). Altas probabilidades de perder cuota de mercado.`;
       } else {
         recomendacion = 'MANTENER PRECIO';
         razon_recomendacion = 'Margen e ingresos comprometidos. No hay ganancia clara para mover agresivamente el precio en esta iteración sin afectar la facturación o la ganancia bruta.';
       }
    }
  }

  return {
    base,
    scenarios,
    mejor_escenario_ingreso: mejorIngresoPct,
    mejor_escenario_margen: mejorMargenPct,
    recomendacion,
    razon_recomendacion
  };
}
