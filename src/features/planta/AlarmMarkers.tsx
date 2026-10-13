// Marcador de alarma por zona: anillo pulsante en la esquina superior derecha del rectángulo de
// la etiqueta. Rojo si es crítica, ámbar si es advertencia (las de información no se marcan).
import type { NivelAlarma } from '../../domain/live'
import { colorEstado } from '../../ui/tokens'
import type { GeoZona } from './planModel'

interface Props {
  alarmas: Map<string, NivelAlarma>
  porId: Map<string, GeoZona>
  k: number
}

export function AlarmMarkers({ alarmas, porId, k }: Props) {
  return (
    <g aria-hidden="true" pointerEvents="none">
      {[...alarmas].map(([id, nivel]) => {
        const g = porId.get(id)
        if (!g || nivel === 'info') return null
        const color = nivel === 'critica' ? colorEstado('detenido') : colorEstado('espera')
        const r = g.etiqueta
        const inset = Math.min(10 / k, r.w / 2, r.h / 2)
        return (
          <g key={id} data-alarma={id} data-nivel={nivel} transform={`translate(${r.x + r.w - inset} ${r.y + inset}) scale(${1 / k})`}>
            <circle
              r={8}
              className="origin-center [transform-box:fill-box] motion-safe:animate-ping"
              style={{ fill: 'none', stroke: color }}
              strokeWidth={2.5}
            />
            <circle r={8} style={{ fill: 'none', stroke: color }} strokeWidth={2.5} />
            <circle r={4.5} style={{ fill: color, stroke: 'var(--c-surface)' }} strokeWidth={1.2} />
          </g>
        )
      })}
    </g>
  )
}
