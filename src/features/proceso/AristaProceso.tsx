// Arista "smoothstep" del flujograma: el mismo trazo que la de React Flow, pero con la etiqueta en
// la posición calculada en buildGraph (sin tapar nodos ni otras etiquetas).
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'
import { memo } from 'react'
import type { ProcesoEdge } from './buildGraph'

export const AristaProceso = memo(function AristaProceso(p: EdgeProps<ProcesoEdge>) {
  const [path, lx, ly] = getSmoothStepPath({
    sourceX: p.sourceX,
    sourceY: p.sourceY,
    sourcePosition: p.sourcePosition,
    targetX: p.targetX,
    targetY: p.targetY,
    targetPosition: p.targetPosition,
  })
  const pos = p.data?.etiqueta
  return (
    <BaseEdge
      id={p.id}
      path={path}
      style={p.style}
      markerEnd={p.markerEnd}
      interactionWidth={0}
      label={p.label}
      labelX={pos?.[0] ?? lx}
      labelY={pos?.[1] ?? ly}
      labelStyle={p.labelStyle}
      labelShowBg={p.labelShowBg}
      labelBgStyle={p.labelBgStyle}
      labelBgPadding={p.labelBgPadding}
      labelBgBorderRadius={p.labelBgBorderRadius}
    />
  )
})
