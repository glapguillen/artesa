// Aviso breve y descartable de lo que la escena supone (escala, norte, alturas en corte, envolventes
// sin dibujar, equipos representativos): una línea y el detalle plegable. Al cerrarlo queda un
// botón "Supuestos" para volver a verlo.
import { useMemo } from 'react'
import { usePlantStore } from '../../../store/usePlantStore'
import type { ModeloEscena } from '../modelo/tipos'
import { supuestosDeEscena } from '../presentacion'
import { useVista3D } from '../useVista3D'

const FOCO = 'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-seleccion'
const TACTIL = 'h-10 xl:h-7 pointer-coarse:h-10'

export function AvisoSupuestos({ modelo }: { modelo: ModeloEscena }) {
  const layout = usePlantStore((s) => s.layout)
  const oculto = useVista3D((s) => s.avisoOculto)
  const setOculto = useVista3D((s) => s.setAvisoOculto)
  const textos = useMemo(() => (layout ? supuestosDeEscena(layout, modelo) : []), [layout, modelo])
  if (!textos.length) return null

  if (oculto) {
    return (
      <button
        type="button"
        data-testid="aviso-supuestos-abrir"
        onClick={() => setOculto(false)}
        aria-label="Ver los supuestos de la escena 3D"
        className={`absolute top-2 left-2 z-20 inline-flex cursor-pointer items-center rounded-md border border-borde bg-surface/90 px-2.5 text-xs font-medium text-aviso shadow-sm ${TACTIL} ${FOCO}`}
      >
        Supuestos
      </button>
    )
  }
  return (
    <section
      data-testid="aviso-supuestos"
      aria-label="Supuestos de la escena 3D"
      className="absolute top-2 left-2 z-20 max-h-[45%] w-[min(21rem,calc(100%-1rem))] overflow-y-auto rounded-lg border border-borde bg-surface/95 py-1 pr-1 pl-2.5 text-xs text-texto shadow-md"
    >
      <div className="flex items-start gap-1">
        <p className="flex-1 py-1 leading-snug">
          <span className="font-semibold text-aviso">Layout preliminar:</span> escala, norte y alturas supuestos; equipos con tamaño
          representativo.
        </p>
        <button
          type="button"
          onClick={() => setOculto(true)}
          aria-label="Ocultar el aviso de supuestos"
          className={`inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-tenue hover:bg-bg hover:text-texto xl:size-7 pointer-coarse:size-10 ${FOCO}`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.75}>
            <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <details className="group">
        <summary className={`inline-flex cursor-pointer list-none items-center gap-1 rounded-md text-tenue hover:text-texto ${TACTIL} ${FOCO}`}>
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" className="transition-transform group-open:rotate-90" style={{ fill: 'currentColor' }}>
            <path d="M3 1.5 7.5 5 3 8.5z" />
          </svg>
          Detalle de los supuestos
        </summary>
        <ul className="list-disc space-y-0.5 pr-1.5 pb-1.5 pl-4 leading-snug text-tenue">
          {textos.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </details>
    </section>
  )
}
