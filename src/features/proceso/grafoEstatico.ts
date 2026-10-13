// Parte del diagrama que solo depende del layout: celdas de las etapas (con respaldo), bandas,
// ruteo de las aristas y ubicación de sus etiquetas. Se calcula una vez por objeto de layout.
import type { PlantLayout, Transicion } from '../../domain/types'
import type { BandaFlowNode } from './buildGraph'
import { ubicarEtiquetas } from './etiquetas'
import { cajaNodo, COL_W, ROW_H, type Punto2 } from './geometria'
import { rutear, type Ruteo } from './ruteo'

export const SECUNDARIAS: ReadonlySet<Transicion['tipo']> = new Set(['insumo', 'registro', 'configuracion'])

export const idArista = (desde: string, hasta: string) => `${desde}->${hasta}`

export interface AristaEstatica {
  id: string
  t: Transicion
  secundaria: boolean
}

export interface GrafoEstatico {
  celdas: Map<string, Punto2>
  bandas: BandaFlowNode[]
  /** Principales primero y luego secundarias, cada grupo en el orden del JSON. */
  aristas: AristaEstatica[]
  ruteo: Map<string, Ruteo>
  /** Centro de la etiqueta de cada arista que la tiene (coordenadas del lienzo). */
  etiquetas: Map<string, Punto2>
}

/** Celda [col, fila] de cada etapa; las que no tienen celda van a la fila siguiente a la última, en orden. */
export function celdasDeEtapas(l: PlantLayout): Map<string, Punto2> {
  const definidas = l.proceso.diagrama.celdas
  const filas = l.proceso.etapas.flatMap((e) => (definidas[e.codigo] ? [definidas[e.codigo]![1]] : []))
  const filaRespaldo = filas.length ? Math.floor(Math.max(...filas)) + 1 : 0
  const out = new Map<string, Punto2>()
  let col = 0
  for (const e of l.proceso.etapas) out.set(e.codigo, definidas[e.codigo] ?? [col++, filaRespaldo])
  return out
}

function construirBandas(l: PlantLayout, celdas: Map<string, Punto2>): BandaFlowNode[] {
  const cols = [...celdas.values()].map((c) => c[0])
  const c1 = cols.length ? Math.min(...cols) : 0
  const c2 = cols.length ? Math.max(...cols) : 0
  return l.proceso.diagrama.bandas.map((b) => {
    const width = (c2 - c1 + 1) * COL_W
    const height = (b.filas[1] - b.filas[0] + 1.1) * ROW_H
    return {
      id: `banda-${b.id}`,
      type: 'banda',
      position: { x: (c1 - 0.5) * COL_W, y: (b.filas[0] - 0.55) * ROW_H },
      width,
      height,
      measured: { width, height },
      data: { titulo: b.titulo, fase: b.fases[0] ?? null },
      selectable: false,
      draggable: false,
      connectable: false,
      focusable: false,
      deletable: false,
      zIndex: -1,
      // Fondo puro: los clics y el arrastre pasan al lienzo.
      style: { pointerEvents: 'none' },
    }
  })
}

const cache = new WeakMap<PlantLayout, GrafoEstatico>()

export function grafoEstatico(l: PlantLayout): GrafoEstatico {
  const previo = cache.get(l)
  if (previo) return previo
  const celdas = celdasDeEtapas(l)
  const centros = new Map<string, Punto2>()
  for (const [codigo, [col, fila]] of celdas) centros.set(codigo, [col * COL_W, fila * ROW_H])

  const vistos = new Set<string>()
  const aristas: AristaEstatica[] = []
  for (const secundaria of [false, true]) {
    for (const t of l.proceso.transiciones) {
      if (SECUNDARIAS.has(t.tipo) !== secundaria || !celdas.has(t.desde) || !celdas.has(t.hasta)) continue
      let id = idArista(t.desde, t.hasta)
      for (let n = 2; vistos.has(id); n++) id = `${idArista(t.desde, t.hasta)}#${n}`
      vistos.add(id)
      aristas.push({ id, t, secundaria })
    }
  }
  // Las principales se rutean solas; las secundarias después, evitando a las principales. Así el
  // trazado de las principales no cambia al mostrar u ocultar las secundarias.
  const tramo = (a: AristaEstatica) => ({ id: a.id, desde: a.t.desde, hasta: a.t.hasta })
  const ruteo = rutear(centros, aristas.filter((a) => !a.secundaria).map(tramo))
  const fijos = [...ruteo.values()]
  for (const [id, r] of rutear(centros, aristas.filter((a) => a.secundaria).map(tramo), fijos)) ruteo.set(id, r)

  const etiquetas = ubicarEtiquetas(
    [...centros.values()].map((c) => cajaNodo(c)),
    aristas.flatMap((a) => {
      const r = ruteo.get(a.id)
      const s = centros.get(a.t.desde)
      const t = centros.get(a.t.hasta)
      if (!a.t.etiqueta || !r || !s || !t) return []
      return [{ id: a.id, etiqueta: a.t.etiqueta, pts: r.pts, s, t, secundaria: a.secundaria }]
    }),
    aristas.flatMap((a) => {
      const r = ruteo.get(a.id)
      return r ? [{ id: a.id, pts: r.pts, secundaria: a.secundaria }] : []
    }),
  )
  const r: GrafoEstatico = { celdas, bandas: construirBandas(l, celdas), aristas, ruteo, etiquetas }
  cache.set(l, r)
  return r
}
