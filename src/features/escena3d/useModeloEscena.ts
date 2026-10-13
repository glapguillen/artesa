import { useMemo } from 'react'
import { usePlantStore } from '../../store/usePlantStore'
import { construirModelo } from './modelo/construirModelo'
import type { ModeloEscena } from './modelo/tipos'

/** Modelo 3D derivado del layout (se recalcula solo si cambia el layout). */
export function useModeloEscena(): ModeloEscena | null {
  const layout = usePlantStore((s) => s.layout)
  const idx = usePlantStore((s) => s.idx)
  return useMemo(() => (layout && idx ? construirModelo(layout, idx) : null), [layout, idx])
}
