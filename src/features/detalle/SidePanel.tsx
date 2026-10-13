// Panel lateral de detalle de la selección (zona, etapa o equipo). En escritorio es un panel fijo
// a la derecha que no bloquea el resto; en móvil, una hoja inferior con fondo que cierra al tocarlo.
// Cerrar (botón, Esc o fondo) limpia la selección en todas las vistas.
import { type CSSProperties, useCallback, useId, useRef } from 'react'
import { type Seleccion, usePlantStore } from '../../store/usePlantStore'
import { encabezadoDe } from './detalleModel'
import { EquipoDetalle } from './EquipoDetalle'
import { EtapaDetalle } from './EtapaDetalle'
import { FOCO, Vacio } from './piezas'
import { useBordeCabecera, useFocoPanel } from './usePanel'
import { ZonaDetalle } from './ZonaDetalle'

const NOMBRE_TIPO: Readonly<Record<Seleccion['tipo'], string>> = { zona: 'zona', etapa: 'etapa', equipo: 'equipo' }

function Cuerpo({ sel }: { sel: Seleccion }) {
  const idx = usePlantStore((s) => s.idx)
  const zona = sel.tipo === 'zona' ? idx?.zonasPorId.get(sel.id) : undefined
  const etapa = sel.tipo === 'etapa' ? idx?.etapasPorCodigo.get(sel.id) : undefined
  const equipo = sel.tipo === 'equipo' ? idx?.equiposPorId.get(sel.id) : undefined
  if (zona) return <ZonaDetalle zona={zona} />
  if (etapa) return <EtapaDetalle etapa={etapa} />
  if (equipo) return <EquipoDetalle equipo={equipo} />
  return (
    <Vacio>
      {idx
        ? `No hay ninguna ${NOMBRE_TIPO[sel.tipo] ?? 'entrada'} con el id «${sel.id}» en el layout.`
        : 'El layout aún no está cargado.'}
    </Vacio>
  )
}

function IconoCerrar() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.75}>
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  )
}

export function SidePanel() {
  const sel = usePlantStore((s) => s.seleccion)
  const idx = usePlantStore((s) => s.idx)
  const seleccionar = usePlantStore((s) => s.seleccionar)
  const tituloId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const titulo = useRef<HTMLHeadingElement>(null)
  const cuerpo = useRef<HTMLDivElement>(null)
  const clave = sel ? `${sel.tipo}:${sel.id}` : null
  const limpiar = useCallback(() => seleccionar(null), [seleccionar])
  const cerrar = useFocoPanel(clave, limpiar, { panel, titulo, cuerpo })
  const bordeCabecera = useBordeCabecera(sel !== null)

  if (!sel) return null
  const enc = idx ? encabezadoDe(idx, sel) : { tipo: 'Detalle', titulo: 'Elemento no encontrado', existe: false }
  // En escritorio el panel empieza bajo la cabecera visible (no tapa alarmas ni tema) y queda bajo
  // el menú de alarmas (z-50).
  const estilo = { '--pv-panel-top': `${bordeCabecera}px` } as CSSProperties

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={cerrar} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="false"
        aria-labelledby={tituloId}
        data-testid="side-panel"
        data-seleccion-tipo={sel.tipo}
        data-seleccion-id={sel.id}
        style={estilo}
        className="fixed right-0 bottom-0 left-0 z-40 flex max-h-[75dvh] flex-col rounded-t-2xl border-t border-borde bg-surface text-texto shadow-[0_-8px_24px_rgb(0_0_0/0.25)] lg:top-(--pv-panel-top) lg:left-auto lg:max-h-none lg:w-[400px] lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-[-8px_0_24px_rgb(0_0_0/0.18)]"
      >
        <div aria-hidden="true" className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-borde lg:hidden" />
        <header className="flex shrink-0 items-start gap-2 border-b border-borde px-4 pt-2 pb-3 lg:pt-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold tracking-wide text-tenue uppercase">{enc.tipo}</p>
            <h2
              id={tituloId}
              ref={titulo}
              tabIndex={-1}
              className={`rounded text-base leading-snug font-semibold break-words text-texto outline-none ${FOCO}`}
            >
              {enc.titulo}
            </h2>
          </div>
          <button
            type="button"
            data-testid="side-panel-cerrar"
            aria-label="Cerrar panel"
            title="Cerrar panel (Esc)"
            onClick={cerrar}
            className={`inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-borde bg-surface-2 text-texto hover:border-seleccion ${FOCO}`}
          >
            <IconoCerrar />
          </button>
        </header>
        <div ref={cuerpo} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-6">
          <Cuerpo sel={sel} />
        </div>
      </div>
    </>
  )
}
