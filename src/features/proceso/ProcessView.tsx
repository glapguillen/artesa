// Vista de proceso: el flujograma oficial (React Flow) generado desde plant-layout.json, con el
// estado en vivo, la ruta de decoración activa y la selección sincronizada con el plano.
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeTypes,
  type NodeMouseHandler,
  type NodeTypes,
  type OnMove,
} from '@xyflow/react'
import { useCallback, useRef, useState } from 'react'
import type { LayoutIndex } from '../../domain/selectors'
import type { PlantLayout } from '../../domain/types'
import { usePlantStore } from '../../store/usePlantStore'
import { colorFase } from '../../ui/tokens'
import { AristaProceso } from './AristaProceso'
import { BandaNode } from './BandaNode'
import type { ProcesoEdge, ProcesoNode } from './buildGraph'
import { EtapaNode } from './EtapaNode'
import { ARIA_FLUJO, COLOR_MODE, ENCUADRE, ESTILO_FLUJO, PRO_OPTIONS } from './flowTema'
import { useEncuadreAlMostrar, useGrafoProceso, useMediaQuery } from './hooks'
import { ProcessHeader } from './ProcessHeader'

// contain:inline-size → el lienzo nunca ensancha la grilla de la página (sin scroll horizontal).
const TARJETA =
  'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-borde bg-surface [contain:inline-size]'

const NODE_TYPES: NodeTypes = { etapa: EtapaNode, banda: BandaNode }
// Reemplaza la "smoothstep" incorporada: mismo trazo, etiqueta en la posición calculada.
const EDGE_TYPES: EdgeTypes = { smoothstep: AristaProceso }

const colorMinimapa = (n: ProcesoNode) =>
  n.type === 'etapa'
    ? colorFase(n.data.fase)
    : `color-mix(in srgb, ${n.data.fase ? colorFase(n.data.fase) : 'var(--c-muted)'} 10%, transparent)`

function Diagrama({ layout, idx }: { layout: PlantLayout; idx: LayoutIndex }) {
  const { nodes, edges } = useGrafoProceso(layout, idx)
  const seleccionar = usePlantStore((s) => s.seleccionar)
  const tema = usePlantStore((s) => s.tema)
  const ancho = useMediaQuery('(min-width: 1024px)')
  const { fitView } = useReactFlow<ProcesoNode, ProcesoEdge>()
  // true si el usuario movió o acercó el diagrama: entonces un cambio de tamaño no lo reencuadra.
  const movidoAMano = useRef(false)
  // Lo mismo como estado: el minimapa solo se muestra mientras se explora el diagrama ampliado
  // (encuadrado ya se ve entero, y el minimapa taparía nodos de la esquina superior derecha).
  const [explorando, setExplorando] = useState(false)
  const marcar = useCallback((movido: boolean) => {
    movidoAMano.current = movido
    setExplorando(movido)
  }, [])
  const encuadrar = useCallback(() => {
    marcar(false)
    void fitView({ ...ENCUADRE, duration: 250 })
  }, [fitView, marcar])
  const marcarMovido = useCallback(() => marcar(true), [marcar])
  const desmarcarMovido = useCallback(() => marcar(false), [marcar])
  // onMove solo llega cuando el encuadre cambia de verdad (un clic sin arrastre no cuenta); con
  // evento = gesto del usuario, sin evento = encuadre programático.
  const onMove = useCallback<OnMove>(
    (evento) => {
      if (evento) marcar(true)
    },
    [marcar],
  )
  const lienzo = useRef<HTMLDivElement>(null)
  useEncuadreAlMostrar(lienzo, encuadrar, movidoAMano)

  const onNodeClick = useCallback<NodeMouseHandler<ProcesoNode>>(
    (_, n) => {
      if (n.type === 'etapa') seleccionar({ tipo: 'etapa', id: n.id })
    },
    [seleccionar],
  )

  return (
    <>
      <ProcessHeader onEncuadrar={encuadrar} />
      <div ref={lienzo} className="relative min-h-0 flex-1">
        <ReactFlow<ProcesoNode, ProcesoEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodeClick={onNodeClick}
          onMove={onMove}
          fitView
          fitViewOptions={ENCUADRE}
          minZoom={0.15}
          maxZoom={2}
          nodesDraggable={false}
          nodesConnectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          elementsSelectable
          deleteKeyCode={null}
          selectionKeyCode={null}
          multiSelectionKeyCode={null}
          colorMode={COLOR_MODE[tema]}
          ariaLabelConfig={ARIA_FLUJO}
          proOptions={PRO_OPTIONS}
          style={ESTILO_FLUJO}
        >
          <Background gap={24} size={1.2} color="var(--c-border)" />
          <Controls
            showInteractive={false}
            position="bottom-left"
            orientation="horizontal"
            onZoomIn={marcarMovido}
            onZoomOut={marcarMovido}
            onFitView={desmarcarMovido}
          />
          {ancho && explorando && (
            <MiniMap<ProcesoNode>
              position="top-right"
              pannable
              zoomable
              nodeColor={colorMinimapa}
              nodeStrokeWidth={0}
              nodeBorderRadius={6}
              ariaLabel="Minimapa del diagrama"
              style={{ width: 168, height: 120, border: '1px solid var(--c-border)', borderRadius: 8 }}
            />
          )}
        </ReactFlow>
      </div>
    </>
  )
}

export function ProcessView() {
  const layout = usePlantStore((s) => s.layout)
  const idx = usePlantStore((s) => s.idx)
  if (!layout || !idx) {
    return (
      <div data-testid="process-view" className={`${TARJETA} items-center justify-center text-sm text-tenue`}>
        Sin layout cargado.
      </div>
    )
  }
  return (
    <div data-testid="process-view" className={TARJETA}>
      <ReactFlowProvider>
        <Diagrama layout={layout} idx={idx} />
      </ReactFlowProvider>
    </div>
  )
}
