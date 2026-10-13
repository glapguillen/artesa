// Encabezado de la tarjeta del plano: título, conmutadores (color, flujos) y zoom.
import type { ReactNode } from 'react'
import { usePlantStore } from '../../store/usePlantStore'

const BOTON =
  'inline-flex h-7 min-w-7 cursor-pointer items-center justify-center rounded-md px-2 text-xs text-texto ' +
  'hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-seleccion ' +
  'disabled:cursor-default disabled:opacity-40 aria-pressed:bg-surface aria-pressed:font-semibold ' +
  'aria-pressed:text-acento aria-pressed:shadow-sm'
const GRUPO = 'inline-flex items-center gap-0.5 rounded-lg border border-borde bg-surface-2 p-0.5'

function Boton(p: { etiqueta: string; onClick: () => void; pulsado?: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      className={BOTON}
      aria-label={p.etiqueta}
      title={p.etiqueta}
      aria-pressed={p.pulsado}
      disabled={p.disabled}
      onClick={p.onClick}
    >
      {p.children}
    </button>
  )
}

interface Props {
  version: string
  flujos: boolean
  onFlujos: (v: boolean) => void
  ampliado: boolean
  acercar: () => void
  alejar: () => void
  encuadrar: () => void
}

export function PlanHeader(p: Props) {
  const colorPor = usePlantStore((s) => s.colorPor)
  const setColorPor = usePlantStore((s) => s.setColorPor)
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-borde px-3 py-2">
      <div className="min-w-0 flex-1 basis-40">
        <h2 className="text-sm font-semibold text-texto">Plano de planta</h2>
        <p className="text-xs leading-tight text-tenue">Escala y norte supuestos · layout v{p.version}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className={GRUPO} role="group" aria-label="Color de las zonas">
          <span className="hidden px-1 text-xs text-tenue sm:inline">Color:</span>
          <Boton etiqueta="Color por estado" pulsado={colorPor === 'estado'} onClick={() => setColorPor('estado')}>
            Estado
          </Boton>
          <Boton etiqueta="Color por grupo" pulsado={colorPor === 'grupo'} onClick={() => setColorPor('grupo')}>
            Grupo
          </Boton>
        </div>
        <div className={GRUPO}>
          <Boton etiqueta="Mostrar flujos de material" pulsado={p.flujos} onClick={() => p.onFlujos(!p.flujos)}>
            Flujos
          </Boton>
        </div>
        <div className={GRUPO} role="group" aria-label="Zoom del plano">
          <Boton etiqueta="Acercar" onClick={p.acercar}>
            <span aria-hidden="true" className="text-sm leading-none">+</span>
          </Boton>
          <Boton etiqueta="Alejar" onClick={p.alejar} disabled={!p.ampliado}>
            <span aria-hidden="true" className="text-sm leading-none">−</span>
          </Boton>
          <Boton etiqueta="Encuadrar todo el plano" onClick={p.encuadrar} disabled={!p.ampliado}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ fill: 'none', stroke: 'currentColor' }} strokeWidth={1.5}>
              <path d="M1 5V1H5M9 1H13V5M13 9V13H9M5 13H1V9" />
            </svg>
          </Boton>
        </div>
      </div>
    </div>
  )
}
