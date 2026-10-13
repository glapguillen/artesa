// Estado por etapa (EstadoEtapa) a partir del estado interno del simulador.
import type { EstadoEtapa, EstadoOperativo } from '../../domain/live'
import type { PlantLayout } from '../../domain/types'
import { enAlmuerzo, enMantenimiento, type Ctx } from './contexto'
import { estadoHorno, pct, redondear } from './curvas'
import type { Sim } from './modelo'

/**
 * Casos "sin datos" A PROPÓSITO, para que la UI demuestre cómo los muestra:
 * - N0 (fichas técnicas y recetas) se envía con estado 'sin_datos' y valores null.
 * - V (venta) se omite del todo: su código no aparece en `etapas` (id sin datos en vivo).
 */
export const ETAPA_SIN_DATOS = 'N0'
export const ETAPA_OMITIDA = 'V'

const suma = (r: Record<string, number>): number => Object.values(r).reduce((a, b) => a + b, 0)

export function estadoEtapaSim(ctx: Ctx, sim: Sim, codigo: string, m: number): EstadoOperativo {
  if (codigo === ETAPA_SIN_DATOS || codigo === ETAPA_OMITIDA) return 'sin_datos'
  if (ctx.hornos.some((h) => h.etapa === codigo)) return estadoHorno(codigo, m, ctx.etapaAlarmaHorno)
  if (enMantenimiento(ctx, codigo, m)) return 'mantenimiento'
  if (enAlmuerzo(codigo, m)) return 'espera'
  // Piscina con WIP sobre su umbral.
  if (sim.wipAltoDesde[codigo] !== undefined) return 'espera'
  return 'operando'
}

/** Piezas en la etapa: cola / piscina / bodega, carga del horno o suma de las colas de las rutas. */
function wipEtapa(ctx: Ctx, sim: Sim, codigo: string): number | null {
  const q = sim.q[codigo] ?? sim.dentro[codigo]
  if (q !== undefined) return redondear(q)
  if (!ctx.etapasDecoracion.includes(codigo)) return null
  let total = 0
  for (const r of ctx.rutas) {
    r.pasos.forEach((p, i) => {
      if (p === codigo) total += sim.colas[r.id]?.[i] ?? 0
    })
  }
  return redondear(total)
}

/** % de merma acumulada en el turno: rechazo en CC, resultados que van a un registro de baja, no productivas. */
function mermaEtapa(l: PlantLayout, ctx: Ctx, sim: Sim, codigo: string): number | null {
  const registros = new Set(l.proceso.etapas.filter((e) => e.tipo === 'registro').map((e) => e.codigo))
  const deBaja = (res: Ctx['resultadosFinal'], conteo: Record<string, number>) =>
    redondear(pct(res.filter((r) => registros.has(r.destino)).reduce((a, r) => a + (conteo[r.resultado] ?? 0), 0), suma(conteo)), 1)
  switch (codigo) {
    case '1.2':
      return redondear(pct(suma(sim.rechazados), suma(sim.formados)), 1)
    case '1.7':
      return deBaja(ctx.resultadosBizcocho, sim.bizcocho)
    case '3.3':
      return deBaja(ctx.resultadosFinal, sim.final)
    case '2.0':
      return redondear(pct(sim.noProductivas, sim.liberadas), 1)
    default:
      return null
  }
}

export function construirEtapas(l: PlantLayout, ctx: Ctx, sim: Sim, m: number): Record<string, EstadoEtapa> {
  const out: Record<string, EstadoEtapa> = {}
  for (const { codigo } of l.proceso.etapas) {
    if (codigo === ETAPA_OMITIDA) continue
    if (codigo === ETAPA_SIN_DATOS) {
      out[codigo] = { estado: 'sin_datos', wip: null, piezas_h: null, merma_pct: null }
      continue
    }
    const tasa = sim.tasa[codigo]
    out[codigo] = {
      estado: estadoEtapaSim(ctx, sim, codigo, m),
      wip: wipEtapa(ctx, sim, codigo),
      piezas_h: tasa === undefined ? null : redondear(tasa * 60),
      merma_pct: mermaEtapa(l, ctx, sim, codigo),
    }
  }
  return out
}
