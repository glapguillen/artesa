// Colores vivos de las losas: estado o grupo (mismo conmutador que el 2D), atenuación fuera de la
// ruta activa y realce del hover. Las funciones de estado y ruta son las del dominio y del 2D.
import { useMemo } from 'react'
import type { EstadoOperativo } from '../../../domain/live'
import { zonasDeRuta } from '../../../domain/selectors'
import { usePlantStore } from '../../../store/usePlantStore'
import { estadosDeZonas } from '../../planta/planLive'
import type { ModeloEscena } from '../modelo/tipos'
import { colorLosa, esRayada } from '../presentacion'
import type { Paleta3D } from '../usePaleta3D'
import { useVista3D } from '../useVista3D'

export interface ColoresLosas {
  colores: Map<string, { relleno: string; borde: string }>
  estados: Record<string, EstadoOperativo>
}

export function useColoresLosas(modelo: ModeloEscena, paleta: Paleta3D): ColoresLosas {
  const layout = usePlantStore((s) => s.layout)
  const idx = usePlantStore((s) => s.idx)
  const live = usePlantStore((s) => s.live)
  const colorPor = usePlantStore((s) => s.colorPor)
  const rutaActiva = usePlantStore((s) => s.rutaActiva)
  const hoverId = useVista3D((s) => s.hover?.id ?? null)
  const ids = useMemo(() => modelo.losas.map((l) => l.id), [modelo])
  const estados = useMemo(() => estadosDeZonas(idx, live, ids), [idx, live, ids])
  const enRuta = useMemo(
    () => (rutaActiva && layout && idx ? new Set(zonasDeRuta(layout, idx, rutaActiva).map((z) => z.id)) : null),
    [rutaActiva, layout, idx],
  )
  const colores = useMemo(
    () =>
      new Map(
        modelo.losas.map((l) => [
          l.id,
          colorLosa(paleta, {
            colorPor,
            estado: estados[l.id] ?? 'sin_datos',
            colorGrupo: l.color,
            rayada: esRayada(l.grupo),
            atenuada: enRuta !== null && !enRuta.has(l.id),
            hover: l.id === hoverId,
          }),
        ]),
      ),
    [modelo, paleta, colorPor, estados, enRuta, hoverId],
  )
  return { colores, estados }
}
