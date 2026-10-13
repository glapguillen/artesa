// Muestras de la notación del plano y del diagrama (líneas, "?", rayado, alarmas, ruta y decisión).
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

/** Flecha discontinua del diagrama: aristas de insumo, registro o configuración. */
export function MuestraFlechaSecundaria() {
  return (
    <Muestra>
      <line x1="1" y1="6" x2="16" y2="6" stroke="var(--c-muted)" strokeWidth={1.25} strokeDasharray="3 2" />
      <path d="M15 3l5 3-5 3z" fill="var(--c-muted)" />
    </Muestra>
  )
}

/** Doble borde de las etapas de decisión del diagrama. */
export function MuestraDecision() {
  return (
    <Muestra>
      <rect x="0.75" y="0.75" width="20.5" height="10.5" rx="2" stroke="var(--c-text)" strokeWidth={0.9} />
      <rect x="2.75" y="2.75" width="16.5" height="6.5" rx="1" stroke="var(--c-text)" strokeWidth={0.9} />
    </Muestra>
  )
}

/** Anillos de alarma del plano: crítica (rojo) y advertencia (ámbar). */
export function MuestraAlarma() {
  return (
    <Muestra>
      <circle cx="6" cy="6" r="4.5" stroke="var(--c-estado-detenido)" strokeWidth={1.75} />
      <circle cx="16" cy="6" r="4.5" stroke="var(--c-estado-espera)" strokeWidth={1.75} />
    </Muestra>
  )
}

/** Ruta de decoración resaltada y contorno de la selección. */
export function MuestraRutaSeleccion() {
  return (
    <Muestra>
      <line x1="1" y1="9" x2="11" y2="9" stroke="var(--c-ruta)" strokeWidth={2.5} strokeLinecap="round" />
      <rect x="13" y="1.5" width="8" height="9" rx="1.5" stroke="var(--c-seleccion)" strokeWidth={2} />
    </Muestra>
  )
}
