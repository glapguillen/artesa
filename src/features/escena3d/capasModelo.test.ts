import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Alarma, LiveState } from '../../domain/live'
import { indexarLayout, zonasDeRuta } from '../../domain/selectors'
import type { PlantLayout } from '../../domain/types'
import { validarLayout } from '../../domain/validate'
import {
  calorRelativo,
  estiloFlujo,
  marcasRepresentativas,
  particulasDeFlujo,
  radioFlujo,
  realceFlujos,
  vistaEquipos,
} from './capasModelo'
import { construirModelo } from './modelo/construirModelo'
import { ALTURA_RUTA, balizasDeAlarmas, colorNivel, rotuloRuta, rutaEscena } from './rutaAlarmasModelo'

const raw: unknown = JSON.parse(readFileSync(new URL('../../../public/plant-layout.json', import.meta.url), 'utf-8'))
const r = validarLayout(raw)
if (!r.ok) throw new Error(r.errores.join('\n'))
const layout: PlantLayout = r.layout
const idx = indexarLayout(layout)
const m = construirModelo(layout)

function vivo(parcial: Partial<LiveState> = {}): LiveState {
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
const alarma = (id: string, nivel: Alarma['nivel'], ref: Alarma['ref']): Alarma => ({ id, nivel, mensaje: id, ref, desde: '' })

describe('equipos en vivo', () => {
  it('calorRelativo va de 0 (ambiente) a 1 (objetivo) y es null sin métricas', () => {
    expect(calorRelativo(undefined)).toBeNull()
    expect(calorRelativo({ temp_c: 900 })).toBeNull()
    expect(calorRelativo({ temp_c: 20, temp_objetivo_c: 1100 })).toBe(0)
    expect(calorRelativo({ temp_c: 1100, temp_objetivo_c: 1100 })).toBe(1)
    expect(calorRelativo({ temp_c: 1300, temp_objetivo_c: 1100 })).toBe(1)
    expect(calorRelativo({ temp_c: 560, temp_objetivo_c: 1100 })).toBeCloseTo(0.5)
    expect(calorRelativo({ temp_c: Number.NaN, temp_objetivo_c: 1100 })).toBeNull()
  })

  it('un equipo sin datos queda en sin_datos y la selección lo resalta', () => {
    const v = vistaEquipos(m.equipos, vivo({ equipos: { 'horno-01': { estado: 'detenido', metricas: { temp_c: 560, temp_objetivo_c: 1100 } } } }), {
      tipo: 'equipo',
      id: 'horno-01',
    })
    expect(v.get('horno-01')).toEqual({ estado: 'detenido', calor: expect.closeTo(0.5), resalte: 'fuerte' })
    expect(v.get('horno-02')).toEqual({ estado: 'sin_datos', calor: null, resalte: null })
    const porEtapa = vistaEquipos(m.equipos, null, { tipo: 'etapa', id: 'B2' })
    expect([...porEtapa].filter(([, x]) => x.resalte === 'suave').map(([id]) => id).sort()).toEqual(
      m.equipos.filter((e) => e.etapa === 'B2').map((e) => e.id).sort(),
    )
  })

  it('marca como representativos los equipos sin medidas completas', () => {
    const marcas = marcasRepresentativas(m.equipos)
    expect(marcas.map((k) => k.equipoId).sort()).toEqual(m.equipos.filter((e) => e.representativo).map((e) => e.id).sort())
    expect(marcas.some((k) => k.equipoId === 'horno-01')).toBe(true)
  })
})

describe('flujos', () => {
  it('grosor: fino sin dato y creciente con el caudal relativo', () => {
    expect(radioFlujo(null)).toBeLessThan(radioFlujo(0))
    expect(radioFlujo(0.2)).toBeLessThan(radioFlujo(0.8))
    expect(radioFlujo(1)).toBe(radioFlujo(5))
    expect(radioFlujo(0.51)).toBe(radioFlujo(0.49))
    expect(particulasDeFlujo(null)).toBe(1)
    expect(particulasDeFlujo(1)).toBe(3)
  })

  it('principal sólido; hipótesis, sin ubicar y venta discontinuos y más tenues', () => {
    const p = estiloFlujo('principal')
    expect(p.discontinuo).toBe(false)
    for (const t of ['hipotesis', 'sin_ubicar', 'venta'] as const) {
      expect(estiloFlujo(t).discontinuo).toBe(true)
      expect(estiloFlujo(t).alfa).toBeLessThan(p.alfa)
    }
  })

  it('realza los flujos de la zona seleccionada', () => {
    expect(Object.values(realceFlujos(m.flujos, idx, null)).every((v) => v === 1)).toBe(true)
    const r = realceFlujos(m.flujos, idx, { tipo: 'zona', id: 'z-horno' })
    for (const f of m.flujos) expect(r[f.id]).toBe(f.desde === 'z-horno' || f.hasta === 'z-horno' ? 1 : 0.25)
  })
})

describe('ruta activa', () => {
  it('recorre las mismas zonas que el 2D, elevada y con pasos repetidos agrupados', () => {
    const ruta = rutaEscena(layout, idx, m, 'R7')!
    const zonas = zonasDeRuta(layout, idx, 'R7')
    expect(ruta.camino).toHaveLength(zonas.length)
    expect(ruta.camino.every((p) => p[1] === ALTURA_RUTA)).toBe(true)
    const repetida = ruta.pasos.find((p) => p.numeros.length > 1)
    expect(repetida?.numeros).toEqual([1, 4])
    expect(ruta.sinZona).toEqual([])
    expect(rotuloRuta(ruta, 120)).toBe('Ruta R7 · D+E+ID+D · 120 pzs/turno')
    expect(rotuloRuta(ruta, null)).toBe('Ruta R7 · D+E+ID+D')
    expect(rutaEscena(layout, idx, m, 'R99')).toBeNull()
  })

  it('declara en el rótulo los pasos sin zona', () => {
    const l2: PlantLayout = { ...layout, zonas: layout.zonas.map((z) => ({ ...z, etapas: z.etapas.filter((c) => c !== '2.5') })) }
    const ruta = rutaEscena(l2, indexarLayout(l2), construirModelo(l2), 'R6')!
    expect(ruta.sinZona.map((s) => s.codigo)).toEqual(['2.5'])
    expect(rotuloRuta(ruta, undefined)).toMatch(/^Ruta R6 · D\+E\+ID · sin zona: 2\.5 /)
    expect(rotuloRuta({ ...ruta, camino: [] }, null)).toBe('Ruta R6 · D+E+ID · sin zonas ubicadas')
  })
})

describe('alarmas', () => {
  it('ubica cada alarma en su equipo, zona o etapa y omite lo no ubicado', () => {
    const live = vivo({
      alarmas: [
        alarma('info-etapa', 'info', { tipo: 'etapa', id: '2.4' }),
        alarma('horno', 'critica', { tipo: 'equipo', id: 'horno-01' }),
        alarma('zona', 'advertencia', { tipo: 'zona', id: 'z-cf' }),
        alarma('sin-ubicar', 'critica', { tipo: 'equipo', id: 'colado-vaciado' }),
        alarma('etapa-sin-zona', 'advertencia', { tipo: 'etapa', id: '1.6' }),
        alarma('sin-ref', 'critica', null),
        alarma('esmaltado-2', 'advertencia', { tipo: 'etapa', id: '2.4' }),
      ],
    })
    const b = balizasDeAlarmas(m, idx, live)
    expect(b.map((x) => x.clave)).toEqual(['equipo:horno-01', 'etapa:2.4', 'zona:z-cf'])
    const horno = m.equipos.find((e) => e.id === 'horno-01')!
    expect(b[0]!.pos).toEqual([horno.instancias[0]!.pos[0], horno.dims.alto + 0.15, horno.instancias[0]!.pos[2]])
    expect(b[0]!.cima).toBeGreaterThan(b[0]!.pos[1])
    const esm = m.losas.find((s) => s.id === 'z-esmaltado')!
    expect(b[1]!.pos[0]).toBeCloseTo(esm.centro[0])
    expect(b[1]!.nivel).toBe('advertencia')
    expect(b[1]!.alarmas.map((a) => a.id)).toEqual(['esmaltado-2', 'info-etapa'])
    expect(b[2]!.nombre).toBe(m.losas.find((s) => s.id === 'z-cf')!.nombre)
    expect(balizasDeAlarmas(m, idx, null)).toEqual([])
  })

  it('colorea por nivel con la paleta del tema', () => {
    const p = { estado: { operando: 'v', espera: 'a', detenido: 'r', mantenimiento: 'm', sin_datos: 'g' }, tenue: 't' }
    expect([colorNivel('critica', p), colorNivel('advertencia', p), colorNivel('info', p)]).toEqual(['r', 'a', 't'])
  })
})
