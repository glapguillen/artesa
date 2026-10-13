// Encabezado de la vista 3D: título, procedencia y supuestos, vistas de cámara, recorrido, "Ir a"
// y capas. Los controles se acomodan en varias filas en pantallas angostas (sin desbordar).
import { useMemo } from 'react'
import { usePlantStore } from '../../../store/usePlantStore'
import { useTour } from '../camara/estadoTour'
import { pasosRecorrido } from '../camara/tour'
import type { ModeloEscena } from '../modelo/tipos'
import { destinoDeSeleccion } from '../presentacion'
import { useVista3D, type Vista3D } from '../useVista3D'
import { Boton, CLASE_BOTON, CLASE_GRUPO } from './botones'
import { Capas3D } from './Capas3D'
import { IrAZona } from './IrAZona'

const VISTAS: Array<{ id: Vista3D; texto: string; etiqueta: string }> = [
  { id: 'general', texto: 'General', etiqueta: 'Vista general (reiniciar vista)' },
  { id: 'cenital', texto: 'Cenital', etiqueta: 'Vista cenital (desde arriba)' },
  { id: 'zona', texto: 'Zona', etiqueta: 'Encuadrar la zona seleccionada' },
]

function BotonRecorrido() {
  const layout = usePlantStore((s) => s.layout)
  const idx = usePlantStore((s) => s.idx)
  const activo = useTour((s) => s.activo)
  const pasos = useMemo(() => (layout && idx ? pasosRecorrido(layout, idx) : []), [layout, idx])
  return (
    <button
      type="button"
      data-testid="tour-boton"
      className={`${CLASE_BOTON} border border-borde bg-surface-2 font-medium`}
      aria-pressed={activo}
      disabled={!pasos.length}
      title={activo ? 'Salir del recorrido y volver a la vista anterior' : 'Recorrido por las etapas del proceso, en orden'}
      onClick={() => (activo ? useTour.getState().detener(true) : useTour.getState().iniciar(pasos))}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" style={{ fill: 'currentColor' }}>
        {activo ? <rect x="2" y="2" width="8" height="8" rx="1" /> : <path d="M3 1.5v9l7.5-4.5z" />}
      </svg>
      {activo ? 'Salir del recorrido' : 'Recorrido'}
    </button>
  )
}

export function Controles3D({ modelo, version }: { modelo: ModeloEscena; version: string }) {
  const idx = usePlantStore((s) => s.idx)
  const seleccion = usePlantStore((s) => s.seleccion)
  const camara = useVista3D((s) => s.camara)
  const conDestino = destinoDeSeleccion(modelo, idx, seleccion)?.tipo === 'escena'
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-borde px-3 py-2">
      <div className="min-w-0 flex-1 basis-52">
        <h2 className="text-sm font-semibold text-texto">Vista 3D</h2>
        <p className="text-xs leading-tight text-tenue">Generada desde el layout v{version} · escala, norte y alturas supuestos</p>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className={CLASE_GRUPO} role="group" aria-label="Vista de cámara">
          {VISTAS.map((v) => (
            <Boton
              key={v.id}
              etiqueta={v.etiqueta}
              datos={{ 'data-vista3d': v.id }}
              disabled={!camara || (v.id === 'zona' && !conDestino)}
              onClick={() => camara?.vista(v.id)}
            >
              {v.texto}
            </Boton>
          ))}
        </div>
        <BotonRecorrido />
        <IrAZona modelo={modelo} />
        <Capas3D />
      </div>
    </div>
  )
}
