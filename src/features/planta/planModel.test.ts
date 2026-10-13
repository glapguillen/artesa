import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { LiveState } from '../../domain/live'
import { indexarLayout, zonasDeRuta } from '../../domain/selectors'
import type { PlantLayout } from '../../domain/types'
import { validarLayout } from '../../domain/validate'
import { puntoEnPoligono } from './geometry'
import {
  alarmasPorZona,
  caudalRelativo,
  estadosDeZonas,
  estiloZona,
  pasosPorZona,
  resaltadoDeSeleccion,
} from './planLive'
import { construirPlano, geoAcceso, patronDeGrupo } from './planModel'

const raw: unknown = JSON.parse(readFileSync(new URL('../../../public/plant-layout.json', import.meta.url), 'utf-8'))
const r = validarLayout(raw)
if (!r.ok) throw new Error(r.errores.join('\n'))
const layout: PlantLayout = r.layout
const idx = indexarLayout(layout)
const plano = construirPlano(layout, idx)

function vivo(parcial: Partial<LiveState>): LiveState {
  return {
    timestamp: '2026-10-13T07:00:00Z',
    fuente: 'mock',
    turno: { id: 't', nombre: 'T', inicio: '', fin: '', progreso: 0 },
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

describe('construirPlano', () => {
  it('separa zonas con polígono de las sin ubicar', () => {
    const conPoligono = layout.zonas.filter((z) => z.poligono).length
    expect(plano.zonas).toHaveLength(conPoligono)
    expect(plano.sinUbicar.map((z) => z.id)).toEqual(layout.zonas.filter((z) => !z.poligono).map((z) => z.id))
  })

  it('el viewBox base contiene todas las zonas y edificios', () => {
    const b = plano.base
    for (const z of plano.zonas)
      for (const [x, y] of z.poligono) {
        expect(x).toBeGreaterThan(b.x)
        expect(y).toBeGreaterThan(b.y)
        expect(x).toBeLessThan(b.x + b.w)
        expect(y).toBeLessThan(b.y + b.h)
      }
  })

  it('las etiquetas quedan dentro de su zona (también en las zonas en L)', () => {
    for (const z of plano.zonas) {
      const e = z.etiqueta
      expect(puntoEnPoligono([e.x + e.w / 2, e.y + e.h / 2], z.poligono)).toBe(true)
    }
  })

  it('omite flujos con zonas sin polígono', () => {
    const ids = plano.flujos.map((f) => f.id)
    const conZonaSinUbicar = layout.flujos.filter((f) => !plano.porId.has(f.desde) || !plano.porId.has(f.hasta))
    expect(conZonaSinUbicar.length).toBeGreaterThan(0)
    for (const f of conZonaSinUbicar) expect(ids).not.toContain(f.id)
    expect(ids.length + conZonaSinUbicar.length).toBe(layout.flujos.length)
  })

  it('arma insignias de etapas, hipótesis y personas', () => {
    const horno = plano.porId.get('z-horno')!
    expect(horno.insignias.map((i) => i.texto)).toEqual(['1.5', '3.1', '3.5?', '3'])
    const id = plano.porId.get('z-id')!
    expect(id.insignias.find((i) => i.tipo === 'personas')?.texto).toMatch(/^~\d+$/)
  })

  it('asigna tramas por grupo', () => {
    expect(patronDeGrupo('sin_rotulo')).toBe('rayado')
    expect(patronDeGrupo('sin_identificar')).toBe('rayado')
    expect(patronDeGrupo('exterior')).toBe('puntos')
    expect(patronDeGrupo('horno')).toBeNull()
  })

  it('ubica el vano de un acceso sobre su muro y rotula el ancho faltante', () => {
    const a = geoAcceso(
      { id: 'a', tipo: 'puerta', zona: 'z', lado: 'este', posicion: [10, 20], ancho_m: null, fuente: '' },
      'Zona',
    )
    expect(a.a[0]).toBe(10)
    expect(a.b[0]).toBe(10)
    expect(a.adentro).toEqual([-1, 0])
    expect(a.titulo).toContain('POR DEFINIR')
  })
})

describe('estado en vivo y selección', () => {
  it('sin datos en vivo todo queda en sin_datos, sin romper con ids desconocidos', () => {
    const e = estadosDeZonas(idx, null, ['z-horno', 'no-existe'])
    expect(e).toEqual({ 'z-horno': 'sin_datos', 'no-existe': 'sin_datos' })
    expect(alarmasPorZona(idx, null).size).toBe(0)
  })

  it('marca alarmas por zona, equipo y etapa con el peor nivel', () => {
    const live = vivo({
      alarmas: [
        { id: '1', nivel: 'advertencia', mensaje: '', ref: { tipo: 'equipo', id: 'horno-01' }, desde: '' },
        { id: '2', nivel: 'critica', mensaje: '', ref: { tipo: 'etapa', id: '3.1' }, desde: '' },
        { id: '3', nivel: 'info', mensaje: '', ref: { tipo: 'zona', id: 'z-museo' }, desde: '' },
        { id: '4', nivel: 'critica', mensaje: '', ref: { tipo: 'equipo', id: 'no-existe' }, desde: '' },
        { id: '5', nivel: 'critica', mensaje: '', ref: null, desde: '' },
      ],
    })
    const a = alarmasPorZona(idx, live)
    expect(a.get('z-horno')).toBe('critica')
    expect(a.get('z-museo')).toBe('info')
    expect(a.size).toBe(2)
  })

  it('normaliza el caudal de los flujos y deja null sin dato', () => {
    const live = vivo({ flujos: { p1: { piezas_h: 50 }, p2: { piezas_h: 100 }, p3: { piezas_h: null } } })
    expect(caudalRelativo(['p1', 'p2', 'p3', 'x'], live)).toEqual({ p1: 0.5, p2: 1, p3: null, x: null })
    expect(caudalRelativo(['p1'], null)).toEqual({ p1: null })
  })

  it('resalta zonas de una etapa (probables discontinuas) y la zona de un equipo', () => {
    const etapa = resaltadoDeSeleccion(idx, { tipo: 'etapa', id: '1.4' })
    expect(etapa.get('z-pulido')).toBe('discontinuo')
    expect(etapa.get('z-secado')).toBe('discontinuo')
    expect(resaltadoDeSeleccion(idx, { tipo: 'etapa', id: '3.1' }).get('z-horno')).toBe('solido')
    expect([...resaltadoDeSeleccion(idx, { tipo: 'equipo', id: 'kerajet-01' })]).toEqual([['z-kerajet', 'solido']])
    expect(resaltadoDeSeleccion(idx, { tipo: 'equipo', id: 'no-existe' }).size).toBe(0)
    expect(resaltadoDeSeleccion(idx, null).size).toBe(0)
  })

  it('numera los pasos de una ruta aunque repita zona (R7)', () => {
    const pasos = pasosPorZona(zonasDeRuta(layout, idx, 'R7'))
    expect(pasos.get('z-decorado')).toEqual([1, 4])
    expect(pasos.get('z-horno')).toEqual([5])
  })

  it('elige colores desde variables CSS según el modo', () => {
    const z = { color: '#A9C0E8', patron: null }
    expect(estiloZona(z, 'estado', 'detenido')).toMatchObject({ relleno: 'var(--c-estado-detenido)' })
    expect(estiloZona(z, 'grupo', 'detenido')).toMatchObject({ relleno: '#A9C0E8', opacidad: 'var(--zona-opacidad)' })
    expect(estiloZona({ color: '#FFFFFF', patron: 'rayado' }, 'grupo', 'operando').relleno).toBe('var(--c-surface-2)')
  })
})
