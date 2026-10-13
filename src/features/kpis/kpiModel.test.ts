import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { validarLayout } from '../../domain/validate'
import type { PlantLayout } from '../../domain/types'
import type { PuntoHistorial } from '../../store/usePlantStore'
import { POR_DEFINIR } from '../../ui/tokens'
import {
  codigosPiscinas,
  conteoPersonal,
  fmtMeta,
  fmtValorKpi,
  kpisOrdenados,
  ORDEN_KPIS,
  PISCINAS,
  segmentosClasif,
  serieDibujable,
  serieKpi,
} from './kpiModel'

const raw: unknown = JSON.parse(readFileSync(new URL('../../../public/plant-layout.json', import.meta.url), 'utf-8'))

function cargar(): PlantLayout {
  const r = validarLayout(raw)
  if (!r.ok) throw new Error(r.errores.join('\n'))
  return r.layout
}

describe('kpisOrdenados', () => {
  it('ordena los KPIs del layout según la prioridad de la barra', () => {
    const ids = kpisOrdenados(cargar().kpis).map((k) => k.id)
    expect(ids).toEqual(ORDEN_KPIS.filter((id) => ids.includes(id)))
    expect(ids[0]).toBe('prod_turno')
  })

  it('deja al final, en su orden, los KPIs que no están en la lista', () => {
    const base = { ambito: 'planta', unidad: null, meta: null }
    const kpis = [
      { ...base, id: 'nuevo_1', nombre: 'Nuevo 1' },
      { ...base, id: 'inv_pt', nombre: 'Inventario PT' },
      { ...base, id: 'nuevo_2', nombre: 'Nuevo 2' },
      { ...base, id: 'prod_turno', nombre: 'Piezas buenas' },
    ]
    expect(kpisOrdenados(kpis).map((k) => k.id)).toEqual(['prod_turno', 'inv_pt', 'nuevo_1', 'nuevo_2'])
  })
})

describe('formato de valores', () => {
  it('sin dato devuelve null (la tarjeta muestra "Sin datos")', () => {
    expect(fmtValorKpi(null, '%')).toBeNull()
    expect(fmtValorKpi(undefined, 'pzs')).toBeNull()
    expect(fmtValorKpi(Number.NaN, 'kg')).toBeNull()
  })

  it('usa porcentaje, cantidades y unidades', () => {
    expect(fmtValorKpi(62.5, '%')).toBe('62,5 %')
    expect(fmtValorKpi(12345, 'pzs')).toBe('12.345 pzs')
    expect(fmtValorKpi(38.24, 'kg')).toBe('38,2 kg')
    expect(fmtValorKpi(7, null)).toBe('7')
  })

  it('la meta nula se muestra como [POR DEFINIR]', () => {
    expect(fmtMeta(null, '%')).toBe(`Meta ${POR_DEFINIR}`)
    expect(fmtMeta(95, '%')).toBe('Meta 95 %')
  })
})

describe('series del historial', () => {
  const h = (v: number | null): PuntoHistorial => ({ t: '', wip: {}, kpis: { prod_turno: v } })

  it('toma el KPI de cada lectura y marca null lo que falta', () => {
    const serie = serieKpi([h(1), h(null), h(3)], 'prod_turno')
    expect(serie).toEqual([
      { i: 0, v: 1 },
      { i: 1, v: null },
      { i: 2, v: 3 },
    ])
    expect(serieKpi([h(1)], 'otro_kpi')).toEqual([{ i: 0, v: null }])
  })

  it('necesita dos lecturas numéricas para dibujar', () => {
    expect(serieDibujable(serieKpi([h(1), h(null)], 'prod_turno'))).toBe(false)
    expect(serieDibujable(serieKpi([h(1), h(null), h(2)], 'prod_turno'))).toBe(true)
  })
})

describe('desgloses', () => {
  it('cuenta el total y el personal de Producción de la dotación', () => {
    const l = cargar()
    const c = conteoPersonal(l.personal)
    expect(c.total).toBe(l.personal.total)
    expect(c.produccion).toBeGreaterThan(0)
    expect(c.produccion).toBeLessThanOrEqual(c.total)
  })

  it('arma los segmentos de la clasificación final en orden y agrega los desconocidos', () => {
    expect(segmentosClasif(undefined)).toBeNull()
    const s = segmentosClasif({ desecho: 2, tipo_a: 60, otro_resultado: 1 }) ?? []
    expect(s.map((x) => x.clave)).toEqual([
      'tipo_a',
      'tipo_b',
      'tipo_c',
      'ok_falta_calcomania',
      'recuperable',
      'desecho',
      'otro_resultado',
    ])
    expect(s.find((x) => x.clave === 'tipo_b')?.valor).toBe(0)
    expect(s.every((x) => x.color.includes('var(--c-'))).toBe(true)
  })

  it('lista las cuatro piscinas y las que traiga el detalle', () => {
    expect(codigosPiscinas(undefined)).toEqual([...PISCINAS])
    expect(codigosPiscinas({ '2.6': 4, '9.9': 1 })).toEqual([...PISCINAS, '9.9'])
    const etapas = new Set(cargar().proceso.etapas.map((e) => e.codigo))
    for (const c of PISCINAS) expect(etapas.has(c)).toBe(true)
  })
})
