// Lista corta del WIP por piscina (1.4, 1.6, 2.6, 3.2) bajo el KPI wip_piscinas.
import { estadoDeEtapa } from '../../domain/selectors'
import { usePlantStore } from '../../store/usePlantStore'
import { colorEstado, ESTADO_ETIQUETA } from '../../ui/tokens'
import { codigosPiscinas, fmtValorKpi } from './kpiModel'

interface Props {
  detalle: Record<string, number> | undefined
  unidad: string | null
}

export function WipPiscinas({ detalle, unidad }: Props) {
  const idx = usePlantStore((s) => s.idx)
  const live = usePlantStore((s) => s.live)
  return (
    <ul aria-label="WIP por piscina" className="mt-auto flex flex-col gap-0.5">
      {codigosPiscinas(detalle).map((c) => {
        const nombre = idx?.etapasPorCodigo.get(c)?.nombre_corto ?? c
        const estado = estadoDeEtapa(live, c)
        const valor = fmtValorKpi(detalle?.[c], unidad)
        return (
          <li key={c} className="flex min-w-0 items-center gap-1.5 text-[10px] leading-tight">
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: colorEstado(estado) }}
              title={ESTADO_ETIQUETA[estado]}
            />
            <span className="truncate text-tenue" title={`${c} · ${nombre}`}>
              <span className="tabular-nums">{c}</span> {nombre}
            </span>
            <span className="sr-only">({ESTADO_ETIQUETA[estado]})</span>
            <span
              className="ml-auto shrink-0 tabular-nums"
              style={{ color: valor === null ? colorEstado('sin_datos') : 'var(--c-text)' }}
            >
              {valor ?? 'Sin datos'}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
