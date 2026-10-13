// Nodo de etapa del flujograma: píldora del código en color de fase, nombre corto, estado,
// métrica principal (WIP o piezas/h), ubicación en el croquis, control por FORMA/SKU y alarmas.
import { Handle, type NodeProps } from '@xyflow/react'
import { type CSSProperties, type KeyboardEvent, memo } from 'react'
import { usePlantStore } from '../../store/usePlantStore'
import { colorEstado, colorFase, ESTADO_ETIQUETA, NIVEL_ALARMA_ETIQUETA, UBICACION_ETIQUETA } from '../../ui/tokens'
import type { EtapaFlowNode } from './buildGraph'
import { describirEtapa, metricaEtapa } from './etapaTexto'
import { MANIJAS } from './geometria'
import { AlarmaIcono, ChipUbicacion, Rombo } from './EtapaPartes'

const mezcla = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`

// Manijas invisibles de 1×1 px en el centro de cada lado (las aristas no se conectan a mano).
const ESTILO_MANIJA: CSSProperties = {
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: 0,
  opacity: 0,
  background: 'transparent',
}

function bordeDe(tipo: EtapaFlowNode['data']['tipo']): string {
  if (tipo === 'decision') return 'border-[3px] border-double'
  if (tipo === 'registro') return 'border-[1.5px] border-dashed'
  if (tipo === 'configuracion') return 'border border-dashed'
  return 'border'
}

export const EtapaNode = memo(function EtapaNode({ data: d }: NodeProps<EtapaFlowNode>) {
  const seleccionar = usePlantStore((s) => s.seleccionar)
  const fase = colorFase(d.fase)
  const metrica = metricaEtapa(d)
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      seleccionar({ tipo: 'etapa', id: d.codigo })
    }
  }
  const tenue = d.tipo === 'configuracion'
  return (
    <>
      {MANIJAS.map((h) => (
        <Handle
          key={h.id}
          id={h.id ?? undefined}
          type={h.type}
          position={h.position}
          isConnectable={false}
          style={ESTILO_MANIJA}
        />
      ))}
      <div
        role="button"
        tabIndex={0}
        aria-label={describirEtapa(d, metrica)}
        aria-pressed={d.seleccion === 'principal'}
        title={d.nombre}
        onKeyDown={onKeyDown}
        className={`relative flex h-full w-full flex-col justify-between rounded-lg px-2 py-1.5 text-left shadow-sm transition-opacity focus-visible:outline-2 focus-visible:outline-offset-[9px] focus-visible:outline-texto ${bordeDe(d.tipo)} ${tenue ? 'bg-surface-2' : 'bg-surface'}`}
        style={{
          borderColor: mezcla(fase, d.tipo === 'decision' ? 80 : 45),
          opacity: d.atenuado ? 0.28 : tenue ? 0.85 : 1,
          boxShadow: d.enRuta ? '0 0 0 2.5px var(--c-ruta)' : undefined,
        }}
      >
        {d.seleccion && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[5px] rounded-xl"
            style={{ border: `${d.seleccion === 'principal' ? 3 : 2}px ${d.seleccion === 'principal' ? 'solid' : 'dashed'} var(--c-seleccion)` }}
          />
        )}
        <div className="flex min-w-0 items-center gap-1.5">
          {d.tipo === 'decision' && <Rombo color={fase} />}
          <span
            className="rounded-full px-1.5 text-[11px] leading-4 font-bold tabular-nums"
            style={{ color: fase, background: mezcla(fase, 14), boxShadow: `inset 0 0 0 1px ${mezcla(fase, 40)}` }}
          >
            {d.codigo}
          </span>
          <span
            aria-hidden="true"
            title={ESTADO_ETIQUETA[d.estado]}
            className="size-2.5 shrink-0 rounded-full"
            style={{ background: colorEstado(d.estado) }}
          />
          <span className="min-w-0 flex-1" />
          {d.alarma && <AlarmaIcono nivel={d.alarma} titulo={`Alarma: ${NIVEL_ALARMA_ETIQUETA[d.alarma]}`} />}
          {d.controlPor && (
            <span className="rounded border border-borde px-1 text-[9px] leading-3.5 font-semibold tracking-wide text-tenue">
              {d.controlPor === 'forma' ? 'FORMA' : 'SKU'}
            </span>
          )}
        </div>
        <div className={`truncate text-[12px] leading-4 font-medium ${tenue ? 'text-tenue' : 'text-texto'}`}>
          {d.nombreCorto}
        </div>
        <div className="flex min-w-0 items-end justify-between gap-1">
          <Metrica m={metrica} />
          <ChipUbicacion ubicacion={d.ubicacion} titulo={UBICACION_ETIQUETA[d.ubicacion]} />
        </div>
      </div>
    </>
  )
})

function Metrica({ m }: { m: ReturnType<typeof metricaEtapa> }) {
  if (!m) return <span />
  if (m.valor === null) {
    return (
      <span className="text-[11px] leading-5" style={{ color: 'var(--c-muted)' }}>
        Sin datos
      </span>
    )
  }
  return (
    <span className="flex min-w-0 items-baseline gap-1 truncate text-texto">
      <span className={`tabular-nums ${m.grande ? 'text-[15px] leading-5 font-semibold' : 'text-[12px] leading-5 font-medium'}`}>
        {m.texto}
      </span>
      <span className="text-[10px] text-tenue">{m.unidad}</span>
    </span>
  )
}
