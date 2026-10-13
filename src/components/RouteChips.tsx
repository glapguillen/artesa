// Selector de ruta de decoración (R1–R9 de layout.proceso.rutas_decoracion). La ruta elegida se
// resalta en el plano y en el diagrama; volver a pulsarla, o "Sin ruta", la quita.
import type { ReactNode } from 'react'
import { usePlantStore } from '../store/usePlantStore'
import { colorEstado, fmtNum } from '../ui/tokens'

const CHIP =
  'inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-borde bg-surface px-3 ' +
  'text-xs whitespace-nowrap text-texto hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-1 ' +
  'focus-visible:outline-seleccion aria-pressed:border-ruta aria-pressed:bg-ruta/10 aria-pressed:font-semibold ' +
  'aria-pressed:text-ruta'

function Chip(p: { ruta: string; pulsado: boolean; etiqueta: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      data-ruta={p.ruta}
      aria-pressed={p.pulsado}
      aria-label={p.etiqueta}
      title={p.etiqueta}
      onClick={p.onClick}
      className={CHIP}
    >
      {p.children}
    </button>
  )
}

export function RouteChips() {
  const rutas = usePlantStore((s) => s.layout?.proceso.rutas_decoracion)
  const vivas = usePlantStore((s) => s.live?.rutas)
  const activa = usePlantStore((s) => s.rutaActiva)
  const setRuta = usePlantStore((s) => s.setRutaActiva)

  return (
    <div role="group" aria-label="Ruta de decoración" className="flex min-w-0 flex-1 basis-64 items-center gap-2">
      <span className="hidden shrink-0 text-xs text-tenue sm:inline">Ruta de decoración</span>
      <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto overscroll-x-contain py-1">
        <Chip ruta="" pulsado={activa === null} etiqueta="Sin ruta resaltada" onClick={() => setRuta(null)}>
          Sin ruta
        </Chip>
        {(rutas ?? []).map((r) => {
          const piezas = vivas?.[r.id]?.piezas_turno
          const texto = `${r.id} · ${r.codigo}`
          const detalle = piezas === undefined ? 'sin datos' : `${fmtNum(piezas)} piezas en el turno`
          const pulsado = activa === r.id
          return (
            <Chip
              key={r.id}
              ruta={r.id}
              pulsado={pulsado}
              etiqueta={`Ruta ${texto}: ${detalle}`}
              onClick={() => setRuta(pulsado ? null : r.id)}
            >
              <span>{texto}</span>
              <span
                className="text-[10px] font-normal tabular-nums"
                style={{ color: piezas === undefined ? colorEstado('sin_datos') : 'var(--c-muted)' }}
              >
                {piezas === undefined ? 'Sin datos' : `${fmtNum(piezas)} pzs`}
              </span>
            </Chip>
          )
        })}
      </div>
    </div>
  )
}
