// Leyenda de la escena. En tarjetas anchas, los estados (o el aviso de color por grupo) están
// siempre a la vista y el resto se despliega; en angostas, todo cabe tras un botón "Leyenda".
// Incluye la notación de las losas y la de las capas de contenido (equipos, flujos, ruta, alarmas).
import { usePlantStore } from '../../../store/usePlantStore'
import { colorEstado, ESTADO_ETIQUETA, ESTADOS } from '../../../ui/tokens'
import { LeyendaCapas3D } from '../capas/LeyendaCapas3D'
import { CELDA, SECCION } from '../geometriaEscena'

const RESUMEN =
  'inline-flex h-10 cursor-pointer list-none items-center gap-1 font-medium text-tenue select-none hover:text-texto ' +
  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-seleccion xl:h-7 pointer-coarse:h-10'

function Triangulo() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden="true" className="transition-transform group-open:rotate-90" style={{ fill: 'currentColor' }}>
      <path d="M3 1.5 7.5 5 3 8.5z" />
    </svg>
  )
}

function Colores() {
  const colorPor = usePlantStore((s) => s.colorPor)
  if (colorPor === 'grupo') return <p className="text-tenue">Zonas con el color de su grupo, como en el plano 2D.</p>
  return (
    <ul aria-label="Estados de las zonas" className="flex flex-wrap gap-x-2.5 gap-y-0.5">
      {ESTADOS.map((e) => (
        <li key={e} className="inline-flex items-center gap-1">
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-sm" style={{ background: colorEstado(e) }} />
          {ESTADO_ETIQUETA[e]}
        </li>
      ))}
    </ul>
  )
}

function Notacion() {
  return (
    <>
      <ul className="mb-1 space-y-0.5 text-tenue">
        <li>Borde continuo: recinto cerrado · discontinuo y translúcido: área abierta.</li>
        <li>Trama rayada: zona sin rótulo o por identificar.</li>
        <li>
          Cuadrícula de {CELDA} m (líneas fuertes cada {SECCION} m), escala supuesta.
        </li>
      </ul>
      <LeyendaCapas3D />
    </>
  )
}

export function Leyenda3D() {
  return (
    <div
      data-testid="leyenda-3d"
      className="absolute bottom-2 left-2 z-20 max-h-[60%] max-w-[min(22rem,calc(100%-4.5rem))] overflow-y-auto rounded-lg border border-borde bg-surface/95 px-2.5 py-0.5 text-[11px] text-texto shadow-sm @lg:py-1.5"
    >
      <div className="hidden @lg:block">
        <Colores />
        <details className="group mt-0.5">
          <summary className={RESUMEN}>
            <Triangulo />
            Más leyenda
          </summary>
          <Notacion />
        </details>
      </div>
      <details className="group @lg:hidden">
        <summary className={RESUMEN}>
          <Triangulo />
          Leyenda
        </summary>
        <div className="space-y-1.5 pb-1.5">
          <Colores />
          <Notacion />
        </div>
      </details>
    </div>
  )
}
