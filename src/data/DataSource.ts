// Interfaz común de las fuentes de datos. La escena y los paneles solo conocen LiveState.
import type { LiveState } from '../domain/live'

export interface DataSource {
  /** 'mock', 'rest', … */
  readonly id: string
  /** true si los datos son simulados (la UI lo muestra con un distintivo). */
  readonly simulado: boolean
  start(onState: (s: LiveState) => void, onError: (e: Error) => void): void
  stop(): void
}
