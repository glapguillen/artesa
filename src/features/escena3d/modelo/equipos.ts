// Equipos 3D: cantidad de instancias, orientación, recorte a la zona y distribución.
import { bbox } from '../../../domain/selectors'
import type { Equipo, PlantLayout, Zona } from '../../../domain/types'
import { DIMS_TIPICAS, FORMA_POR_TIPO, MARGEN_ZONA, PASILLO } from './catalogo'
import type { Equipo3D, Instancia, OrigenCantidad, V2 } from './tipos'

/** Holgura en cada extremo cuando un equipo se recorta al largo de su zona (m). */
const HOLGURA_LARGO = 0.4

/**
 * Cuántas instancias dibujar y de dónde sale ese número: cantidad del JSON, o el mínimo
 * observado, o una sola instancia representativa. Nunca se estima a partir de otros datos.
 */
export function cantidadEquipo(e: Equipo): { n: number; origen: OrigenCantidad } {
  if (e.cantidad !== null && e.cantidad > 0) return { n: Math.round(e.cantidad), origen: 'json' }
  if (e.cantidad_min_observada && e.cantidad_min_observada > 0) return { n: e.cantidad_min_observada, origen: 'minimo_observado' }
  return { n: 1, origen: 'uno' }
}

/**
 * Largo dibujado: el original, recortado al largo disponible en la zona en la orientación del
 * equipo, menos una holgura por extremo (para no atravesar los muros). Nunca queda en cero:
 * mínimo 0,5 m o el original si es menor.
 */
export function ajustarLargo(largoOriginal: number, disponibleEnZona: number): number {
  const disponible = disponibleEnZona - 2 * HOLGURA_LARGO
  return Math.max(Math.min(largoOriginal, disponible), Math.min(0.5, largoOriginal))
}

/**
 * Largo máximo de un segmento centrado en `pos` y orientado según `rotY` (convención three.js:
 * el eje X local apunta a (cos, -sin) en el plano x-z) que cabe dentro del rectángulo.
 */
export function largoDisponible(pos: V2, rotY: number, r: { x1: number; z1: number; x2: number; z2: number }): number {
  const dx = Math.abs(Math.cos(rotY))
  const dz = Math.abs(Math.sin(rotY))
  const mitadX = dx > 1e-6 ? Math.min(pos[0] - r.x1, r.x2 - pos[0]) / dx : Infinity
  const mitadZ = dz > 1e-6 ? Math.min(pos[1] - r.z1, r.z2 - pos[1]) / dz : Infinity
  return Math.max(0, 2 * Math.min(mitadX, mitadZ))
}

/** Distribuye n instancias en filas dentro de un rectángulo, a lo largo de su eje mayor. */
export function distribuirEnRect(
  n: number,
  rect: { x1: number; z1: number; x2: number; z2: number },
  largo: number,
  ancho: number,
  pasillo: number,
): Instancia[] {
  const W = rect.x2 - rect.x1
  const H = rect.z2 - rect.z1
  const ejeX = W >= H
  const L = Math.max((ejeX ? W : H) - 2 * MARGEN_ZONA, largo)
  const A = Math.max((ejeX ? H : W) - 2 * MARGEN_ZONA, ancho)
  const cols = Math.max(1, Math.min(n, Math.floor((L + pasillo) / (largo + pasillo))))
  const filas = Math.ceil(n / cols)
  const pasoL = largo + pasillo
  const pasoA = Math.min(ancho + pasillo, filas > 1 ? (A - ancho) / (filas - 1) : ancho + pasillo)
  const cx = (rect.x1 + rect.x2) / 2
  const cz = (rect.z1 + rect.z2) / 2
  const out: Instancia[] = []
  for (let i = 0; i < n; i++) {
    const c = i % cols
    const f = Math.floor(i / cols)
    const enFila = Math.min(cols, n - f * cols)
    const u = (c - (enFila - 1) / 2) * pasoL
    const v = (f - (filas - 1) / 2) * pasoA
    out.push({ pos: ejeX ? [cx + u, 0, cz + v] : [cx + v, 0, cz + u], rotY: ejeX ? 0 : Math.PI / 2 })
  }
  return out
}

export function construirEquipos(l: PlantLayout, zonas: Map<string, Zona>): { equipos: Equipo3D[]; sinUbicar: Equipo[] } {
  const equipos: Equipo3D[] = []
  const sinUbicar: Equipo[] = []
  const sinPosicionPorZona = new Map<string, Equipo[]>()
  for (const e of l.equipos) {
    const z = zonas.get(e.zona)
    if (!z?.poligono) {
      sinUbicar.push(e)
      continue
    }
    if (!e.posicion) sinPosicionPorZona.set(e.zona, [...(sinPosicionPorZona.get(e.zona) ?? []), e])
  }
  for (const e of l.equipos) {
    const z = zonas.get(e.zona)
    if (!z?.poligono) continue
    const forma = FORMA_POR_TIPO[e.tipo] ?? 'generico'
    const [lt, at, ht] = DIMS_TIPICAS[forma]
    const d = e.dimensiones
    const b = bbox(z.poligono)
    const ejeX = b.x2 - b.x1 >= b.z2 - b.z1
    // Orientación: la del JSON si hay posición y rotación; si no, a lo largo del eje mayor de la zona.
    const rotY = e.posicion && e.rotacion_grados !== undefined ? (e.rotacion_grados * Math.PI) / 180 : ejeX ? 0 : Math.PI / 2
    const largoOriginal = d?.largo ?? lt
    const disponible = e.posicion
      ? largoDisponible([e.posicion[0], e.posicion[1]], rotY, b)
      : Math.max(b.x2 - b.x1, b.z2 - b.z1)
    const largo = ajustarLargo(largoOriginal, disponible)
    const recortado = largo < largoOriginal
    const dims = { largo, ancho: d?.ancho ?? at, alto: d?.alto ?? ht }
    const representativo = !(d && d.largo !== null && d.ancho !== null && d.alto !== null) || recortado
    const { n, origen } = cantidadEquipo(e)
    let instancias: Instancia[]
    if (e.posicion) {
      instancias = [{ pos: [e.posicion[0], 0, e.posicion[1]], rotY }]
    } else {
      // Varios equipos sin posición en la misma zona: cada uno ocupa una franja del eje mayor.
      const grupo = sinPosicionPorZona.get(e.zona) ?? [e]
      const k = grupo.length
      const i = grupo.indexOf(e)
      const paso = ((ejeX ? b.x2 - b.x1 : b.z2 - b.z1) / k) * i
      const tramo = (ejeX ? b.x2 - b.x1 : b.z2 - b.z1) / k
      const rect = ejeX ? { x1: b.x1 + paso, x2: b.x1 + paso + tramo, z1: b.z1, z2: b.z2 } : { x1: b.x1, x2: b.x2, z1: b.z1 + paso, z2: b.z1 + paso + tramo }
      instancias = distribuirEnRect(n, rect, dims.largo, dims.ancho, PASILLO[forma])
    }
    equipos.push({ id: e.id, nombre: e.nombre, tipo: e.tipo, forma, zona: e.zona, etapa: e.etapa, dims, representativo, largoOriginal, recortado, cantidadOrigen: origen, instancias })
  }
  return { equipos, sinUbicar }
}
