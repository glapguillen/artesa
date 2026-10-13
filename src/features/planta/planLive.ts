// Agregación de presentación sobre el estado en vivo y la selección (sin KPIs de negocio).
// Todo tolera ids sin datos: lo que falta queda como "sin_datos" o simplemente no se marca.
import type { EstadoOperativo, LiveState, NivelAlarma } from '../../domain/live'
import type { LayoutIndex } from '../../domain/selectors'
import { estadoDeZona } from '../../domain/selectors'
import type { Zona } from '../../domain/types'
import type { Seleccion } from '../../store/usePlantStore'
import { colorEstado } from '../../ui/tokens'

export function estadosDeZonas(
  idx: LayoutIndex | null,
  live: LiveState | null,
  ids: string[],
): Record<string, EstadoOperativo> {
  const out: Record<string, EstadoOperativo> = {}
  for (const id of ids) out[id] = idx ? estadoDeZona(idx, live, id) : 'sin_datos'
  return out
}

const GRAVEDAD: Record<NivelAlarma, number> = { info: 0, advertencia: 1, critica: 2 }

/** Zonas donde se dibuja una etapa en el plano: las confirmadas o, si no hay, las probables. */
function zonasDeEtapa(idx: LayoutIndex, codigo: string): Zona[] {
  const z = idx.zonasPorEtapa.get(codigo)
  if (!z) return []
  return z.confirmadas.length ? z.confirmadas : z.hipotesis
}

/**
 * Peor nivel de alarma activa por zona. Una alarma marca su zona (ref zona), la zona de su equipo
 * (ref equipo) o las zonas donde ocurre su etapa (ref etapa). Alarmas sin ref no marcan zonas.
 */
export function alarmasPorZona(idx: LayoutIndex | null, live: LiveState | null): Map<string, NivelAlarma> {
  const out = new Map<string, NivelAlarma>()
  if (!idx || !live) return out
  const marcar = (id: string | undefined, nivel: NivelAlarma) => {
    if (!id) return
    const actual = out.get(id)
    if (!actual || GRAVEDAD[nivel] > GRAVEDAD[actual]) out.set(id, nivel)
  }
  for (const a of live.alarmas ?? []) {
    if (!a?.ref) continue
    if (a.ref.tipo === 'zona') marcar(a.ref.id, a.nivel)
    else if (a.ref.tipo === 'equipo') marcar(idx.equiposPorId.get(a.ref.id)?.zona, a.nivel)
    else for (const z of zonasDeEtapa(idx, a.ref.id)) marcar(z.id, a.nivel)
  }
  return out
}

/** Caudal relativo (0–1) de cada flujo respecto del mayor; null si no hay dato. */
export function caudalRelativo(ids: string[], live: LiveState | null): Record<string, number | null> {
  const valores = ids.map((id) => {
    const v = live?.flujos?.[id]?.piezas_h
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null
  })
  const max = Math.max(0, ...valores.map((v) => v ?? 0))
  const out: Record<string, number | null> = {}
  ids.forEach((id, i) => {
    const v = valores[i] ?? null
    out[id] = v === null ? null : max > 0 ? v / max : 0
  })
  return out
}

export type Resalte = 'solido' | 'discontinuo'

/** Zonas a resaltar según la selección: la zona, las zonas de la etapa o la zona del equipo. */
export function resaltadoDeSeleccion(idx: LayoutIndex | null, sel: Seleccion | null): Map<string, Resalte> {
  const out = new Map<string, Resalte>()
  if (!idx || !sel) return out
  if (sel.tipo === 'zona') out.set(sel.id, 'solido')
  else if (sel.tipo === 'equipo') {
    const z = idx.equiposPorId.get(sel.id)?.zona
    if (z) out.set(z, 'solido')
  } else {
    const z = idx.zonasPorEtapa.get(sel.id)
    for (const h of z?.hipotesis ?? []) out.set(h.id, 'discontinuo')
    for (const c of z?.confirmadas ?? []) out.set(c.id, 'solido')
  }
  return out
}

/** Números de paso (1, 2, …) de cada zona en el recorrido de una ruta; una zona puede repetirse. */
export function pasosPorZona(zonas: Array<{ id: string }>): Map<string, number[]> {
  const out = new Map<string, number[]>()
  zonas.forEach((z, i) => out.set(z.id, [...(out.get(z.id) ?? []), i + 1]))
  return out
}

export interface EstiloZona {
  relleno: string
  opacidad: number | string
  trazo: string
}

/**
 * Colores de una zona. Por estado: color del estado translúcido con borde del mismo color.
 * Por grupo: color de la zona con var(--zona-opacidad); las zonas con trama (sin rótulo,
 * sin identificar, exterior) usan la superficie del tema para no encandilar en modo oscuro.
 */
export function estiloZona(
  z: { color: string; patron: string | null },
  colorPor: 'estado' | 'grupo',
  estado: EstadoOperativo,
): EstiloZona {
  if (colorPor === 'estado') return { relleno: colorEstado(estado), opacidad: 0.42, trazo: colorEstado(estado) }
  if (z.patron) return { relleno: 'var(--c-surface-2)', opacidad: 1, trazo: 'var(--c-muted)' }
  return { relleno: z.color, opacidad: 'var(--zona-opacidad)', trazo: 'var(--c-muted)' }
}
