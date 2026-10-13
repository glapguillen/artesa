// Chips clicables que llevan a otra etapa, zona o equipo. Leen su estado del store, así que
// un código sin datos en vivo se ve en gris ("Sin datos") y uno que no existe no rompe nada.
import { estadoDeZona } from '../../domain/selectors'
import type { Equipo } from '../../domain/types'
import { usePlantStore } from '../../store/usePlantStore'
import { colorEstado, ESTADO_ETIQUETA, fmtNum } from '../../ui/tokens'
import { textoCantidad } from './detalleModel'
import { CHIP, FOCO, Punto } from './piezas'

interface ChipEtapaProps {
  codigo: string
  /** Asignación probable (borde discontinuo). */
  probable?: boolean
  /** Texto breve al final, p. ej. la etiqueta de una transición. */
  nota?: string | null
}

export function ChipEtapa({ codigo, probable = false, nota }: ChipEtapaProps) {
  const etapa = usePlantStore((s) => s.idx?.etapasPorCodigo.get(codigo))
  const vivo = usePlantStore((s) => s.live?.etapas?.[codigo])
  const seleccionar = usePlantStore((s) => s.seleccionar)
  const estado = vivo?.estado ?? 'sin_datos'
  const wip = vivo?.wip ?? null
  const wipTxt = wip !== null && Number.isFinite(wip) ? `${fmtNum(wip)} pzs` : null
  const etiqueta =
    `Etapa ${codigo}, ${etapa?.nombre ?? 'no encontrada en el layout'}${probable ? ' (probable)' : ''}. ` +
    `${ESTADO_ETIQUETA[estado] ?? ESTADO_ETIQUETA.sin_datos}${wipTxt ? `, WIP ${wipTxt}` : ''}${nota ? `. ${nota}` : ''}. Ver detalle`
  return (
    <li className="max-w-full min-w-0">
      <button
        type="button"
        aria-label={etiqueta}
        title={etapa?.nombre ?? codigo}
        onClick={() => seleccionar({ tipo: 'etapa', id: codigo })}
        className={`${CHIP} ${probable ? 'border-dashed' : ''}`}
      >
        <Punto color={colorEstado(estado)} hueco={probable} />
        <span className="shrink-0 font-semibold tabular-nums">{codigo}</span>
        <span className="min-w-0 truncate">{etapa?.nombre_corto ?? 'No encontrada'}</span>
        {wipTxt && <span className="shrink-0 text-tenue tabular-nums">{wipTxt}</span>}
        {nota && <span className="min-w-0 truncate text-tenue">· {nota}</span>}
      </button>
    </li>
  )
}

export function ChipZona({ id, probable = false }: { id: string; probable?: boolean }) {
  const zona = usePlantStore((s) => s.idx?.zonasPorId.get(id))
  const estado = usePlantStore((s) => (s.idx ? estadoDeZona(s.idx, s.live, id) : 'sin_datos'))
  const seleccionar = usePlantStore((s) => s.seleccionar)
  const nombre = zona?.nombre ?? id
  const sinUbicar = zona !== undefined && zona.poligono === null
  const etiqueta =
    `Zona ${nombre}${zona ? '' : ' (no encontrada en el layout)'}${probable ? ' (probable)' : ''}` +
    `${sinUbicar ? ', sin ubicar en el croquis' : ''}. ${ESTADO_ETIQUETA[estado]}. Ver detalle`
  return (
    <li className="max-w-full min-w-0">
      <button
        type="button"
        aria-label={etiqueta}
        title={nombre}
        onClick={() => seleccionar({ tipo: 'zona', id })}
        className={`${CHIP} ${probable ? 'border-dashed' : ''}`}
      >
        <Punto color={colorEstado(estado)} hueco={probable} />
        <span className="min-w-0 truncate">{nombre}</span>
        {sinUbicar && <span className="shrink-0 text-tenue">(sin ubicar)</span>}
      </button>
    </li>
  )
}

/** Fila clicable de un equipo: estado, nombre y cantidad ([POR DEFINIR] si es null). */
export function BotonEquipo({ equipo }: { equipo: Equipo }) {
  const estado = usePlantStore((s) => s.live?.equipos?.[equipo.id]?.estado ?? 'sin_datos')
  const seleccionar = usePlantStore((s) => s.seleccionar)
  const cantidad = textoCantidad(equipo)
  return (
    <li>
      <button
        type="button"
        aria-label={`Equipo ${equipo.nombre}. ${ESTADO_ETIQUETA[estado]}. Cantidad: ${cantidad}. Ver detalle`}
        onClick={() => seleccionar({ tipo: 'equipo', id: equipo.id })}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-md border border-borde bg-surface-2 px-2 py-1.5 text-left text-sm text-texto hover:border-seleccion ${FOCO}`}
      >
        <Punto color={colorEstado(estado)} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{equipo.nombre}</span>
          <span className="text-[11px] text-tenue tabular-nums">
            {ESTADO_ETIQUETA[estado]} · Cantidad: {cantidad}
          </span>
        </span>
      </button>
    </li>
  )
}
