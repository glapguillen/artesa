import { describe, expect, it } from 'vitest'
import type { Alarma, NivelAlarma } from '../domain/live'
import { contarAlarmas, nivelMaximo, resumenAlarmas } from './alarmasModel'

const alarma = (id: string, nivel: NivelAlarma): Alarma => ({
  id,
  nivel,
  mensaje: id,
  ref: null,
  desde: '2026-10-13T07:00:00.000Z',
})

describe('alarmas', () => {
  it('sin datos o sin alarmas no hay nivel máximo ni resumen', () => {
    const c = contarAlarmas(undefined)
    expect(c).toEqual({ critica: 0, advertencia: 0, info: 0 })
    expect(nivelMaximo(c)).toBeNull()
    expect(resumenAlarmas(c)).toBe('')
  })

  it('cuenta por nivel y resume con plural', () => {
    const c = contarAlarmas([
      alarma('a', 'info'),
      alarma('b', 'critica'),
      alarma('c', 'advertencia'),
      alarma('d', 'advertencia'),
    ])
    expect(c).toEqual({ critica: 1, advertencia: 2, info: 1 })
    expect(nivelMaximo(c)).toBe('critica')
    expect(resumenAlarmas(c)).toBe('1 crítica · 2 advertencias · 1 informativa')
  })

  it('el nivel máximo sin críticas es la advertencia', () => {
    expect(nivelMaximo(contarAlarmas([alarma('a', 'info'), alarma('b', 'advertencia')]))).toBe('advertencia')
  })
})
