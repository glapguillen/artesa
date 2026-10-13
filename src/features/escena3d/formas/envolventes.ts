// Cajas envolventes y puntos de referencia de los equipos (puro): contorno de selección, rombo de
// "representativo" y base de las balizas de alarma.
import type { Equipo3D, V3 } from '../modelo/tipos'
import { rotarY } from './piezas'

/** Caja envolvente de una instancia (para el contorno de selección y el rombo de "representativo"). */
export function envolventes(e: Equipo3D, holgura = 0.25): Array<{ pos: V3; rotY: number; escala: V3 }> {
  const { largo, ancho, alto } = e.dims
  return e.instancias.map((i) => ({
    pos: [i.pos[0], i.pos[1] + alto / 2, i.pos[2]],
    rotY: i.rotY,
    escala: [largo + 2 * holgura, alto + holgura, ancho + 2 * holgura],
  }))
}

/** Punto sobre el equipo (centro de sus instancias, por encima del más alto) para marcas y balizas. */
export function cimaDeEquipo(e: Equipo3D, sobre = 0.9): V3 | null {
  if (!e.instancias.length) return null
  let x = 0
  let z = 0
  for (const i of e.instancias) {
    x += i.pos[0]
    z += i.pos[2]
  }
  return [x / e.instancias.length, e.dims.alto + sobre, z / e.instancias.length]
}

/** Las 12 aristas de una caja orientada, como pares de puntos (para dibujar contornos con líneas). */
export function aristasDeCaja(pos: V3, rotY: number, escala: V3): V3[] {
  const [hx, hy, hz] = [escala[0] / 2, escala[1] / 2, escala[2] / 2]
  const v = (sx: number, sy: number, sz: number): V3 => {
    const [x, y, z] = rotarY([sx * hx, sy * hy, sz * hz], rotY)
    return [pos[0] + x, pos[1] + y, pos[2] + z]
  }
  const out: V3[] = []
  for (const s of [-1, 1]) {
    // Aristas paralelas a cada eje, en las 4 posiciones de los otros dos.
    for (const t of [-1, 1]) {
      out.push(v(-1, s, t), v(1, s, t))
      out.push(v(s, -1, t), v(s, 1, t))
      out.push(v(s, t, -1), v(s, t, 1))
    }
  }
  return out
}
