// Selección que muestra la escena 3D: la global del store o, durante un recorrido sin selección
// global (pantallas angostas), la etapa del paso en curso.
import { useMemo } from 'react'
import { type Seleccion, usePlantStore } from '../../../store/usePlantStore'
import { etapaDelPaso, useTour } from './estadoTour'

const etapaLocal = (t: ReturnType<typeof useTour.getState>) => (t.activo && !t.global ? etapaDelPaso(t.pasos[t.indice]) : null)

function combinar(sel: Seleccion | null, etapa: string | null): Seleccion | null {
  return sel ?? (etapa ? { tipo: 'etapa', id: etapa } : null)
}

export function useSeleccion3D(): Seleccion | null {
  const sel = usePlantStore((s) => s.seleccion)
  const etapa = useTour(etapaLocal)
  return useMemo(() => combinar(sel, etapa), [sel, etapa])
}

/** Lo mismo, leído al momento (fuera del render). */
export const seleccion3DActual = (): Seleccion | null => combinar(usePlantStore.getState().seleccion, etapaLocal(useTour.getState()))
