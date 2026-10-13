import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { indexarLayout, zonasDeRuta } from '../../../domain/selectors'
import type { PlantLayout } from '../../../domain/types'
import { validarLayout } from '../../../domain/validate'
import { caminoPorZonas, encuadreCenital, encuadreGeneral, encuadrePara } from './camara'
import { ajustarLargo, areaConSigno, cantidadEquipo, construirModelo, distribuirEnRect, largoDisponible, tramos } from './construirModelo'

const raw: unknown = JSON.parse(readFileSync(new URL('../../../../public/plant-layout.json', import.meta.url), 'utf-8'))
const r = validarLayout(raw)
if (!r.ok) throw new Error(r.errores.join('\n'))
const layout: PlantLayout = r.layout
const idx = indexarLayout(layout)
const m = construirModelo(layout)
const finito = (v: number[]) => v.every(Number.isFinite)

describe('construirModelo', () => {
  it('crea una losa por zona con polígono y lista las zonas sin ubicar', () => {
    expect(m.losas.length).toBe(layout.zonas.filter((z) => z.poligono).length)
    expect(m.zonasSinUbicar.map((z) => z.id).sort()).toEqual(['z-formacion', 'z-secado'])
  })

  it('dibuja los dos hornos sin que excedan su zona, marcados como representativos', () => {
    const hornos = m.equipos.filter((e) => e.forma === 'horno')
    expect(hornos.map((h) => h.id).sort()).toEqual(['horno-01', 'horno-02'])
    const zona = m.losas.find((s) => s.id === 'z-horno')!
    for (const h of hornos) {
      expect(h.dims.largo).toBeLessThanOrEqual(Math.max(zona.ancho, zona.largo))
      expect(h.dims.largo).toBeGreaterThan(15)
      expect(h.representativo).toBe(true)
      expect(h.instancias).toHaveLength(1)
    }
  })

  it('declara de dónde sale la cantidad de instancias', () => {
    const mesas = m.equipos.find((e) => e.id === 'puesto-decoracion')!
    expect(mesas.cantidadOrigen).toBe('minimo_observado')
    expect(mesas.instancias).toHaveLength(5)
    const esm = m.equipos.find((e) => e.id === 'esmaltado-maquinas')!
    expect(esm.cantidadOrigen).toBe('minimo_observado')
    expect(esm.instancias).toHaveLength(2)
    expect(m.equipos.find((e) => e.id === 'kerajet-01')!.cantidadOrigen).toBe('uno')
  })

  it('cantidadEquipo cubre los tres orígenes y nunca usa la dotación', () => {
    const base = layout.equipos.find((e) => e.id === 'kerajet-01')!
    expect(cantidadEquipo({ ...base, cantidad: 3 })).toEqual({ n: 3, origen: 'json' })
    expect(cantidadEquipo({ ...base, cantidad: null, cantidad_min_observada: 4 })).toEqual({ n: 4, origen: 'minimo_observado' })
    expect(cantidadEquipo({ ...base, cantidad: null, cantidad_min_observada: undefined, instanciado: true })).toEqual({ n: 1, origen: 'uno' })
  })

  it('conserva el largo del JSON cuando lo recorta para caber en la zona', () => {
    const h = m.equipos.find((e) => e.id === 'horno-01')!
    expect(h.largoOriginal).toBe(20)
    expect(h.recortado).toBe(true)
    // Posición z = 79,5 en una zona de 70 a 89,5: caben 19 m centrados, menos 0,4 m por extremo.
    expect(h.dims.largo).toBeCloseTo(19 - 0.8)
    expect(ajustarLargo(20, 0.5)).toBeGreaterThan(0)
    expect(ajustarLargo(0.3, 0.2)).toBeCloseTo(0.3)
    expect(ajustarLargo(4, 10)).toBe(4)
  })

  it('no ubica equipos de zonas sin polígono', () => {
    const ids = m.equiposSinUbicar.map((e) => e.id)
    expect(ids).toContain('torno-roller')
    expect(ids).toContain('rack-secado')
    expect(m.equipos.some((e) => e.zona === 'z-formacion')).toBe(false)
  })

  it('mantiene la huella rotada de cada instancia dentro de su zona (sin atravesar muros)', () => {
    for (const e of m.equipos) {
      const s = m.losas.find((x) => x.id === e.zona)!
      const xs = s.contorno.map((p) => p[0])
      const zs = s.contorno.map((p) => p[1])
      for (const i of e.instancias) {
        // Eje X local → (cos, -sin); eje Z local → (sin, cos) en el plano x-z (convención three.js).
        const [c, sn] = [Math.cos(i.rotY), Math.sin(i.rotY)]
        const L = e.dims.largo / 2
        const A = e.dims.ancho / 2
        for (const [u, v] of [[L, A], [L, -A], [-L, A], [-L, -A]] as const) {
          const x = i.pos[0] + u * c + v * sn
          const z = i.pos[2] - u * sn + v * c
          expect(x, `${e.id} x`).toBeGreaterThanOrEqual(Math.min(...xs) - 0.01)
          expect(x, `${e.id} x`).toBeLessThanOrEqual(Math.max(...xs) + 0.01)
          expect(z, `${e.id} z`).toBeGreaterThanOrEqual(Math.min(...zs) - 0.01)
          expect(z, `${e.id} z`).toBeLessThanOrEqual(Math.max(...zs) + 0.01)
        }
      }
    }
  })

  it('orienta los hornos a lo largo de Z según rotacion_grados', () => {
    for (const id of ['horno-01', 'horno-02']) {
      const h = m.equipos.find((e) => e.id === id)!
      expect(h.instancias[0]!.rotY).toBeCloseTo(Math.PI / 2)
    }
    expect(largoDisponible([47, 79.5], 0, { x1: 44.5, z1: 70, x2: 52, z2: 89.5 })).toBeCloseTo(5)
    expect(largoDisponible([47, 79.5], Math.PI / 2, { x1: 44.5, z1: 70, x2: 52, z2: 89.5 })).toBeCloseTo(19)
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
