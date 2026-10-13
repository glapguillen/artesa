// Banda de fondo del flujograma (Stocks, Fase 1, Fase 2, Fase 3) con su título.
import type { NodeProps } from '@xyflow/react'
import { memo } from 'react'
import { colorFase } from '../../ui/tokens'
import type { BandaFlowNode } from './buildGraph'

export const BandaNode = memo(function BandaNode({ data }: NodeProps<BandaFlowNode>) {
  const color = data.fase ? colorFase(data.fase) : 'var(--c-muted)'
  return (
    <div
      className="pointer-events-none h-full w-full rounded-2xl border border-dashed"
      style={{
        background: `color-mix(in srgb, ${color} 5%, transparent)`,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
      }}
    >
      <div className="truncate px-3 pt-1 text-[11px] leading-3.5 font-semibold tracking-wide" style={{ color }}>
        {data.titulo}
      </div>
    </div>
  )
})
