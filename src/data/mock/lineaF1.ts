// Fase B y Fase 1 en un minuto: pasta, formación (RF1–RF7), CC, pulido y clasificación de bizcocho.
// La quema de bizcocho (1.5) está en hornos.ts.
import { capacidad, repartirMix, type Ctx } from './contexto'
import { clamp, noNeg } from './curvas'
import { meter, mover, sacar, sumar, type Sim } from './modelo'
import { PARAM } from './parametros'
import { ruido, ruidoSuave } from './rng'

/** Lleva piezas clasificadas a su destino: a la cola si existe (bodega, piscina) o a un registro. */
export function destinar(sim: Sim, origenes: string[], destino: string, cant: number): void {
  if (!destino) return
  if (sim.q[destino] !== undefined) meter(sim, destino, cant)
  else sumar(sim.tasa, destino, cant)
  for (const o of origenes) mover(sim, o, destino, cant)
}

export function pasoF1(ctx: Ctx, sim: Sim, m: number): void {
  const s = ctx.semilla

  // 1.1 Formación y 1.2 CC de formación, por método (RF).
  const prod = capacidad(ctx, '1.1', m) * (1 + 0.04 * ruido(s, 'prod:1.1', m))
  let formados = 0
  let rechazados = 0
  for (const rf of ctx.rf) {
    const f = noNeg(prod * rf.peso * (1 + 0.15 * ruidoSuave(s, `mix:${rf.id}`, m, 50)))
    const rechPct = clamp(rf.rechazoBasePct * (1 + 0.35 * ruidoSuave(s, `cc:${rf.id}`, m, 60)), 0, 100)
    const r = (f * rechPct) / 100
    sumar(sim.formados, rf.id, f)
    sumar(sim.rechazados, rf.id, r)
    sim.tasa[`rf:${rf.id}`] = f
    if (rf.insumo) {
      mover(sim, rf.insumo, '1.1', f, rf.id)
      // La pasta líquida o extrusada sale de la preparación de pasta (B2).
      if (rf.insumo !== 'B2') mover(sim, 'B2', rf.insumo, f)
    }
    mover(sim, '1.2', '1.3', f - r, rf.id)
    formados += f
    rechazados += r
  }
  sim.tasa['1.1'] = formados
  sim.tasa['1.2'] = formados - rechazados
  meter(sim, '1.3', formados - rechazados)

  // Fase B en equivalente de piezas: materia prima → molienda → filtro prensa.
  sim.tasa.B2 = formados
  mover(sim, 'B1', 'B2', formados)
  mover(sim, 'B2', 'B2', formados)
  sim.bajaPastaKg += noNeg(
    rechazados * PARAM.kgPastaPorRechazo + PARAM.kgPastaBasePorMin * (1 + 0.5 * ruido(s, 'baja:B5', m)),
  )

  // 1.3 Pulido → 1.4 Piscina de pulido.
  const pulidas = sacar(sim, '1.3', capacidad(ctx, '1.3', m))
  sim.tasa['1.3'] = pulidas
  meter(sim, '1.4', pulidas)
  mover(sim, '1.3', '1.4', pulidas)

  // 1.7 Clasificación de bizcocho desde la piscina de quemado 1 (1.6).
  const clasif = sacar(sim, '1.6', capacidad(ctx, '1.7', m))
  sim.tasa['1.6'] = clasif
  sim.tasa['1.7'] = clasif
  const reparto = repartirMix(ctx, '1.7', ctx.resultadosBizcocho, m, clasif)
  ctx.resultadosBizcocho.forEach((r, i) => {
    const cant = reparto[i] ?? 0
    sumar(sim.bizcocho, r.resultado, cant)
    destinar(sim, ['1.6', '1.7'], r.destino, cant)
  })
}
