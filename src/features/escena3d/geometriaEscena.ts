// Geometría de presentación de la escena 3D (pura, sin three.js): piso y cuadrícula, muros como
// cajas escaladas, punto de clic libre de equipos y reparto de etiquetas sin solapes.
import type { Punto } from '../../domain/types'
import { puntoEnPoligono, rectInterior } from '../planta/geometry'
import type { Equipo3D, Instancia, Limites, Losa3D, Muro3D, V2, V3 } from './modelo/tipos'

/** Espesor de las losas de zona (m). */
export const ESPESOR_LOSA = 0.08
/** Margen del piso alrededor de lo dibujado (m). */
export const MARGEN_PISO = 8
/** Celda y sección de la cuadrícula (m). */
export const CELDA = 1
export const SECCION = 10

export interface RectPiso {
  cx: number
  cz: number
  w: number
  h: number
}

/**
 * Rectángulo del piso: cubre los límites del modelo y la envolvente de `planta.dimensiones`, con
 * margen. El centro cae en múltiplos de la sección para que las líneas de la cuadrícula coincidan
 * con metros enteros del layout.
 */
export function rectPiso(l: Limites, envolvente: { x: number; z: number; w: number; h: number } | null, margen = MARGEN_PISO): RectPiso {
  const minX = Math.min(l.minX, envolvente?.x ?? l.minX) - margen
  const maxX = Math.max(l.maxX, envolvente ? envolvente.x + envolvente.w : l.maxX) + margen
  const minZ = Math.min(l.minZ, envolvente?.z ?? l.minZ) - margen
  const maxZ = Math.max(l.maxZ, envolvente ? envolvente.z + envolvente.h : l.maxZ) + margen
  const cx = Math.round((minX + maxX) / 2 / SECCION) * SECCION
  const cz = Math.round((minZ + maxZ) / 2 / SECCION) * SECCION
  return { cx, cz, w: 2 * Math.max(cx - minX, maxX - cx), h: 2 * Math.max(cz - minZ, maxZ - cz) }
}

/** Caja que acota el objetivo de la cámara (los límites del modelo con margen). */
export function cajaObjetivo(l: Limites, margen = 4): { min: V3; max: V3 } {
  return { min: [l.minX - margen, 0, l.minZ - margen], max: [l.maxX + margen, 4, l.maxZ + margen] }
}

/** Centro, giro y escala de la caja unitaria que dibuja un tramo de muro (con las esquinas cerradas). */
export function transformacionMuro(m: Muro3D): { pos: V3; rotY: number; escala: V3 } {
  const dx = m.hasta[0] - m.desde[0]
  const dz = m.hasta[1] - m.desde[1]
  const largo = Math.hypot(dx, dz)
  return {
    pos: [(m.desde[0] + m.hasta[0]) / 2, m.alto / 2, (m.desde[1] + m.hasta[1]) / 2],
    rotY: Math.atan2(-dz, dx),
    escala: [largo + m.grosor, m.alto, m.grosor],
  }
}

/** ¿El punto (x, z) cae en la huella de una instancia de equipo (con margen)? */
export function enHuella([px, pz]: V2, i: Instancia, dims: { largo: number; ancho: number }, margen = 0.5): boolean {
  const dx = px - i.pos[0]
  const dz = pz - i.pos[2]
  const c = Math.cos(i.rotY)
  const s = Math.sin(i.rotY)
  return Math.abs(dx * c - dz * s) <= dims.largo / 2 + margen && Math.abs(dx * s + dz * c) <= dims.ancho / 2 + margen
}

/** Ancla de la etiqueta de una zona: centro del mayor rectángulo interior (como en el 2D). */
export function anclaEtiqueta(s: Losa3D): V2 {
  const r = rectInterior(s.contorno as Punto[])
  return [r.x + r.w / 2, r.y + r.h / 2]
}

/**
 * Punto de la losa donde un clic la selecciona: el centroide si está dentro y libre de equipos;
 * si no, el punto libre de una malla interior más cercano al centroide.
 */
export function puntoLibre(s: Losa3D, equipos: Equipo3D[]): V2 {
  const propios = equipos.filter((e) => e.zona === s.id)
  const pol = s.contorno as Punto[]
  const libre = (p: V2) => puntoEnPoligono(p, pol) && !propios.some((e) => e.instancias.some((i) => enHuella(p, i, e.dims)))
  if (libre(s.centro)) return s.centro
  const xs = s.contorno.map((p) => p[0])
  const zs = s.contorno.map((p) => p[1])
  const [x1, x2, z1, z2] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]
  const n = 16
  let mejor: V2 | null = null
  let dMejor = Infinity
  for (let i = 1; i < n; i++) {
    for (let j = 1; j < n; j++) {
      const p: V2 = [x1 + ((x2 - x1) * i) / n, z1 + ((z2 - z1) * j) / n]
      const d = Math.hypot(p[0] - s.centro[0], p[1] - s.centro[1])
      if (d < dMejor && libre(p)) {
        mejor = p
        dMejor = d
      }
    }
  }
  return mejor ?? anclaEtiqueta(s)
}

export interface CandidatoEtiqueta {
  id: string
  /** Centro en píxeles. */
  x: number
  y: number
  w: number
  h: number
  prioridad: number
}

/** Reparto voraz: de mayor a menor prioridad, se muestra cada etiqueta que no pisa a otra ya puesta. */
export function disponerEtiquetas(cands: CandidatoEtiqueta[], separacion = 4): Set<string> {
  const puestas: CandidatoEtiqueta[] = []
  for (const c of [...cands].sort((a, b) => b.prioridad - a.prioridad)) {
    const choca = puestas.some(
      (p) => Math.abs(p.x - c.x) * 2 < p.w + c.w + separacion && Math.abs(p.y - c.y) * 2 < p.h + c.h + separacion,
    )
    if (!choca) puestas.push(c)
  }
  return new Set(puestas.map((p) => p.id))
}

/** Ancho aproximado en px de una etiqueta de 11 px (acotado: los nombres largos se recortan). */
export const anchoEtiquetaPx = (texto: string) => Math.min(texto.length * 6.1 + 14, 164)
