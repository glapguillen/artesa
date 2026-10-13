// Etiqueta de zona: nombre ajustado al rectángulo interior (tamaño y saltos de línea automáticos,
// vertical en zonas angostas) e insignias debajo. Se dibuja en píxeles con scale(1/k): al acercar
// el zoom caben más cosas. No depende del estado en vivo.
import { memo, useMemo } from 'react'
import type { GeoZona } from './planModel'
import { disponerEtiqueta, type Disposicion } from './textFit'
import { ZoneBadge } from './ZoneBadge'

const HALO = {
  fill: 'var(--c-text)',
  stroke: 'var(--c-surface)',
  strokeWidth: 3,
  strokeLinejoin: 'round',
  paintOrder: 'stroke',
} as const

type Nombre = NonNullable<Disposicion<unknown>['nombre']>

function NombreZona({ n }: { n: Nombre }) {
  const alto = n.tam * 1.15
  const y0 = -((n.lineas.length - 1) * alto) / 2
  return (
    <g transform={`translate(0 ${n.cy})${n.rotado ? ' rotate(-90)' : ''}`}>
      <text textAnchor="middle" fontSize={n.tam} fontWeight={600} style={HALO}>
        {n.lineas.map((l, i) => (
          <tspan key={i} x={0} y={y0 + i * alto} dy="0.35em">
            {l}
          </tspan>
        ))}
      </text>
    </g>
  )
}

interface Props {
  geo: GeoZona
  k: number
  atenuada: boolean
}

export const ZoneLabel = memo(function ZoneLabel({ geo, k, atenuada }: Props) {
  const r = geo.etiqueta
  const w = Math.round(r.w * k)
  const h = Math.round(r.h * k)
  const d = useMemo(() => disponerEtiqueta({ w, h }, geo.nombre, geo.insignias), [w, h, geo])
  if (!d.nombre && d.insignias.length === 0) return null
  const cx = r.x + r.w / 2
  const cy = r.y + r.h / 2
  return (
    <g
      data-etiqueta-zona={geo.id}
      transform={`translate(${cx} ${cy}) scale(${1 / k})`}
      opacity={atenuada ? 0.45 : 1}
      pointerEvents="none"
    >
      {d.nombre && <NombreZona n={d.nombre} />}
      {d.insignias.map(({ item, x, y }) => (
        <ZoneBadge key={item.clave} item={item} x={x} y={y} />
      ))}
    </g>
  )
})
