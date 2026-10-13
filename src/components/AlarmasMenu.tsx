// Botón de alarmas con su menú desplegable. Elegir una alarma selecciona su referencia y cierra;
// también cierra con Esc o con un clic fuera.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { usePlantStore } from '../store/usePlantStore'
import { AlarmaItem } from './AlarmaItem'
import { colorNivel, contarAlarmas, nivelMaximo, resumenAlarmas } from './alarmasModel'

function Campana() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.5}>
      <path d="M4 11V7a4 4 0 0 1 8 0v4l1.5 1.5h-11Z" strokeLinejoin="round" />
      <path d="M6.5 14a1.5 1.5 0 0 0 3 0" strokeLinecap="round" />
    </svg>
  )
}

/** Flechas arriba/abajo para moverse entre las alarmas del menú. */
function moverFoco(e: KeyboardEvent<HTMLDivElement>) {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-alarma-item]'))
  if (items.length === 0) return
  e.preventDefault()
  const i = items.findIndex((b) => b === document.activeElement)
  const sig = e.key === 'ArrowDown' ? (i + 1) % items.length : (i <= 0 ? items.length : i) - 1
  items[sig]?.focus()
}

export function AlarmasMenu() {
  const alarmas = usePlantStore((s) => s.live?.alarmas)
  const seleccionar = usePlantStore((s) => s.seleccionar)
  const [abierto, setAbierto] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!abierto) return
    const alTeclado = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setAbierto(false)
      boton.current?.focus()
    }
    const alPulsar = (e: PointerEvent) => {
      if (e.target instanceof Node && !raiz.current?.contains(e.target)) setAbierto(false)
    }
    document.addEventListener('keydown', alTeclado)
    document.addEventListener('pointerdown', alPulsar)
    return () => {
      document.removeEventListener('keydown', alTeclado)
      document.removeEventListener('pointerdown', alPulsar)
    }
  }, [abierto])

  const conteo = contarAlarmas(alarmas)
  const max = nivelMaximo(conteo)
  const resumen = resumenAlarmas(conteo)
  const etiqueta = alarmas
    ? `Alarmas activas: ${alarmas.length}${resumen ? ` (${resumen})` : ''}`
    : 'Alarmas: sin datos de la fuente'
  const critica = max === 'critica'
  const acento = max === 'advertencia' ? colorNivel('advertencia') : null
  const estiloBoton = critica
    ? { background: colorNivel('critica'), borderColor: colorNivel('critica'), color: 'var(--c-bg)' }
    : acento
      ? { borderColor: acento, color: acento }
      : undefined

  return (
    <div ref={raiz} className="relative shrink-0">
      <button
        ref={boton}
        type="button"
        data-testid="alarmas-boton"
        aria-label={etiqueta}
        title={etiqueta}
        aria-expanded={abierto}
        aria-controls={panelId}
        onClick={() => setAbierto((v) => !v)}
        className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-borde bg-surface px-2.5 text-sm font-semibold text-texto hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seleccion"
        style={estiloBoton}
      >
        <Campana />
        <span className="tabular-nums">{alarmas ? alarmas.length : '–'}</span>
      </button>
      {abierto && (
        <div
          id={panelId}
          role="region"
          aria-label="Alarmas activas"
          onKeyDown={moverFoco}
          className="absolute top-full right-0 z-50 mt-2 max-h-[min(24rem,70dvh)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-borde bg-surface p-1 shadow-lg"
        >
          {!alarmas || alarmas.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-tenue">
              {alarmas ? 'Sin alarmas activas.' : 'Sin datos de la fuente.'}
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {alarmas.map((a) => {
                const ref = a.ref
                const elegir = ref
                  ? () => {
                      seleccionar({ tipo: ref.tipo, id: ref.id })
                      setAbierto(false)
                    }
                  : undefined
                return <AlarmaItem key={a.id} alarma={a} onElegir={elegir} />
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
