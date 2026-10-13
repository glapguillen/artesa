// Ajuste de un encuadre al tamaño del lienzo (puro): conserva la dirección de la vista de
// modelo/camara.ts y calcula la distancia mínima para que la caja quepa con la proporción y el
// campo de visión reales (así la planta llena la escena tanto en escritorio como en un móvil vertical).
import type { Encuadre, Equipo3D, Limites, Losa3D, V3 } from '../modelo/tipos'

export interface Caja3 {
  min: V3
  max: V3
}

const resta = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const punto = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cruz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const largo = (a: V3) => Math.hypot(a[0], a[1], a[2])
const unitario = (a: V3): V3 => {
  const l = largo(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}

/** Esquinas de una caja. */
function esquinas({ min, max }: Caja3): V3[] {
  const out: V3[] = []
  for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) out.push([x, y, z])
  return out
}

/**
 * Misma dirección de vista y mismo objetivo; distancia justa para ver toda la caja.
 * fovV en grados (vertical); aspecto = ancho / alto del lienzo; margen > 1 deja aire alrededor.
 */
export function ajustarEncuadre(e: Encuadre, caja: Caja3, fovV: number, aspecto: number, margen = 1.08, dMin = 5, dMax = Infinity): Encuadre {
  const atras = resta(e.posicion, e.objetivo)
  const f = unitario(resta(e.objetivo, e.posicion))
  let r = cruz(f, [0, 1, 0])
  if (largo(r) < 1e-3) r = [1, 0, 0]
  r = unitario(r)
  const u = cruz(r, f)
  const tv = Math.tan(((fovV / 2) * Math.PI) / 180)
  const th = tv * Math.max(aspecto, 0.05)
  let d = 0
  for (const p of esquinas(caja)) {
    const q = resta(p, e.objetivo)
    const z = punto(q, f)
    d = Math.max(d, Math.abs(punto(q, r)) / th - z, Math.abs(punto(q, u)) / tv - z)
  }
  const dist = Math.min(dMax, Math.max(dMin, d * margen))
  const dir = unitario(atras)
  return {
    objetivo: e.objetivo,
    posicion: [e.objetivo[0] + dir[0] * dist, e.objetivo[1] + dir[1] * dist, e.objetivo[2] + dir[2] * dist],
  }
}

/** Caja de toda la planta (hasta la altura de los muros en corte). */
export const cajaPlanta = (l: Limites, alto = 3): Caja3 => ({ min: [l.minX, 0, l.minZ], max: [l.maxX, alto, l.maxZ] })

/** Caja de una zona. */
export function cajaLosa(s: Losa3D, alto = 2.5): Caja3 {
  const xs = s.contorno.map((p) => p[0])
  const zs = s.contorno.map((p) => p[1])
  return { min: [Math.min(...xs), 0, Math.min(...zs)], max: [Math.max(...xs), alto, Math.max(...zs)] }
}

/** Caja de las instancias de un equipo (aprox.: el lado mayor en ambos ejes, por el giro). */
export function cajaEquipo(e: Equipo3D): Caja3 | null {
  if (!e.instancias.length) return null
  const r = Math.max(e.dims.largo, e.dims.ancho) / 2
  const xs = e.instancias.map((i) => i.pos[0])
  const zs = e.instancias.map((i) => i.pos[2])
  return { min: [Math.min(...xs) - r, 0, Math.min(...zs) - r], max: [Math.max(...xs) + r, e.dims.alto, Math.max(...zs) + r] }
}
