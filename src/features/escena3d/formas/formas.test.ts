import { readFileSync } from 'node:fs'
import { Matrix4, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { validarLayout } from '../../../domain/validate'
import { DIMS_TIPICAS } from '../modelo/catalogo'
import { construirModelo } from '../modelo/construirModelo'
import type { FormaEquipo, V3 } from '../modelo/tipos'
import { aristasDeCaja, cimaDeEquipo, envolventes } from './envolventes'
import { instanciasPorForma, piezasDeForma, piezasPorMalla, rotarY } from './piezas'
import { acortarFinal, acumuladas, construirTubos, direccionFinal, mediosDeTramos, puntoEn } from './trazos'

const raw: unknown = JSON.parse(readFileSync(new URL('../../../../public/plant-layout.json', import.meta.url), 'utf-8'))
const r = validarLayout(raw)
if (!r.ok) throw new Error(r.errores.join('\n'))
const m = construirModelo(r.layout)
const FORMAS = Object.keys(DIMS_TIPICAS) as FormaEquipo[]
const finito = (v: readonly number[]) => v.every(Number.isFinite)

describe('piezas de los equipos', () => {
  it('cada forma tiene de 1 a 6 piezas dentro de su caja (con un 12 % de holgura)', () => {
    for (const forma of FORMAS) {
      const [largo, ancho, alto] = DIMS_TIPICAS[forma]
      const piezas = piezasDeForma(forma, { largo, ancho, alto })
      expect(piezas.length, forma).toBeGreaterThanOrEqual(1)
      expect(piezas.length, forma).toBeLessThanOrEqual(6)
      for (const p of piezas) {
        expect(finito([...p.centro, ...p.tam]), forma).toBe(true)
        expect(Math.min(...p.tam), forma).toBeGreaterThan(0)
        expect(Math.abs(p.centro[0]) + p.tam[0] / 2, forma).toBeLessThanOrEqual((largo / 2) * 1.12 + 1e-9)
        expect(Math.abs(p.centro[2]) + p.tam[2] / 2, forma).toBeLessThanOrEqual((ancho / 2) * 1.12 + 1e-9)
        expect(p.centro[1] - p.tam[1] / 2, forma).toBeGreaterThanOrEqual(-1e-9)
        expect(p.centro[1] + p.tam[1] / 2, forma).toBeLessThanOrEqual(alto + 1e-9)
      }
    }
  })

  it('agrupa todas las piezas en 3 mallas, con el equipo de cada instancia', () => {
    const g = piezasPorMalla(m.equipos)
    const total = m.equipos.reduce((n, e) => n + e.instancias.length * piezasDeForma(e.forma, e.dims).length, 0)
    expect(g.caja.length + g.cilindro.length + g.calor.length).toBe(total)
    // Solo los dos hornos tienen franja de calor.
    expect(g.calor.map((p) => p.equipoId).sort()).toEqual(['horno-01', 'horno-02'])
    // Los 5 puestos de decoración (mínimo observado) dibujan 5 tableros.
    expect(g.caja.filter((p) => p.equipoId === 'puesto-decoracion' && p.rol === 'cuerpo')).toHaveLength(5)
    for (const p of [...g.caja, ...g.cilindro, ...g.calor]) expect(finito([...p.pos, ...p.escala, p.rotY])).toBe(true)
  })

  it('cuenta instancias por forma sin inventar cantidades', () => {
    const n = instanciasPorForma(m.equipos)
    expect(n.get('horno')).toBe(2)
    expect(n.get('mesa')).toBe(5)
    expect(n.get('esmaltadora')).toBe(2)
    expect(n.get('kerajet')).toBe(1)
    expect(n.has('puesto_formacion')).toBe(false) // formación está sin ubicar
  })

  it('rotarY sigue la convención de three.js', () => {
    const v = new Vector3(2, 1, -3).applyMatrix4(new Matrix4().makeRotationY(0.7))
    const w = rotarY([2, 1, -3], 0.7)
    expect(w[0]).toBeCloseTo(v.x)
    expect(w[1]).toBeCloseTo(v.y)
    expect(w[2]).toBeCloseTo(v.z)
  })

  it('un cilindro acostado queda con su eje sobre el largo del equipo', () => {
    const molino = m.equipos.find((e) => e.forma === 'molino')!
    const [tambor] = piezasPorMalla([{ ...molino, instancias: [{ pos: [0, 0, 0], rotY: 0 }] }]).cilindro
    expect(tambor?.girarZ).toBe(true)
    // Misma composición que MallaPiezas: rotación Y, luego giro de 90° en Z, escala local.
    const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2))
    const mat = new Matrix4().compose(new Vector3(...tambor!.pos), q, new Vector3(...tambor!.escala))
    const tapa = new Vector3(0, 0.5, 0).applyMatrix4(mat)
    expect(Math.abs(tapa.x - tambor!.pos[0])).toBeCloseTo(molino.dims.largo * 0.4)
    expect(tapa.z).toBeCloseTo(tambor!.pos[2])
  })

  it('envolventes, aristas y cima de un equipo', () => {
    const mesas = m.equipos.find((e) => e.id === 'puesto-decoracion')!
    expect(envolventes(mesas)).toHaveLength(5)
    const [c] = envolventes(mesas)
    const aristas = aristasDeCaja(c!.pos, c!.rotY, c!.escala)
    expect(aristas).toHaveLength(24)
    expect(cimaDeEquipo(mesas)![1]).toBeGreaterThan(mesas.dims.alto)
    expect(cimaDeEquipo({ ...mesas, instancias: [] })).toBeNull()
  })
})

describe('trazos', () => {
  const L: V3[] = [
    [0, 0, 0],
    [3, 0, 0],
    [3, 0, 4],
  ]

  it('mide, recorre y acorta una polilínea', () => {
    expect(acumuladas(L)).toEqual([0, 3, 7])
    expect(puntoEn(L, 0)).toEqual([0, 0, 0])
    expect(puntoEn(L, 1)).toEqual([3, 0, 4])
    expect(puntoEn(L, 0.5)).toEqual([3, 0, 0.5])
    const corto = acortarFinal(L, 2)
    expect(acumuladas(corto).at(-1)).toBeCloseTo(5)
    expect(acortarFinal(L, 50)).toEqual(L)
    expect(direccionFinal(L)).toEqual([0, 0, 1])
    expect(mediosDeTramos(L)).toEqual([
      { pos: [1.5, 0, 0], dir: [1, 0, 0] },
      { pos: [3, 0, 2], dir: [0, 0, 1] },
    ])
  })

  it('arma todos los tubos en una geometría con índices válidos', () => {
    const lados = 6
    const g = construirTubos(
      [
        { puntos: L, radio: 0.2, color: [1, 0, 0], alfa: 1, discontinuo: false },
        { puntos: m.flujos[0]!.puntos, radio: 0.3, color: [0, 0, 1], alfa: 0.5, discontinuo: true },
        { puntos: [[0, 0, 0]], radio: 0.3, color: [0, 0, 1], alfa: 0.5, discontinuo: true },
      ],
      lados,
    )
    const nV = (L.length + m.flujos[0]!.puntos.length) * lados
    expect(g.posiciones.length).toBe(nV * 3)
    expect(g.distancias.length).toBe(nV)
    expect(Math.max(...g.indices)).toBeLessThan(nV)
    expect(finito([...g.posiciones])).toBe(true)
    // Cada anillo queda a `radio` del eje.
    expect(Math.hypot(g.posiciones[1]!, g.posiciones[2]!)).toBeCloseTo(0.2)
    expect(g.estilos[nV * 2 - 1]).toBe(1)
    expect(g.distancias[L.length * lados - 1]).toBeCloseTo(7)
  })
})
