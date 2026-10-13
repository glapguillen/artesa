// Marcador de alarma por zona: anillo pulsante sobre la esquina inferior derecha de la zona (fuera
// del rectángulo de la etiqueta, para no tapar el nombre en zonas angostas, y en la esquina opuesta
// a los pasos de la ruta activa). Rojo si es crítica, ámbar si es advertencia (las de información no
// se marcan).
import type { NivelAlarma } from '../../domain/live'
import { bbox } from '../../domain/selectors'
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
        const { x2, z2 } = bbox(g.poligono)
        return (
          <g key={id} data-alarma={id} data-nivel={nivel} transform={`translate(${x2} ${z2}) scale(${1 / k}) translate(-4 -4)`}>
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
