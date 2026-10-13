// Zonas sin polígono en el croquis: chips seleccionables con el color de su estado.
import type { EstadoOperativo } from '../../domain/live'
import type { Zona } from '../../domain/types'
import { colorEstado, ESTADO_ETIQUETA } from '../../ui/tokens'
import type { Resalte } from './planLive'

interface Props {
  zonas: Zona[]
  estados: Record<string, EstadoOperativo>
  resalte: Map<string, Resalte>
  onSeleccionar: (id: string) => void
}

export function Unplaced({ zonas, estados, resalte, onSeleccionar }: Props) {
  if (zonas.length === 0) return null
  return (
    <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-t border-borde px-3 py-2 text-xs sm:flex-wrap">
      <span className="shrink-0 whitespace-nowrap text-tenue">Sin ubicar en el croquis:</span>
      {zonas.map((z) => {
        const estado = estados[z.id] ?? 'sin_datos'
        const r = resalte.get(z.id)
        return (
          <button
            key={z.id}
            type="button"
            data-zona-id={z.id}
            aria-label={`${z.nombre} (sin ubicar en el croquis) · ${ESTADO_ETIQUETA[estado]}`}
            aria-pressed={r !== undefined}
            title={`${z.nombre} · ${ESTADO_ETIQUETA[estado]}`}
            onClick={() => onSeleccionar(z.id)}
            className="inline-flex max-w-[18rem] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-borde bg-surface-2 px-2 py-0.5 text-texto hover:border-seleccion focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-seleccion"
            style={r ? { borderColor: 'var(--c-seleccion)', borderStyle: r === 'solido' ? 'solid' : 'dashed', boxShadow: '0 0 0 1px var(--c-seleccion)' } : undefined}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorEstado(estado) }} />
            <span className="truncate">{z.nombre}</span>
          </button>
        )
      })}
    </div>
  )
}
