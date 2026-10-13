// SVG del plano. Orden de dibujo: edificios → zonas → accesos → flujos → selección → línea de la
// ruta → etiquetas → pasos de la ruta → alarmas. Geometría memoizada por layout; el estado en
// vivo solo cambia colores y marcadores.
import { useCallback } from 'react'
import { usePlantStore } from '../../store/usePlantStore'
import { ESTADO_ETIQUETA, NIVEL_ALARMA_ETIQUETA } from '../../ui/tokens'
import { Accesos } from './Accesos'
import { AlarmMarkers } from './AlarmMarkers'
import { Edificios } from './Edificios'
import { FlowArrows } from './FlowArrows'
import { textoViewBox } from './geometry'
import { PlanDefs } from './PlanDefs'
import { estiloZona } from './planLive'
import type { Plano } from './planModel'
import { RouteLine, RouteSteps } from './RouteOverlay'
import { SelectionLayer } from './SelectionLayer'
import type { PanZoom } from './usePanZoom'
import type { PlanoVivo, RutaPlano } from './usePlanoVivo'
import { ZoneLabel } from './ZoneLabel'
import { ZoneShape } from './ZoneShape'

interface Props {
  plano: Plano
  pz: PanZoom
  vivo: PlanoVivo
  ruta: RutaPlano | null
  mostrarFlujos: boolean
}

export function PlanCanvas({ plano, pz, vivo, ruta, mostrarFlujos }: Props) {
  const colorPor = usePlantStore((s) => s.colorPor)
  const seleccionar = usePlantStore((s) => s.seleccionar)
  const onSeleccionar = useCallback((id: string) => seleccionar({ tipo: 'zona', id }), [seleccionar])
  const enRuta = new Set(ruta?.zonas.map((z) => z.id))
  const atenuada = (id: string) => ruta !== null && !enRuta.has(id)
  const { k, vb, ampliado, handlers, ref: refSvg } = pz

  return (
    <svg
      ref={refSvg}
      viewBox={textoViewBox(vb)}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full select-none"
      style={{ touchAction: ampliado ? 'none' : 'pan-y', cursor: ampliado ? 'grab' : undefined }}
      role="group"
      aria-label="Plano de planta: zonas, accesos, flujos y ruta activa"
      {...handlers}
    >
      <PlanDefs k={k} />
      <Edificios edificios={plano.edificios} k={k} />
      <g data-capa="zonas">
        {plano.zonas.map((z) => {
          const estado = vivo.estados[z.id] ?? 'sin_datos'
          const alarma = vivo.alarmas.get(z.id)
          const est = estiloZona(z, colorPor, estado)
          const titulo = `${z.nombre} · ${ESTADO_ETIQUETA[estado]}${alarma ? ` · Alarma: ${NIVEL_ALARMA_ETIQUETA[alarma]}` : ''}`
          return (
            <ZoneShape
              key={z.id}
              geo={z}
              k={k}
              relleno={est.relleno}
              opacidad={est.opacidad}
              trazo={est.trazo}
              atenuada={atenuada(z.id)}
              seleccionada={vivo.resalte.has(z.id)}
              titulo={titulo}
              onSeleccionar={onSeleccionar}
            />
          )
        })}
      </g>
      <Accesos accesos={plano.accesos} k={k} />
      {mostrarFlujos && <FlowArrows flujos={plano.flujos} live={vivo.live} k={k} tenue={ruta !== null} />}
      <SelectionLayer resalte={vivo.resalte} porId={plano.porId} k={k} />
      {ruta && <RouteLine ruta={ruta} k={k} />}
      <g data-capa="etiquetas" aria-hidden="true">
        {plano.zonas.map((z) => (
          <ZoneLabel key={z.id} geo={z} k={k} atenuada={atenuada(z.id)} />
        ))}
      </g>
      {ruta && <RouteSteps ruta={ruta} k={k} />}
      <AlarmMarkers alarmas={vivo.alarmas} porId={plano.porId} k={k} />
    </svg>
  )
}
