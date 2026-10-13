// Tooltip de un equipo al pasar el puntero (escritorio): nombre, estado, instancias y la
// advertencia de forma y tamaño representativos.
import type { EstadoOperativo } from '../../../domain/live'
import { ESTADO_ETIQUETA, fmtNum, POR_DEFINIR } from '../../../ui/tokens'
import { cimaDeEquipo } from '../formas/envolventes'
import type { Equipo3D } from '../modelo/tipos'
import { HtmlEscena as Html } from './HtmlEscena'

export function EquipoTooltip({ equipo, estado }: { equipo: Equipo3D; estado: EstadoOperativo }) {
  const pos = cimaDeEquipo(equipo, 1.6)
  if (!pos) return null
  const n = equipo.instancias.length
  return (
    <Html position={pos} center zIndexRange={[29, 29]} pointerEvents="none">
      <div
        role="tooltip"
        data-testid="equipo-tooltip"
        className="pointer-events-none w-max max-w-[15rem] -translate-y-1/2 rounded-md border border-borde bg-surface px-2 py-1 text-xs leading-snug text-texto shadow-md"
      >
        <p className="font-semibold">{equipo.nombre}</p>
        <p>
          {ESTADO_ETIQUETA[estado]}
          {n > 1 ? ` · ${fmtNum(n)} instancias` : ''}
        </p>
        {equipo.representativo && <p className="text-tenue">Forma y tamaño representativos · {POR_DEFINIR}</p>}
        <p className="text-tenue">Clic para ver el detalle</p>
      </div>
    </Html>
  )
}
