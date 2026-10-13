// Rótulo de la ruta activa para la capa HTML de la vista 3D (fuera del lienzo): "Ruta R7 ·
// D+E+ID+D · 61 pzs/turno", con los pasos sin zona si los hay. Lo ubica la escena base junto a sus
// otros controles superpuestos; null si no hay ruta activa.
import type { ModeloEscena } from '../modelo/tipos'
import { useRutaEscena } from './useRutaEscena'

export function RotuloRuta3D({ modelo, className = '' }: { modelo: ModeloEscena; className?: string }) {
  const r = useRutaEscena(modelo)
  if (!r) return null
  return (
    <p
      data-testid="ruta-rotulo-3d"
      data-ruta-activa={r.ruta.id}
      aria-live="polite"
      className={`w-max max-w-full rounded-lg bg-ruta px-2.5 py-1 text-xs leading-snug font-bold text-surface shadow-md ${className}`}
    >
      {r.rotulo}
    </p>
  )
}
