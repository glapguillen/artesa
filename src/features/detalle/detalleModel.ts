// Funciones puras del panel de detalle: relacionan ids del layout con el estado en vivo y
// preparan lo que se muestra. No calculan KPIs de negocio (llegan hechos en LiveState).
import type { Alarma, LiveState } from '../../domain/live'
import { bbox, etapasDeRuta, type LayoutIndex } from '../../domain/selectors'
import type { Equipo, PlantLayout, Punto, RutaDecoracion, Transicion } from '../../domain/types'
import type { PuntoHistorial, Seleccion } from '../../store/usePlantStore'
import { fmtNum, POR_DEFINIR } from '../../ui/tokens'

/** Redondeo a 0,5 (la convención de redondeo del layout). */
export const redondearMedio = (v: number) => Math.round(v * 2) / 2

/** Área del polígono (fórmula del cordón de zapato), en m². */
export function areaPoligono(pol: Punto[]): number {
  let a = 0
  for (let i = 0; i < pol.length; i++) {
    const [x0, z0] = pol[i]!
    const [x1, z1] = pol[(i + 1) % pol.length]!
    a += x0 * z1 - x1 * z0
  }
  return Math.abs(a) / 2
}

export interface Medidas {
  /** Lado menor del rectángulo envolvente (m). */
  ancho: number
  /** Lado mayor del rectángulo envolvente (m). */
  largo: number
  /** Área del polígono (m²). */
  area: number
}

/** Medidas aproximadas de una zona a partir de su polígono, redondeadas a 0,5; null si no está ubicada. */
export function medidasZona(pol: Punto[] | null | undefined): Medidas | null {
  if (!pol || pol.length < 3) return null
  const b = bbox(pol)
  const dx = b.x2 - b.x1
  const dz = b.z2 - b.z1
  return {
    ancho: redondearMedio(Math.min(dx, dz)),
    largo: redondearMedio(Math.max(dx, dz)),
    area: redondearMedio(areaPoligono(pol)),
  }
}

export interface PuntoWip {
  t: string
  v: number
}

/** Mínimo de lecturas con valor para dibujar el historial. */
export const MIN_PUNTOS_HISTORIAL = 2

/** WIP histórico de una etapa: solo las lecturas con valor numérico. */
export function serieWip(historial: readonly PuntoHistorial[], codigo: string): PuntoWip[] {
  const out: PuntoWip[] = []
  for (const p of historial) {
    const v = p.wip[codigo]
    if (typeof v === 'number' && Number.isFinite(v)) out.push({ t: p.t, v })
  }
  return out
}

export function transicionesDeEtapa(
  l: PlantLayout,
  codigo: string,
): { entrantes: Transicion[]; salientes: Transicion[] } {
  const ts = l.proceso.transiciones
  return { entrantes: ts.filter((t) => t.hasta === codigo), salientes: ts.filter((t) => t.desde === codigo) }
}

/** Rutas de decoración cuyo recorrido (2.0 → pasos → siguiente) pasa por la etapa. */
export function rutasConEtapa(l: PlantLayout, codigo: string): RutaDecoracion[] {
  return l.proceso.rutas_decoracion.filter((r) => etapasDeRuta(l, r.id).includes(codigo))
}

/** Cantidad de un equipo: la del JSON o [POR DEFINIR], con el mínimo observado si lo hay. Nunca se estima. */
export function textoCantidad(e: Pick<Equipo, 'cantidad' | 'cantidad_min_observada'>): string {
  if (e.cantidad !== null && Number.isFinite(e.cantidad)) return fmtNum(e.cantidad)
  const min = e.cantidad_min_observada
  return min !== undefined && min > 0 ? `${POR_DEFINIR} · mín. observado ${fmtNum(min)}` : POR_DEFINIR
}

/** Qué conteo de live.clasificaciones corresponde a cada etapa de decisión (contrato LiveState). */
export const CLASIFICACION_EN_VIVO: Readonly<Record<string, keyof LiveState['clasificaciones']>> = {
  '1.7': 'bizcocho',
  '3.3': 'final',
}

/** Piezas del turno con ese resultado; null si la fuente no lo envía. */
export function conteoClasificacion(live: LiveState | null, codigo: string, resultado: string): number | null {
  const clave = CLASIFICACION_EN_VIVO[codigo]
  if (!live || !clave) return null
  const v = live.clasificaciones?.[clave]?.[resultado]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

/**
 * Alarmas relacionadas con la selección. Equipo: las suyas. Etapa: las suyas y las de sus
 * equipos. Zona: las suyas, las de sus equipos y las de sus etapas confirmadas.
 */
export function alarmasDeSeleccion(live: LiveState | null, idx: LayoutIndex, sel: Seleccion): Alarma[] {
  const alarmas = live?.alarmas ?? []
  const claves = new Set<string>([`${sel.tipo}:${sel.id}`])
  if (sel.tipo === 'zona') {
    for (const e of idx.equiposPorZona.get(sel.id) ?? []) claves.add(`equipo:${e.id}`)
    for (const c of idx.zonasPorId.get(sel.id)?.etapas ?? []) claves.add(`etapa:${c}`)
  } else if (sel.tipo === 'etapa') {
    for (const e of idx.equiposPorEtapa.get(sel.id) ?? []) claves.add(`equipo:${e.id}`)
  }
  return alarmas.filter((a) => a.ref !== null && claves.has(`${a.ref.tipo}:${a.ref.id}`))
}

const TIPO_SELECCION: Readonly<Record<Seleccion['tipo'], string>> = {
  zona: 'Zona',
  etapa: 'Etapa del proceso',
  equipo: 'Equipo',
}

export interface Encabezado {
  tipo: string
  titulo: string
  existe: boolean
}

/** Título del panel; si el id no existe en el layout, "Elemento no encontrado". */
export function encabezadoDe(idx: LayoutIndex, sel: Seleccion): Encabezado {
  const tipo = TIPO_SELECCION[sel.tipo] ?? 'Elemento'
  let titulo: string | undefined
  if (sel.tipo === 'zona') titulo = idx.zonasPorId.get(sel.id)?.nombre
  else if (sel.tipo === 'etapa') {
    const e = idx.etapasPorCodigo.get(sel.id)
    titulo = e ? `${e.codigo} · ${e.nombre}` : undefined
  } else if (sel.tipo === 'equipo') titulo = idx.equiposPorId.get(sel.id)?.nombre
  return titulo === undefined ? { tipo, titulo: 'Elemento no encontrado', existe: false } : { tipo, titulo, existe: true }
}
