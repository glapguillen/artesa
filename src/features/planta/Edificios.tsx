// Contornos de edificios (trazo grueso) con un relleno tenue de la huella.
import { memo } from 'react'
import type { GeoEdificio } from './planModel'

export const Edificios = memo(function Edificios({ edificios, k }: { edificios: GeoEdificio[]; k: number }) {
  return (
    <g aria-hidden="true" pointerEvents="none">
      {edificios.map((e) => (
        <polygon
          key={e.id}
          data-edificio-id={e.id}
          points={e.puntos}
          style={{ fill: 'var(--c-surface-2)', stroke: 'var(--c-text)' }}
          strokeOpacity={0.6}
          strokeWidth={3.5 / k}
          strokeLinejoin="round"
        />
      ))}
    </g>
  )
})
