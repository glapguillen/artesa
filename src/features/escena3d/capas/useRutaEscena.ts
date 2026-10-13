// Ruta activa traducida a la escena (camino, pasos y rótulo), compartida por la capa Ruta (dentro
// del lienzo) y el rótulo HTML de la ruta (fuera del lienzo).
import { useMemo } from 'react'
import { usePlantStore } from '../../../store/usePlantStore'
import type { ModeloEscena } from '../modelo/tipos'
import { rotuloRuta, rutaEscena, type RutaEscena } from '../rutaAlarmasModelo'

export function useRutaEscena(modelo: ModeloEscena | null): { ruta: RutaEscena; rotulo: string } | null {
  const layout = usePlantStore((s) => s.layout)
  const idx = usePlantStore((s) => s.idx)
  const rutaActiva = usePlantStore((s) => s.rutaActiva)
  const piezas = usePlantStore((s) => (s.rutaActiva ? s.live?.rutas?.[s.rutaActiva]?.piezas_turno : undefined))
  const ruta = useMemo(
    () => (rutaActiva && layout && idx && modelo ? rutaEscena(layout, idx, modelo, rutaActiva) : null),
    [rutaActiva, layout, idx, modelo],
  )
  return ruta ? { ruta, rotulo: rotuloRuta(ruta, piezas) } : null
}
