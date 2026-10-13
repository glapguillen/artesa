// Encabezado de la tarjeta del flujograma: título, conmutador de aristas secundarias y encuadre.
import { usePlantStore } from '../../store/usePlantStore'

const BOTON =
  'inline-flex h-7 min-w-7 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 text-xs text-texto ' +
  'hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-seleccion ' +
  'aria-pressed:bg-surface aria-pressed:font-semibold aria-pressed:text-acento aria-pressed:shadow-sm'
const GRUPO = 'inline-flex items-center gap-0.5 rounded-lg border border-borde bg-surface-2 p-0.5'

export function ProcessHeader({ onEncuadrar }: { onEncuadrar: () => void }) {
  const secundarias = usePlantStore((s) => s.mostrarSecundarias)
  const setSecundarias = usePlantStore((s) => s.setMostrarSecundarias)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-borde px-3 py-2">
      <div className="min-w-0 flex-1 basis-40">
        <h2 className="text-sm font-semibold text-texto">Flujograma ARTESA 2025</h2>
        <p className="text-xs leading-tight text-tenue">Fase 1 por FORMA · Fases 2 y 3 por SKU</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className={GRUPO}>
          <button
            type="button"
            className={BOTON}
            aria-pressed={secundarias}
            title="Mostrar las aristas de insumo, registro y configuración"
            onClick={() => setSecundarias(!secundarias)}
          >
            <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden="true" style={{ fill: 'none', stroke: 'currentColor' }}>
              <path d="M1 4h14" strokeWidth="1.5" strokeDasharray="3 2" />
            </svg>
            Insumos y configuración
          </button>
        </div>
        <div className={GRUPO}>
          <button
            type="button"
            className={BOTON}
            aria-label="Encuadrar todo el diagrama"
            title="Encuadrar todo el diagrama"
            onClick={onEncuadrar}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ fill: 'none', stroke: 'currentColor' }} strokeWidth={1.5}>
              <path d="M1 5V1H5M9 1H13V5M13 9V13H9M5 13H1V9" />
            </svg>
            Encuadrar
          </button>
        </div>
      </div>
    </div>
  )
}
