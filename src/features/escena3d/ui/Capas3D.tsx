// Conmutadores de capas de la escena (etiquetas, muros en corte, flujos) y color de las zonas
// (Estado | Grupo, el mismo del 2D). En tarjetas angostas van en un menú "Capas".
import { useEffect, useId, useRef, useState } from 'react'
import { usePlantStore } from '../../../store/usePlantStore'
import { useVista3D } from '../useVista3D'
import { Boton, CLASE_BOTON, CLASE_GRUPO } from './botones'

export function Capas3D() {
  const etiquetas = useVista3D((s) => s.etiquetas)
  const muros = useVista3D((s) => s.muros)
  const flujos = useVista3D((s) => s.flujos)
  const { setEtiquetas, setMuros, setFlujos } = useVista3D.getState()
  const colorPor = usePlantStore((s) => s.colorPor)
  const setColorPor = usePlantStore((s) => s.setColorPor)
  const [abierto, setAbierto] = useState(false)
  const id = useId()
  const caja = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (e.target instanceof Node && !caja.current?.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto])

  return (
    <div ref={caja} className="relative">
      <button
        ref={boton}
        type="button"
        className={`${CLASE_BOTON} border border-borde bg-surface-2 @2xl:hidden`}
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto(!abierto)}
      >
        Capas
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" style={{ fill: 'none', stroke: 'currentColor' }} strokeWidth={1.5}>
          <path d={abierto ? 'M2 6.5 5 3.5 8 6.5' : 'M2 3.5 5 6.5 8 3.5'} />
        </svg>
      </button>
      <div
        id={id}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && abierto) {
            e.preventDefault()
            setAbierto(false)
            boton.current?.focus()
          }
        }}
        className={`${abierto ? 'flex' : 'hidden'} absolute top-full right-0 z-30 mt-1 w-max max-w-[calc(100vw-2rem)] flex-col items-end gap-2 rounded-lg border border-borde bg-surface p-2 shadow-lg @2xl:static @2xl:mt-0 @2xl:flex @2xl:flex-row @2xl:flex-wrap @2xl:items-center @2xl:border-0 @2xl:bg-transparent @2xl:p-0 @2xl:shadow-none`}
      >
        <div className={CLASE_GRUPO} role="group" aria-label="Capas de la escena">
          <Boton etiqueta="Etiquetas de todas las zonas" pulsado={etiquetas} onClick={() => setEtiquetas(!etiquetas)}>
            Etiquetas
          </Boton>
          <Boton etiqueta="Muros en corte (bajos para ver el interior)" pulsado={muros} onClick={() => setMuros(!muros)}>
            Muros
          </Boton>
          <Boton etiqueta="Flujos de material" pulsado={flujos} onClick={() => setFlujos(!flujos)}>
            Flujos
          </Boton>
        </div>
        <div className={CLASE_GRUPO} role="group" aria-label="Color de las zonas">
          <span className="px-1 text-xs text-tenue">Color:</span>
          <Boton etiqueta="Color por estado" pulsado={colorPor === 'estado'} onClick={() => setColorPor('estado')}>
            Estado
          </Boton>
          <Boton etiqueta="Color por grupo" pulsado={colorPor === 'grupo'} onClick={() => setColorPor('grupo')}>
            Grupo
          </Boton>
        </div>
      </div>
    </div>
  )
}
