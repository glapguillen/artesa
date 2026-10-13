// Botón "!" en la cima de una baliza de alarma: abre el detalle de su referencia. Área táctil de
// 40 px; el número indica cuántas alarmas activas tiene esa referencia.
import { Html } from '@react-three/drei'
import { NIVEL_ALARMA_ETIQUETA } from '../../../ui/tokens'
import type { Baliza } from '../rutaAlarmasModelo'

interface Props {
  baliza: Baliza
  color: string
  texto: string
  onElegir: () => void
}

export function BotonAlarma({ baliza: b, color, texto, onElegir }: Props) {
  const n = b.alarmas.length
  const nivel = NIVEL_ALARMA_ETIQUETA[b.nivel].toLowerCase()
  const mensajes = b.alarmas.map((a) => a.mensaje).join(' ')
  const chico = b.nivel === 'info'
  return (
    <Html position={[b.pos[0], b.cima, b.pos[2]]} center zIndexRange={[28, 25]}>
      <button
        type="button"
        data-alarma-3d={b.clave}
        data-nivel={b.nivel}
        aria-label={`Alarma ${nivel} en ${b.nombre}${n > 1 ? ` (${n} alarmas)` : ''}: ${mensajes} Abrir el detalle.`}
        title={mensajes}
        onClick={onElegir}
        className="grid size-10 cursor-pointer place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-seleccion"
      >
        <span
          aria-hidden="true"
          className={`relative grid place-items-center rounded-full font-bold shadow-md ${chico ? 'size-6 text-xs' : 'size-8 text-base'}`}
          style={{ background: color, color: texto, border: `2px solid ${texto}` }}
        >
          !
          {n > 1 && (
            <span
              className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full border border-borde bg-surface text-[10px] text-texto"
            >
              {n}
            </span>
          )}
        </span>
      </button>
    </Html>
  )
}
