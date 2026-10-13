import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { LiveState } from '../../domain/live'
import { indexarLayout } from '../../domain/selectors'
import type { PlantLayout } from '../../domain/types'
import { validarLayout } from '../../domain/validate'
import { colorFase } from '../../ui/tokens'
import {
  buildGraph,
  COL_W,
  ROW_H,
  type EtapaFlowNode,
  type OpcionesGrafo,
  type ProcesoEdge,
  type ProcesoNode,
} from './buildGraph'
import { anchoEtiqueta } from './etiquetas'
import { cajaNodo, cruzaCaja, polilinea, type Lado, type Punto2 } from './geometria'

const raw: unknown = JSON.parse(readFileSync(new URL('../../../public/plant-layout.json', import.meta.url), 'utf-8'))

function cargar(mod?: (l: PlantLayout) => void): PlantLayout {
  const r = validarLayout(structuredClone(raw))
  if (!r.ok) throw new Error(r.errores.join('\n'))
  mod?.(r.layout)
  return r.layout
}

const BASE: OpcionesGrafo = { mostrarSecundarias: false, rutaActiva: null, seleccion: null }
const etapas = (ns: ProcesoNode[]) => ns.filter((n): n is EtapaFlowNode => n.type === 'etapa')
const porId = (ns: ProcesoNode[], id: string) => etapas(ns).find((n) => n.id === id)

describe('buildGraph', () => {
  const l = cargar()
  const idx = indexarLayout(l)

  it('crea 35 nodos de etapa (id = código) y 4 bandas', () => {
    const { nodes } = buildGraph(l, idx, null, BASE)
    expect(etapas(nodes)).toHaveLength(35)
    expect(etapas(nodes).map((n) => n.id)).toEqual(l.proceso.etapas.map((e) => e.codigo))
    const bandas = nodes.filter((n) => n.type === 'banda')
    expect(bandas.map((n) => n.id)).toEqual(['banda-stocks', 'banda-F1', 'banda-F2', 'banda-F3'])
    for (const b of bandas) {
      expect(b.selectable).toBe(false)
      expect(b.draggable).toBe(false)
      expect(b.zIndex).toBeLessThan(0)
    }
  })

  it('ubica cada etapa en su celda [col, fila] y las bandas abarcan sus filas', () => {
    const { nodes } = buildGraph(l, idx, null, BASE)
    expect(porId(nodes, '1.4')?.position).toEqual({ x: 3 * COL_W, y: 5 * ROW_H })
    expect(porId(nodes, 'B5')?.position).toEqual({ x: 3 * COL_W, y: 2.5 * ROW_H })
    const f1 = nodes.find((n) => n.id === 'banda-F1')!
    expect(f1.position.y).toBeCloseTo((5 - 0.55) * ROW_H)
    expect(f1.height).toBeCloseTo((6.2 - 5 + 1.1) * ROW_H)
    expect(f1.position.x).toBe(-0.5 * COL_W)
    expect(f1.width).toBe(8 * COL_W)
  })

  it('da una posición de respaldo a una etapa sin celda (fila siguiente a la última, en orden)', () => {
    const mod = cargar((x) => {
      delete x.proceso.diagrama.celdas['3.8']
      delete x.proceso.diagrama.celdas['V']
    })
    const { nodes, edges } = buildGraph(mod, indexarLayout(mod), null, BASE)
    expect(porId(nodes, '3.8')?.position).toEqual({ x: 0, y: 15 * ROW_H })
    expect(porId(nodes, 'V')?.position).toEqual({ x: COL_W, y: 15 * ROW_H })
    expect(edges.some((e) => e.id === '3.6->V')).toBe(true)
  })

  it('muestra las aristas secundarias solo si se pide', () => {
    const sin = buildGraph(l, idx, null, BASE).edges
    const con = buildGraph(l, idx, null, { ...BASE, mostrarSecundarias: true }).edges
    expect(sin).toHaveLength(37)
    expect(con).toHaveLength(48)
    expect(con).toHaveLength(l.proceso.transiciones.length)
    expect(sin.every((e) => e.data?.tipo === 'flujo' || e.data?.tipo === 'clasificacion')).toBe(true)
    const insumo = con.find((e) => e.id === 'A3->2.3')!
    expect(insumo.style?.strokeDasharray).toBeTruthy()
    expect(con.find((e) => e.id === '1.1->1.2')!.style?.strokeDasharray).toBeUndefined()
  })

  it('usa ids estables "desde->hasta", color de la fase de origen, flecha y etiquetas', () => {
    const { edges } = buildGraph(l, idx, null, { ...BASE, mostrarSecundarias: true })
    expect(new Set(edges.map((e) => e.id)).size).toBe(edges.length)
    const e = edges.find((x) => x.id === '1.7->1.8')!
    expect(e.source).toBe('1.7')
    expect(e.target).toBe('1.8')
    expect(e.type).toBe('smoothstep')
    expect(e.style?.stroke).toBe(colorFase('F1'))
    expect(e.label).toBe('buena')
    expect(e.markerEnd).toMatchObject({ type: 'arrowclosed', color: colorFase('F1') })
    expect(edges.find((x) => x.id === 'N0->B2')!.style?.stroke).toBe(colorFase('nivel_0'))
    expect(edges.find((x) => x.id === '1.1->1.2')!.label).toBeUndefined()
  })

  it('R7 resalta exactamente sus 5 aristas (incluye 2.5→2.3) y atenúa el resto', () => {
    const { nodes, edges } = buildGraph(l, idx, null, { ...BASE, rutaActiva: 'R7' })
    const resaltadas = edges.filter((e) => e.data?.enRuta)
    expect(resaltadas.map((e) => e.id).sort()).toEqual(['2.0->2.3', '2.3->2.4', '2.3->2.6', '2.4->2.5', '2.5->2.3'])
    for (const e of resaltadas) {
      expect(e.style?.stroke).toBe('var(--c-ruta)')
      expect(e.animated).toBe(true)
      expect(e.className).toBeUndefined()
    }
    for (const e of edges.filter((x) => !x.data?.enRuta)) expect(e.className).toBe('opacity-20')
    const enRuta = etapas(nodes).filter((n) => n.data.enRuta).map((n) => n.id)
    expect(enRuta.sort()).toEqual(['2.0', '2.3', '2.4', '2.5', '2.6'])
    expect(porId(nodes, '1.1')?.data.atenuado).toBe(true)
    expect(porId(nodes, '2.5')?.data.atenuado).toBe(false)
    expect(buildGraph(l, idx, null, { ...BASE, rutaActiva: 'R7', animar: false }).edges.some((e) => e.animated)).toBe(
      false,
    )
  })

  it('sin ruta activa (o ruta desconocida) no atenúa nada', () => {
    for (const rutaActiva of [null, 'R99']) {
      const { nodes, edges } = buildGraph(l, idx, null, { ...BASE, rutaActiva })
      expect(etapas(nodes).some((n) => n.data.atenuado || n.data.enRuta)).toBe(false)
      expect(edges.some((e) => e.className || e.data?.enRuta)).toBe(false)
    }
  })

  it('sincroniza la selección: etapa, zona (confirmadas y probables) y equipo', () => {
    const sel = (s: OpcionesGrafo['seleccion']) =>
      Object.fromEntries(
        etapas(buildGraph(l, idx, null, { ...BASE, seleccion: s }).nodes)
          .filter((n) => n.data.seleccion)
          .map((n) => [n.id, n.data.seleccion]),
      )
    expect(sel({ tipo: 'etapa', id: '2.3' })).toEqual({ '2.3': 'principal' })
    expect(sel({ tipo: 'zona', id: 'z-horno' })).toEqual({ '1.5': 'principal', '3.1': 'principal', '3.5': 'probable' })
    expect(sel({ tipo: 'zona', id: 'z-trazado' })).toEqual({ '2.2': 'principal', '2.1': 'probable' })
    expect(sel({ tipo: 'equipo', id: 'horno-02' })).toEqual({ '1.5': 'principal' })
    expect(sel({ tipo: 'zona', id: 'no-existe' })).toEqual({})
    expect(sel(null)).toEqual({})
  })

  it('toma estado, WIP y alarmas del estado en vivo; un código sin datos queda en "sin_datos"', () => {
    const live = {
      etapas: { '1.4': { estado: 'espera', wip: 320, piezas_h: null, merma_pct: null } },
      alarmas: [
        { id: 'a1', nivel: 'critica', mensaje: '', ref: { tipo: 'equipo', id: 'horno-02' }, desde: '' },
        { id: 'a2', nivel: 'info', mensaje: '', ref: { tipo: 'etapa', id: '1.5' }, desde: '' },
        { id: 'a3', nivel: 'advertencia', mensaje: '', ref: { tipo: 'equipo', id: 'no-existe' }, desde: '' },
        { id: 'a4', nivel: 'info', mensaje: '', ref: null, desde: '' },
      ],
    } as unknown as LiveState
    const { nodes } = buildGraph(l, idx, live, BASE)
    expect(porId(nodes, '1.4')?.data).toMatchObject({ estado: 'espera', wip: 320, piezasH: null })
    expect(porId(nodes, '1.5')?.data.alarma).toBe('critica')
    expect(porId(nodes, 'V')?.data).toMatchObject({ estado: 'sin_datos', wip: null, alarma: null })
    expect(etapas(buildGraph(l, idx, null, BASE).nodes).every((n) => n.data.estado === 'sin_datos')).toBe(true)
  })

  it('rutea las aristas principales sin atravesar otros nodos', () => {
    const { nodes, edges } = buildGraph(l, idx, null, BASE)
    const centro = (n: ProcesoNode): Punto2 => [n.position.x, n.position.y]
    const lado = (h: string | null | undefined) => (h ?? '').slice(2) as Lado
    const choques = (e: ProcesoEdge) => {
      const pts = polilinea(centro(porId(nodes, e.source)!), lado(e.sourceHandle), centro(porId(nodes, e.target)!), lado(e.targetHandle))
      return etapas(nodes)
        .filter((n) => n.id !== e.source && n.id !== e.target)
        .filter((n) => pts.some((p, i) => i + 1 < pts.length && cruzaCaja(p, pts[i + 1]!, cajaNodo(centro(n)))))
        .map((n) => `${e.id} cruza ${n.id}`)
    }
    expect(edges.every((e) => e.sourceHandle?.startsWith('s-') && e.targetHandle?.startsWith('t-'))).toBe(true)
    expect(edges.flatMap(choques)).toEqual([])
  })

  it('ubica las etiquetas sin tapar nodos ni otras etiquetas', () => {
    const { nodes, edges } = buildGraph(l, idx, null, { ...BASE, mostrarSecundarias: true })
    const conEtiqueta = edges.filter((e) => typeof e.label === 'string')
    expect(conEtiqueta.length).toBe(l.proceso.transiciones.filter((t) => t.etiqueta).length)
    const cajas = conEtiqueta.map((e) => {
      const [x, y] = e.data!.etiqueta!
      const w = anchoEtiqueta(String(e.label))
      return { id: e.id, x1: x - w / 2, x2: x + w / 2, y1: y - 7, y2: y + 7 }
    })
    const solapa = (a: { x1: number; x2: number; y1: number; y2: number }, b: typeof a) =>
      a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2
    const problemas: string[] = []
    for (const [i, c] of cajas.entries()) {
      for (const n of etapas(nodes)) if (solapa(c, cajaNodo([n.position.x, n.position.y]))) problemas.push(`${c.id} tapa ${n.id}`)
      for (const o of cajas.slice(i + 1)) if (solapa(c, o)) problemas.push(`${c.id} tapa ${o.id}`)
    }
    expect(problemas).toEqual([])
  })
})
