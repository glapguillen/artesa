import { usePlantStore, type ModoPlanta } from '../store/usePlantStore'

const OPCIONES: Array<{ id: ModoPlanta; texto: string }> = [
  { id: '2d', texto: 'Plano 2D' },
  { id: '3d', texto: 'Vista 3D' },
]

/** Conmutador de la sección de planta entre el plano 2D y la escena 3D. */
export function ModoPlantaToggle() {
  const modo = usePlantStore((s) => s.modoPlanta)
  const setModo = usePlantStore((s) => s.setModoPlanta)
  return (
    <div role="group" aria-label="Vista de la planta" className="inline-flex rounded-lg border border-borde bg-surface p-0.5 text-sm">
      {OPCIONES.map((o) => (
        <button
          key={o.id}
          type="button"
          data-modo-planta={o.id}
          aria-pressed={modo === o.id}
          onClick={() => setModo(o.id)}
          className={`rounded-md px-3 py-1 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-seleccion ${
            modo === o.id ? 'bg-acento text-white' : 'text-tenue hover:text-texto'
          }`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}
