import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { LiveState } from './live'
import {
  aristasDeRuta,
  centroide,
  estadoDeZona,
  indexarLayout,
  peorEstado,
  personasEnZona,
  ubicacionEtapa,
  zonasDeRuta,
} from './selectors'
import type { PlantLayout } from './types'
import { validarLayout } from './validate'

const raw: unknown = JSON.parse(readFileSync(new URL('../../public/plant-layout.json', import.meta.url), 'utf-8'))

function cargar(): PlantLayout {
  const r = validarLayout(raw)
  if (!r.ok) throw new Error(r.errores.join('\n'))
  return r.layout
}

describe('plant-layout.json', () => {
  it('es válido y sin referencias rotas', () => {
    const r = validarLayout(raw)
    expect(r.ok ? [] : r.errores).toEqual([])
  })

  it('detecta referencias rotas con mensajes legibles', () => {
    const copia = structuredClone(raw) as { zonas: Array<{ etapas: string[] }> }
    copia.zonas[0]!.etapas.push('9.9')
    const r = validarLayout(copia)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errores.join(' ')).toContain('"9.9"')
  })

  it('reporta campos faltantes', () => {
    const r = validarLayout({ version: '0' })
    expect(r.ok).toBe(false)
  })
})

describe('selectores', () => {
  const l = cargar()
  const idx = indexarLayout(l)

  it('ubica etapas a partir de las zonas', () => {
    expect(ubicacionEtapa(idx, '2.5')).toBe('ubicada') // Kerajet
    expect(ubicacionEtapa(idx, '3.3')).toBe('hipotesis') // CF
    expect(ubicacionEtapa(idx, '1.8')).toBe('sin_ubicar') // Bodega bizcocho
    expect(ubicacionEtapa(idx, '1.1')).toBe('ubicada') // Impresión 3D tiene polígono
  })

  it('arma las aristas de la ruta R7 con el decorado repetido', () => {
    expect(aristasDeRuta(l, 'R7')).toEqual([
      ['2.0', '2.3'],
      ['2.3', '2.4'],
      ['2.4', '2.5'],
      ['2.5', '2.3'],
      ['2.3', '2.6'],
    ])
  })

  it('traduce R8 a su recorrido físico terminando en hornos', () => {
    expect(zonasDeRuta(l, idx, 'R8').map((z) => z.id)).toEqual(['z-esmaltado', 'z-kerajet', 'z-decorado', 'z-horno'])
  })

  it('calcula centroides de polígonos en L', () => {
    const [x, z] = centroide([
      [0, 0],
      [2, 0],
      [2, 1],
      [1, 1],
      [1, 2],
      [0, 2],
    ])
    expect(x).toBeCloseTo(5 / 6)
    expect(z).toBeCloseTo(5 / 6)
  })

  it('elige el estado más grave e ignora "sin_datos"', () => {
    expect(peorEstado(['operando', 'sin_datos', 'espera'])).toBe('espera')
    expect(peorEstado([])).toBe('sin_datos')
  })

  it('deriva el estado de una zona y nunca falla con ids sin datos', () => {
    const live = { zonas: {}, etapas: { '2.3': { estado: 'detenido' } }, equipos: {} } as unknown as LiveState
    expect(estadoDeZona(idx, live, 'z-decorado')).toBe('detenido')
    expect(estadoDeZona(idx, live, 'no-existe')).toBe('sin_datos')
    expect(estadoDeZona(idx, null, 'z-decorado')).toBe('sin_datos')
  })

  it('suma la dotación por zona', () => {
    expect(personasEnZona(idx, 'z-decorado').confirmado).toBe(10)
    expect(l.personal.dotacion.reduce((s, d) => s + d.cantidad, 0)).toBe(l.personal.total)
  })
})
