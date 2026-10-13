// Geometría de polígonos y muros (tramos de edificio y tabiques en corte).
import type { PlantLayout, Punto } from '../../../domain/types'
import { ALTO_MURO_EDIFICIO, ALTO_TABIQUE, GROSOR_MURO_EDIFICIO, GROSOR_TABIQUE } from './catalogo'
import type { Muro3D, V2 } from './tipos'

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
