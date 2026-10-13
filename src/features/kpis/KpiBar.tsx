// Barra de KPIs del turno. Dos filas de tarjetas: si la barra mide al menos 78rem (escritorio xl sin
// el panel de detalle abierto) llenan el ancho; si no, se desplazan en horizontal dentro de la barra
// (la página no se desborda). Se usa una consulta de contenedor y no de ventana porque el panel de
// detalle le quita 400 px a la barra en escritorio.
import { useMemo } from 'react'
import { usePlantStore } from '../../store/usePlantStore'
import { AlarmasTile, PersonalTile } from './ExtraTiles'
import { kpisOrdenados } from './kpiModel'
import { KpiLayoutTile } from './KpiLayoutTile'

const GRILLA =
  'relative grid grid-flow-col-dense grid-rows-[auto_auto] auto-cols-min gap-2 overflow-x-auto overscroll-x-contain ' +
  'rounded-lg pb-1 @min-[78rem]:auto-cols-[1fr] focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-seleccion'

export function KpiBar() {
  const kpis = usePlantStore((s) => s.layout?.kpis)
  const ordenados = useMemo(() => kpisOrdenados(kpis ?? []), [kpis])
  return (
    <section data-testid="kpi-bar" aria-labelledby="kpi-bar-titulo" className="@container min-w-0 px-4 pt-2 pb-1">
      <h2 id="kpi-bar-titulo" className="sr-only">
        Indicadores del turno
      </h2>
      {/* Contenedor desplazable: enfocable para poder recorrerlo con el teclado. */}
      <div className={GRILLA} tabIndex={0} role="group" aria-label="Tarjetas de indicadores">
        {ordenados.map((k) => (
          <KpiLayoutTile key={k.id} kpi={k} />
        ))}
        <AlarmasTile />
        <PersonalTile />
      </div>
    </section>
  )
}
