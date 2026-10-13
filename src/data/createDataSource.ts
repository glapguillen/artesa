import { CONFIG } from '../config'
import type { PlantLayout } from '../domain/types'
import type { DataSource } from './DataSource'
import { MockDataSource } from './mock/MockDataSource'

export function createDataSource(layout: PlantLayout): DataSource {
  switch (CONFIG.fuenteDatos) {
    case 'mock':
      return new MockDataSource(layout, CONFIG.mock)
    case 'rest':
      throw new Error('La fuente REST (webhook de n8n) se implementa en la Fase 3.')
  }
}
