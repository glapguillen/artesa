// Polígono interactivo de una zona: relleno (estado o grupo), trama, borde y foco visible.
import { type KeyboardEvent, memo } from 'react'
import type { GeoZona } from './planModel'

interface Props {
  geo: GeoZona
  k: number
  relleno: string
  opacidad: number | string
  trazo: string
  atenuada: boolean
  seleccionada: boolean
  titulo: string
  onSeleccionar: (id: string) => void
}

export const ZoneShape = memo(function ZoneShape(p: Props) {
  const { geo, k } = p
  const activar = () => p.onSeleccionar(geo.id)
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      activar()
    }
  }
  return (
    <g
      data-zona-id={geo.id}
      role="button"
      tabIndex={0}
      aria-label={p.titulo}
      aria-pressed={p.seleccionada}
      className="group cursor-pointer outline-none"
      opacity={p.atenuada ? 0.4 : 1}
      onClick={activar}
      onKeyDown={onKeyDown}
    >
      <title>{p.titulo}</title>
      <polygon
        points={geo.puntos}
        style={{ fill: p.relleno, fillOpacity: p.opacidad, stroke: p.trazo }}
        strokeWidth={1.2 / k}
        strokeDasharray={geo.recintoCerrado ? undefined : `${5 / k} ${3 / k}`}
        strokeLinejoin="round"
      />
      {geo.patron && <polygon points={geo.puntos} fill={`url(#pv-${geo.patron})`} pointerEvents="none" />}
      <polygon
        points={geo.puntos}
        className="opacity-0 transition-opacity group-hover:opacity-50 group-focus-visible:opacity-100"
        style={{ fill: 'none', stroke: 'var(--c-seleccion)' }}
        strokeWidth={2.5 / k}
        strokeDasharray={`${4 / k} ${2 / k}`}
        strokeLinejoin="round"
        pointerEvents="none"
      />
    </g>
  )
})
