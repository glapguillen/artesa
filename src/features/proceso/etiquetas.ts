// Ubicación de las etiquetas de las aristas: sobre su propio trazo y sin tapar nodos ni otras
// etiquetas. En aristas cortas entre nodos vecinos la etiqueta pasa encima (o debajo) del hueco.
import { NODE_H, type Caja, type Punto2 } from './geometria'

/** Tamaño de letra de las etiquetas (px del lienzo). */
export const ETIQUETA_PX = 10
const ALTO = ETIQUETA_PX + 4
const MARGEN = 2

/** Ancho aproximado de la etiqueta con su fondo (no hay DOM: estimación por caracteres). */
export const anchoEtiqueta = (texto: string) => texto.length * ETIQUETA_PX * 0.56 + 8

function puntoEn(pts: Punto2[], f: number): Punto2 {
  const largos = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i]![0], p[1] - pts[i]![1]))
  let resto = largos.reduce((a, b) => a + b, 0) * f
  for (let i = 0; i < largos.length; i++) {
    const l = largos[i]!
    if (resto <= l && l > 0) {
      const a = pts[i]!
      const b = pts[i + 1]!
      return [a[0] + ((b[0] - a[0]) * resto) / l, a[1] + ((b[1] - a[1]) * resto) / l]
    }
    resto -= l
  }
  return pts[pts.length - 1] ?? [0, 0]
}

const caja = (c: Punto2, w: number): Caja => ({
  x1: c[0] - w / 2 - MARGEN,
  y1: c[1] - ALTO / 2 - MARGEN,
  x2: c[0] + w / 2 + MARGEN,
  y2: c[1] + ALTO / 2 + MARGEN,
})

/** ¿El punto está sobre el trazo (polilínea) indicado? */
function sobreTrazo(p: Punto2, pts: Punto2[]): boolean {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, ay] = pts[i]!
    const [bx, by] = pts[i + 1]!
    const dx = bx - ax
    const dy = by - ay
    const l2 = dx * dx + dy * dy
    const f = l2 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2)) : 0
    if (Math.hypot(p[0] - (ax + f * dx), p[1] - (ay + f * dy)) < 1.5) return true
  }
  return false
}

/** Etiqueta sobre un tramo compartido: ambigua, pero menos grave que tapar un nodo. */
const COSTO_COMPARTIDO = 1000

const solape = (a: Caja, b: Caja) =>
  Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)) * Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1))

export interface AristaEtiquetada {
  id: string
  etiqueta: string
  pts: Punto2[]
  /** Centros de los nodos de origen y destino (para pasar por encima del hueco entre ambos). */
  s: Punto2
  t: Punto2
  /** Las etiquetas principales ignoran los trazos secundarios (no cambian al mostrarlos). */
  secundaria: boolean
}

export interface TrazoArista {
  id: string
  pts: Punto2[]
  secundaria: boolean
}

/**
 * Centro de cada etiqueta, en orden (las primeras tienen prioridad). Se prueba el medio del trazo,
 * otros puntos del trazo y, al final, encima/debajo del hueco entre los dos nodos; gana la primera
 * posición libre o, si no hay, la de menor costo. Se evita poner la etiqueta en un tramo que la
 * arista comparte con otra (p. ej. antes de una bifurcación), donde sería ambigua.
 */
export function ubicarEtiquetas(
  nodos: Caja[],
  aristas: AristaEtiquetada[],
  trazos: ReadonlyArray<TrazoArista> = [],
): Map<string, Punto2> {
  const out = new Map<string, Punto2>()
  const puestas: Caja[] = []
  for (const a of aristas) {
    if (a.pts.length < 2) continue
    const w = anchoEtiqueta(a.etiqueta)
    const medio = puntoEn(a.pts, 0.5)
    const arriba = Math.min(a.s[1], a.t[1]) - NODE_H / 2 - 4 - ALTO / 2
    const abajo = Math.max(a.s[1], a.t[1]) + NODE_H / 2 + 4 + ALTO / 2
    const posibles: Punto2[] = [
      ...[0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.9, 0.1].map((f) => puntoEn(a.pts, f)),
      [medio[0], arriba],
      [medio[0], abajo],
    ]
    let mejor: { p: Punto2; costo: number } | null = null
    for (const p of posibles) {
      const c = caja(p, w)
      const compartido = trazos.some(
        (o) => o.id !== a.id && (a.secundaria || !o.secundaria) && sobreTrazo(p, o.pts),
      )
      const costo = [...nodos, ...puestas].reduce((n, o) => n + solape(c, o), compartido ? COSTO_COMPARTIDO : 0)
      if (!mejor || costo < mejor.costo) mejor = { p, costo }
      if (costo === 0) break
    }
    if (mejor) {
      out.set(a.id, mejor.p)
      puestas.push(caja(mejor.p, w))
    }
  }
  return out
}
