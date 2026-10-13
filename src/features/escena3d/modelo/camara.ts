// Encuadres de cámara y recorridos para la escena 3D (puros).
import type { Encuadre, Equipo3D, Limites, Losa3D, ModeloEscena, V3 } from './tipos'

const lim = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/** Vista general en perspectiva desde el sureste. */
export function encuadreGeneral(l: Limites): Encuadre {
  const [cx, cz] = l.centro
  return { objetivo: [cx, 0, cz], posicion: [cx + l.tam * 0.45, l.tam * 0.75, cz + l.tam * 0.85] }
}

/** Vista cenital (planta), con un mínimo desfase para que los controles no queden en singularidad. */
export function encuadreCenital(l: Limites): Encuadre {
  const [cx, cz] = l.centro
  return { objetivo: [cx, 0, cz], posicion: [cx, l.tam * 1.15, cz + 0.01] }
}

export function encuadreZona(s: Losa3D): Encuadre {
  const d = lim(Math.max(s.ancho, s.largo) * 1.6, 14, 90)
  const [cx, cz] = s.centro
  return { objetivo: [cx, 0, cz], posicion: [cx + d * 0.55, d * 0.8, cz + d * 0.75] }
}

export function encuadreEquipo(e: Equipo3D): Encuadre | null {
  if (!e.instancias.length) return null
  let x = 0
  let z = 0
  for (const i of e.instancias) {
    x += i.pos[0]
    z += i.pos[2]
  }
  x /= e.instancias.length
  z /= e.instancias.length
  const d = lim(Math.max(e.dims.largo, e.dims.ancho * e.instancias.length) * 1.4 + 6, 8, 60)
  return { objetivo: [x, e.dims.alto / 2, z], posicion: [x + d * 0.6, e.dims.alto + d * 0.7, z + d * 0.7] }
}

/** Encuadre para un elemento seleccionado, o null si no está en la escena. */
export function encuadrePara(m: ModeloEscena, tipo: 'zona' | 'equipo', id: string): Encuadre | null {
  if (tipo === 'zona') {
    const s = m.losas.find((x) => x.id === id)
    return s ? encuadreZona(s) : null
  }
  const e = m.equipos.find((x) => x.id === id)
  return e ? encuadreEquipo(e) : null
}

/** Polilínea elevada que une los centros de una secuencia de zonas (ruta activa). */
export function caminoPorZonas(m: ModeloEscena, zonaIds: string[], altura = 1.2): V3[] {
  const out: V3[] = []
  for (const id of zonaIds) {
    const s = m.losas.find((x) => x.id === id)
    if (s) out.push([s.centro[0], altura, s.centro[1]])
  }
  return out
}
