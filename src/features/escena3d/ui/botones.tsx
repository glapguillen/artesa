// Botón y grupo de botones de la barra 3D. Táctiles de 40 px; en escritorio ancho, 32 px.
import type { ReactNode } from 'react'

export const CLASE_BOTON =
  'inline-flex h-10 min-w-10 cursor-pointer items-center justify-center gap-1 rounded-md px-2.5 text-xs text-texto ' +
  'hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-seleccion ' +
  'disabled:cursor-default disabled:opacity-40 aria-pressed:bg-surface aria-pressed:font-semibold ' +
  'aria-pressed:text-acento aria-pressed:shadow-sm xl:h-8 xl:min-w-8 pointer-coarse:h-10'

export const CLASE_GRUPO = 'inline-flex items-center gap-0.5 rounded-lg border border-borde bg-surface-2 p-0.5'

interface BotonProps {
  etiqueta: string
  onClick: () => void
  pulsado?: boolean
  disabled?: boolean
  datos?: Record<`data-${string}`, string>
  children: ReactNode
}

export function Boton({ etiqueta, onClick, pulsado, disabled, datos, children }: BotonProps) {
  return (
    <button
      type="button"
      className={CLASE_BOTON}
      aria-label={etiqueta}
      title={etiqueta}
      aria-pressed={pulsado}
      disabled={disabled}
      onClick={onClick}
      {...datos}
    >
      {children}
    </button>
  )
}
