// Rótulo del recorrido: paso, etapas, zona, datos en vivo y etapas omitidas por no estar ubicadas,
// con controles (anterior, pausa, siguiente, salir). Teclado: ← → Espacio Esc.
import type { ReactNode } from 'react'
import { usePlantStore } from '../../../store/usePlantStore'
import { useTour } from '../camara/estadoTour'
import { datosEnVivo, rotuloPaso, SEGUNDOS_POR_PASO, textoOmitidas } from '../camara/tour'
import { CLASE_BOTON } from './botones'

const ICONOS: Record<string, ReactNode> = {
  anterior: <path d="M9.5 2 4 7l5.5 5" fill="none" stroke="currentColor" strokeWidth={1.8} />,
  siguiente: <path d="M4.5 2 10 7l-5.5 5" fill="none" stroke="currentColor" strokeWidth={1.8} />,
  pausa: <path d="M4 2.5h2v9H4zM8 2.5h2v9H8z" fill="currentColor" />,
  seguir: <path d="M4 2v10l8-5z" fill="currentColor" />,
  salir: <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" fill="none" stroke="currentColor" strokeWidth={1.8} />,
}

function Control({ icono, etiqueta, onClick, disabled }: { icono: string; etiqueta: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={`${CLASE_BOTON} border border-borde bg-surface-2`} aria-label={etiqueta} title={etiqueta} disabled={disabled} onClick={onClick}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        {ICONOS[icono]}
      </svg>
    </button>
  )
}

export function TourCaption() {
  const activo = useTour((s) => s.activo)
  const pausado = useTour((s) => s.pausado)
  const indice = useTour((s) => s.indice)
  const pasos = useTour((s) => s.pasos)
  const live = usePlantStore((s) => s.live)
  const paso = pasos[indice]
  if (!activo || !paso) return null
  const t = useTour.getState()
  const omitidas = textoOmitidas(paso)
  const ultimo = indice === pasos.length - 1
  return (
    <section
      data-testid="tour-caption"
      aria-label="Recorrido de la planta"
      className="absolute inset-x-2 bottom-2 z-30 max-h-[55%] overflow-y-auto rounded-lg border border-borde bg-surface/95 p-2.5 text-xs text-texto shadow-lg @xl:right-auto @xl:left-1/2 @xl:w-[34rem] @xl:-translate-x-1/2"
    >
      <div>
        <p aria-live="polite" aria-atomic="true" className="text-sm leading-snug font-semibold">
          {rotuloPaso(paso, indice, pasos.length)}
        </p>
        {paso.etapas.some((e) => e.probable) && <p className="text-tenue">«?»: la etapa ocurre probablemente aquí (por confirmar).</p>}
        <ul className="mt-1 space-y-0.5 text-tenue">
          {datosEnVivo(paso, live).map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        {omitidas && <p className="mt-1 text-aviso">{omitidas}</p>}
        {ultimo && pausado && <p className="mt-1 font-medium">Fin del recorrido.</p>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Control icono="anterior" etiqueta="Paso anterior (←)" disabled={indice === 0} onClick={() => t.ir(indice - 1)} />
        <Control icono={pausado ? 'seguir' : 'pausa'} etiqueta={pausado ? 'Reanudar (Espacio)' : 'Pausar (Espacio)'} onClick={() => t.setPausado(!pausado)} />
        <Control icono="siguiente" etiqueta="Paso siguiente (→)" disabled={ultimo} onClick={() => t.ir(indice + 1)} />
        <Control icono="salir" etiqueta="Salir del recorrido (Esc)" onClick={() => t.detener(true)} />
        <span className="ml-auto text-[11px] text-tenue">{pausado ? 'En pausa' : `Avanza solo cada ${SEGUNDOS_POR_PASO} s`}</span>
      </div>
    </section>
  )
}
