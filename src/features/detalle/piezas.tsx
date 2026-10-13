// Piezas básicas del panel de detalle: secciones, filas de datos, chips de estado y textos vacíos.
import type { ReactNode } from 'react'
import type { EstadoOperativo } from '../../domain/live'
import { colorEstado, ESTADO_ETIQUETA, fmtNum, fmtPct, POR_DEFINIR } from '../../ui/tokens'

export const FOCO = 'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-seleccion'

/** Chip clicable (botón nativo: foco, Enter y Espacio incluidos). */
export const CHIP =
  'inline-flex max-w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-full border border-borde bg-surface-2 px-2 py-1 text-xs text-texto hover:border-seleccion ' +
  FOCO

export function Seccion({ titulo, extra, children }: { titulo: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-borde py-3 first:border-t-0 first:pt-0">
      <h3 className="mb-2 flex items-baseline justify-between gap-2 text-[11px] font-semibold tracking-wide text-tenue uppercase">
        <span>{titulo}</span>
        {extra && <span className="font-normal tracking-normal normal-case">{extra}</span>}
      </h3>
      {children}
    </section>
  )
}

export function Subtitulo({ children }: { children: ReactNode }) {
  return <h4 className="mt-2 mb-1 text-xs font-medium text-tenue first:mt-0">{children}</h4>
}

export function Datos({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-[minmax(6.5rem,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">{children}</dl>
}

export function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <>
      <dt className="pt-0.5 text-xs text-tenue">{etiqueta}</dt>
      <dd className="min-w-0 break-words text-texto">{children}</dd>
    </>
  )
}

export function Punto({ color, hueco = false }: { color: string; hueco?: boolean }) {
  const estilo = hueco ? { border: `2px solid ${color}` } : { background: color }
  return <span aria-hidden="true" className="inline-block size-2.5 shrink-0 rounded-full" style={estilo} />
}

export function SinDatos({ texto = 'Sin datos' }: { texto?: string }) {
  return <span className="text-tenue">{texto}</span>
}

export function PorDefinir() {
  return <span className="text-tenue">{POR_DEFINIR}</span>
}

/** Texto del layout que puede ser null → [POR DEFINIR]. */
export function Texto({ v }: { v: string | null | undefined }) {
  return v === null || v === undefined || v.trim() === '' ? <PorDefinir /> : <>{v}</>
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="text-xs text-tenue">{children}</p>
}

export function ChipEstado({ estado }: { estado: EstadoOperativo }) {
  const color = colorEstado(estado)
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium text-texto"
      style={{ borderColor: color }}
    >
      <Punto color={color} />
      {ESTADO_ETIQUETA[estado] ?? ESTADO_ETIQUETA.sin_datos}
    </span>
  )
}

/** Valor en vivo: número con unidad, o "Sin datos" en gris. */
export function ValorVivo({ v, unidad, decimales = 0 }: { v: number | null | undefined; unidad?: string; decimales?: 0 | 1 }) {
  if (v === null || v === undefined || !Number.isFinite(v)) return <SinDatos />
  return (
    <span className="tabular-nums">
      {fmtNum(v, decimales)}
      {unidad ? ` ${unidad}` : ''}
    </span>
  )
}

export function PctVivo({ v }: { v: number | null | undefined }) {
  if (v === null || v === undefined || !Number.isFinite(v)) return <SinDatos />
  return <span className="tabular-nums">{fmtPct(v)}</span>
}

/** Lista horizontal de chips. */
export function Chips({ children }: { children: ReactNode }) {
  return <ul className="flex flex-wrap gap-1.5">{children}</ul>
}
