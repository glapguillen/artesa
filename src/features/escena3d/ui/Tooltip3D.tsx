// Tooltip de la zona bajo el puntero (escritorio): nombre y estado. No captura clics.
import { useVista3D } from '../useVista3D'

export function Tooltip3D() {
  const hover = useVista3D((s) => s.hover)
  if (!hover) return null
  return (
    <div
      role="tooltip"
      data-testid="tooltip-3d"
      className="pointer-events-none fixed z-30 max-w-[16rem] rounded-md border border-borde bg-surface px-2 py-1 text-xs text-texto shadow-md"
      style={{ left: hover.x + 14, top: hover.y + 14 }}
    >
      {hover.titulo}
    </div>
  )
}
