// Colores resueltos para three.js a partir de las variables CSS del tema (claro/oscuro).
// three.js no entiende var(--…): se leen con getComputedStyle y se recalculan al cambiar el tema.
import { useEffect, useState } from 'react'
import type { EstadoOperativo } from '../../domain/live'
import type { Fase } from '../../domain/types'
import { ESTADOS } from '../../ui/tokens'

export interface Paleta3D {
  oscuro: boolean
  estado: Record<EstadoOperativo, string>
  fase: Record<Fase, string>
  ruta: string
  seleccion: string
  texto: string
  tenue: string
  borde: string
  fondo: string
  superficie: string
  /** Opacidad para colores de grupo (más baja en oscuro). */
  opacidadZona: number
}

const FASES: Fase[] = ['nivel_0', 'A', 'B', 'F1', 'F2', 'F3', 'venta']

function leer(): Paleta3D {
  const cs = getComputedStyle(document.documentElement)
  const v = (n: string, def: string) => cs.getPropertyValue(n).trim() || def
  const estado = {} as Record<EstadoOperativo, string>
  for (const e of ESTADOS) estado[e] = v(`--c-estado-${e}`, '#9ca3af')
  const fase = {} as Record<Fase, string>
  for (const f of FASES) fase[f] = v(`--c-fase-${f}`, '#6b7280')
  return {
    oscuro: document.documentElement.classList.contains('dark'),
    estado,
    fase,
    ruta: v('--c-ruta', '#db2777'),
    seleccion: v('--c-seleccion', '#0ea5e9'),
    texto: v('--c-text', '#1f2328'),
    tenue: v('--c-muted', '#5c6168'),
    borde: v('--c-border', '#e2ded6'),
    fondo: v('--c-bg', '#f6f5f2'),
    superficie: v('--c-surface', '#ffffff'),
    opacidadZona: Number.parseFloat(v('--zona-opacidad', '0.85')) || 0.85,
  }
}

/** Paleta actual; se actualiza cuando cambia la clase .dark de <html>. */
export function usePaleta3D(): Paleta3D {
  const [p, setP] = useState<Paleta3D>(leer)
  useEffect(() => {
    const obs = new MutationObserver(() => setP(leer()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return p
}
