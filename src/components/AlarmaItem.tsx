// Una fila del menú de alarmas: nivel con color, mensaje y hora de inicio.
import type { Alarma } from '../domain/live'
import { fmtHora, NIVEL_ALARMA_ETIQUETA } from '../ui/tokens'
import { colorNivel } from './alarmasModel'

interface Props {
  alarma: Alarma
  /** Sin función: la alarma no apunta a nada seleccionable. */
  onElegir?: () => void
}

function Contenido({ alarma }: { alarma: Alarma }) {
  const color = colorNivel(alarma.nivel)
  return (
    <>
      <span aria-hidden="true" className="mt-1 size-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-2 text-[11px]">
          <span className="font-semibold text-texto">{NIVEL_ALARMA_ETIQUETA[alarma.nivel]}</span>
          <span className="shrink-0 text-tenue tabular-nums">desde {fmtHora(alarma.desde)}</span>
        </span>
        <span className="text-xs leading-snug break-words text-texto">{alarma.mensaje}</span>
      </span>
    </>
  )
}

export function AlarmaItem({ alarma, onElegir }: Props) {
  const borde = { borderLeftColor: colorNivel(alarma.nivel) }
  const clases = 'flex w-full gap-2 rounded-md border-l-[3px] px-2 py-1.5 text-left'
  if (!onElegir || !alarma.ref) {
    return (
      <li className={clases} style={borde}>
        <Contenido alarma={alarma} />
      </li>
    )
  }
  const destino = `${alarma.ref.tipo} ${alarma.ref.id}`
  return (
    <li>
      <button
        type="button"
        data-alarma-item=""
        onClick={onElegir}
        title={`Seleccionar ${destino}`}
        className={`${clases} cursor-pointer hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-seleccion`}
        style={borde}
      >
        <Contenido alarma={alarma} />
        <span className="sr-only">. Seleccionar {destino}</span>
      </button>
    </li>
  )
}
