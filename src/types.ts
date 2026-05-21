export interface RawData {
  [key: string]: any;
}

export interface MappedColumns {
  sku: string;
  departamento: string;
  nombre_producto: string;
  precio_base: string;
  unidades_base: string;
  costo_unitario: string;
  elasticidad?: string;
}

export interface ProductData {
  sku: string;
  departamento: string;
  nombre_producto: string;
  precio_base: number;
  unidades_base: number;
  costo_unitario: number;
  elasticidad: number;
  ingreso_base: number;
  margen_base: number;
  raw?: RawData;
}

export interface ScenarioResult {
  pct_cambio: number;
  precio_nuevo: number;
  unidades_simuladas: number;
  ingreso_simulado: number;
  margen_simulado: number;
  cambio_ingreso_pct: number;
  cambio_margen_pct: number;
}

export type Recommendation = 'SUBIR PRECIO' | 'BAJAR PRECIO / PROMOVER' | 'MANTENER PRECIO' | 'NO RECOMENDAR';

export interface SimulationOutput {
  base: ProductData;
  scenarios: Record<number, ScenarioResult>;
  mejor_escenario_ingreso: number;
  mejor_escenario_margen: number;
  recomendacion: Recommendation;
  razon_recomendacion: string;
}
