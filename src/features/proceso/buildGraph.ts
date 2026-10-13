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
import { ETIQUETA_PX } from './etiquetas'
import { grafoEstatico, idArista, type AristaEstatica } from './grafoEstatico'
import { COL_W, MANIJAS, NODE_H, NODE_W, ROW_H, type Punto2 } from './geometria'
import { alarmasPorEtapa, etapasSeleccionadas } from './resaltes'
import type { Ruteo } from './ruteo'

export { celdasDeEtapas, idArista } from './grafoEstatico'
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
export type AristaData = {
  tipo: Transicion['tipo']
  enRuta: boolean
  /** Centro de la etiqueta en el lienzo (elegido para no tapar nodos ni otras etiquetas). */
  etiqueta: Punto2 | null
}
export type ProcesoEdge = Edge<AristaData>

export interface OpcionesGrafo {
  mostrarSecundarias: boolean
  rutaActiva: string | null
  seleccion: Seleccion | null
  /** false con "reducir movimiento": la ruta activa no se anima. */
  animar?: boolean
}

interface EstiloArista {
  fase: Fase | undefined
  enRuta: boolean
  atenuada: boolean
  animar: boolean
}

function construirArista(a: AristaEstatica, r: Ruteo | undefined, etiqueta: Punto2 | null, e: EstiloArista): ProcesoEdge {
  const { t, secundaria } = a
  const color = e.enRuta ? 'var(--c-ruta)' : e.fase ? colorFase(e.fase) : 'var(--c-muted)'
  const edge: ProcesoEdge = {
    id: a.id,
    source: t.desde,
    target: t.hasta,
    sourceHandle: r?.sourceHandle ?? null,
    targetHandle: r?.targetHandle ?? null,
    type: 'smoothstep',
    data: { tipo: t.tipo, enRuta: e.enRuta, etiqueta },
    animated: e.enRuta && e.animar,
    selectable: false,
    focusable: false,
    deletable: false,
    reconnectable: false,
    className: e.atenuada ? 'opacity-20' : undefined,
    style: {
      stroke: color,
      strokeWidth: e.enRuta ? 3 : secundaria ? 1.2 : 1.6,
      strokeDasharray: secundaria && !e.enRuta ? '6 4' : undefined,
    },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: e.enRuta ? 14 : 16, height: e.enRuta ? 14 : 16 },
  }
  if (t.etiqueta) {
    edge.label = t.etiqueta
    edge.labelShowBg = true
    edge.labelBgPadding = [4, 2]
    edge.labelBgBorderRadius = 3
    edge.labelBgStyle = { fill: 'var(--c-surface)', fillOpacity: 0.92 }
    edge.labelStyle = {
      fontSize: ETIQUETA_PX,
      fill: t.tipo === 'clasificacion' || e.enRuta ? color : 'var(--c-muted)',
      fontWeight: t.tipo === 'clasificacion' ? 600 : 400,
    }
  }
  return edge
}

export function buildGraph(
  layout: PlantLayout,
  idx: LayoutIndex,
  live: LiveState | null,
  op: OpcionesGrafo,
): { nodes: ProcesoNode[]; edges: ProcesoEdge[] } {
  const est = grafoEstatico(layout)
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
      // La celda es el centro del nodo.
      position: { x: col * COL_W, y: fila * ROW_H },
      origin: [0.5, 0.5],
      width: NODE_W,
      height: NODE_H,
      // Tamaño y manijas declarados: React Flow no remide el nodo en cada actualización en vivo.
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
  for (const a of est.aristas) {
    if (a.secundaria && !op.mostrarSecundarias) continue
    const enRuta = aristasRuta.has(a.id)
    const edge = construirArista(a, est.ruteo.get(a.id), est.etiquetas.get(a.id) ?? null, {
      fase: fasePorEtapa.get(a.t.desde),
      enRuta,
      atenuada: ruta !== undefined && !enRuta,
      animar: op.animar !== false,
    })
    // Las aristas de la ruta se dibujan al final para quedar por encima de las atenuadas.
    if (enRuta) resaltadas.push(edge)
    else edges.push(edge)
  }
  return { nodes, edges: [...edges, ...resaltadas] }
}
