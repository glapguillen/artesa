// Estado por equipo (EstadoEquipo). Hornos: temperatura, objetivo, gas y carga; el resto, al menos piezas_h.
import type { EstadoEtapa, EstadoEquipo } from '../../domain/live'
import type { Equipo, PlantLayout } from '../../domain/types'
import type { Ctx, HornoSim } from './contexto'
import { estadoHorno, factorGas, pct, redondear, temperaturaHorno } from './curvas'
import type { Sim } from './modelo'
import { PARAM } from './parametros'
import { ruidoSuave } from './rng'

export interface LecturaHorno extends EstadoEquipo {
  metricas: { temp_c: number; temp_objetivo_c: number; gas_m3_h: number; carga_pct: number; piezas_h: number }
}

/** Lectura de un horno (por su etapa de quema) en el minuto m. */
export function lecturaHorno(ctx: Ctx, sim: Sim, h: HornoSim, m: number): LecturaHorno {
  const s = ctx.semilla
  const estado = estadoHorno(h.etapa, m, ctx.etapaAlarmaHorno)
  const conAlarma = h.etapa === ctx.etapaAlarmaHorno
  const temp = temperaturaHorno(h.objetivoC, m, conAlarma, ruidoSuave(s, `temp:${h.etapa}`, m, 20))
  const gas = h.gasM3h * factorGas(estado) * (1 + 0.05 * ruidoSuave(s, `gas:${h.etapa}`, m, 25))
  return {
    estado,
    metricas: {
      temp_c: redondear(temp),
      temp_objetivo_c: h.objetivoC,
      gas_m3_h: redondear(gas, 1),
      carga_pct: redondear(pct(sim.dentro[h.etapa] ?? 0, h.capCarga * h.residenciaMin), 1),
      piezas_h: redondear((sim.tasa[h.etapa] ?? 0) * 60),
    },
  }
}

/** Equipos que procesan solo parte del flujo de su etapa (clave en Sim.mov). */
const FLUJO_POR_TIPO: Readonly<Record<string, string>> = { extrusora: 'B2>B4' }

function metricasEquipo(ctx: Ctx, sim: Sim, eq: Equipo): Record<string, number> {
  // Formación: cada método (RF) tiene su equipo 'formacion_<método>'.
  const rf = ctx.rf.find((r) => eq.tipo === `formacion_${r.clave}`)
  if (rf) return { piezas_h: redondear((sim.tasa[`rf:${rf.id}`] ?? 0) * 60) }
  const clave = FLUJO_POR_TIPO[eq.tipo]
  const porMin = (clave ? sim.mov[clave] : undefined) ?? sim.tasa[eq.etapa] ?? 0
  const piezas_h = redondear(porMin * 60)
  // Fases A y B trabajan material: se agrega su equivalente en kg/h.
  if (eq.etapa.startsWith('B')) return { piezas_h, kg_h: redondear(porMin * 60 * PARAM.kgPastaPorPieza) }
  if (eq.etapa.startsWith('A')) return { piezas_h, kg_h: redondear(porMin * 60 * PARAM.kgEsmaltePorPieza, 1) }
  return { piezas_h }
}

export function construirEquipos(
  l: PlantLayout,
  ctx: Ctx,
  sim: Sim,
  m: number,
  etapas: Record<string, EstadoEtapa>,
): Record<string, EstadoEquipo> {
  const out: Record<string, EstadoEquipo> = {}
  for (const eq of l.equipos) {
    const horno = eq.tipo.startsWith('horno') ? ctx.hornos.find((h) => h.etapa === eq.etapa) : undefined
    out[eq.id] = horno
      ? lecturaHorno(ctx, sim, horno, m)
      : { estado: etapas[eq.etapa]?.estado ?? 'sin_datos', metricas: metricasEquipo(ctx, sim, eq) }
  }
  return out
}
