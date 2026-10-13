// Barra de KPIs del turno. Dos filas de tarjetas: en escritorio llenan el ancho; en pantallas
// angostas se desplazan en horizontal dentro de la barra (la página no se desborda).
import { useMemo } from 'react'
import { usePlantStore } from '../../store/usePlantStore'
import { AlarmasTile, PersonalTile } from './ExtraTiles'
import { kpisOrdenados } from './kpiModel'
import { KpiLayoutTile } from './KpiLayoutTile'

const GRILLA =
  'relative grid grid-flow-col-dense grid-rows-[auto_auto] auto-cols-min gap-2 overflow-x-auto overscroll-x-contain ' +
  'rounded-lg pb-1 xl:auto-cols-[1fr] focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-seleccion'

export function KpiBar() {
  const kpis = usePlantStore((s) => s.layout?.kpis)
  const ordenados = useMemo(() => kpisOrdenados(kpis ?? []), [kpis])
  return (
    <section data-testid="kpi-bar" aria-labelledby="kpi-bar-titulo" className="min-w-0 px-4 pt-2 pb-1">
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
