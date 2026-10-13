// Convierte plant-layout.json en un modelo de escena 3D (puro y testeable).
import { bbox, centroide } from '../../../domain/selectors'
import type { Equipo, PlantLayout, Punto, Zona } from '../../../domain/types'
import {
  ALTO_MURO_EDIFICIO,
  ALTO_TABIQUE,
  DIMS_TIPICAS,
  FORMA_POR_TIPO,
  GROSOR_MURO_EDIFICIO,
  GROSOR_TABIQUE,
  MARGEN_ZONA,
  PASILLO,
} from './catalogo'

/** Holgura en cada extremo cuando un equipo se recorta al largo de su zona (m). */
const HOLGURA_LARGO = 0.4
import type { Equipo3D, Flujo3D, Instancia, Limites, Losa3D, ModeloEscena, Muro3D, OrigenCantidad, V2, V3 } from './tipos'

export function calcularLimites(poligonos: Punto[][]): Limites {
  const pts = poligonos.flat()
  if (!pts.length) return { minX: 0, maxX: 1, minZ: 0, maxZ: 1, centro: [0.5, 0.5], tam: 1 }
  const b = bbox(pts)
  return {
    minX: b.x1,
    maxX: b.x2,
    minZ: b.z1,
    maxZ: b.z2,
    centro: [(b.x1 + b.x2) / 2, (b.z1 + b.z2) / 2],
    tam: Math.max(b.x2 - b.x1, b.z2 - b.z1, 1),
  }
}

/** Área con signo del polígono en el plano x-z. */
export function areaConSigno(pol: Punto[]): number {
  let a = 0
  for (let i = 0; i < pol.length; i++) {
    const [x0, z0] = pol[i]!
    const [x1, z1] = pol[(i + 1) % pol.length]!
    a += x0 * z1 - x1 * z0
  }
  return a / 2
}

function distPuntoSegmento(p: V2, a: V2, b: V2): number {
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const l2 = dx * dx + dz * dz || 1
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2))
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz))
}

/** Lados del polígono, desplazados `offset` metros hacia el interior. */
export function tramos(pol: Punto[], offset: number): Array<[V2, V2]> {
  const s = Math.sign(areaConSigno(pol)) || 1
  const out: Array<[V2, V2]> = []
  for (let i = 0; i < pol.length; i++) {
    const a = pol[i]!
    const b = pol[(i + 1) % pol.length]!
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (L < 0.01) continue
    const nx = (-(b[1] - a[1]) / L) * s
    const nz = ((b[0] - a[0]) / L) * s
    out.push([
      [a[0] + nx * offset, a[1] + nz * offset],
      [b[0] + nx * offset, b[1] + nz * offset],
    ])
  }
  return out
}

/**
 * Muros de edificio en el contorno de cada edificio con polígono y tabiques bajos en el
 * perímetro de cada recinto cerrado (desplazados medio grosor hacia adentro para que dos
 * recintos vecinos no superpongan caras). Se omite el tabique que coincide con un muro de edificio.
 */
export function construirMuros(l: PlantLayout): Muro3D[] {
  const muros: Muro3D[] = []
  for (const e of l.edificios) {
    if (!e.poligono) continue
    for (const [desde, hasta] of tramos(e.poligono, 0)) {
      muros.push({ tipo: 'edificio', de: e.id, desde, hasta, alto: ALTO_MURO_EDIFICIO, grosor: GROSOR_MURO_EDIFICIO })
    }
  }
  const deEdificio = muros.slice()
  const cubierto = (a: V2, b: V2) =>
    deEdificio.some((m) => distPuntoSegmento(a, m.desde, m.hasta) < 0.6 && distPuntoSegmento(b, m.desde, m.hasta) < 0.6)
  for (const z of l.zonas) {
    if (!z.poligono || !z.recinto_cerrado || z.grupo === 'exterior') continue
    for (const [desde, hasta] of tramos(z.poligono, GROSOR_TABIQUE / 2)) {
      if (!cubierto(desde, hasta)) muros.push({ tipo: 'tabique', de: z.id, desde, hasta, alto: ALTO_TABIQUE, grosor: GROSOR_TABIQUE })
    }
  }
  return muros
}

/**
 * Cuántas instancias dibujar y de dónde sale ese número: cantidad del JSON, o el mínimo
 * observado, o una sola instancia representativa. Nunca se estima a partir de otros datos.
 */
export function cantidadEquipo(e: Equipo): { n: number; origen: OrigenCantidad } {
  if (e.cantidad !== null && e.cantidad > 0) return { n: Math.round(e.cantidad), origen: 'json' }
  if (e.cantidad_min_observada && e.cantidad_min_observada > 0) return { n: e.cantidad_min_observada, origen: 'minimo_observado' }
  return { n: 1, origen: 'uno' }
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

function construirEquipos(l: PlantLayout, zonas: Map<string, Zona>): { equipos: Equipo3D[]; sinUbicar: Equipo[] } {
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
    // El largo no puede exceder el eje mayor de la zona (evita que el equipo atraviese los muros).
    const ejeMayor = Math.max(b.x2 - b.x1, b.z2 - b.z1) - 2 * HOLGURA_LARGO
    const largo = Math.min(d?.largo ?? lt, ejeMayor)
    const dims = { largo, ancho: d?.ancho ?? at, alto: d?.alto ?? ht }
    const representativo = !(d && d.largo !== null && d.ancho !== null && d.alto !== null) || largo !== (d?.largo ?? lt)
    const { n, origen } = cantidadEquipo(e)
    let instancias: Instancia[]
    if (e.posicion) {
      const rot = e.rotacion_grados !== undefined ? (e.rotacion_grados * Math.PI) / 180 : b.x2 - b.x1 >= b.z2 - b.z1 ? 0 : Math.PI / 2
      instancias = [{ pos: [e.posicion[0], 0, e.posicion[1]], rotY: rot }]
    } else {
      // Varios equipos sin posición en la misma zona: cada uno ocupa una franja del eje mayor.
      const grupo = sinPosicionPorZona.get(e.zona) ?? [e]
      const k = grupo.length
      const i = grupo.indexOf(e)
      const ejeX = b.x2 - b.x1 >= b.z2 - b.z1
      const paso = ((ejeX ? b.x2 - b.x1 : b.z2 - b.z1) / k) * i
      const tramo = (ejeX ? b.x2 - b.x1 : b.z2 - b.z1) / k
      const rect = ejeX ? { x1: b.x1 + paso, x2: b.x1 + paso + tramo, z1: b.z1, z2: b.z2 } : { x1: b.x1, x2: b.x2, z1: b.z1 + paso, z2: b.z1 + paso + tramo }
      instancias = distribuirEnRect(n, rect, dims.largo, dims.ancho, PASILLO[forma])
    }
    equipos.push({ id: e.id, nombre: e.nombre, tipo: e.tipo, forma, zona: e.zona, etapa: e.etapa, dims, representativo, cantidadOrigen: origen, instancias })
  }
  return { equipos, sinUbicar }
}

/** Arco elevado entre dos centroides (Bézier cuadrática muestreada). */
export function arco(a: V2, b: V2, muestras = 24): V3[] {
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1])
  const h = Math.min(9, Math.max(2.5, dist * 0.18))
  const base = 0.6
  const c: V3 = [(a[0] + b[0]) / 2, base + h * 2, (a[1] + b[1]) / 2]
  const out: V3[] = []
  for (let i = 0; i <= muestras; i++) {
    const t = i / muestras
    const u = 1 - t
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * base + 2 * u * t * c[1] + t * t * base, u * u * a[1] + 2 * u * t * c[2] + t * t * b[1]])
  }
  return out
}

export function construirModelo(l: PlantLayout): ModeloEscena {
  const zonas = new Map(l.zonas.map((z) => [z.id, z]))
  const conPoligono = l.zonas.filter((z) => z.poligono)
  const losas: Losa3D[] = conPoligono.map((z) => {
    const pol = z.poligono!
    const b = bbox(pol)
    const c = centroide(pol)
    return {
      id: z.id,
      nombre: z.nombre,
      grupo: z.grupo,
      color: z.color,
      recintoCerrado: z.recinto_cerrado,
      contorno: pol.map((p) => [p[0], p[1]] as V2),
      centro: [c[0], c[1]],
      ancho: b.x2 - b.x1,
      largo: b.z2 - b.z1,
      etapas: z.etapas,
      etapasHipotesis: z.etapas_hipotesis,
    }
  })
  const centros = new Map(losas.map((s) => [s.id, s.centro]))
  const flujos: Flujo3D[] = []
  for (const f of l.flujos) {
    const a = centros.get(f.desde)
    const b = centros.get(f.hasta)
    if (a && b) flujos.push({ id: f.id, desde: f.desde, hasta: f.hasta, fase: f.fase, tipo: f.tipo, puntos: arco(a, b) })
  }
  const { equipos, sinUbicar } = construirEquipos(l, zonas)
  return {
    limites: calcularLimites([...conPoligono.map((z) => z.poligono!), ...l.edificios.flatMap((e) => (e.poligono ? [e.poligono] : []))]),
    losas,
    muros: construirMuros(l),
    equipos,
    flujos,
    zonasSinUbicar: l.zonas.filter((z) => !z.poligono).map((z) => ({ id: z.id, nombre: z.nombre, etapas: z.etapas })),
    equiposSinUbicar: sinUbicar.map((e) => ({ id: e.id, nombre: e.nombre, etapas: [e.etapa] })),
  }
}
