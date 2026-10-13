import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Alarma, LiveState } from '../../domain/live'
import { indexarLayout } from '../../domain/selectors'
import type { PlantLayout } from '../../domain/types'
import { validarLayout } from '../../domain/validate'
import type { PuntoHistorial } from '../../store/usePlantStore'
import { POR_DEFINIR } from '../../ui/tokens'
import {
  alarmasDeSeleccion,
  areaPoligono,
  conteoClasificacion,
  encabezadoDe,
  medidasZona,
  redondearMedio,
  rutasConEtapa,
  serieWip,
  textoCantidad,
  transicionesDeEtapa,
} from './detalleModel'
import { etiquetaFuente, etiquetaSeccion, humanizar, nombreMetrica } from './etiquetas'

const raw: unknown = JSON.parse(readFileSync(new URL('../../../public/plant-layout.json', import.meta.url), 'utf-8'))

function cargar(): PlantLayout {
  const r = validarLayout(raw)
  if (!r.ok) throw new Error(r.errores.join('\n'))
  return r.layout
}

const layout = cargar()
const idx = indexarLayout(layout)

function liveCon(parcial: Partial<LiveState>): LiveState {
  return {
    timestamp: '2026-10-13T12:00:00.000Z',
    fuente: 'mock',
    turno: { id: 'T1', nombre: 'Turno', inicio: '', fin: '', progreso: 0 },
    etapas: {},
    equipos: {},
    zonas: {},
    flujos: {},
    rutas: {},
    clasificaciones: { bizcocho: {}, final: {} },
    kpis: {},
    alarmas: [],
    ...parcial,
  }
}

describe('medidas de zona', () => {
  it('rectángulo: ancho ≤ largo y área exacta', () => {
    const m = medidasZona([
      [32, 0.5],
      [47, 0.5],
      [47, 14],
      [32, 14],
    ])
    expect(m).toEqual({ ancho: 13.5, largo: 15, area: 202.5 })
  })

  it('polígono en L: área del polígono, no del rectángulo envolvente', () => {
    const l: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [10, 4],
      [4, 4],
      [4, 10],
      [0, 10],
    ]
    expect(areaPoligono(l)).toBe(64)
    expect(medidasZona(l)).toEqual({ ancho: 10, largo: 10, area: 64 })
  })

  it('redondea a 0,5 y devuelve null sin polígono', () => {
    expect(redondearMedio(3.2)).toBe(3)
    expect(redondearMedio(3.3)).toBe(3.5)
    expect(medidasZona(null)).toBeNull()
    expect(medidasZona(idx.zonasPorId.get('z-formacion')?.poligono)).toBeNull()
  })

  it('todas las zonas con polígono tienen medidas positivas', () => {
    for (const z of layout.zonas.filter((x) => x.poligono)) {
      const m = medidasZona(z.poligono)
      expect(m?.area, z.id).toBeGreaterThan(0)
      expect(m!.ancho).toBeLessThanOrEqual(m!.largo)
    }
  })
})

describe('serieWip', () => {
  it('omite lecturas nulas, ausentes o no numéricas', () => {
    const h: PuntoHistorial[] = [
      { t: 'a', wip: { '1.4': 10 }, kpis: {} },
      { t: 'b', wip: { '1.4': null }, kpis: {} },
      { t: 'c', wip: {}, kpis: {} },
      { t: 'd', wip: { '1.4': Number.NaN }, kpis: {} },
      { t: 'e', wip: { '1.4': 12 }, kpis: {} },
    ]
    expect(serieWip(h, '1.4')).toEqual([
      { t: 'a', v: 10 },
      { t: 'e', v: 12 },
    ])
    expect(serieWip(h, 'no-existe')).toEqual([])
  })
})

describe('relaciones de una etapa', () => {
  it('transiciones entrantes y salientes', () => {
    const { entrantes, salientes } = transicionesDeEtapa(layout, '1.7')
    expect(entrantes.length).toBeGreaterThan(0)
    expect(salientes.map((t) => t.hasta).sort()).toEqual(expect.arrayContaining(['1.8', '1.9']))
    expect(transicionesDeEtapa(layout, 'XX')).toEqual({ entrantes: [], salientes: [] })
  })

  it('rutas de decoración que la incluyen (2.0 → pasos → siguiente)', () => {
    expect(rutasConEtapa(layout, '2.5').map((r) => r.id)).toEqual(['R6', 'R7', 'R8', 'R9'])
    expect(rutasConEtapa(layout, '2.0')).toHaveLength(layout.proceso.rutas_decoracion.length)
    expect(rutasConEtapa(layout, '1.4')).toEqual([])
  })

  it('conteo de clasificación desde live.clasificaciones', () => {
    const live = liveCon({ clasificaciones: { bizcocho: { buena: 120, mala: 8 }, final: { tipo_a: 50 } } })
    expect(conteoClasificacion(live, '1.7', 'buena')).toBe(120)
    expect(conteoClasificacion(live, '3.3', 'tipo_a')).toBe(50)
    expect(conteoClasificacion(live, '3.3', 'desecho')).toBeNull()
    expect(conteoClasificacion(live, '2.0', 'buena')).toBeNull()
    expect(conteoClasificacion(null, '1.7', 'buena')).toBeNull()
  })
})

describe('alarmasDeSeleccion', () => {
  const a = (id: string, ref: Alarma['ref']): Alarma => ({ id, nivel: 'info', mensaje: id, ref, desde: '' })
  const live = liveCon({
    alarmas: [
      a('horno', { tipo: 'equipo', id: 'horno-01' }),
      a('esmaltado', { tipo: 'etapa', id: '2.4' }),
      a('zona', { tipo: 'zona', id: 'z-horno' }),
      a('suelta', null),
    ],
  })

  it('zona: las suyas, las de sus equipos y las de sus etapas', () => {
    expect(alarmasDeSeleccion(live, idx, { tipo: 'zona', id: 'z-horno' }).map((x) => x.id)).toEqual(['horno', 'zona'])
    expect(alarmasDeSeleccion(live, idx, { tipo: 'zona', id: 'z-esmaltado' }).map((x) => x.id)).toEqual(['esmaltado'])
  })

  it('etapa incluye sus equipos; equipo solo las suyas; sin fuente, ninguna', () => {
    expect(alarmasDeSeleccion(live, idx, { tipo: 'etapa', id: '3.1' }).map((x) => x.id)).toEqual(['horno'])
    expect(alarmasDeSeleccion(live, idx, { tipo: 'equipo', id: 'horno-02' })).toEqual([])
    expect(alarmasDeSeleccion(null, idx, { tipo: 'zona', id: 'z-horno' })).toEqual([])
  })
})

describe('encabezado y textos', () => {
  it('títulos por tipo y "Elemento no encontrado" si el id no existe', () => {
    expect(encabezadoDe(idx, { tipo: 'etapa', id: '1.4' }).titulo).toMatch(/^1\.4 · /)
    expect(encabezadoDe(idx, { tipo: 'zona', id: 'z-horno' })).toMatchObject({ tipo: 'Zona', existe: true })
    expect(encabezadoDe(idx, { tipo: 'equipo', id: 'no-existe' })).toEqual({
      tipo: 'Equipo',
      titulo: 'Elemento no encontrado',
      existe: false,
    })
  })

  it('cantidad: la del JSON, [POR DEFINIR] y el mínimo observado; nunca estimada', () => {
    expect(textoCantidad({ cantidad: 2, cantidad_min_observada: undefined })).toBe('2')
    expect(textoCantidad({ cantidad: null, cantidad_min_observada: undefined })).toBe(POR_DEFINIR)
    expect(textoCantidad({ cantidad: null, cantidad_min_observada: 5 })).toBe(`${POR_DEFINIR} · mín. observado 5`)
  })

  it('etiquetas legibles', () => {
    expect(nombreMetrica('temp_c')).toBe('Temperatura (°C)')
    expect(nombreMetrica('gas_m3_h')).toBe('Gas (m³/h)')
    expect(nombreMetrica('otra_cosa')).toBe('otra_cosa')
    expect(etiquetaSeccion('CLASIFICACION DE BIZCOCHO')).toBe('Clasificación de bizcocho')
    expect(etiquetaSeccion('BODEGA PT')).toBe('Bodega PT')
    expect(etiquetaFuente('croquis+foto-4')).toBe('Croquis + foto-4')
    expect(humanizar('materias_primas')).toBe('Materias primas')
  })
})
