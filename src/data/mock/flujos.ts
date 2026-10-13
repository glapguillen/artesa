// Piezas/h por flujo del layout y piezas del turno por ruta (R1–R9, RF1–RF7).
// Cada flujo se traduce a pares 'desde>hasta' leyendo su campo "etapas" ("1.4→1.5", "2.1/2.2→2.3").
import type { LiveState } from '../../domain/live'
import type { PlantLayout } from '../../domain/types'
import type { Ctx } from './contexto'
import { noNeg, redondear } from './curvas'
import type { Sim } from './modelo'

/** "2.1/2.2→2.3" → ['2.1>2.3', '2.2>2.3']; "1.6→1.8→2.x" → ['1.6>1.8'] (primer tramo). */
export function paresDeFlujo(etapas: string): string[] {
  const tramos = etapas.split('→').map((t) => t.split('/').map((x) => x.trim()).filter(Boolean))
  const [desde, hasta] = tramos
  if (!desde || !hasta) return []
  return desde.flatMap((a) => hasta.map((b) => `${a}>${b}`))
}

export function construirFlujos(l: PlantLayout, sim: Sim): LiveState['flujos'] {
  const info = l.flujos.map((f) => {
    const pares = paresDeFlujo(f.etapas)
    const firma = `${pares.join(',')}|${f.rutas ? [...f.rutas].sort().join(',') : '*'}`
    return { f, pares, firma }
  })
  // Rutas que otro flujo ya cuenta en el mismo tramo (para no contarlas dos veces).
  const reclamadas: Record<string, Set<string>> = {}
  const repetidos: Record<string, number> = {}
  for (const { f, pares, firma } of info) {
    repetidos[firma] = (repetidos[firma] ?? 0) + 1
    for (const k of pares) for (const r of f.rutas ?? []) (reclamadas[k] ??= new Set()).add(r)
  }

  const out: LiveState['flujos'] = {}
  for (const { f, pares, firma } of info) {
    let v = 0
    let medido = false
    for (const k of pares) {
      const total = sim.mov[k]
      if (total === undefined) continue
      medido = true
      const porRuta = sim.movRuta[k] ?? {}
      if (f.rutas) v += f.rutas.reduce((a, r) => a + (porRuta[r] ?? 0), 0)
      else v += total - [...(reclamadas[k] ?? [])].reduce((a, r) => a + (porRuta[r] ?? 0), 0)
    }
    // Sin movimiento este minuto: 0 si la etapa de origen se simula; null si no hay dato.
    const origen = pares[0]?.split('>')[0]
    if (!medido && (origen === undefined || sim.tasa[origen] === undefined)) {
      out[f.id] = { piezas_h: null }
      continue
    }
    // Flujos idénticos (p. ej. bodega PT → dos puntos de venta) se reparten en partes iguales.
    out[f.id] = { piezas_h: redondear((noNeg(v) * 60) / (repetidos[firma] ?? 1)) }
  }
  return out
}

export function construirRutas(ctx: Ctx, sim: Sim): LiveState['rutas'] {
  const out: LiveState['rutas'] = {}
  for (const r of ctx.rutas) out[r.id] = { piezas_turno: redondear(sim.completados[r.id] ?? 0) }
  for (const r of ctx.rf) out[r.id] = { piezas_turno: redondear(sim.formados[r.id] ?? 0) }
  return out
}
