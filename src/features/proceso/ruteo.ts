// Geometría del diagrama de proceso: grilla de celdas, manijas fijas de los nodos y elección del
// lado de salida/llegada de cada arista para que el trazo "smoothstep" no pase por detrás de otros
// nodos. Funciones puras (se prueban en node, sin DOM).
import { getSmoothStepPath, Position, type NodeHandle } from '@xyflow/react'

/** Separación entre columnas y filas de la grilla (px del lienzo). */
export const COL_W = 240
export const ROW_H = 110
/** Tamaño fijo de un nodo de etapa (cabe en una celda con margen). */
export const NODE_W = 196
export const NODE_H = 78

export type Lado = 'top' | 'right' | 'bottom' | 'left'
export type Punto2 = [number, number]
export interface Caja {
  x1: number
  y1: number
  x2: number
  y2: number
}

const LADOS: Lado[] = ['right', 'left', 'bottom', 'top']
const POSICION: Record<Lado, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
}

export const idManija = (tipo: 'source' | 'target', lado: Lado) => `${tipo === 'source' ? 's' : 't'}-${lado}`

/** Punto de cada manija relativo a la esquina superior izquierda del nodo (manija de 1×1 px). */
function manijaRelativa(lado: Lado): Punto2 {
  switch (lado) {
    case 'right':
      return [NODE_W - 0.5, NODE_H / 2 - 0.5]
    case 'left':
      return [-0.5, NODE_H / 2 - 0.5]
    case 'top':
      return [NODE_W / 2 - 0.5, -0.5]
    case 'bottom':
      return [NODE_W / 2 - 0.5, NODE_H - 0.5]
  }
}

/** Manijas declaradas en el nodo: React Flow no necesita medirlas en el DOM en cada actualización. */
export const MANIJAS: NodeHandle[] = LADOS.flatMap((lado) =>
  (['source', 'target'] as const).map((type) => {
    const [x, y] = manijaRelativa(lado)
    return { id: idManija(type, lado), type, position: POSICION[lado], x, y, width: 1, height: 1 }
  }),
)

/** Extremo de la arista en el lado indicado de un nodo centrado en c. */
function extremo(c: Punto2, lado: Lado): Punto2 {
  const [rx, ry] = manijaRelativa(lado)
  const x = c[0] - NODE_W / 2 + rx
  const y = c[1] - NODE_H / 2 + ry
  // Igual que getHandlePosition de React Flow: borde exterior de la manija.
  if (lado === 'right') return [x + 1, y + 0.5]
  if (lado === 'left') return [x, y + 0.5]
  if (lado === 'bottom') return [x + 0.5, y + 1]
  return [x + 0.5, y]
}

export function cajaNodo(c: Punto2, margen = 0): Caja {
  return {
    x1: c[0] - NODE_W / 2 - margen,
    y1: c[1] - NODE_H / 2 - margen,
    x2: c[0] + NODE_W / 2 + margen,
    y2: c[1] + NODE_H / 2 + margen,
  }
}

/** Polilínea del trazo smoothstep (las curvas se aproximan por su esquina). */
export function polilinea(s: Punto2, ls: Lado, t: Punto2, lt: Lado): Punto2[] {
  const [sx, sy] = extremo(s, ls)
  const [tx, ty] = extremo(t, lt)
  const [d] = getSmoothStepPath({
    sourceX: sx,
    sourceY: sy,
    sourcePosition: POSICION[ls],
    targetX: tx,
    targetY: ty,
    targetPosition: POSICION[lt],
  })
  const nums = (d.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi) ?? []).map(Number)
  const out: Punto2[] = []
  for (let i = 0; i + 1 < nums.length; i += 2) out.push([nums[i]!, nums[i + 1]!])
  return out
}

/** ¿El segmento a-b toca la caja? (recorte de Liang-Barsky). */
export function cruzaCaja(a: Punto2, b: Punto2, c: Caja): boolean {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  let t0 = 0
  let t1 = 1
  const lim: Array<[number, number]> = [
    [-dx, a[0] - c.x1],
    [dx, c.x2 - a[0]],
    [-dy, a[1] - c.y1],
    [dy, c.y2 - a[1]],
  ]
  for (const [p, q] of lim) {
    if (p === 0) {
      if (q < 0) return false
    } else {
      const r = q / p
      if (p < 0) t0 = Math.max(t0, r)
      else t1 = Math.min(t1, r)
      if (t0 > t1) return false
    }
  }
  return true
}

function longitud(pts: Punto2[]): number {
  let n = 0
  for (let i = 0; i + 1 < pts.length; i++) n += Math.abs(pts[i + 1]![0] - pts[i]![0]) + Math.abs(pts[i + 1]![1] - pts[i]![1])
  return n
}

/** Largo en que dos segmentos colineales (horizontales o verticales) se superponen. */
function superposicion(a1: Punto2, a2: Punto2, b1: Punto2, b2: Punto2): number {
  const tramo = (p: number, q: number, r: number, s: number) =>
    Math.max(0, Math.min(Math.max(p, q), Math.max(r, s)) - Math.max(Math.min(p, q), Math.min(r, s)))
  if (Math.abs(a1[1] - a2[1]) < 0.5 && Math.abs(b1[1] - b2[1]) < 0.5 && Math.abs(a1[1] - b1[1]) < 2)
    return tramo(a1[0], a2[0], b1[0], b2[0])
  if (Math.abs(a1[0] - a2[0]) < 0.5 && Math.abs(b1[0] - b2[0]) < 0.5 && Math.abs(a1[0] - b1[0]) < 2)
    return tramo(a1[1], a2[1], b1[1], b2[1])
  return 0
}

const COSTO_CHOQUE = 2000
const COSTO_CURVA = 40
const COSTO_SUPERPOSICION = 2

export interface Ruteo {
  sourceHandle: string
  targetHandle: string
}

/**
 * Elige, para cada arista y en orden, el par de lados que minimiza: nodos atravesados, largo,
 * curvas y tramos superpuestos con las aristas ya ruteadas. Determinista.
 */
export function rutear(
  centros: ReadonlyMap<string, Punto2>,
  aristas: ReadonlyArray<{ id: string; desde: string; hasta: string }>,
): Map<string, Ruteo> {
  const out = new Map<string, Ruteo>()
  const trazados: Punto2[][] = []
  for (const a of aristas) {
    const s = centros.get(a.desde)
    const t = centros.get(a.hasta)
    if (!s || !t) continue
    const obstaculos: Caja[] = []
    for (const [id, c] of centros) {
      if (id === a.desde || id === a.hasta) obstaculos.push(cajaNodo(c, -3))
      else obstaculos.push(cajaNodo(c, 4))
    }
    let mejor: { costo: number; ls: Lado; lt: Lado; pts: Punto2[] } | null = null
    for (const ls of LADOS) {
      for (const lt of LADOS) {
        const pts = polilinea(s, ls, t, lt)
        let choques = 0
        for (const caja of obstaculos) {
          for (let i = 0; i + 1 < pts.length; i++) {
            if (cruzaCaja(pts[i]!, pts[i + 1]!, caja)) {
              choques++
              break
            }
          }
        }
        let sup = 0
        for (const otro of trazados) {
          for (let i = 0; i + 1 < pts.length; i++) {
            for (let j = 0; j + 1 < otro.length; j++) sup += superposicion(pts[i]!, pts[i + 1]!, otro[j]!, otro[j + 1]!)
          }
        }
        const curvas = Math.max(0, pts.length - 2) / 3
        const costo = choques * COSTO_CHOQUE + longitud(pts) + curvas * COSTO_CURVA + sup * COSTO_SUPERPOSICION
        if (!mejor || costo < mejor.costo - 1e-6) mejor = { costo, ls, lt, pts }
      }
    }
    if (mejor) {
      out.set(a.id, { sourceHandle: idManija('source', mejor.ls), targetHandle: idManija('target', mejor.lt) })
      trazados.push(mejor.pts)
    }
  }
  return out
}
