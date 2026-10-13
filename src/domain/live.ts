// Contrato del estado en vivo. Lo produce una DataSource (hoy MockDataSource; en la Fase 3,
// un webhook de n8n). Todo se indexa por los id/códigos de plant-layout.json.
// Regla: los KPIs de negocio llegan calculados; el frontend no los calcula.

export type EstadoOperativo = 'operando' | 'espera' | 'detenido' | 'mantenimiento' | 'sin_datos'
export type NivelAlarma = 'info' | 'advertencia' | 'critica'

export interface EstadoEtapa {
  estado: EstadoOperativo
  /** Piezas en la etapa o en espera (piscinas). null = sin dato. */
  wip: number | null
  piezas_h: number | null
  merma_pct: number | null
}

export interface EstadoEquipo {
  estado: EstadoOperativo
  /** Métricas libres por equipo, p. ej. { temp_c: 1080, temp_objetivo_c: 1100 }. */
  metricas: Record<string, number>
}

export interface EstadoZona {
  estado: EstadoOperativo
  wip: number | null
  merma_pct: number | null
}

export interface ValorKpi {
  valor: number | null
  unidad: string | null
  /** Desglose opcional, p. ej. { tipo_a: 62, tipo_b: 21, ... } o WIP por piscina. */
  detalle?: Record<string, number>
}

export interface Alarma {
  id: string
  nivel: NivelAlarma
  mensaje: string
  ref: { tipo: 'zona' | 'equipo' | 'etapa'; id: string } | null
  /** ISO 8601. */
  desde: string
}

export interface LiveState {
  /** ISO 8601 del instante (simulado o real) del estado. */
  timestamp: string
  fuente: 'mock' | 'rest' | 'sse' | 'mqtt'
  /** inicio y fin en ISO 8601; progreso = fracción transcurrida del turno, de 0 a 1. */
  turno: { id: string; nombre: string; inicio: string; fin: string; progreso: number }
  /** Por código de etapa (1.4, 2.6, …). */
  etapas: Record<string, EstadoEtapa>
  /** Por id de equipo. */
  equipos: Record<string, EstadoEquipo>
  /** Opcional por zona. Si una zona no viene, la UI muestra el peor estado de sus etapas. */
  zonas: Record<string, EstadoZona>
  /** Por id de flujo (flujos[] del layout). */
  flujos: Record<string, { piezas_h: number | null }>
  /** Por id de ruta (R1–R9, RF1–RF7): piezas en el turno. */
  rutas: Record<string, { piezas_turno: number }>
  /** Conteos del turno por resultado: bizcocho {buena, mala}; final {ok_falta_calcomania, tipo_a, …}. */
  clasificaciones: { bizcocho: Record<string, number>; final: Record<string, number> }
  /** Por id de kpis[] del layout. */
  kpis: Record<string, ValorKpi>
  alarmas: Alarma[]
}
