// Vista 3D de la planta: tarjeta con encabezado y controles, la escena (React Three Fiber) con sus
// avisos y controles superpuestos, y la lista de lo que no está ubicado en el croquis. Todo sale de
// plant-layout.json (useModeloEscena). Si no hay WebGL o la escena falla, se ofrece volver al 2D.
import { type KeyboardEvent, useId, useRef, useState } from 'react'
import { CONFIG } from '../../config'
import { usePlantStore } from '../../store/usePlantStore'
import { AYUDA_TECLADO, accionDeTecla } from './camara/teclado'
import { useRecorrido } from './camara/useRecorrido'
import { Escena } from './Escena'
import type { ModeloEscena } from './modelo/tipos'
import { AvisoSeleccion } from './ui/AvisoSeleccion'
import { AvisoSupuestos } from './ui/AvisoSupuestos'
import { Controles3D } from './ui/Controles3D'
import { DebugOverlay } from './ui/DebugOverlay'
import { ErrorBoundary3D, MensajeSin3D } from './ui/ErrorBoundary3D'
import { Leyenda3D } from './ui/Leyenda3D'
import { Navegacion3D } from './ui/Navegacion3D'
import { SinUbicar3D } from './ui/SinUbicar3D'
import { Tooltip3D } from './ui/Tooltip3D'
import { TourCaption } from './ui/TourCaption'
import { useVisible } from './ui/useVisible'
import { soportaWebGL2 } from './ui/webgl'
import { useModeloEscena } from './useModeloEscena'
import { useVista3D } from './useVista3D'

// @container: los controles se acomodan según el ancho de la tarjeta (no de la ventana), y
// contain:inline-size impide que el contenido ensanche la grilla de la página.
const TARJETA = 'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-borde bg-surface @container'

function descripcion(m: ModeloEscena): string {
  return (
    `Escena 3D con ${m.losas.length} zonas y ${m.equipos.length} equipos ubicados según el croquis. ` +
    `${m.zonasSinUbicar.length} zonas y ${m.equiposSinUbicar.length} equipos sin ubicar se listan bajo la escena. ` +
    `Para seleccionar con teclado use la lista «Ir a». Con el foco en la escena: ${AYUDA_TECLADO}.`
  )
}

function alTeclado(e: KeyboardEvent<HTMLDivElement>) {
  if (e.defaultPrevented || e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return
  const a = accionDeTecla(e.key, e.shiftKey)
  if (!a) return
  e.preventDefault()
  useVista3D.getState().camara?.accion(a)
}

function Lienzo({ modelo, visible }: { modelo: ModeloEscena; visible: boolean }) {
  const planta = usePlantStore((s) => s.layout?.planta)
  const descId = useId()
  if (!planta) return null
  return (
    <ErrorBoundary3D>
      <div
        role="application"
        aria-roledescription="escena 3D"
        aria-label="Escena 3D de la planta"
        aria-describedby={descId}
        tabIndex={0}
        onKeyDown={alTeclado}
        className="peer absolute inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-seleccion"
      >
        <Escena modelo={modelo} planta={planta} visible={visible} descripcionId={descId} />
      </div>
      <p id={descId} className="sr-only">
        {descripcion(modelo)}
      </p>
      <p className="pointer-events-none absolute top-14 left-1/2 z-20 hidden w-max max-w-[calc(100%-1rem)] -translate-x-1/2 rounded-md bg-surface/95 px-2 py-1 text-center text-[11px] text-tenue shadow-sm peer-focus-visible:block">
        {AYUDA_TECLADO}
      </p>
      <AvisoSupuestos modelo={modelo} />
      <AvisoSeleccion modelo={modelo} />
      <Leyenda3D />
      <Navegacion3D />
      <TourCaption />
      <Tooltip3D />
      {CONFIG.debug && <DebugOverlay />}
    </ErrorBoundary3D>
  )
}

export function Scene3DView() {
  const layout = usePlantStore((s) => s.layout)
  const modelo = useModeloEscena()
  const raiz = useRef<HTMLDivElement>(null)
  const visible = useVisible(raiz)
  const [webgl] = useState(soportaWebGL2)
  useRecorrido()

  if (!layout || !modelo) {
    return (
      <div data-testid="scene3d-view" className={`${TARJETA} items-center justify-center text-sm text-tenue`}>
        Sin layout cargado.
      </div>
    )
  }
  return (
    <div ref={raiz} data-testid="scene3d-view" className={TARJETA}>
      <Controles3D modelo={modelo} version={layout.version} />
      <div className="relative isolate min-h-0 flex-1 overflow-hidden">
        {webgl ? (
          <Lienzo modelo={modelo} visible={visible} />
        ) : (
          <MensajeSin3D
            titulo="Este navegador o equipo no puede mostrar la vista 3D (WebGL 2 no está disponible)."
            detalle="El plano 2D muestra la misma información de la planta. Si el problema sigue, active la aceleración por hardware del navegador."
          />
        )}
      </div>
      <SinUbicar3D modelo={modelo} />
    </div>
  )
}
