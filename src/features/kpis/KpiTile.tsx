// Tarjeta de un indicador: nombre, valor (o "Sin datos"), meta, tendencia y detalle opcional.
import type { ReactNode } from 'react'
import { colorEstado } from '../../ui/tokens'
import type { PuntoSerie } from './kpiModel'
import { Sparkline } from './Sparkline'

interface Props {
  /** Va en data-kpi. */
  id: string
  nombre: string
  /** Valor ya formateado; null = sin dato (se muestra "Sin datos" en gris). */
  valor: string | null
  /** Color del valor (variable CSS); por defecto, el del texto. */
  colorValor?: string
  /** Línea secundaria: la meta o una aclaración. */
  meta: ReactNode
  /** Texto de ayuda al pasar el puntero (p. ej. el nombre completo). */
  ayuda?: string
  serie?: PuntoSerie[]
  /** Ocupa las dos filas de la barra. */
  grande?: boolean
  /** KPI principal: número y tendencia más grandes. */
  destacado?: boolean
  children?: ReactNode
}

const BASE = 'relative flex min-h-0 flex-col gap-0.5 rounded-lg border border-borde bg-surface px-2.5 py-2 shadow-xs'
const ANCHO_CHICO = 'w-[9.5rem] min-w-0 @min-[78rem]:w-auto'
const ANCHO_GRANDE = 'row-span-2 w-[12rem] min-w-[12rem] @min-[78rem]:w-auto'

export function KpiTile(p: Props) {
  const sinDato = p.valor === null
  const tamValor = p.destacado ? 'text-2xl' : 'text-lg'
  return (
    <article data-kpi={p.id} aria-label={p.nombre} className={`${BASE} ${p.grande ? ANCHO_GRANDE : ANCHO_CHICO}`}>
      <h3 className="truncate text-[11px] leading-tight font-medium text-tenue" title={p.ayuda ?? p.nombre}>
        {p.nombre}
      </h3>
      <div className={p.destacado ? 'flex flex-col gap-1' : 'flex items-end justify-between gap-2'}>
        <p
          className={`${sinDato ? 'text-sm font-medium' : `${tamValor} font-semibold`} leading-tight tabular-nums whitespace-nowrap`}
          style={{ color: sinDato ? colorEstado('sin_datos') : (p.colorValor ?? 'var(--c-text)') }}
        >
          {p.valor ?? 'Sin datos'}
        </p>
        {p.serie &&
          (p.destacado ? <Sparkline serie={p.serie} alto={40} /> : <Sparkline serie={p.serie} ancho={60} alto={24} />)}
      </div>
      <p className="truncate text-[10px] leading-tight text-tenue">{p.meta}</p>
      {p.children}
    </article>
  )
}
