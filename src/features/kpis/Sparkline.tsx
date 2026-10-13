// Mini gráfico de tendencia del turno (sin ejes ni animación). Es decorativo: el valor está en la tarjeta.
import { Line, LineChart, YAxis } from 'recharts'
import { serieDibujable, type PuntoSerie } from './kpiModel'

interface Props {
  serie: PuntoSerie[]
  /** Ancho fijo en px; sin ancho, ocupa el ancho de su contenedor. */
  ancho?: number
  alto: number
}

const MARGEN = { top: 2, right: 2, bottom: 2, left: 2 }

export function Sparkline({ serie, ancho, alto }: Props) {
  const estilo = { width: ancho ?? '100%', height: alto }
  if (!serieDibujable(serie)) {
    // Aún no hay tendencia: una línea punteada tenue ocupa el lugar sin mover el diseño.
    return (
      <div aria-hidden="true" className="flex shrink-0 items-center" style={estilo}>
        <div className="w-full border-t border-dashed border-borde" />
      </div>
    )
  }
  return (
    <div aria-hidden="true" className="shrink-0" style={estilo}>
      <LineChart
        data={serie}
        margin={MARGEN}
        responsive={ancho === undefined}
        width={ancho}
        height={alto}
        style={ancho === undefined ? { width: '100%', height: alto } : undefined}
        accessibilityLayer={false}
      >
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Line
          type="monotone"
          dataKey="v"
          stroke="var(--c-accent)"
          strokeWidth={1.5}
          dot={false}
          activeDot={false}
          connectNulls
          isAnimationActive={false}
        />
      </LineChart>
    </div>
  )
}
