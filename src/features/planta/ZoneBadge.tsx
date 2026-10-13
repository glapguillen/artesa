// Insignias de una zona, en píxeles de pantalla: etapa confirmada (píldora sólida del color de su
// fase), etapa probable ("?" en píldora tenue) y personas asignadas (ícono + número).
import { colorFase } from '../../ui/tokens'
import type { InsigniaZona } from './planModel'
import { ALTO_INSIGNIA } from './textFit'

const H = ALTO_INSIGNIA
const TEXTO = { fontSize: 9.5, fontWeight: 600 } as const

function IconoPersona({ x }: { x: number }) {
  return (
    <g transform={`translate(${x} 0)`} style={{ fill: 'var(--c-muted)' }}>
      <circle cx={0} cy={-2.4} r={2.1} />
      <path d="M-3.6 4.4Q-3.6 0.6 0 0.6Q3.6 0.6 3.6 4.4Z" />
    </g>
  )
}

export function ZoneBadge({ item, x, y }: { item: InsigniaZona; x: number; y: number }) {
  const w = item.ancho
  const color = item.fase ? colorFase(item.fase) : 'var(--c-muted)'
  const caja = { x: -w / 2, y: -H / 2, width: w, height: H, rx: H / 2 }
  if (item.tipo === 'personas') {
    return (
      <g transform={`translate(${x} ${y})`} data-insignia="personas">
        <rect {...caja} style={{ fill: 'var(--c-surface)', stroke: 'var(--c-border)' }} strokeWidth={1} />
        <IconoPersona x={-w / 2 + 9} />
        <text x={-w / 2 + 15} dy="0.35em" style={{ fill: 'var(--c-text)' }} {...TEXTO}>
          {item.texto}
        </text>
      </g>
    )
  }
  const solida = item.tipo === 'etapa'
  return (
    <g transform={`translate(${x} ${y})`} data-insignia={item.tipo}>
      <rect
        {...caja}
        style={{ fill: solida ? color : 'var(--c-surface)', stroke: color }}
        strokeWidth={1}
        strokeDasharray={solida ? undefined : '2.5 1.5'}
      />
      <text textAnchor="middle" dy="0.35em" style={{ fill: solida ? 'var(--c-surface)' : 'var(--c-muted)' }} {...TEXTO}>
        {item.texto}
      </text>
    </g>
  )
}
