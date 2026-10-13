// Tarjeta de un KPI de layout.kpis: toma el valor de live.kpis y la tendencia del historial.
import { useMemo } from 'react'
import type { Kpi } from '../../domain/types'
import { usePlantStore } from '../../store/usePlantStore'
import { ClasifBar } from './ClasifBar'
import { fmtMeta, fmtValorKpi, KPIS_GRANDES, serieKpi } from './kpiModel'
import { KpiTile } from './KpiTile'
import { WipPiscinas } from './WipPiscinas'

export function KpiLayoutTile({ kpi }: { kpi: Kpi }) {
  const vivo = usePlantStore((s) => s.live?.kpis[kpi.id])
  const historial = usePlantStore((s) => s.historial)
  const serie = useMemo(() => serieKpi(historial, kpi.id), [historial, kpi.id])
  // La unidad viene con el dato; si no, la del layout.
  const unidad = vivo?.unidad ?? kpi.unidad
  const ayuda = kpi.formula ? `${kpi.nombre} · ${kpi.formula}` : kpi.nombre
  return (
    <KpiTile
      id={kpi.id}
      nombre={kpi.nombre}
      ayuda={ayuda}
      valor={fmtValorKpi(vivo?.valor, unidad)}
      meta={fmtMeta(kpi.meta, unidad)}
      serie={serie}
      grande={KPIS_GRANDES.has(kpi.id)}
      destacado={kpi.id === 'prod_turno'}
    >
      {kpi.id === 'clasif_final' && <ClasifBar detalle={vivo?.detalle} unidad={unidad} />}
      {kpi.id === 'wip_piscinas' && <WipPiscinas detalle={vivo?.detalle} unidad={unidad} />}
    </KpiTile>
  )
}
