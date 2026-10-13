// Fuente simulada: avanza un turno determinista (simularEstado) con un temporizador.
// Es el ÚNICO lugar del simulador que lee el reloj: en start() fija el inicio del turno de hoy.
import type { OpcionesMock } from '../../config'
import type { LiveState } from '../../domain/live'
import type { PlantLayout } from '../../domain/types'
import type { DataSource } from '../DataSource'
import { simularEstado } from './simulador'

/** ISO 8601 de hoy (fecha local de `ahora`) a la hora local "HH:MM"; si no se entiende, 07:00. */
export function inicioDeTurnoHoy(hhmm: string, ahora: Date): string {
  const r = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  const h = r ? Math.min(23, Number(r[1] ?? 7)) : 7
  const mi = r ? Math.min(59, Number(r[2] ?? 0)) : 0
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), h, mi, 0, 0).toISOString()
}

export class MockDataSource implements DataSource {
  readonly id = 'mock'
  readonly simulado = true
  private readonly layout: PlantLayout
  private readonly opciones: OpcionesMock
  private timer: ReturnType<typeof setInterval> | null = null
  private minuto = 0
  private ciclo = 1
  private inicioTurnoISO = ''

  constructor(layout: PlantLayout, opciones: OpcionesMock) {
    this.layout = layout
    this.opciones = opciones
  }

  start(onState: (s: LiveState) => void, onError?: (e: Error) => void): void {
    // Tolera start → stop → start (React StrictMode) y un start repetido: nunca quedan dos temporizadores.
    this.stop()
    this.inicioTurnoISO = inicioDeTurnoHoy(this.opciones.inicioTurno, new Date())
    this.minuto = 0
    this.ciclo = 1
    this.emitir(onState, onError)
    const duracion = Math.max(1, this.opciones.duracionTurnoMin)
    const paso = this.opciones.minutosPorTick > 0 ? this.opciones.minutosPorTick : 1
    this.timer = setInterval(
      () => {
        this.minuto += paso
        if (this.minuto > duracion) {
          // Turno terminado: empieza el siguiente (inicio = fin del anterior) con otro ciclo.
          this.inicioTurnoISO = new Date(Date.parse(this.inicioTurnoISO) + duracion * 60_000).toISOString()
          this.minuto = 0
          this.ciclo += 1
        }
        this.emitir(onState, onError)
      },
      Math.max(50, this.opciones.intervaloMs),
    )
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }

  private emitir(onState: (s: LiveState) => void, onError?: (e: Error) => void): void {
    let estado: LiveState
    try {
      estado = simularEstado(this.layout, this.minuto, {
        semilla: this.opciones.semilla,
        duracionTurnoMin: this.opciones.duracionTurnoMin,
        inicioTurnoISO: this.inicioTurnoISO,
        ciclo: this.ciclo,
      })
    } catch (e) {
      onError?.(e instanceof Error ? e : new Error(String(e)))
      return
    }
    onState(estado)
  }
}
