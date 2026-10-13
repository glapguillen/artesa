// Convierte plant-layout.json en un modelo de escena 3D (puro y testeable).
import { bbox, centroide } from '../../../domain/selectors'
import type { PlantLayout, Punto } from '../../../domain/types'
import { construirEquipos } from './equipos'
import { construirMuros } from './muros'
import type { Flujo3D, Limites, Losa3D, ModeloEscena, V2, V3 } from './tipos'

export { ajustarLargo, cantidadEquipo, distribuirEnRect, largoDisponible } from './equipos'
export { areaConSigno, construirMuros, tramos } from './muros'

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
