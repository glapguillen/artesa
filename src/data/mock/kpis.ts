// KPIs de negocio calculados por el simulador (la UI solo los muestra). Uno por id de layout.kpis.
import type { ValorKpi } from '../../domain/live'
import type { PlantLayout } from '../../domain/types'
import type { Ctx, HornoSim } from './contexto'
import { clamp, pct, redondear } from './curvas'
import type { Sim } from './modelo'
import { PARAM } from './parametros'

type Calculo = (ctx: Ctx, sim: Sim, m: number, l: PlantLayout) => Omit<ValorKpi, 'unidad'>

const suma = (r: Record<string, number>): number => Object.values(r).reduce((a, b) => a + b, 0)

/** Porcentaje de cada clave sobre el total (1 decimal). */
function porcentajes(conteo: Record<string, number>): Record<string, number> {
  const total = suma(conteo)
  return Object.fromEntries(Object.entries(conteo).map(([k, v]) => [k, redondear(pct(v, total), 1)]))
}

/** OEE (%) = disponibilidad × rendimiento × calidad, acumulado en el turno. */
export function oeeHorno(sim: Sim, h: HornoSim, m: number): number {
  const transcurridos = Math.max(1, m + 1)
  const operando = sim.minOperando[h.etapa] ?? 0
  const disp = clamp(operando / transcurridos, 0, 1)
  const rend = operando > 0 ? clamp((sim.cargadas[h.etapa] ?? 0) / (h.capCarga * operando), 0, 1) : 0
  const conteo = h.calidad === 'bizcocho' ? sim.bizcocho : sim.final
  const buenas =
    h.calidad === 'bizcocho'
      ? (conteo.buena ?? 0)
      : PARAM.resultadosBuenos.reduce((a, k) => a + (conteo[k] ?? 0), 0)
  const total = suma(conteo)
  const calidad = total > 0 ? clamp(buenas / total, 0, 1) : 1
  return redondear(disp * rend * calidad * 100, 1)
}

const CALCULOS: Readonly<Record<string, Calculo>> = {
  wip_piscinas: (_ctx, sim) => {
    const detalle = Object.fromEntries(Object.keys(PARAM.umbralWipAlto).map((c) => [c, redondear(sim.q[c] ?? 0)]))
    return { valor: suma(detalle), detalle }
  },
  rend_bizcocho: (_ctx, sim) => {
    const detalle = porcentajes(sim.bizcocho)
    return { valor: detalle.buena ?? 0, detalle }
  },
  clasif_final: (_ctx, sim) => {
    const detalle = porcentajes(sim.final)
    return { valor: detalle.tipo_a ?? 0, detalle }
  },
  cc_formacion: (ctx, sim) => {
    const detalle = Object.fromEntries(
      ctx.rf.map((r) => [r.id, redondear(pct(sim.rechazados[r.id] ?? 0, sim.formados[r.id] ?? 0), 1)]),
    )
    return { valor: redondear(pct(suma(sim.rechazados), suma(sim.formados)), 1), detalle }
  },
  prod_turno: (_ctx, sim) => {
    const detalle = Object.fromEntries(PARAM.resultadosBuenos.map((k) => [k, redondear(sim.final[k] ?? 0)]))
    return { valor: suma(detalle), detalle }
  },
  oee_horno: (ctx, sim, m, l) => {
    const detalle: Record<string, number> = {}
    for (const eq of l.equipos) {
      const h = eq.tipo.startsWith('horno') ? ctx.hornos.find((x) => x.etapa === eq.etapa) : undefined
      if (h) detalle[eq.id] = oeeHorno(sim, h, m)
    }
    const valores = Object.values(detalle)
    return { valor: valores.length ? redondear(suma(detalle) / valores.length, 1) : 0, detalle }
  },
  baja_pasta: (_ctx, sim) => ({ valor: redondear(sim.bajaPastaKg, 1) }),
  consumo_esmaltes: (_ctx, sim) => ({
    valor: redondear(sim.esmaltesKg + sim.coloresKg, 1),
    detalle: { esmaltes: redondear(sim.esmaltesKg, 1), colores: redondear(sim.coloresKg, 1) },
  }),
  inv_pt: (_ctx, sim) => ({ valor: redondear(sim.q['3.6'] ?? 0) }),
}

/** Unidad si el layout no la trae. */
const UNIDAD_POR_DEFECTO: Readonly<Record<string, string>> = { oee_horno: '%' }

export function construirKpis(l: PlantLayout, ctx: Ctx, sim: Sim, m: number): Record<string, ValorKpi> {
  const out: Record<string, ValorKpi> = {}
  for (const k of l.kpis) {
    const unidad = k.unidad ?? UNIDAD_POR_DEFECTO[k.id] ?? null
    const calc = CALCULOS[k.id]
    // Un KPI nuevo en el layout sin cálculo en el simulador llega sin valor (la UI muestra "Sin datos").
    out[k.id] = calc ? { ...calc(ctx, sim, m, l), unidad } : { valor: null, unidad }
  }
  return out
}
