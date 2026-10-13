// Geometría pura del plano 2D (sin React): viewBox, rectángulos de etiqueta, curvas, zoom y escala.
// Unidades del mundo = metros del layout. En el SVG, x = X del layout e y = Z del layout.
import type { Punto } from '../../domain/types'

export interface Caja {
  x: number
  y: number
  w: number
  h: number
}

export interface Tam {
  w: number
  h: number
}

/** Curva cuadrática de a hasta b con punto de control c. */
export interface Curva {
  a: Punto
  c: Punto
  b: Punto
}

const r2 = (n: number) => Math.round(n * 100) / 100
const limitarNum = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export function cajaDePuntos(puntos: Punto[]): Caja | null {
  if (puntos.length === 0) return null
  let x1 = Infinity
  let y1 = Infinity
  let x2 = -Infinity
  let y2 = -Infinity
  for (const [x, y] of puntos) {
    x1 = Math.min(x1, x)
    y1 = Math.min(y1, y)
    x2 = Math.max(x2, x)
    y2 = Math.max(y2, y)
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

/** viewBox que encierra todos los polígonos con un margen en metros. Sin polígonos: 100 × 100. */
export function viewBoxDe(poligonos: Punto[][], margen = 4): Caja {
  const c = cajaDePuntos(poligonos.flat())
  if (!c) return { x: 0, y: 0, w: 100, h: 100 }
  return { x: c.x - margen, y: c.y - margen, w: Math.max(c.w, 1) + 2 * margen, h: Math.max(c.h, 1) + 2 * margen }
}

export const textoViewBox = (v: Caja) => `${r2(v.x)} ${r2(v.y)} ${r2(v.w)} ${r2(v.h)}`

export const puntosSvg = (pol: Punto[]) => pol.map(([x, y]) => `${x},${y}`).join(' ')

/** Punto dentro del polígono (regla par-impar). */
export function puntoEnPoligono([px, py]: Punto, pol: Punto[]): boolean {
  let dentro = false
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const [xi, yi] = pol[i]!
    const [xj, yj] = pol[j]!
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}

/**
 * Mayor rectángulo alineado a los ejes dentro del polígono, buscado sobre la grilla de sus vértices.
 * Sirve para ubicar la etiqueta en zonas en L. Si no encuentra ninguno, devuelve el envolvente.
 */
export function rectInterior(pol: Punto[]): Caja {
  const env = cajaDePuntos(pol) ?? { x: 0, y: 0, w: 0, h: 0 }
  const xs = [...new Set(pol.map((p) => p[0]))].sort((a, b) => a - b)
  const ys = [...new Set(pol.map((p) => p[1]))].sort((a, b) => a - b)
  const nx = xs.length - 1
  const ny = ys.length - 1
  const dentro = (i: number, j: number) =>
    puntoEnPoligono([(xs[i]! + xs[i + 1]!) / 2, (ys[j]! + ys[j + 1]!) / 2], pol)
  const celdas = Array.from({ length: nx }, (_, i) => Array.from({ length: ny }, (_, j) => dentro(i, j)))
  let mejor: Caja | null = null
  let area = 0
  for (let i0 = 0; i0 < nx; i0++)
    for (let i1 = i0; i1 < nx; i1++)
      for (let j0 = 0; j0 < ny; j0++)
        for (let j1 = j0; j1 < ny; j1++) {
          let ok = true
          for (let i = i0; i <= i1 && ok; i++) for (let j = j0; j <= j1 && ok; j++) ok = celdas[i]![j]!
          if (!ok) continue
          const c = { x: xs[i0]!, y: ys[j0]!, w: xs[i1 + 1]! - xs[i0]!, h: ys[j1 + 1]! - ys[j0]! }
          if (c.w * c.h > area) {
            area = c.w * c.h
            mejor = c
          }
        }
  return mejor ?? env
}

/**
 * Curva entre dos puntos, combada hacia la izquierda del sentido de avance (así A→B y B→A no se
 * superponen) y recortada en los extremos para no tapar los centros de las zonas.
 */
export function curvaEntre(a: Punto, b: Punto, curvatura = 0.18, recorte = 3): Curva | null {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const largo = Math.hypot(dx, dy)
  if (largo < 1e-6) return null
  const ux = dx / largo
  const uy = dy / largo
  const r = Math.min(recorte, largo * 0.2)
  const mx = (a[0] + b[0]) / 2
  const my = (a[1] + b[1]) / 2
  return {
    a: [a[0] + ux * r, a[1] + uy * r],
    c: [mx + uy * largo * curvatura, my - ux * largo * curvatura],
    b: [b[0] - ux * r, b[1] - uy * r],
  }
}

/** Ángulo (grados) de la tangente al final de la curva, para orientar la punta de flecha. */
export function anguloFinal(c: Curva): number {
  return (Math.atan2(c.b[1] - c.c[1], c.b[0] - c.c[0]) * 180) / Math.PI
}

/** Acorta el final de la curva una distancia d (la punta de flecha tapa ese tramo). */
export function acortarFinal(c: Curva, d: number): Curva {
  const dx = c.b[0] - c.c[0]
  const dy = c.b[1] - c.c[1]
  const l = Math.hypot(dx, dy)
  if (l < 1e-6) return c
  const t = Math.min(d, l * 0.5) / l
  return { a: c.a, c: c.c, b: [c.b[0] - dx * t, c.b[1] - dy * t] }
}

export const pathCurva = (c: Curva) =>
  `M${r2(c.a[0])} ${r2(c.a[1])}Q${r2(c.c[0])} ${r2(c.c[1])} ${r2(c.b[0])} ${r2(c.b[1])}`

export const pathPolilinea = (ps: Punto[]) =>
  ps.map(([x, y], i) => `${i ? 'L' : 'M'}${r2(x)} ${r2(y)}`).join('')

/** Píxeles por metro con preserveAspectRatio="xMidYMid meet". 0 si el contenedor aún no mide. */
export function escalaMeet(vb: Caja, t: Tam): number {
  if (t.w <= 0 || t.h <= 0 || vb.w <= 0 || vb.h <= 0) return 0
  return Math.min(t.w / vb.w, t.h / vb.h)
}

/** Convierte un punto en píxeles del contenedor a metros del mundo (meet, centrado). */
export function pantallaAMundo(px: number, py: number, vb: Caja, t: Tam): Punto {
  const s = escalaMeet(vb, t)
  if (!s) return [vb.x + vb.w / 2, vb.y + vb.h / 2]
  const ox = (t.w - vb.w * s) / 2
  const oy = (t.h - vb.h * s) / 2
  return [vb.x + (px - ox) / s, vb.y + (py - oy) / s]
}

/** Mantiene la vista dentro del encuadre base (no se puede alejar más allá ni salirse). */
export function limitarVista(vb: Caja, base: Caja): Caja {
  const w = Math.min(vb.w, base.w)
  const h = Math.min(vb.h, base.h)
  return {
    x: limitarNum(vb.x, base.x, base.x + base.w - w),
    y: limitarNum(vb.y, base.y, base.y + base.h - h),
    w,
    h,
  }
}

/** Zoom de factor f (>1 acerca) dejando fijo el punto `centro` del mundo. */
export function zoomEn(vb: Caja, factor: number, centro: Punto, base: Caja, maxZoom = 10): Caja {
  const w = limitarNum(vb.w / factor, base.w / maxZoom, base.w)
  const f = vb.w / w
  const h = vb.h / f
  return limitarVista({ x: centro[0] - (centro[0] - vb.x) / f, y: centro[1] - (centro[1] - vb.y) / f, w, h }, base)
}

export function desplazarVista(vb: Caja, dx: number, dy: number, base: Caja): Caja {
  return limitarVista({ ...vb, x: vb.x + dx, y: vb.y + dy }, base)
}

const PASOS_ESCALA = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500]

/** Barra de escala "redonda" de unos `objetivoPx` píxeles para k píxeles por metro. */
export function escalaBonita(k: number, objetivoPx = 90): { metros: number; px: number } {
  const objetivo = k > 0 ? objetivoPx / k : PASOS_ESCALA[3]!
  let metros = PASOS_ESCALA[0]!
  for (const p of PASOS_ESCALA) if (p <= objetivo) metros = p
  return { metros, px: metros * k }
}
