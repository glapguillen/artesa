import { describe, expect, it } from 'vitest'
import type { Punto } from '../../domain/types'
import {
  acortarFinal,
  anguloFinal,
  cajaDePuntos,
  curvaEntre,
  desplazarVista,
  escalaBonita,
  escalaMeet,
  limitarVista,
  pantallaAMundo,
  pathPolilinea,
  puntoEnPoligono,
  puntosSvg,
  rectInterior,
  textoViewBox,
  viewBoxDe,
  zoomEn,
} from './geometry'
import { ajustarTexto, anchoTexto, disponerEtiqueta, fluirFilas, partirLineas } from './textFit'

const cuadrado: Punto[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]
// Zona en L (como z-trazado): brazo angosto arriba a la derecha.
const ele: Punto[] = [
  [37.5, 90],
  [53, 90],
  [53, 81],
  [74, 81],
  [74, 104],
  [37.5, 104],
]

describe('viewBox y polígonos', () => {
  it('encierra todos los polígonos con margen', () => {
    const vb = viewBoxDe([cuadrado, [[20, 30], [25, 30], [25, 35]]], 2)
    expect(vb).toEqual({ x: -2, y: -2, w: 29, h: 39 })
    expect(textoViewBox(vb)).toBe('-2 -2 29 39')
  })

  it('sin polígonos devuelve un viewBox por defecto válido', () => {
    expect(viewBoxDe([])).toEqual({ x: 0, y: 0, w: 100, h: 100 })
    expect(cajaDePuntos([])).toBeNull()
  })

  it('serializa los puntos para <polygon>', () => {
    expect(puntosSvg([[1, 2], [3.5, 4], [5, 6]])).toBe('1,2 3.5,4 5,6')
  })

  it('detecta puntos dentro y fuera, también en polígonos en L', () => {
    expect(puntoEnPoligono([5, 5], cuadrado)).toBe(true)
    expect(puntoEnPoligono([15, 5], cuadrado)).toBe(false)
    expect(puntoEnPoligono([45, 85], ele)).toBe(false)
    expect(puntoEnPoligono([60, 85], ele)).toBe(true)
  })

  it('el rectángulo interior de un rectángulo es él mismo', () => {
    expect(rectInterior(cuadrado)).toEqual({ x: 0, y: 0, w: 10, h: 10 })
  })

  it('el rectángulo interior de una L queda dentro del polígono y es el mayor', () => {
    const r = rectInterior(ele)
    expect(r).toEqual({ x: 37.5, y: 90, w: 36.5, h: 14 })
    for (const p of [[r.x + 0.1, r.y + 0.1], [r.x + r.w - 0.1, r.y + r.h - 0.1]] as Punto[]) {
      expect(puntoEnPoligono(p, ele)).toBe(true)
    }
  })
})

describe('curvas y polilíneas', () => {
  it('recorta los extremos y comba hacia un lado', () => {
    const c = curvaEntre([0, 0], [100, 0], 0.2, 3)!
    expect(c.a).toEqual([3, 0])
    expect(c.b).toEqual([97, 0])
    expect(c.c[0]).toBeCloseTo(50)
    expect(Math.abs(c.c[1])).toBeCloseTo(20)
    // El sentido contrario se comba hacia el otro lado (no se superponen).
    const inversa = curvaEntre([100, 0], [0, 0], 0.2, 3)!
    expect(Math.sign(inversa.c[1])).toBe(-Math.sign(c.c[1]))
  })

  it('no recorta más del 20 % en tramos cortos y descarta puntos iguales', () => {
    const c = curvaEntre([0, 0], [5, 0], 0.2, 3)!
    expect(c.a[0]).toBeCloseTo(1)
    expect(curvaEntre([1, 1], [1, 1])).toBeNull()
  })

  it('orienta la punta según la tangente final y acorta el final', () => {
    const c = { a: [0, 0] as Punto, c: [10, 0] as Punto, b: [10, 10] as Punto }
    expect(anguloFinal(c)).toBeCloseTo(90)
    expect(acortarFinal(c, 2).b).toEqual([10, 8])
  })

  it('arma el path de una polilínea', () => {
    expect(pathPolilinea([[0, 0], [1.234, 5], [3, 4]])).toBe('M0 0L1.23 5L3 4')
  })
})

describe('zoom, desplazamiento y escala', () => {
  const base = { x: 0, y: 0, w: 100, h: 200 }
  const tam = { w: 400, h: 400 }

  it('calcula la escala meet y convierte pantalla a mundo', () => {
    expect(escalaMeet(base, tam)).toBe(2)
    expect(escalaMeet(base, { w: 0, h: 0 })).toBe(0)
    // Ancho sobrante: 400 - 100 * 2 = 200 → 100 px de margen a cada lado.
    expect(pantallaAMundo(100, 0, base, tam)).toEqual([0, 0])
    expect(pantallaAMundo(300, 400, base, tam)).toEqual([100, 200])
  })

  it('el zoom deja fijo el punto bajo el cursor', () => {
    const p: Punto = [30, 50]
    const v = zoomEn(base, 2, p, base)
    expect(v.w).toBe(50)
    expect(v.h).toBe(100)
    const antes = pantallaAMundo(160, 100, base, tam)
    expect(antes).toEqual(p)
    const despues = pantallaAMundo(160, 100, v, tam)
    expect(despues[0]).toBeCloseTo(p[0])
    expect(despues[1]).toBeCloseTo(p[1])
  })

  it('no aleja más allá del encuadre base ni acerca más del máximo', () => {
    expect(zoomEn(base, 0.1, [50, 100], base)).toEqual(base)
    expect(zoomEn(base, 1000, [50, 100], base, 10).w).toBeCloseTo(10)
  })

  it('el desplazamiento queda dentro del encuadre base', () => {
    const v = { x: 10, y: 10, w: 50, h: 100 }
    expect(desplazarVista(v, -100, 0, base).x).toBe(0)
    expect(desplazarVista(v, 1000, 1000, base)).toEqual({ x: 50, y: 100, w: 50, h: 100 })
    expect(limitarVista({ x: 5, y: 5, w: 500, h: 500 }, base)).toEqual(base)
  })

  it('elige una barra de escala redonda', () => {
    expect(escalaBonita(3, 90)).toEqual({ metros: 25, px: 75 })
    expect(escalaBonita(10, 90).metros).toBe(5)
    expect(escalaBonita(0).metros).toBe(10)
  })
})

describe('ajuste de texto', () => {
  it('parte por palabras y rechaza palabras más largas que la línea', () => {
    expect(partirLineas('Oficinas de producción', 12)).toEqual(['Oficinas de', 'producción'])
    expect(partirLineas('Extraordinariamente', 5)).toBeNull()
  })

  it('usa el mayor tamaño que entra', () => {
    const t = ajustarTexto('Hornos', 200, 40, { maxPx: 14, minPx: 9 })
    expect(t).toEqual({ lineas: ['Hornos'], tam: 14, truncado: false })
  })

  it('salta de línea y achica cuando hace falta', () => {
    const t = ajustarTexto('Bodega de suministros', 80, 40, { maxPx: 14, minPx: 9 })!
    expect(t.truncado).toBe(false)
    expect(t.lineas.length).toBeGreaterThan(1)
    for (const l of t.lineas) expect(anchoTexto(l, t.tam)).toBeLessThanOrEqual(80)
    expect(t.lineas.length * t.tam * 1.15).toBeLessThanOrEqual(40)
  })

  it('recorta con "…" si no entra ni al mínimo, y null si no hay lugar', () => {
    const t = ajustarTexto('Laboratorio de colores y esmaltes', 60, 12, { maxPx: 14, minPx: 9 })!
    expect(t.truncado).toBe(true)
    expect(t.lineas).toHaveLength(1)
    expect(t.lineas[0]!.endsWith('…')).toBe(true)
    expect(ajustarTexto('Laboratorio', 15, 40, { maxPx: 14, minPx: 9 })).toBeNull()
    expect(ajustarTexto('', 100, 100, { maxPx: 14, minPx: 9 })).toBeNull()
  })

  it('nunca parte una palabra: la recorta con "…" o gira el texto', () => {
    const t = ajustarTexto('Kerajet (impresión digital)', 32, 70, { maxPx: 14, minPx: 9 })!
    expect(t.truncado).toBe(true)
    for (const l of t.lineas) expect(l.length <= 5).toBe(true)
    expect(t.lineas.every((l) => l.endsWith('…') || 'Kerajet (impresión digital)'.split(' ').includes(l))).toBe(true)
    const d = disponerEtiqueta({ w: 40, h: 83 }, 'Kerajet (impresión digital)', [])
    expect(d.nombre?.rotado).toBe(true)
    expect(d.nombre?.lineas[0]).toBe('Kerajet')
    const pulido = disponerEtiqueta({ w: 28, h: 45 }, 'Pulido', [])
    expect(pulido.nombre).toMatchObject({ lineas: ['Pulido'], rotado: true, truncado: false })
  })

  it('reparte insignias en filas', () => {
    const items = [{ ancho: 30 }, { ancho: 30 }, { ancho: 30 }]
    expect(fluirFilas(items, 70)?.map((f) => f.length)).toEqual([2, 1])
    expect(fluirFilas([{ ancho: 80 }], 70)).toBeNull()
  })

  it('dispone nombre e insignias cuando hay lugar', () => {
    const items = [{ ancho: 26 }, { ancho: 30 }]
    const d = disponerEtiqueta({ w: 160, h: 80 }, 'Esmaltado', items)
    expect(d.nombre?.lineas).toEqual(['Esmaltado'])
    expect(d.insignias).toHaveLength(2)
    // Insignias debajo del nombre y centradas.
    expect(d.insignias[0]!.y).toBeGreaterThan(d.nombre!.cy)
    const izq = d.insignias[0]!.x - 26 / 2
    const der = d.insignias[1]!.x + 30 / 2
    expect(izq + der).toBeCloseTo(0)
  })

  it('prioriza el nombre completo y gira el texto en zonas altas y angostas', () => {
    const items = [{ ancho: 22 }, { ancho: 22 }, { ancho: 26 }]
    const d = disponerEtiqueta({ w: 25, h: 64 }, 'Hornos', items)
    expect(d.nombre?.rotado).toBe(true)
    expect(d.nombre?.truncado).toBe(false)
  })

  it('devuelve vacío si la caja es demasiado chica', () => {
    expect(disponerEtiqueta({ w: 6, h: 6 }, 'Museo', [])).toEqual({ nombre: null, insignias: [] })
  })
})
