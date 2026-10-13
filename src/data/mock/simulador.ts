// Simulador determinista del turno: función PURA (layout, minuto, opciones) → LiveState.
// Mismas entradas dan el mismo resultado: no usa Math.random ni el reloj. Para el ruido usa un
// PRNG con semilla (rng.ts) y curvas suaves (curvas.ts); el guion del turno está en HISTORIA.
// Cada llamada re-simula minuto a minuto desde el inicio del turno (barato: ≤ 480 pasos).
import type { LiveState } from '../../domain/live'
import type { PlantLayout } from '../../domain/types'
import { construirAlarmas } from './alarmas'
import { construirContexto, type Ctx } from './contexto'
import { clamp, redondear } from './curvas'
import { construirEquipos } from './equipos'
import { construirEtapas } from './etapas'
import { construirFlujos, construirRutas } from './flujos'
import { construirKpis } from './kpis'
import { pasoF1 } from './lineaF1'
import { pasoF2 } from './lineaF2'
import { pasoF3, pasoHornos } from './lineaF3'
import { actualizarWipAlto, simInicial, type Sim } from './modelo'
import { hash32 } from './rng'

export interface OpcionesSimulacion {
  semilla: number
  duracionTurnoMin: number
  /** ISO 8601 del inicio del turno; el timestamp es inicio + minuto. */
  inicioTurnoISO: string
  /** Número de turno simulado (1, 2, …); cambia el id del turno y la secuencia de ruido. */
  ciclo: number
}

/** Simula los minutos 0..m (incluido) desde el WIP heredado del turno anterior. */
export function simularHasta(ctx: Ctx, m: number): Sim {
  const sim = simInicial(ctx)
  for (let t = 0; t <= m; t++) {
    sim.tasa = {}
    sim.mov = {}
    sim.movRuta = {}
    pasoF1(ctx, sim, t)
    pasoF2(ctx, sim, t)
    pasoHornos(ctx, sim, t)
    pasoF3(ctx, sim, t)
    actualizarWipAlto(sim, t)
    sim.m = t
  }
  return sim
}

export function simularEstado(layout: PlantLayout, minuto: number, opciones: OpcionesSimulacion): LiveState {
  const duracion = Math.max(1, Number.isFinite(opciones.duracionTurnoMin) ? opciones.duracionTurnoMin : 1)
  const min = clamp(Number.isFinite(minuto) ? minuto : 0, 0, duracion)
  const m = Math.floor(min)
  const ctx = construirContexto(layout, hash32(opciones.semilla, 'turno', opciones.ciclo))
  const sim = simularHasta(ctx, m)

  const base = Date.parse(opciones.inicioTurnoISO)
  const t0 = Number.isFinite(base) ? base : 0
  const isoEn = (mm: number) => new Date(t0 + Math.round(mm * 60_000)).toISOString()

  const etapas = construirEtapas(layout, ctx, sim, m)
  const redondearTodo = (r: Record<string, number>) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, redondear(v)]))

  return {
    timestamp: isoEn(min),
    fuente: 'mock',
    turno: {
      id: `T${opciones.ciclo}`,
      nombre: 'Turno simulado',
      inicio: isoEn(0),
      fin: isoEn(duracion),
      progreso: clamp(min / duracion, 0, 1),
    },
    etapas,
    equipos: construirEquipos(layout, ctx, sim, m, etapas),
    // La UI deriva el estado de cada zona (peor estado de sus etapas y equipos).
    zonas: {},
    flujos: construirFlujos(layout, sim),
    rutas: construirRutas(ctx, sim),
    clasificaciones: { bizcocho: redondearTodo(sim.bizcocho), final: redondearTodo(sim.final) },
    kpis: construirKpis(layout, ctx, sim, m),
    alarmas: construirAlarmas(layout, ctx, sim, m, isoEn),
  }
}
