// Cuando lo seleccionado (zona, equipo o etapa) no está en el croquis, la cámara no vuela a ningún
// sitio: se avisa y se remite a la lista "Sin ubicar".
import { usePlantStore } from '../../../store/usePlantStore'
import type { ModeloEscena } from '../modelo/tipos'
import { destinoDeSeleccion } from '../presentacion'

export function AvisoSeleccion({ modelo }: { modelo: ModeloEscena }) {
  const idx = usePlantStore((s) => s.idx)
  const seleccion = usePlantStore((s) => s.seleccion)
  const d = destinoDeSeleccion(modelo, idx, seleccion)
  if (d?.tipo !== 'sin_ubicar') return null
  return (
    <p
      role="status"
      data-testid="aviso-sin-ubicar-3d"
      className="pointer-events-none absolute top-14 left-1/2 z-20 w-max max-w-[calc(100%-1rem)] -translate-x-1/2 rounded-md border border-dashed border-borde bg-surface/95 px-2.5 py-1.5 text-center text-xs text-texto shadow-sm"
    >
      «{d.nombre}» está sin ubicar en el croquis: no se dibuja en la planta (ver «Sin ubicar» abajo).
    </p>
  )
}
