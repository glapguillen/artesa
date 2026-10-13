// STUB provisional: lo reemplaza la implementación del simulador.
import type { OpcionesMock } from '../../config'
import type { LiveState } from '../../domain/live'
import type { PlantLayout } from '../../domain/types'
import type { DataSource } from '../DataSource'

export class MockDataSource implements DataSource {
  readonly id = 'mock'
  readonly simulado = true
  private readonly layout: PlantLayout
  private readonly opciones: OpcionesMock

  constructor(layout: PlantLayout, opciones: OpcionesMock) {
    this.layout = layout
    this.opciones = opciones
  }

  start(onState: (s: LiveState) => void): void {
    void this.layout
    void this.opciones
    onState({
      timestamp: new Date().toISOString(),
      fuente: 'mock',
      turno: { id: 't1', nombre: 'Turno 1', inicio: '', fin: '', progreso: 0 },
      etapas: {},
      equipos: {},
      zonas: {},
      flujos: {},
      rutas: {},
      clasificaciones: { bizcocho: {}, final: {} },
      kpis: {},
      alarmas: [],
    })
  }

  stop(): void {}
}
