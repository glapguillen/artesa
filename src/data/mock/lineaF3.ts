// Hornos (1.5 y 3.1) y Fase 3 en un minuto: clasificación final, calcomanía, recuperación y despachos.
import { capacidad, capacidadBase, repartirMix, type Ctx } from './contexto'
import { estadoHorno } from './curvas'
import { destinar } from './lineaF1'
import { meter, mover, sacar, sumar, type Sim } from './modelo'
import { ruidoSuave } from './rng'

/**
 * Horno continuo: si opera, carga desde su piscina de entrada y descarga en la de salida con un
 * tiempo medio de permanencia (primer orden). En arranque o detenido no carga ni descarga.
 */
export function pasoHornos(ctx: Ctx, sim: Sim, m: number): void {
  for (const h of ctx.hornos) {
    sim.tasa[h.etapa] = 0
    sim.tasa[h.entrada] = 0
    if (estadoHorno(h.etapa, m, ctx.etapaAlarmaHorno) !== 'operando') continue
    const carga = sacar(sim, h.entrada, h.capCarga * (1 + 0.05 * ruidoSuave(ctx.semilla, `carga:${h.etapa}`, m, 30)))
    const dentro = (sim.dentro[h.etapa] ?? 0) + carga
    const descarga = dentro / Math.max(1, h.residenciaMin)
    sim.dentro[h.etapa] = dentro - descarga
    meter(sim, h.salida, descarga)
    sumar(sim.cargadas, h.etapa, carga)
    sumar(sim.minOperando, h.etapa, 1)
    sim.tasa[h.etapa] = descarga
    sim.tasa[h.entrada] = carga
    // Si la entrada es la piscina donde terminan las rutas de decoración, la carga se atribuye por ruta.
    const rutas = ctx.rutas.filter((r) => r.siguiente === h.entrada)
    const peso = rutas.reduce((a, r) => a + r.peso, 0)
    if (rutas.length && peso > 0) for (const r of rutas) mover(sim, h.entrada, h.etapa, (carga * r.peso) / peso, r.id)
    else mover(sim, h.entrada, h.etapa, carga)
    mover(sim, h.etapa, h.salida, descarga)
  }
}

export function pasoF3(ctx: Ctx, sim: Sim, m: number): void {
  // 3.3 Clasificación final desde la piscina de quemado 2 (3.2).
  const clasif = sacar(sim, '3.2', capacidad(ctx, '3.3', m))
  sim.tasa['3.2'] = clasif
  sim.tasa['3.3'] = clasif
  mover(sim, '3.2', '3.3', clasif)
  const reparto = repartirMix(ctx, '3.3', ctx.resultadosFinal, m, clasif)
  ctx.resultadosFinal.forEach((r, i) => {
    const cant = reparto[i] ?? 0
    sumar(sim.final, r.resultado, cant)
    destinar(sim, ['3.3'], r.destino, cant)
  })

  // 3.4 Aplicar calcomanía → 3.5 Quema de calcomanía → 3.6 Bodega PT.
  const calco = sacar(sim, '3.4', capacidad(ctx, '3.4', m))
  sim.tasa['3.4'] = calco
  meter(sim, '3.5', calco)
  mover(sim, '3.4', '3.5', calco)
  const quemaCalco = sacar(sim, '3.5', capacidad(ctx, '3.5', m))
  sim.tasa['3.5'] = quemaCalco
  meter(sim, '3.6', quemaCalco)
  mover(sim, '3.5', '3.6', quemaCalco)

  // 3.8 Recuperación (las piezas recuperadas salen del turno).
  sim.tasa['3.8'] = sacar(sim, '3.8', capacidad(ctx, '3.8', m))

  // 3.6 Bodega PT: ingreso del minuto y despachos hacia venta (V).
  sim.tasa['3.6'] = (sim.mov['3.3>3.6'] ?? 0) + quemaCalco
  const despacho = sacar(sim, '3.6', capacidadBase(ctx, 'ventas') * (1 + 0.3 * ruidoSuave(ctx.semilla, 'ventas', m, 60)))
  mover(sim, '3.6', 'V', despacho)
}
