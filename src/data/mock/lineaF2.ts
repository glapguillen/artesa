// Fase 2 en un minuto: 2.0 libera bizcocho de la bodega (1.8) hacia las rutas R1–R9 y cada puesto
// (2.1–2.5) procesa su cola, repartiendo su capacidad entre las rutas en proporción a lo que espera.
// Al terminar su último paso, cada pieza entra a la piscina de esmaltado (2.6).
import { capacidad, type Ctx } from './contexto'
import { noNeg } from './curvas'
import { meter, mover, sacar, sumar, type Sim } from './modelo'
import { PARAM } from './parametros'
import { ruido, ruidoSuave } from './rng'

function liberar(ctx: Ctx, sim: Sim, m: number): void {
  const s = ctx.semilla
  const pedido = capacidad(ctx, '2.0', m) * (1 + 0.05 * ruido(s, 'lib:2.0', m))
  const lib = sacar(sim, '1.8', pedido)
  const noProd = noNeg(((lib * PARAM.noProductivasPct) / 100) * (1 + 0.5 * ruidoSuave(s, 'noprod:2.0', m, 60)))
  const neto = noNeg(lib - noProd)
  sim.liberadas += lib
  sim.noProductivas += lib - neto
  sim.tasa['1.8'] = lib
  sim.tasa['2.0'] = lib
  for (const r of ctx.rutas) {
    const c = neto * r.peso
    const primero = r.pasos[0]
    const cola = sim.colas[r.id]
    if (primero !== undefined && cola) {
      cola[0] = (cola[0] ?? 0) + c
      mover(sim, '2.0', primero, c, r.id)
    } else {
      meter(sim, r.siguiente, c)
      sumar(sim.completados, r.id, c)
    }
  }
}

function procesarEtapa(ctx: Ctx, sim: Sim, etapa: string, m: number): void {
  // Qué espera esta etapa en cada ruta y paso.
  const espera: Array<{ ruta: string; paso: number; cant: number }> = []
  for (const r of ctx.rutas) {
    const cola = sim.colas[r.id] ?? []
    r.pasos.forEach((p, i) => {
      if (p === etapa && (cola[i] ?? 0) > 0) espera.push({ ruta: r.id, paso: i, cant: cola[i] ?? 0 })
    })
  }
  const total = espera.reduce((a, e) => a + e.cant, 0)
  const proc = Math.min(total, capacidad(ctx, etapa, m))
  sim.tasa[etapa] = noNeg(proc)
  if (!(proc > 0)) return
  const f = proc / total
  // Primero se descuenta todo y después se avanza: una pieza no pasa dos veces por el mismo puesto en un minuto.
  for (const e of espera) {
    const cola = sim.colas[e.ruta]
    if (cola) cola[e.paso] = noNeg((cola[e.paso] ?? 0) - e.cant * f)
  }
  for (const e of espera) {
    const r = ctx.rutas.find((x) => x.id === e.ruta)
    const cola = sim.colas[e.ruta]
    if (!r || !cola) continue
    const sale = e.cant * f
    const sig = r.pasos[e.paso + 1]
    if (sig !== undefined) {
      cola[e.paso + 1] = (cola[e.paso + 1] ?? 0) + sale
      mover(sim, etapa, sig, sale, r.id)
    } else {
      meter(sim, r.siguiente, sale)
      sumar(sim.completados, r.id, sale)
      mover(sim, etapa, r.siguiente, sale, r.id)
    }
  }
}

export function pasoF2(ctx: Ctx, sim: Sim, m: number): void {
  liberar(ctx, sim, m)
  for (const etapa of ctx.etapasDecoracion) procesarEtapa(ctx, sim, etapa, m)

  // Fase A: esmaltes y colores consumidos (kg) y su flujo en equivalente de piezas.
  const esmaltadas = sim.tasa['2.4'] ?? 0
  const decoradas = sim.tasa['2.3'] ?? 0
  sim.esmaltesKg += esmaltadas * PARAM.kgEsmaltePorPieza
  sim.coloresKg += decoradas * PARAM.kgColorPorPieza
  sim.tasa.A2 = esmaltadas + decoradas
  mover(sim, 'A2', '2.4', esmaltadas)
  mover(sim, 'A2', '2.3', decoradas)
}
