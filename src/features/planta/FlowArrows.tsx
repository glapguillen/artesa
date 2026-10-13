// Flujos de material entre zonas: curvas con flecha del color de su fase, discontinuas si son
// hipótesis, sin ubicar o venta. El grosor sigue a piezas/h en vivo (fino si no hay dato).
import { memo, useMemo } from 'react'
import type { LiveState } from '../../domain/live'
import { colorFase, fmtNum } from '../../ui/tokens'
import { acortarFinal, anguloFinal, pathCurva } from './geometry'
import { caudalRelativo } from './planLive'
import type { GeoFlujo } from './planModel'
import { Punta } from './Punta'

interface Props {
  flujos: GeoFlujo[]
  live: LiveState | null
  k: number
  /** Con una ruta activa los flujos pasan a segundo plano. */
  tenue: boolean
}

export const FlowArrows = memo(function FlowArrows({ flujos, live, k, tenue }: Props) {
  const caudal = useMemo(() => caudalRelativo(flujos.map((f) => f.id), live), [flujos, live])
  return (
    <g data-capa="flujos" opacity={tenue ? 0.25 : 1}>
      {flujos.map((f) => {
        const rel = caudal[f.id] ?? null
        const grosor = rel === null ? 1.25 : 1.25 + 3.5 * rel
        const tam = 7 + grosor * 1.2
        const color = colorFase(f.fase)
        const piezas = live?.flujos?.[f.id]?.piezas_h ?? null
        return (
          <g key={f.id} data-flujo-id={f.id} opacity={rel === null ? 0.7 : 0.9}>
            <title>{`${f.titulo} · ${fmtNum(piezas, 0, 'Sin datos')} piezas/h`}</title>
            <path
              d={pathCurva(acortarFinal(f.curva, (tam * 0.75) / k))}
              style={{ fill: 'none', stroke: color }}
              strokeWidth={grosor / k}
              strokeDasharray={f.discontinuo ? `${6 / k} ${4 / k}` : undefined}
              strokeLinecap="round"
              pointerEvents="visibleStroke"
            />
            <Punta x={f.curva.b[0]} y={f.curva.b[1]} angulo={anguloFinal(f.curva)} k={k} color={color} tam={tam} />
          </g>
        )
      })}
    </g>
  )
})
