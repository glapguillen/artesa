// Geometría de trazos (puro, sin three.js): longitudes, puntos a lo largo de una polilínea y un
// generador de tubos que junta varios trazos en UNA geometría (un solo draw call para todos los
// flujos o para la ruta). Cada vértice lleva su color, su distancia a lo largo del trazo (para
// animar guiones) y su estilo (alfa, discontinuo).
import type { V3 } from '../modelo/tipos'

/** Distancias acumuladas desde el primer punto. */
export function acumuladas(puntos: readonly V3[]): number[] {
  const out = [0]
  for (let i = 1; i < puntos.length; i++) {
    const a = puntos[i - 1]!
    const b = puntos[i]!
    out.push(out[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]))
  }
  return out
}

const mezclar = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/** Punto a la fracción t (0–1) del largo de la polilínea. */
export function puntoEn(puntos: readonly V3[], t: number, acum = acumuladas(puntos)): V3 {
  if (!puntos.length) return [0, 0, 0]
  const total = acum[acum.length - 1] ?? 0
  if (puntos.length === 1 || total <= 0) return puntos[0]!
  const d = Math.min(1, Math.max(0, t)) * total
  let i = 1
  while (i < acum.length - 1 && acum[i]! < d) i++
  const d0 = acum[i - 1]!
  const seg = acum[i]! - d0 || 1
  return mezclar(puntos[i - 1]!, puntos[i]!, (d - d0) / seg)
}

/** Dirección unitaria del último tramo (hacia dónde apunta la flecha final). */
export function direccionFinal(puntos: readonly V3[]): V3 {
  const n = puntos.length
  if (n < 2) return [1, 0, 0]
  const a = puntos[n - 2]!
  const b = puntos[n - 1]!
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1
  return [(b[0] - a[0]) / L, (b[1] - a[1]) / L, (b[2] - a[2]) / L]
}

/** Quita `d` metros del final (para que el tubo termine donde empieza la punta de flecha). */
export function acortarFinal(puntos: readonly V3[], d: number): V3[] {
  const acum = acumuladas(puntos)
  const total = acum[acum.length - 1] ?? 0
  if (puntos.length < 2 || d <= 0 || total <= d) return [...puntos]
  const corte = total - d
  const out: V3[] = []
  for (let i = 0; i < puntos.length; i++) {
    if (acum[i]! < corte) out.push(puntos[i]!)
    else {
      out.push(puntoEn(puntos, corte / total, acum))
      break
    }
  }
  return out
}

export interface Trazo {
  puntos: readonly V3[]
  radio: number
  /** Color lineal [r, g, b] (0–1). */
  color: V3
  alfa: number
  discontinuo: boolean
}

export interface GeometriaTubos {
  posiciones: Float32Array
  colores: Float32Array
  /** Distancia (m) de cada vértice desde el inicio de su trazo. */
  distancias: Float32Array
  /** [alfa, discontinuo (0/1)] por vértice. */
  estilos: Float32Array
  indices: Uint32Array
}

function normalizar(v: V3): V3 {
  const L = Math.hypot(v[0], v[1], v[2]) || 1
  return [v[0] / L, v[1] / L, v[2] / L]
}

const cruz = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/**
 * Tubos de sección poligonal (`lados` vértices por anillo) a lo largo de cada trazo. El marco de
 * cada anillo usa la horizontal perpendicular a la tangente, estable para arcos en un plano vertical
 * y para recorridos horizontales.
 */
export function construirTubos(trazos: readonly Trazo[], lados = 6): GeometriaTubos {
  const validos = trazos.filter((t) => t.puntos.length >= 2)
  const nV = validos.reduce((n, t) => n + t.puntos.length * lados, 0)
  const nI = validos.reduce((n, t) => n + (t.puntos.length - 1) * lados * 6, 0)
  const g: GeometriaTubos = {
    posiciones: new Float32Array(nV * 3),
    colores: new Float32Array(nV * 3),
    distancias: new Float32Array(nV),
    estilos: new Float32Array(nV * 2),
    indices: new Uint32Array(nI),
  }
  let v = 0
  let k = 0
  for (const t of validos) {
    const acum = acumuladas(t.puntos)
    const base = v
    t.puntos.forEach((p, i) => {
      const a = t.puntos[Math.max(0, i - 1)]!
      const b = t.puntos[Math.min(t.puntos.length - 1, i + 1)]!
      const tan = normalizar([b[0] - a[0], b[1] - a[1], b[2] - a[2]])
      let n = cruz(tan, [0, 1, 0])
      if (Math.hypot(n[0], n[1], n[2]) < 1e-6) n = [1, 0, 0]
      n = normalizar(n)
      const bi = normalizar(cruz(n, tan))
      for (let j = 0; j < lados; j++) {
        const ang = (j / lados) * Math.PI * 2
        const c = Math.cos(ang) * t.radio
        const s = Math.sin(ang) * t.radio
        g.posiciones.set([p[0] + n[0] * c + bi[0] * s, p[1] + n[1] * c + bi[1] * s, p[2] + n[2] * c + bi[2] * s], v * 3)
        g.colores.set(t.color, v * 3)
        g.distancias[v] = acum[i]!
        g.estilos.set([t.alfa, t.discontinuo ? 1 : 0], v * 2)
        v++
      }
    })
    for (let i = 0; i + 1 < t.puntos.length; i++) {
      for (let j = 0; j < lados; j++) {
        const a = base + i * lados + j
        const b = base + i * lados + ((j + 1) % lados)
        const c = a + lados
        const d = b + lados
        g.indices.set([a, c, b, b, c, d], k)
        k += 6
      }
    }
  }
  return g
}
