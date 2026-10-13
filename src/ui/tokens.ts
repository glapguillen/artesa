// Etiquetas y colores compartidos. Los colores apuntan a variables CSS (cambian con el tema).
import type { EstadoOperativo, NivelAlarma } from '../domain/live'
import type { Fase, Ubicacion } from '../domain/types'

export const POR_DEFINIR = '[POR DEFINIR]'

export const ESTADOS: EstadoOperativo[] = ['operando', 'espera', 'detenido', 'mantenimiento', 'sin_datos']

export const ESTADO_ETIQUETA: Record<EstadoOperativo, string> = {
  operando: 'Operando',
  espera: 'En espera / WIP alto',
  detenido: 'Detenido / alarma',
  mantenimiento: 'Mantenimiento',
  sin_datos: 'Sin datos',
}

export const colorEstado = (e: EstadoOperativo) => `var(--c-estado-${e})`
export const colorFase = (f: Fase) => `var(--c-fase-${f})`

export const FASE_ETIQUETA: Record<Fase, string> = {
  nivel_0: 'Nivel 0 · Ingeniería',
  A: 'Stock de esmaltes y colores',
  B: 'Stock de pastas',
  F1: 'Fase 1 · Formación y bizcocho',
  F2: 'Fase 2 · Decoración y esmaltado',
  F3: 'Fase 3 · Quema esmalte y clasificación',
  venta: 'Venta',
}

export const UBICACION_ETIQUETA: Record<Ubicacion, string> = {
  ubicada: 'Ubicada en el croquis',
  hipotesis: 'Ubicación probable',
  sin_ubicar: 'Sin ubicar en el croquis',
}

export const NIVEL_ALARMA_ETIQUETA: Record<NivelAlarma, string> = {
  info: 'Información',
  advertencia: 'Advertencia',
  critica: 'Crítica',
}

const nf0 = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 0 })
const nf1 = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 1 })

/** Número con separador de miles; null → [POR DEFINIR] (o el texto indicado). */
export function fmtNum(v: number | null | undefined, decimales: 0 | 1 = 0, vacio = POR_DEFINIR): string {
  if (v === null || v === undefined || Number.isNaN(v)) return vacio
  return (decimales ? nf1 : nf0).format(v)
}

export function fmtPct(v: number | null | undefined, vacio = POR_DEFINIR): string {
  return v === null || v === undefined || Number.isNaN(v) ? vacio : `${nf1.format(v)} %`
}

/** Hora local HH:MM de un ISO 8601. */
export function fmtHora(iso: string | null | undefined): string {
  if (!iso) return '--:--'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
}
