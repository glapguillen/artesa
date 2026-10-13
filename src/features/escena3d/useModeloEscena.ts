import { useMemo } from 'react'
import { usePlantStore } from '../../store/usePlantStore'
import { construirModelo } from './modelo/construirModelo'
import type { ModeloEscena } from './modelo/tipos'

/** Modelo 3D derivado del layout (se recalcula solo si cambia el layout). */
export function useModeloEscena(): ModeloEscena | null {
  const layout = usePlantStore((s) => s.layout)
  return useMemo(() => (layout ? construirModelo(layout) : null), [layout])
}
