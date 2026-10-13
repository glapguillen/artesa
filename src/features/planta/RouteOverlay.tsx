// Ruta de decoración activa en tres piezas:
// - RouteLine (debajo de las etiquetas): polilínea con flechas por los centroides de sus zonas.
// - RouteSteps (encima): pasos numerados en la esquina de cada zona ("1·4" si se repite).
// - RouteBadge (HTML, fijo arriba a la izquierda del lienzo): código de la ruta y piezas.
import { fmtNum } from '../../ui/tokens'
import { pathPolilinea } from './geometry'
import { pasosPorZona } from './planLive'
import { Punta } from './Punta'
import { anchoTexto } from './textFit'
import type { RutaPlano } from './usePlanoVivo'

const RUTA = 'var(--c-ruta)'
const TEXTO = { fontSize: 11, fontWeight: 700, style: { fill: 'var(--c-surface)' } } as const

export function RouteLine({ ruta, k }: { ruta: RutaPlano; k: number }) {
  const puntos = ruta.zonas.map((z) => z.centro)
  const d = pathPolilinea(puntos)
  return (
    <g data-testid="ruta-overlay" data-ruta-activa={ruta.id} pointerEvents="none" aria-hidden="true">
      {puntos.length > 1 && (
        <>
          <path d={d} style={{ fill: 'none', stroke: 'var(--c-surface)' }} strokeWidth={7 / k} strokeLinejoin="round" strokeOpacity={0.8} />
          <path d={d} style={{ fill: 'none', stroke: RUTA }} strokeWidth={3.5 / k} strokeLinejoin="round" />
        </>
      )}
      {puntos.slice(1).map((b, i) => {
        const a = puntos[i]!
        const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
        return <Punta key={i} x={(a[0] + b[0]) / 2} y={(a[1] + b[1]) / 2} angulo={ang} k={k} color={RUTA} tam={13} />
      })}
      {puntos.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4 / k} style={{ fill: RUTA, stroke: 'var(--c-surface)' }} strokeWidth={1.5 / k} />
      ))}
    </g>
  )
}

export function RouteSteps({ ruta, k }: { ruta: RutaPlano; k: number }) {
  const pasos = pasosPorZona(ruta.zonas)
  return (
    <g data-testid="ruta-pasos" pointerEvents="none" aria-hidden="true">
      {[...pasos].map(([id, nums]) => {
        const z = ruta.zonas.find((x) => x.id === id)
        if (!z) return null
        const t = nums.join('·')
        const w = Math.max(20, anchoTexto(t, 11) + 10)
        return (
          <g key={id} data-paso-zona={id} transform={`translate(${z.etiqueta.x} ${z.etiqueta.y}) scale(${1 / k})`}>
            <rect x={3} y={3} width={w} height={20} rx={10} style={{ fill: RUTA, stroke: 'var(--c-surface)' }} strokeWidth={2} />
            <text x={3 + w / 2} y={13} dy="0.35em" textAnchor="middle" {...TEXTO}>
              {t}
            </text>
          </g>
        )
      })}
    </g>
  )
}

export function RouteBadge({ ruta, piezas }: { ruta: RutaPlano; piezas: number | null }) {
  const sinZonas = ruta.zonas.length === 0
  return (
    <div
      className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-4rem)] truncate rounded-full bg-ruta px-2.5 py-0.5 text-xs font-bold text-surface"
    >
      {`Ruta ${ruta.id}${ruta.codigo ? ` · ${ruta.codigo}` : ''}`}
      {piezas !== null && <span className="font-medium">{` · ${fmtNum(piezas)} pzs/turno`}</span>}
      {sinZonas && <span className="font-medium"> · sin zonas ubicadas</span>}
    </div>
  )
}
