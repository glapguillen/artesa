// Barra apilada con el detalle de la clasificación final (3.3) y su leyenda accesible.
import { colorEstado } from '../../ui/tokens'
import { fmtValorKpi, segmentosClasif } from './kpiModel'

interface Props {
  detalle: Record<string, number> | undefined
  unidad: string | null
}

export function ClasifBar({ detalle, unidad }: Props) {
  const segmentos = segmentosClasif(detalle)
  if (!segmentos) {
    return (
      <p className="mt-auto text-[10px]" style={{ color: colorEstado('sin_datos') }}>
        Detalle: Sin datos
      </p>
    )
  }
  const total = segmentos.reduce((n, s) => n + Math.max(0, s.valor), 0)
  const fmt = (v: number) => fmtValorKpi(v, unidad) ?? 'Sin datos'
  return (
    <div className="mt-auto flex flex-col gap-1">
      {/* La barra es decorativa: la misma información está en la lista de abajo. */}
      <div aria-hidden="true" className="flex h-2 w-full overflow-hidden rounded-full bg-surface-2">
        {total > 0 &&
          segmentos.map((s) =>
            s.valor > 0 ? (
              <div
                key={s.clave}
                className="h-full"
                style={{ width: `${(s.valor / total) * 100}%`, background: s.color }}
                title={`${s.etiqueta}: ${fmt(s.valor)}`}
              />
            ) : null,
          )}
      </div>
      <ul aria-label="Detalle de la clasificación final" className="grid grid-cols-3 gap-x-1.5 gap-y-0.5">
        {segmentos.map((s) => (
          <li key={s.clave} className="flex min-w-0 items-center gap-1 text-[10px] leading-tight" title={s.etiqueta}>
            <span aria-hidden="true" className="size-2 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span aria-hidden="true" className="truncate text-tenue">
              {s.corta}
            </span>
            <span className="sr-only">{s.etiqueta}:</span>
            <span className="ml-auto tabular-nums text-texto">{fmt(s.valor)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
