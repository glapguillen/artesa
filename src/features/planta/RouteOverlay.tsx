// Recorrido de la ruta de decoración activa: polilínea con flechas por los centroides de sus
// zonas, pasos numerados (una zona puede tener varios: "1·4") y un rótulo con el código.
import { fmtNum } from '../../ui/tokens'
import { pathPolilinea } from './geometry'
import { pasosPorZona } from './planLive'
import { Punta } from './Punta'
import { anchoTexto } from './textFit'
import type { RutaPlano } from './usePlanoVivo'

interface Props {
  ruta: RutaPlano
  k: number
  piezas: number | null
}

const RUTA = 'var(--c-ruta)'

function Rotulo({ texto, x, y, k }: { texto: string; x: number; y: number; k: number }) {
  const w = anchoTexto(texto, 11) + 14
  return (
    <g transform={`translate(${x} ${y}) scale(${1 / k})`}>
      <rect x={-w / 2} y={-40} width={w} height={20} rx={10} style={{ fill: RUTA }} />
      <text y={-30} dy="0.35em" textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: 'var(--c-surface)' }}>
        {texto}
      </text>
    </g>
  )
}

export function RouteOverlay({ ruta, k, piezas }: Props) {
  const puntos = ruta.zonas.map((z) => z.centro)
  const pasos = pasosPorZona(ruta.zonas)
  const primero = puntos[0]
  const texto = `${ruta.id}${ruta.codigo ? ` · ${ruta.codigo}` : ''}${piezas !== null ? ` · ${fmtNum(piezas)} pzs` : ''}`
  return (
    <g data-testid="ruta-overlay" data-ruta-activa={ruta.id} pointerEvents="none" aria-hidden="true">
      {puntos.length > 1 && (
        <>
          <path d={pathPolilinea(puntos)} style={{ fill: 'none', stroke: 'var(--c-surface)' }} strokeWidth={7 / k} strokeLinejoin="round" strokeOpacity={0.8} />
          <path d={pathPolilinea(puntos)} style={{ fill: 'none', stroke: RUTA }} strokeWidth={3.5 / k} strokeLinejoin="round" />
        </>
      )}
      {puntos.slice(1).map((b, i) => {
        const a = puntos[i]!
        const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
        return <Punta key={i} x={(a[0] + b[0]) / 2} y={(a[1] + b[1]) / 2} angulo={ang} k={k} color={RUTA} tam={13} />
      })}
      {[...pasos].map(([id, nums]) => {
        const z = ruta.zonas.find((x) => x.id === id)
        if (!z) return null
        const t = nums.join('·')
        const w = Math.max(20, anchoTexto(t, 11) + 10)
        return (
          <g key={id} data-paso-zona={id} transform={`translate(${z.centro[0]} ${z.centro[1]}) scale(${1 / k})`}>
            <rect x={-w / 2} y={-10} width={w} height={20} rx={10} style={{ fill: RUTA, stroke: 'var(--c-surface)' }} strokeWidth={2} />
            <text dy="0.35em" textAnchor="middle" fontSize={11} fontWeight={700} style={{ fill: 'var(--c-surface)' }}>
              {t}
            </text>
          </g>
        )
      })}
      {primero && <Rotulo texto={texto} x={primero[0]} y={primero[1]} k={k} />}
    </g>
  )
}
