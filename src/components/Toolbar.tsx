// Barra de herramientas: pestañas Planta | Proceso (solo < lg) y selector de ruta de decoración.
import { RouteChips } from './RouteChips'
import { ViewTabs } from './ViewTabs'

export function Toolbar() {
  return (
    <div
      data-testid="toolbar"
      role="group"
      aria-label="Herramientas de las vistas"
      className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2"
    >
      <ViewTabs />
      <RouteChips />
    </div>
  )
}
