// Accesos: puerta = vano con hoja y arco de giro; portón = vano más ancho con hoja corrediza.
import { memo } from 'react'
import type { GeoAcceso } from './planModel'

const r2 = (n: number) => Math.round(n * 100) / 100

function Acceso({ a, k }: { a: GeoAcceso; k: number }) {
  const [ax, ay] = a.a
  const [bx, by] = a.b
  const vano = (
    <line x1={ax} y1={ay} x2={bx} y2={by} style={{ stroke: 'var(--c-surface)' }} strokeWidth={4.5 / k} strokeLinecap="butt" />
  )
  if (a.tipo === 'porton') {
    const poste = 3 / k
    return (
      <g data-acceso-id={a.id}>
        <title>{a.titulo}</title>
        {vano}
        <line x1={ax} y1={ay} x2={bx} y2={by} style={{ stroke: 'var(--c-text)' }} strokeWidth={1.6 / k} strokeDasharray={`${3 / k} ${2 / k}`} />
        {[a.a, a.b].map(([x, y], i) => (
          <rect key={i} x={x - poste} y={y - poste} width={2 * poste} height={2 * poste} style={{ fill: 'var(--c-text)' }} />
        ))}
      </g>
    )
  }
  // Hoja desde la bisagra (a) hacia adentro y arco hasta el otro extremo del vano (b).
  const hx = ax + a.adentro[0] * a.largo
  const hy = ay + a.adentro[1] * a.largo
  const cruz = a.adentro[0] * (by - ay) - a.adentro[1] * (bx - ax)
  const arco = `M${r2(hx)} ${r2(hy)}A${a.largo} ${a.largo} 0 0 ${cruz > 0 ? 1 : 0} ${r2(bx)} ${r2(by)}`
  const interna = a.tipo === 'puerta_interna'
  return (
    <g data-acceso-id={a.id}>
      <title>{a.titulo}</title>
      {vano}
      <line x1={ax} y1={ay} x2={hx} y2={hy} style={{ stroke: 'var(--c-text)' }} strokeWidth={1.4 / k} strokeLinecap="round" />
      <path
        d={arco}
        style={{ fill: 'none', stroke: 'var(--c-muted)' }}
        strokeWidth={1 / k}
        strokeDasharray={interna ? `${2 / k} ${2 / k}` : undefined}
      />
    </g>
  )
}

export const Accesos = memo(function Accesos({ accesos, k }: { accesos: GeoAcceso[]; k: number }) {
  return (
    <g pointerEvents="visibleStroke">
      {accesos.map((a) => (
        <Acceso key={a.id} a={a} k={k} />
      ))}
    </g>
  )
})
