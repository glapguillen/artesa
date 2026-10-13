// Resalte de la selección: contorno grueso var(--c-seleccion); discontinuo si la zona es probable.
import type { Resalte } from './planLive'
import type { GeoZona } from './planModel'

interface Props {
  resalte: Map<string, Resalte>
  porId: Map<string, GeoZona>
  k: number
}

export function SelectionLayer({ resalte, porId, k }: Props) {
  return (
    <g aria-hidden="true" pointerEvents="none">
      {[...resalte].map(([id, estilo]) => {
        const g = porId.get(id)
        if (!g) return null
        const solido = estilo === 'solido'
        return (
          <g key={id} data-resalte={estilo} data-resalte-zona={id}>
            <polygon points={g.puntos} style={{ fill: 'none', stroke: 'var(--c-surface)' }} strokeWidth={6.5 / k} strokeLinejoin="round" strokeOpacity={0.8} />
            <polygon
              points={g.puntos}
              style={{ fill: 'none', stroke: 'var(--c-seleccion)' }}
              strokeWidth={(solido ? 3.5 : 3) / k}
              strokeDasharray={solido ? undefined : `${7 / k} ${4 / k}`}
              strokeLinejoin="round"
            />
          </g>
        )
      })}
    </g>
  )
}
