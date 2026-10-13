// Muestras de la notación del plano y del diagrama (línea discontinua, "?" y rayado).
import type { ReactNode } from 'react'

function Muestra({ children }: { children: ReactNode }) {
  return (
    <svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true" className="shrink-0" fill="none">
      {children}
    </svg>
  )
}

export function MuestraDiscontinua() {
  return (
    <Muestra>
      <line x1="1" y1="6" x2="21" y2="6" stroke="var(--c-text)" strokeWidth={1.5} strokeDasharray="4 3" />
    </Muestra>
  )
}

export function MuestraProbable() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-dashed border-tenue text-[10px] leading-none font-bold text-texto"
    >
      ?
    </span>
  )
}

export function MuestraRayado() {
  return (
    <Muestra>
      <g stroke="var(--c-muted)" strokeWidth={1}>
        <line x1="-4" y1="12" x2="8" y2="0" />
        <line x1="2" y1="12" x2="14" y2="0" />
        <line x1="8" y1="12" x2="20" y2="0" />
        <line x1="14" y1="12" x2="26" y2="0" />
      </g>
      <rect x="0.5" y="0.5" width="21" height="11" rx="1.5" stroke="var(--c-text)" />
    </Muestra>
  )
}
