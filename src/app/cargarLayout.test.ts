import { describe, expect, it } from 'vitest'
import { interpretarRespuesta, lineaColumna } from './cargarLayout'

const URL_LAYOUT = './plant-layout.json'

describe('interpretarRespuesta', () => {
  it('lee un JSON válido', () => {
    expect(interpretarRespuesta(URL_LAYOUT, 200, 'application/json', '{"a":1}')).toEqual({ ok: true, raw: { a: 1 } })
  })

  it('explica el 404 y el HTML devuelto en lugar del archivo', () => {
    const r404 = interpretarRespuesta(URL_LAYOUT, 404, 'text/plain', 'Not found')
    expect(r404.ok ? '' : r404.error).toContain('No se encontró plant-layout.json')
    const html = interpretarRespuesta(URL_LAYOUT, 200, 'text/html', '<!doctype html><html></html>')
    expect(html.ok ? '' : html.error).toContain('página HTML')
  })

  it('indica línea y columna de un error de sintaxis', () => {
    const r = interpretarRespuesta(URL_LAYOUT, 200, 'application/json', '{\n  "a": 1,\n  b: 2\n}')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toContain('línea 3')
      expect(r.error).toContain('no es un JSON válido')
    }
  })

  it('avisa si el archivo está vacío', () => {
    const r = interpretarRespuesta(URL_LAYOUT, 200, 'application/json', '  ')
    expect(r.ok ? '' : r.error).toContain('vacío')
  })
})

describe('lineaColumna', () => {
  it('cuenta desde 1', () => {
    expect(lineaColumna('ab\ncd', 4)).toEqual({ linea: 2, columna: 2 })
    expect(lineaColumna('ab', 0)).toEqual({ linea: 1, columna: 1 })
  })
})
