// Construye los nodos y aristas de React Flow del flujograma oficial a partir de plant-layout.json
// (proceso.etapas, proceso.transiciones, proceso.diagrama) y del estado en vivo. Función pura.
import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { EstadoOperativo, LiveState, NivelAlarma } from '../../domain/live'
import {
  aristasDeRuta,
  estadoDeEtapa,
  etapasDeRuta,
  ubicacionEtapa,
  type LayoutIndex,
} from '../../domain/selectors'
import type { Etapa, Fase, PlantLayout, Transicion, Ubicacion } from '../../domain/types'
import type { Seleccion } from '../../store/usePlantStore'
import { colorFase } from '../../ui/tokens'
import { COL_W, MANIJAS, NODE_H, NODE_W, ROW_H, rutear, type Punto2, type Ruteo } from './ruteo'

export { COL_W, ROW_H }

export type EtapaNodeData = {
  codigo: string
  nombre: string
  nombreCorto: string
  fase: Fase
  tipo: Etapa['tipo']
  controlPor: Etapa['control_por']
  estado: EstadoOperativo
  wip: number | null
  piezasH: number | null
  ubicacion: Ubicacion
  /** Nivel más grave de las alarmas que refieren a la etapa o a un equipo de la etapa. */
  alarma: NivelAlarma | null
  enRuta: boolean
  atenuado: boolean
  /** principal = etapa/equipo seleccionado o etapa confirmada de la zona; probable = hipótesis. */
  seleccion: 'principal' | 'probable' | null
}

export type BandaNodeData = { titulo: string; fase: Fase | null }

export type EtapaFlowNode = Node<EtapaNodeData, 'etapa'>
export type BandaFlowNode = Node<BandaNodeData, 'banda'>
export type ProcesoNode = EtapaFlowNode | BandaFlowNode
export type AristaData = { tipo: Transicion['tipo']; enRuta: boolean }
export type ProcesoEdge = Edge<AristaData>

export interface OpcionesGrafo {
  mostrarSecundarias: boolean
  rutaActiva: string | null
  seleccion: Seleccion | null
  /** false con "reducir movimiento": la ruta activa no se anima. */
  animar?: boolean
}

const SECUNDARIAS: ReadonlySet<Transicion['tipo']> = new Set(['insumo', 'registro', 'configuracion'])
const GRAVEDAD: Record<NivelAlarma, number> = { info: 1, advertencia: 2, critica: 3 }

export const idArista = (desde: string, hasta: string) => `${desde}->${hasta}`

/** Lo que solo depende del layout: celdas (con respaldo), bandas y ruteo. Se calcula una vez por layout. */
interface Estatico {
  celdas: Map<string, Punto2>
  bandas: BandaFlowNode[]
  aristas: Array<{ id: string; t: Transicion }>
  ruteo: Map<string, Ruteo>
}

const cache = new WeakMap<PlantLayout, Estatico>()

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

function estatico(l: PlantLayout): Estatico {
  const previo = cache.get(l)
  if (previo) return previo
  const celdas = celdasDeEtapas(l)
  const vistos = new Set<string>()
  const aristas: Estatico['aristas'] = []
  // Primero las principales: así se rutean igual con o sin las secundarias visibles.
  const orden = [...l.proceso.transiciones].sort(
    (a, b) => Number(SECUNDARIAS.has(a.tipo)) - Number(SECUNDARIAS.has(b.tipo)),
  )
  for (const t of orden) {
    if (!celdas.has(t.desde) || !celdas.has(t.hasta)) continue
    let id = idArista(t.desde, t.hasta)
    for (let n = 2; vistos.has(id); n++) id = `${idArista(t.desde, t.hasta)}#${n}`
    vistos.add(id)
    aristas.push({ id, t })
  }
  const centros = new Map<string, Punto2>()
  for (const [codigo, [col, fila]] of celdas) centros.set(codigo, [col * COL_W, fila * ROW_H])
  const ruteo = rutear(
    centros,
    aristas.map((a) => ({ id: a.id, desde: a.t.desde, hasta: a.t.hasta })),
  )
  const r: Estatico = { celdas, bandas: construirBandas(l, celdas), aristas, ruteo }
  cache.set(l, r)
  return r
}

function alarmasPorEtapa(idx: LayoutIndex, live: LiveState | null): Map<string, NivelAlarma> {
  const out = new Map<string, NivelAlarma>()
  const marcar = (codigo: string, nivel: NivelAlarma) => {
    const previo = out.get(codigo)
    if (!previo || GRAVEDAD[nivel] > GRAVEDAD[previo]) out.set(codigo, nivel)
  }
  for (const a of live?.alarmas ?? []) {
    if (a.ref?.tipo === 'etapa') marcar(a.ref.id, a.nivel)
    else if (a.ref?.tipo === 'equipo') {
      const eq = idx.equiposPorId.get(a.ref.id)
      if (eq) marcar(eq.etapa, a.nivel)
    }
  }
  return out
}

/** Etapas resaltadas por la selección (etapa, zona o equipo). */
function etapasSeleccionadas(idx: LayoutIndex, sel: Seleccion | null): Map<string, 'principal' | 'probable'> {
  const out = new Map<string, 'principal' | 'probable'>()
  if (!sel) return out
  if (sel.tipo === 'etapa') out.set(sel.id, 'principal')
  else if (sel.tipo === 'equipo') {
    const eq = idx.equiposPorId.get(sel.id)
    if (eq) out.set(eq.etapa, 'principal')
  } else {
    const z = idx.zonasPorId.get(sel.id)
    for (const c of z?.etapas_hipotesis ?? []) out.set(c, 'probable')
    for (const c of z?.etapas ?? []) out.set(c, 'principal')
  }
  return out
}

export function buildGraph(
  layout: PlantLayout,
  idx: LayoutIndex,
  live: LiveState | null,
  op: OpcionesGrafo,
): { nodes: ProcesoNode[]; edges: ProcesoEdge[] } {
  const est = estatico(layout)
  const ruta = op.rutaActiva ? layout.proceso.rutas_decoracion.find((r) => r.id === op.rutaActiva) : undefined
  const etapasRuta = new Set(ruta ? etapasDeRuta(layout, ruta.id) : [])
  const aristasRuta = new Set(ruta ? aristasDeRuta(layout, ruta.id).map(([d, h]) => idArista(d, h)) : [])
  const alarmas = alarmasPorEtapa(idx, live)
  const sel = etapasSeleccionadas(idx, op.seleccion)
  const fasePorEtapa = new Map(layout.proceso.etapas.map((e) => [e.codigo, e.fase]))

  const nodes: ProcesoNode[] = [...est.bandas]
  for (const e of layout.proceso.etapas) {
    const [col, fila] = est.celdas.get(e.codigo) ?? [0, 0]
    const vivo = live?.etapas[e.codigo]
    nodes.push({
      id: e.codigo,
      type: 'etapa',
      position: { x: col * COL_W, y: fila * ROW_H },
      origin: [0.5, 0.5],
      width: NODE_W,
      height: NODE_H,
      measured: { width: NODE_W, height: NODE_H },
      handles: MANIJAS,
      draggable: false,
      connectable: false,
      deletable: false,
      // El foco lo lleva el botón interno del nodo (role="button", Enter/Espacio).
      focusable: false,
      data: {
        codigo: e.codigo,
        nombre: e.nombre,
        nombreCorto: e.nombre_corto,
        fase: e.fase,
        tipo: e.tipo,
        controlPor: e.control_por,
        estado: estadoDeEtapa(live, e.codigo),
        wip: vivo?.wip ?? null,
        piezasH: vivo?.piezas_h ?? null,
        ubicacion: ubicacionEtapa(idx, e.codigo),
        alarma: alarmas.get(e.codigo) ?? null,
        enRuta: etapasRuta.has(e.codigo),
        atenuado: ruta !== undefined && !etapasRuta.has(e.codigo),
        seleccion: sel.get(e.codigo) ?? null,
      },
    })
  }

  const edges: ProcesoEdge[] = []
  const resaltadas: ProcesoEdge[] = []
  for (const { id, t } of est.aristas) {
    const secundaria = SECUNDARIAS.has(t.tipo)
    if (secundaria && !op.mostrarSecundarias) continue
    const enRuta = aristasRuta.has(id)
    const atenuada = ruta !== undefined && !enRuta
    const fase = fasePorEtapa.get(t.desde)
    const color = enRuta ? 'var(--c-ruta)' : fase ? colorFase(fase) : 'var(--c-muted)'
    const r = est.ruteo.get(id)
    const edge: ProcesoEdge = {
      id,
      source: t.desde,
      target: t.hasta,
      sourceHandle: r?.sourceHandle ?? null,
      targetHandle: r?.targetHandle ?? null,
      type: 'smoothstep',
      data: { tipo: t.tipo, enRuta },
      animated: enRuta && op.animar !== false,
      selectable: false,
      focusable: false,
      deletable: false,
      reconnectable: false,
      className: atenuada ? 'opacity-20' : undefined,
      style: {
        stroke: color,
        strokeWidth: enRuta ? 3 : secundaria ? 1.2 : 1.6,
        strokeDasharray: secundaria && !enRuta ? '6 4' : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: enRuta ? 14 : 16, height: enRuta ? 14 : 16 },
    }
    if (t.etiqueta) {
      edge.label = t.etiqueta
      edge.labelShowBg = true
      edge.labelBgPadding = [4, 2]
      edge.labelBgBorderRadius = 3
      edge.labelBgStyle = { fill: 'var(--c-surface)', fillOpacity: 0.92 }
      edge.labelStyle = {
        fontSize: 10,
        fill: t.tipo === 'clasificacion' || enRuta ? color : 'var(--c-muted)',
        fontWeight: t.tipo === 'clasificacion' ? 600 : 400,
      }
    }
    // Las aristas de la ruta se dibujan al final para quedar por encima de las atenuadas.
    if (enRuta) resaltadas.push(edge)
    else edges.push(edge)
  }
  return { nodes, edges: [...edges, ...resaltadas] }
}
