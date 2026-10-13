// Resaltes por etapa que dependen del estado en vivo o de la selección: alarmas y etapas seleccionadas.
import type { LiveState, NivelAlarma } from '../../domain/live'
import type { LayoutIndex } from '../../domain/selectors'
import type { Seleccion } from '../../store/usePlantStore'

const GRAVEDAD: Record<NivelAlarma, number> = { info: 1, advertencia: 2, critica: 3 }

/** Nivel más grave de alarma por etapa (alarmas de la etapa o de un equipo de la etapa). */
export function alarmasPorEtapa(idx: LayoutIndex, live: LiveState | null): Map<string, NivelAlarma> {
  const out = new Map<string, NivelAlarma>()
  const marcar = (codigo: string, nivel: NivelAlarma) => {
    const previo = out.get(codigo)
    if (!previo || GRAVEDAD[nivel] > GRAVEDAD[previo]) out.set(codigo, nivel)
  }
  for (const a of live?.alarmas ?? []) {
    if (a.ref?.tipo === 'etapa') marcar(a.ref.id, a.nivel)
    else if (a.ref?.tipo === 'equipo') {
      const eq = idx.equiposPorId.get(a.ref.id)
      if (eq) marcar(eq.etapa, a.nivel)
    }
  }
  return out
}

/** Etapas resaltadas por la selección (etapa, zona o equipo). */
export function etapasSeleccionadas(idx: LayoutIndex, sel: Seleccion | null): Map<string, 'principal' | 'probable'> {
  const out = new Map<string, 'principal' | 'probable'>()
  if (!sel) return out
  if (sel.tipo === 'etapa') out.set(sel.id, 'principal')
  else if (sel.tipo === 'equipo') {
    const eq = idx.equiposPorId.get(sel.id)
    if (eq) out.set(eq.etapa, 'principal')
  } else {
    const z = idx.zonasPorId.get(sel.id)
    for (const c of z?.etapas_hipotesis ?? []) out.set(c, 'probable')
    for (const c of z?.etapas ?? []) out.set(c, 'principal')
  }
  return out
}
