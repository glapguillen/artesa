// Lógica pura de las capas Equipos y Flujos de la escena 3D sobre el modelo y el estado en vivo.
// Solo agregación de presentación: elegir colores, grosores y realces. Reutiliza las funciones del
// plano 2D (planta/planLive) para que ambas vistas digan lo mismo.
import type { EstadoOperativo, LiveState } from '../../domain/live'
import type { LayoutIndex } from '../../domain/selectors'
import type { Seleccion } from '../../store/usePlantStore'
import { resaltadoDeSeleccion } from '../planta/planLive'
import { cimaDeEquipo } from './formas/envolventes'
import type { Equipo3D, Flujo3D, V3 } from './modelo/tipos'

// ---------- Equipos ----------

/** Temperatura ambiente de referencia para el brillo de los hornos (°C, solo presentación). */
export const TEMP_AMBIENTE_C = 20

/**
 * Brillo de la franja de calor de un horno (0 = frío, 1 = en temperatura objetivo), a partir de
 * las métricas en vivo temp_c y temp_objetivo_c. null si la fuente no las envía.
 */
export function calorRelativo(metricas: Record<string, number> | undefined): number | null {
  const t = metricas?.temp_c
  const o = metricas?.temp_objetivo_c
  if (typeof t !== 'number' || typeof o !== 'number' || !Number.isFinite(t) || !Number.isFinite(o)) return null
  if (o <= TEMP_AMBIENTE_C) return null
  return Math.min(1, Math.max(0, (t - TEMP_AMBIENTE_C) / (o - TEMP_AMBIENTE_C)))
}

export type ResalteEquipo = 'fuerte' | 'suave'

/** Equipos a resaltar: el equipo elegido (fuerte) o los equipos de la etapa elegida (suave). */
export function equiposResaltados(equipos: readonly Equipo3D[], sel: Seleccion | null): Map<string, ResalteEquipo> {
  const out = new Map<string, ResalteEquipo>()
  if (!sel) return out
  for (const e of equipos) {
    if (sel.tipo === 'equipo' && e.id === sel.id) out.set(e.id, 'fuerte')
    else if (sel.tipo === 'etapa' && e.etapa === sel.id) out.set(e.id, 'suave')
  }
  return out
}

export interface VistaEquipo {
  estado: EstadoOperativo
  calor: number | null
  resalte: ResalteEquipo | null
}

/** Estado visual de cada equipo dibujado (ids sin datos → 'sin_datos'). */
export function vistaEquipos(equipos: readonly Equipo3D[], live: LiveState | null, sel: Seleccion | null): Map<string, VistaEquipo> {
  const resalte = equiposResaltados(equipos, sel)
  const out = new Map<string, VistaEquipo>()
  for (const e of equipos) {
    const vivo = live?.equipos?.[e.id]
    out.set(e.id, { estado: vivo?.estado ?? 'sin_datos', calor: calorRelativo(vivo?.metricas), resalte: resalte.get(e.id) ?? null })
  }
  return out
}

// ---------- Flujos ----------

/** Radio del tubo (m) según el caudal relativo 0–1 (de caudalRelativo, como en 2D); fino sin dato. */
export function radioFlujo(rel: number | null): number {
  if (rel === null || !Number.isFinite(rel)) return 0.07
  // Se cuantiza en décimos para no reconstruir la geometría con cada lectura.
  const q = Math.round(Math.min(1, Math.max(0, rel)) * 10) / 10
  return 0.1 + 0.2 * q
}

/** Largo de la punta de flecha de un flujo según el radio de su tubo (m). */
export const largoPunta = (radio: number) => Math.max(1.1, radio * 5)

/** Principal: sólido; hipótesis, sin ubicar y venta: discontinuo y más tenue (como en 2D). */
export function estiloFlujo(tipo: Flujo3D['tipo']): { alfa: number; discontinuo: boolean } {
  if (tipo === 'principal') return { alfa: 0.92, discontinuo: false }
  if (tipo === 'venta') return { alfa: 0.6, discontinuo: true }
  return { alfa: 0.5, discontinuo: true }
}

/**
 * Factor de realce por flujo según la selección: con una zona, etapa o equipo elegido, los flujos
 * que entran o salen de sus zonas quedan en 1 y el resto baja a `tenue`. Sin selección, todos en 1.
 */
export function realceFlujos(
  flujos: readonly Flujo3D[],
  idx: LayoutIndex | null,
  sel: Seleccion | null,
  tenue = 0.25,
): Record<string, number> {
  const zonas = resaltadoDeSeleccion(idx, sel)
  const out: Record<string, number> = {}
  for (const f of flujos) out[f.id] = zonas.size === 0 || zonas.has(f.desde) || zonas.has(f.hasta) ? 1 : tenue
  return out
}

/** Partículas que recorren un flujo: 1 sin dato, hasta 3 con el mayor caudal. */
export function particulasDeFlujo(rel: number | null): number {
  return rel === null || !Number.isFinite(rel) ? 1 : 1 + Math.round(Math.min(1, Math.max(0, rel)) * 2)
}

/** Marca de "forma y tamaño representativos" sobre cada equipo que no está medido. */
export function marcasRepresentativas(equipos: readonly Equipo3D[]): Array<{ equipoId: string; pos: V3 }> {
  return equipos.flatMap((e) => {
    const p = e.representativo ? cimaDeEquipo(e) : null
    return p ? [{ equipoId: e.id, pos: p }] : []
  })
}
