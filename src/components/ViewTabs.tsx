// Pestañas Planta | Proceso. Solo en pantallas angostas (< lg), donde se ve una vista a la vez.
import type { KeyboardEvent } from 'react'
import { usePlantStore } from '../store/usePlantStore'

type Vista = 'planta' | 'proceso'
const VISTAS: ReadonlyArray<{ id: Vista; etiqueta: string }> = [
  { id: 'planta', etiqueta: 'Planta' },
  { id: 'proceso', etiqueta: 'Proceso' },
]

export function ViewTabs() {
  const vista = usePlantStore((s) => s.vistaMovil)
  const setVista = usePlantStore((s) => s.setVistaMovil)

  // Flechas izquierda/derecha cambian de pestaña (patrón de pestañas con foco itinerante).
  const alTeclado = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const i = VISTAS.findIndex((v) => v.id === vista)
    const sig = VISTAS[(i + (e.key === 'ArrowRight' ? 1 : VISTAS.length - 1)) % VISTAS.length]
    if (!sig) return
    setVista(sig.id)
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-vista="${sig.id}"]`)?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Vista"
      onKeyDown={alTeclado}
      className="inline-flex shrink-0 gap-0.5 rounded-lg border border-borde bg-surface-2 p-0.5 lg:hidden"
    >
      {VISTAS.map((v) => {
        const activa = v.id === vista
        return (
          <button
            key={v.id}
            type="button"
            role="tab"
            data-vista={v.id}
            aria-controls={`vista-${v.id}`}
            aria-selected={activa}
            tabIndex={activa ? 0 : -1}
            onClick={() => setVista(v.id)}
            className="h-8 cursor-pointer rounded-md px-4 text-sm text-tenue hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-seleccion aria-selected:bg-surface aria-selected:font-semibold aria-selected:text-acento aria-selected:shadow-sm"
          >
            {v.etiqueta}
          </button>
        )
      })}
    </div>
  )
}
