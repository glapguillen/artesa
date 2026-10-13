import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { indexarLayout, zonasDeRuta } from '../../../domain/selectors'
import type { PlantLayout } from '../../../domain/types'
import { validarLayout } from '../../../domain/validate'
import { caminoPorZonas, encuadreCenital, encuadreGeneral, encuadrePara } from './camara'
import { areaConSigno, construirModelo, distribuirEnRect, tramos } from './construirModelo'

const raw: unknown = JSON.parse(readFileSync(new URL('../../../../public/plant-layout.json', import.meta.url), 'utf-8'))
const r = validarLayout(raw)
if (!r.ok) throw new Error(r.errores.join('\n'))
const layout: PlantLayout = r.layout
const idx = indexarLayout(layout)
const m = construirModelo(layout, idx)
const finito = (v: number[]) => v.every(Number.isFinite)

describe('construirModelo', () => {
  it('crea una losa por zona con polígono y lista las zonas sin ubicar', () => {
    expect(m.losas.length).toBe(layout.zonas.filter((z) => z.poligono).length)
    expect(m.zonasSinUbicar.map((z) => z.id).sort()).toEqual(['z-formacion', 'z-secado'])
  })

  it('dibuja los dos hornos con largo del JSON y ancho representativo', () => {
    const hornos = m.equipos.filter((e) => e.forma === 'horno')
    expect(hornos.map((h) => h.id).sort()).toEqual(['horno-01', 'horno-02'])
    for (const h of hornos) {
      expect(h.dims.largo).toBe(20)
      expect(h.representativo).toBe(true)
      expect(h.instancias).toHaveLength(1)
    }
  })

  it('declara de dónde sale la cantidad de instancias', () => {
    const mesas = m.equipos.find((e) => e.id === 'puesto-decoracion')!
    expect(mesas.cantidadOrigen).toBe('dotacion')
    expect(mesas.instancias).toHaveLength(10)
    const esm = m.equipos.find((e) => e.id === 'esmaltado-maquinas')!
    expect(esm.cantidadOrigen).toBe('minimo_observado')
    expect(esm.instancias).toHaveLength(2)
    expect(m.equipos.find((e) => e.id === 'kerajet-01')!.cantidadOrigen).toBe('uno')
  })

  it('no ubica equipos de zonas sin polígono', () => {
    const ids = m.equiposSinUbicar.map((e) => e.id)
    expect(ids).toContain('torno-roller')
    expect(ids).toContain('rack-secado')
    expect(m.equipos.some((e) => e.zona === 'z-formacion')).toBe(false)
  })

  it('mantiene las instancias dentro de su zona', () => {
    for (const e of m.equipos) {
      const s = m.losas.find((x) => x.id === e.zona)!
      const xs = s.contorno.map((p) => p[0])
      const zs = s.contorno.map((p) => p[1])
      for (const i of e.instancias) {
        expect(i.pos[0]).toBeGreaterThanOrEqual(Math.min(...xs) - 0.01)
        expect(i.pos[0]).toBeLessThanOrEqual(Math.max(...xs) + 0.01)
        expect(i.pos[2]).toBeGreaterThanOrEqual(Math.min(...zs) - 0.01)
        expect(i.pos[2]).toBeLessThanOrEqual(Math.max(...zs) + 0.01)
      }
    }
  })

  it('genera muros de edificio y tabiques, sin tabiques en el parqueadero', () => {
    expect(m.muros.some((w) => w.tipo === 'edificio')).toBe(true)
    expect(m.muros.some((w) => w.tipo === 'tabique')).toBe(true)
    expect(m.muros.some((w) => w.de === 'z-parqueadero')).toBe(false)
    for (const w of m.muros) expect(finito([...w.desde, ...w.hasta, w.alto, w.grosor])).toBe(true)
  })

  it('arma flujos solo entre zonas con polígono, como arcos elevados', () => {
    const conZona = layout.flujos.filter((f) => !['z-formacion', 'z-secado'].includes(f.desde) && !['z-formacion', 'z-secado'].includes(f.hasta))
    expect(m.flujos.length).toBe(conZona.length)
    const f = m.flujos[0]!
    expect(f.puntos.length).toBeGreaterThan(10)
    expect(Math.max(...f.puntos.map((p) => p[1]))).toBeGreaterThan(1)
  })
})

describe('geometría', () => {
  it('desplaza los lados hacia el interior en ambas orientaciones', () => {
    const cuadrado: Array<[number, number]> = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]
    for (const pol of [cuadrado, [...cuadrado].reverse()]) {
      expect(Math.abs(areaConSigno(pol))).toBe(100)
      for (const [a, b] of tramos(pol, 1)) {
        for (const p of [a, b]) {
          expect(p[0]).toBeGreaterThanOrEqual(0)
          expect(p[0]).toBeLessThanOrEqual(10)
          expect(p[1]).toBeGreaterThanOrEqual(0)
          expect(p[1]).toBeLessThanOrEqual(10)
        }
      }
    }
  })

  it('distribuye instancias sin desbordar el rectángulo', () => {
    const inst = distribuirEnRect(10, { x1: 0, z1: 0, x2: 15, z2: 23 }, 1.6, 0.8, 1.4)
    expect(inst).toHaveLength(10)
    for (const i of inst) {
      expect(i.pos[0]).toBeGreaterThan(0)
      expect(i.pos[0]).toBeLessThan(15)
      expect(i.pos[2]).toBeGreaterThan(0)
      expect(i.pos[2]).toBeLessThan(23)
      expect(i.rotY).toBeCloseTo(Math.PI / 2)
    }
  })
})

describe('cámara', () => {
  it('produce encuadres finitos', () => {
    for (const e of [encuadreGeneral(m.limites), encuadreCenital(m.limites), encuadrePara(m, 'zona', 'z-horno')!, encuadrePara(m, 'equipo', 'horno-01')!]) {
      expect(finito([...e.posicion, ...e.objetivo])).toBe(true)
    }
    expect(encuadrePara(m, 'zona', 'z-formacion')).toBeNull()
  })

  it('traza la ruta R7 por las zonas en orden', () => {
    const ids = zonasDeRuta(layout, idx, 'R7').map((z) => z.id)
    expect(caminoPorZonas(m, ids)).toHaveLength(ids.length)
  })
})
