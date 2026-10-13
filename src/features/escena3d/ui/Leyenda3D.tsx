// Leyenda de la escena: los estados (o el aviso de color por grupo) siempre visibles, y plegable
// la notación de las losas y la de las capas de contenido (equipos, flujos, ruta, alarmas).
import { usePlantStore } from '../../../store/usePlantStore'
import { colorEstado, ESTADO_ETIQUETA, ESTADOS } from '../../../ui/tokens'
import { LeyendaCapas3D } from '../capas/LeyendaCapas3D'
import { CELDA, SECCION } from '../geometriaEscena'

export function Leyenda3D() {
  const colorPor = usePlantStore((s) => s.colorPor)
  return (
    <div
      data-testid="leyenda-3d"
      className="absolute bottom-2 left-2 z-20 max-h-[60%] max-w-[min(22rem,calc(100%-4.5rem))] overflow-y-auto rounded-lg border border-borde bg-surface/95 px-2.5 py-1.5 text-[11px] text-texto shadow-sm"
    >
      {colorPor === 'estado' ? (
        <ul aria-label="Estados de las zonas" className="flex flex-wrap gap-x-2.5 gap-y-0.5">
          {ESTADOS.map((e) => (
            <li key={e} className="inline-flex items-center gap-1">
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ background: colorEstado(e) }} />
              {ESTADO_ETIQUETA[e]}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-tenue">Zonas con el color de su grupo, como en el plano 2D.</p>
      )}
      <details className="group mt-0.5">
        <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-1 font-medium text-tenue select-none hover:text-texto focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-seleccion xl:h-7 pointer-coarse:h-10">
          <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" className="transition-transform group-open:rotate-90" style={{ fill: 'currentColor' }}>
            <path d="M3 1.5 7.5 5 3 8.5z" />
          </svg>
          Más leyenda
        </summary>
        <ul className="mb-1 space-y-0.5 text-tenue">
          <li>Borde continuo: recinto cerrado · discontinuo y translúcido: área abierta.</li>
          <li>Trama rayada: zona sin rótulo o por identificar.</li>
          <li>
            Cuadrícula de {CELDA} m (líneas fuertes cada {SECCION} m), escala supuesta.
          </li>
        </ul>
        <LeyendaCapas3D />
      </details>
    </div>
  )
}
