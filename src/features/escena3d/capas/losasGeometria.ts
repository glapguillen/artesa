// Geometría de las losas de zona: el polígono exacto del layout extruido con poco espesor, y todas
// las losas de un mismo estilo fundidas en una sola malla (1 draw call por estilo). Cada triángulo
// sabe a qué zona pertenece (clic y hover) y cada zona su rango de vértices (color).
import { BufferAttribute, BufferGeometry, type Color, ExtrudeGeometry, Shape, Vector2 } from 'three'
import type { Losa3D, V2 } from '../modelo/tipos'

/**
 * Forma 2D del contorno. three.js extruye en el plano x-y: se usa (x, −z) y luego se gira −90° en X,
 * con lo que y = −z vuelve a ser la z del layout y la extrusión queda hacia arriba (Y).
 */
export const formaDeContorno = (contorno: V2[]) => new Shape(contorno.map(([x, z]) => new Vector2(x, -z)))

/** Losa en coordenadas del mundo: base en y = 0 y cara superior en y = espesor. */
export function geometriaLosa(contorno: V2[], espesor: number): BufferGeometry {
  const g = new ExtrudeGeometry(formaDeContorno(contorno), { depth: espesor, bevelEnabled: false, steps: 1, curveSegments: 1 })
  g.rotateX(-Math.PI / 2)
  return g
}

export interface RangoLosa {
  id: string
  inicio: number
  cuenta: number
}

export interface GrupoLosas {
  clave: string
  abierta: boolean
  rayada: boolean
  geometria: BufferGeometry
  rangos: RangoLosa[]
  /** Zona de cada triángulo (faceIndex del raycast → id). */
  caras: string[]
}

export interface EstiloLosa {
  abierta: boolean
  rayada: boolean
}

const copiar = (destino: Float32Array, g: BufferGeometry, nombre: string, desde: number) => {
  const a = g.getAttribute(nombre)
  if (a) destino.set(a.array as Float32Array, desde * a.itemSize)
}

/** ExtrudeGeometry ya viene sin índice; si no, se expande (cada triángulo con sus 3 vértices). */
function sinIndice(g: BufferGeometry): BufferGeometry {
  if (!g.index) return g
  const n = g.toNonIndexed()
  g.dispose()
  return n
}

/** Funde las losas por estilo (cerrada/abierta, con o sin trama). Geometrías no indexadas. */
export function agruparLosas(losas: Losa3D[], espesor: number, estilo: (l: Losa3D) => EstiloLosa): GrupoLosas[] {
  const porClave = new Map<string, { e: EstiloLosa; partes: Array<{ id: string; g: BufferGeometry }> }>()
  for (const l of losas) {
    if (l.contorno.length < 3) continue
    const e = estilo(l)
    const clave = `${e.abierta ? 'abierta' : 'cerrada'}${e.rayada ? '-rayada' : ''}`
    const g = sinIndice(geometriaLosa(l.contorno, espesor))
    const grupo = porClave.get(clave) ?? { e, partes: [] }
    grupo.partes.push({ id: l.id, g })
    porClave.set(clave, grupo)
  }
  return [...porClave].map(([clave, { e, partes }]) => {
    const total = partes.reduce((n, p) => n + p.g.getAttribute('position').count, 0)
    const pos = new Float32Array(total * 3)
    const nor = new Float32Array(total * 3)
    const uv = new Float32Array(total * 2)
    const rangos: RangoLosa[] = []
    const caras: string[] = []
    let off = 0
    for (const p of partes) {
      const n = p.g.getAttribute('position').count
      copiar(pos, p.g, 'position', off)
      copiar(nor, p.g, 'normal', off)
      copiar(uv, p.g, 'uv', off)
      rangos.push({ id: p.id, inicio: off, cuenta: n })
      for (let t = 0; t < n / 3; t++) caras.push(p.id)
      off += n
      p.g.dispose()
    }
    const geometria = new BufferGeometry()
    geometria.setAttribute('position', new BufferAttribute(pos, 3))
    geometria.setAttribute('normal', new BufferAttribute(nor, 3))
    geometria.setAttribute('uv', new BufferAttribute(uv, 2))
    geometria.setAttribute('color', new BufferAttribute(new Float32Array(total * 3).fill(1), 3))
    geometria.computeBoundingBox()
    geometria.computeBoundingSphere()
    return { clave, abierta: e.abierta, rayada: e.rayada, geometria, rangos, caras }
  })
}

/** Escribe el color de cada zona en sus vértices (atributo `color`, espacio lineal de three). */
export function pintarRangos(g: BufferGeometry, rangos: RangoLosa[], colorDe: (id: string) => Color | undefined): void {
  const attr = g.getAttribute('color')
  if (!attr) return
  const arr = attr.array as Float32Array
  const s = attr.itemSize
  for (const r of rangos) {
    const c = colorDe(r.id)
    if (!c) continue
    for (let i = r.inicio; i < r.inicio + r.cuenta; i++) {
      arr[i * s] = c.r
      arr[i * s + 1] = c.g
      arr[i * s + 2] = c.b
    }
  }
  attr.needsUpdate = true
}

/** Segmentos del contorno de cada losa a la altura y (2 vértices por lado) para LineSegments. */
export function segmentosContorno(losas: Losa3D[], y: number): { posiciones: Float32Array; rangos: RangoLosa[] } {
  const total = losas.reduce((n, l) => n + l.contorno.length * 2, 0)
  const posiciones = new Float32Array(total * 3)
  const rangos: RangoLosa[] = []
  let off = 0
  for (const l of losas) {
    const n = l.contorno.length
    l.contorno.forEach(([x, z], i) => {
      const [x2, z2] = l.contorno[(i + 1) % n]!
      posiciones.set([x, y, z, x2, y, z2], (off + i * 2) * 3)
    })
    rangos.push({ id: l.id, inicio: off, cuenta: n * 2 })
    off += n * 2
  }
  return { posiciones, rangos }
}
