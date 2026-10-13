// Botones de navegación sobre la escena (acercar, alejar, girar, reiniciar), útiles en pantallas
// táctiles y como alternativa al ratón. El teclado se describe en la ayuda de la escena.
import { GIRO } from '../camara/teclado'
import { type AccionCamara, useVista3D } from '../useVista3D'

const BOTON =
  'inline-flex size-10 cursor-pointer items-center justify-center rounded-md text-texto hover:bg-bg focus-visible:outline-2 ' +
  'focus-visible:outline-offset-1 focus-visible:outline-seleccion xl:size-8 pointer-coarse:size-10'

const ACCIONES: Array<{ accion: AccionCamara; etiqueta: string; icono: string }> = [
  { accion: { tipo: 'zoom', dir: 1 }, etiqueta: 'Acercar', icono: 'M7 2v10M2 7h10' },
  { accion: { tipo: 'zoom', dir: -1 }, etiqueta: 'Alejar', icono: 'M2 7h10' },
  { accion: { tipo: 'rotar', az: GIRO, pol: 0 }, etiqueta: 'Girar a la izquierda', icono: 'M11 4.5A5 5 0 1 0 12 8M11 1.5v3h-3' },
  { accion: { tipo: 'rotar', az: -GIRO, pol: 0 }, etiqueta: 'Girar a la derecha', icono: 'M3 4.5A5 5 0 1 1 2 8M3 1.5v3h3' },
  { accion: { tipo: 'vista', vista: 'general' }, etiqueta: 'Reiniciar vista', icono: 'M1.5 5V1.5H5M9 1.5h3.5V5M12.5 9v3.5H9M5 12.5H1.5V9' },
]

export function Navegacion3D() {
  const camara = useVista3D((s) => s.camara)
  if (!camara) return null
  return (
    <div
      role="group"
      aria-label="Navegación de la cámara"
      className="absolute right-2 bottom-2 z-20 flex flex-col gap-0.5 rounded-lg border border-borde bg-surface/90 p-0.5 shadow-sm"
    >
      {ACCIONES.map((a) => (
        <button key={a.etiqueta} type="button" className={BOTON} aria-label={a.etiqueta} title={a.etiqueta} onClick={() => camara.accion(a.accion)}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
            <path d={a.icono} />
          </svg>
        </button>
      ))}
    </div>
  )
}
