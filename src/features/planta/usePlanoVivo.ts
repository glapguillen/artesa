// Suscripciones del plano al store: estado en vivo, selección y ruta activa, ya agregados para
// dibujar. La geometría (Plano) no cambia con el estado en vivo; esto sí.
import { useMemo } from 'react'
import type { EstadoOperativo, LiveState, NivelAlarma } from '../../domain/live'
import { zonasDeRuta } from '../../domain/selectors'
import { usePlantStore } from '../../store/usePlantStore'
import { alarmasPorZona, estadosDeZonas, type Resalte, resaltadoDeSeleccion } from './planLive'
import type { GeoZona, Plano } from './planModel'

export interface PlanoVivo {
  live: LiveState | null
  estados: Record<string, EstadoOperativo>
  alarmas: Map<string, NivelAlarma>
  resalte: Map<string, Resalte>
}

export function usePlanoVivo(plano: Plano): PlanoVivo {
  const idx = usePlantStore((s) => s.idx)
  const live = usePlantStore((s) => s.live)
  const seleccion = usePlantStore((s) => s.seleccion)
  const ids = useMemo(() => [...plano.zonas.map((z) => z.id), ...plano.sinUbicar.map((z) => z.id)], [plano])
  const estados = useMemo(() => estadosDeZonas(idx, live, ids), [idx, live, ids])
  const alarmas = useMemo(() => alarmasPorZona(idx, live), [idx, live])
  const resalte = useMemo(() => resaltadoDeSeleccion(idx, seleccion), [idx, seleccion])
  return { live, estados, alarmas, resalte }
}

export interface RutaPlano {
  id: string
  codigo: string | null
  /** Zonas del recorrido, en orden (con polígono). */
  zonas: GeoZona[]
}

/** Ruta de decoración activa traducida a zonas del plano; null si no hay ruta activa. */
export function useRutaPlano(plano: Plano): RutaPlano | null {
  const layout = usePlantStore((s) => s.layout)
  const idx = usePlantStore((s) => s.idx)
  const rutaActiva = usePlantStore((s) => s.rutaActiva)
  return useMemo(() => {
    if (!rutaActiva || !layout || !idx) return null
    const zonas = zonasDeRuta(layout, idx, rutaActiva).flatMap((z) => plano.porId.get(z.id) ?? [])
    const codigo = layout.proceso.rutas_decoracion.find((r) => r.id === rutaActiva)?.codigo ?? null
    return { id: rutaActiva, codigo, zonas }
  }, [rutaActiva, layout, idx, plano])
}
