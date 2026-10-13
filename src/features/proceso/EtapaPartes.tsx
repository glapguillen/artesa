// Piezas pequeñas del nodo de etapa: chip de ubicación, indicador de alarma y rombo de decisión.
import type { NivelAlarma } from '../../domain/live'
import type { Ubicacion } from '../../domain/types'
import { colorEstado } from '../../ui/tokens'

const COLOR_ALARMA: Record<NivelAlarma, string> = {
  critica: colorEstado('detenido'),
  advertencia: colorEstado('espera'),
  info: 'var(--c-seleccion)',
}

const CHIP: Record<Ubicacion, string> = { ubicada: 'Ubicada', hipotesis: 'Probable', sin_ubicar: 'Sin ubicar' }

// Neutro a propósito: el rojo queda reservado para "Detenido / alarma", como dice la leyenda.
export function ChipUbicacion({ ubicacion, titulo }: { ubicacion: Ubicacion; titulo: string }) {
  const estilo =
    ubicacion === 'sin_ubicar'
      ? { borderStyle: 'dotted' as const, background: 'var(--c-surface-2)' }
      : ubicacion === 'hipotesis'
        ? { borderStyle: 'dashed' as const }
        : undefined
  return (
    <span
      title={titulo}
      className="shrink-0 rounded border border-borde px-1 text-[9px] leading-3.5 whitespace-nowrap text-tenue"
      style={estilo}
    >
      {CHIP[ubicacion]}
    </span>
  )
}

export function AlarmaIcono({ nivel, titulo }: { nivel: NivelAlarma; titulo: string }) {
  return (
    <svg width="14" height="13" viewBox="0 0 14 13" role="img" aria-label={titulo} className="shrink-0">
      <title>{titulo}</title>
      <path d="M7 1 13 12H1Z" style={{ fill: COLOR_ALARMA[nivel] }} strokeLinejoin="round" />
      <path d="M7 5v3.2M7 9.6v.6" style={{ stroke: 'var(--c-surface)' }} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function Rombo({ color }: { color: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className="shrink-0">
      <path d="M5 0.8 9.2 5 5 9.2 0.8 5Z" style={{ fill: 'none', stroke: color }} strokeWidth="1.6" />
    </svg>
  )
}
