// Mini gráfico del WIP histórico de una etapa (lecturas del store). Una sola serie: sin leyenda;
// el resumen en texto (último, mínimo, máximo y rango horario) acompaña al gráfico.
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtHora, fmtNum } from '../../ui/tokens'
import { MIN_PUNTOS_HISTORIAL, type PuntoWip } from './detalleModel'
import { Vacio } from './piezas'

interface Props {
  serie: PuntoWip[]
  /** Color de la línea (variable CSS). */
  color: string
  unidad: string
  /** Qué se grafica, para el texto alternativo. */
  titulo: string
}

const ALTO = 96
const MARGEN = { top: 6, right: 8, bottom: 2, left: 0 }
const TOOLTIP = {
  background: 'var(--c-surface)',
  border: '1px solid var(--c-border)',
  borderRadius: 6,
  fontSize: 12,
  color: 'var(--c-text)',
  padding: '4px 8px',
}

export function MiniGrafico({ serie, color, unidad, titulo }: Props) {
  if (serie.length < MIN_PUNTOS_HISTORIAL) return <Vacio>Sin historial</Vacio>
  const valores = serie.map((p) => p.v)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const primero = serie[0]!
  const ultimo = serie[serie.length - 1]!
  const rango = `${fmtHora(primero.t)}–${fmtHora(ultimo.t)}`
  const resumen =
    `${titulo}: último ${fmtNum(ultimo.v)} ${unidad}; mínimo ${fmtNum(min)} y máximo ${fmtNum(max)} ` +
    `en ${serie.length} lecturas (${rango}).`
  return (
    <figure className="m-0">
      <div role="img" aria-label={resumen} className="w-full" style={{ height: ALTO }}>
        <LineChart
          data={serie}
          responsive
          style={{ width: '100%', height: ALTO }}
          margin={MARGEN}
          accessibilityLayer={false}
        >
          <CartesianGrid vertical={false} stroke="var(--c-border)" strokeDasharray="3 3" />
          <XAxis dataKey="t" hide />
          <YAxis
            width={40}
            tickCount={3}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            domain={[0, 'auto']}
            tick={{ fontSize: 10, fill: 'var(--c-muted)' }}
            tickFormatter={(v: number) => fmtNum(v)}
          />
          <Tooltip
            cursor={{ stroke: 'var(--c-muted)', strokeDasharray: '3 3' }}
            contentStyle={TOOLTIP}
            labelStyle={{ color: 'var(--c-muted)' }}
            itemStyle={{ color: 'var(--c-text)', padding: 0 }}
            labelFormatter={(t) => fmtHora(String(t))}
            separator=": "
            formatter={(v) => [`${fmtNum(Number(v))} ${unidad}`, 'WIP']}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color, stroke: 'var(--c-surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </div>
      <figcaption className="mt-1 text-[11px] text-tenue tabular-nums">
        Último {fmtNum(ultimo.v)} {unidad} · mín. {fmtNum(min)} · máx. {fmtNum(max)} · {rango}
      </figcaption>
    </figure>
  )
}
