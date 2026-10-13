// Estado interno del simulador y bucle por minuto. Cada minuto mueve piezas entre colas
// (piscinas, bodegas y puestos) según capacidades, pausas y el guion del turno.
import type { Ctx } from './contexto'
import { PARAM } from './parametros'

export interface Sim {
  /** Último minuto simulado. */
  m: number
  /** Cola / WIP por código de etapa (piscinas, bodegas, colas de puestos). */
  q: Record<string, number>
  /** Por ruta de decoración: piezas esperando cada paso. */
  colas: Record<string, number[]>
  /** Piezas dentro de cada horno, por etapa de quema. */
  dentro: Record<string, number>
  /** Por etapa de quema: piezas cargadas y minutos operando (para el OEE). */
  cargadas: Record<string, number>
  minOperando: Record<string, number>
  /** Salida de cada etapa en el último minuto (pzs/min). */
  tasa: Record<string, number>
  /** Movimiento 'desde>hasta' del último minuto (pzs/min) y su reparto por ruta. */
  mov: Record<string, number>
  movRuta: Record<string, Record<string, number>>
  /** Acumulados del turno. */
  formados: Record<string, number>
  rechazados: Record<string, number>
  bizcocho: Record<string, number>
  final: Record<string, number>
  completados: Record<string, number>
  liberadas: number
  noProductivas: number
  bajaPastaKg: number
  esmaltesKg: number
  coloresKg: number
  /** Piscina → minuto en que su WIP superó el umbral (ausente si está por debajo). */
  wipAltoDesde: Record<string, number>
}

export function simInicial(ctx: Ctx): Sim {
  const ceros = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, 0]))
  return {
    m: -1,
    q: { ...PARAM.wipInicial },
    colas: Object.fromEntries(ctx.rutas.map((r) => [r.id, r.pasos.map(() => PARAM.wipInicialPorPasoRuta)])),
    dentro: ceros(ctx.hornos.map((h) => h.etapa)),
    cargadas: ceros(ctx.hornos.map((h) => h.etapa)),
    minOperando: ceros(ctx.hornos.map((h) => h.etapa)),
    tasa: {},
    mov: {},
    movRuta: {},
    formados: ceros(ctx.rf.map((r) => r.id)),
    rechazados: ceros(ctx.rf.map((r) => r.id)),
    bizcocho: ceros(ctx.resultadosBizcocho.map((r) => r.resultado)),
    final: ceros(ctx.resultadosFinal.map((r) => r.resultado)),
    completados: ceros(ctx.rutas.map((r) => r.id)),
    liberadas: 0,
    noProductivas: 0,
    bajaPastaKg: 0,
    esmaltesKg: 0,
    coloresKg: 0,
    wipAltoDesde: {},
  }
}

/** Suma en un registro numérico. */
export function sumar(r: Record<string, number>, k: string, v: number): void {
  r[k] = (r[k] ?? 0) + v
}

/** Registra un movimiento de piezas 'desde>hasta' (opcionalmente atribuido a una ruta). */
export function mover(sim: Sim, desde: string, hasta: string, cant: number, ruta?: string): void {
  const k = `${desde}>${hasta}`
  sumar(sim.mov, k, cant)
  if (ruta) sumar((sim.movRuta[k] ??= {}), ruta, cant)
}

/** Saca hasta `max` piezas de la cola `codigo` y devuelve cuántas salieron. */
export function sacar(sim: Sim, codigo: string, max: number): number {
  const hay = sim.q[codigo] ?? 0
  const sale = Math.max(0, Math.min(hay, max))
  sim.q[codigo] = hay - sale
  return sale
}

/** Agrega piezas a una cola (crea la cola si no existe). */
export function meter(sim: Sim, codigo: string, cant: number): void {
  sumar(sim.q, codigo, cant)
}

/** Actualiza el registro de piscinas con WIP alto (con histéresis para no parpadear). */
export function actualizarWipAlto(sim: Sim, m: number): void {
  for (const [codigo, umbral] of Object.entries(PARAM.umbralWipAlto)) {
    const wip = sim.q[codigo] ?? 0
    const alto = sim.wipAltoDesde[codigo] !== undefined
    if (!alto && wip > umbral) sim.wipAltoDesde[codigo] = m
    else if (alto && wip < umbral * PARAM.histeresisWip) delete sim.wipAltoDesde[codigo]
  }
}
