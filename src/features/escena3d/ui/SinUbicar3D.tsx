// Zonas y equipos que existen en el layout pero no tienen polígono en el croquis: no se dibujan
// dentro de la planta (no se sabe dónde están), se listan aquí. Clic → panel con [POR DEFINIR].
import { useMemo } from 'react'
import type { EstadoOperativo } from '../../../domain/live'
import { estadoDeZona } from '../../../domain/selectors'
import { usePlantStore } from '../../../store/usePlantStore'
import { colorEstado, ESTADO_ETIQUETA } from '../../../ui/tokens'
import { resaltadoDeSeleccion } from '../../planta/planLive'
import type { ElementoSinUbicar, ModeloEscena } from '../modelo/tipos'

const CHIP =
  'inline-flex h-10 max-w-[16rem] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-borde bg-surface-2 px-2.5 text-texto ' +
  'hover:border-seleccion focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-seleccion ' +
  'aria-pressed:border-solid aria-pressed:border-seleccion aria-pressed:ring-1 aria-pressed:ring-seleccion xl:h-7 pointer-coarse:h-10'

interface ChipProps {
  el: ElementoSinUbicar
  tipo: 'zona' | 'equipo'
  estado: EstadoOperativo
  pulsado: boolean
  onClick: () => void
}

function Chip({ el, tipo, estado, pulsado, onClick }: ChipProps) {
  const datos = tipo === 'zona' ? { 'data-zona-id': el.id } : { 'data-equipo-id': el.id }
  const que = tipo === 'zona' ? 'Zona' : 'Equipo'
  return (
    <button
      type="button"
      {...datos}
      className={CHIP}
      aria-pressed={pulsado}
      aria-label={`${que} ${el.nombre}, sin ubicar en el croquis · ${ESTADO_ETIQUETA[estado]}`}
      title={`${que} sin ubicar en el croquis · ${ESTADO_ETIQUETA[estado]}`}
      onClick={onClick}
    >
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: colorEstado(estado) }} />
      <span className="truncate">{el.nombre}</span>
    </button>
  )
}

export function SinUbicar3D({ modelo }: { modelo: ModeloEscena }) {
  const idx = usePlantStore((s) => s.idx)
  const live = usePlantStore((s) => s.live)
  const seleccion = usePlantStore((s) => s.seleccion)
  const seleccionar = usePlantStore((s) => s.seleccionar)
  const resalte = useMemo(() => resaltadoDeSeleccion(idx, seleccion), [idx, seleccion])
  const { zonasSinUbicar: zonas, equiposSinUbicar: equipos } = modelo
  if (!zonas.length && !equipos.length) return null

  const estadoEquipo = (id: string): EstadoOperativo => live?.equipos[id]?.estado ?? 'sin_datos'
  const equipoPulsado = (e: ElementoSinUbicar) =>
    (seleccion?.tipo === 'equipo' && seleccion.id === e.id) || (seleccion?.tipo === 'etapa' && e.etapas.includes(seleccion.id))
  return (
    <div
      data-testid="sin-ubicar-3d"
      role="group"
      aria-label="Sin ubicar en el croquis"
      className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-t border-borde px-3 py-2 text-xs @2xl:flex-wrap"
    >
      <span className="shrink-0 text-tenue" title="Existen en el layout pero no tienen polígono: no se dibujan dentro de la planta">
        Sin ubicar en el croquis:
      </span>
      {zonas.map((z) => (
        <Chip
          key={z.id}
          el={z}
          tipo="zona"
          estado={idx ? estadoDeZona(idx, live, z.id) : 'sin_datos'}
          pulsado={resalte.has(z.id)}
          onClick={() => seleccionar({ tipo: 'zona', id: z.id })}
        />
      ))}
      {equipos.map((e) => (
        <Chip key={e.id} el={e} tipo="equipo" estado={estadoEquipo(e.id)} pulsado={equipoPulsado(e)} onClick={() => seleccionar({ tipo: 'equipo', id: e.id })} />
      ))}
    </div>
  )
}
