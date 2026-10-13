import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { PlantLayout } from '../../domain/types'
import { validarLayout } from '../../domain/validate'
import { construirModelo } from './modelo/construirModelo'
import { representacion3D, TEXTO_ORIGEN, textoDimensiones, textoInstancias, textoRecorte } from './representacion'

const raw: unknown = JSON.parse(readFileSync(new URL('../../../public/plant-layout.json', import.meta.url), 'utf-8'))
const r = validarLayout(raw)
if (!r.ok) throw new Error(r.errores.join('\n'))
const layout: PlantLayout = r.layout
const m = construirModelo(layout)
const eq = (id: string) => layout.equipos.find((e) => e.id === id)!
const e3 = (id: string) => m.equipos.find((e) => e.id === id)!

describe('Representación 3D (panel del equipo)', () => {
  it('declara el origen de las instancias', () => {
    expect(TEXTO_ORIGEN.json).toBe('cantidad del JSON')
    expect(textoInstancias(e3('puesto-decoracion'), 'Foto-2')).toBe('5 · mínimo observado en fotos (Foto-2)')
    expect(textoInstancias(e3('kerajet-01'))).toBe('1 · una instancia representativa: cantidad [POR DEFINIR]')
    const l2: PlantLayout = { ...layout, equipos: layout.equipos.map((e) => (e.id === 'kerajet-01' ? { ...e, cantidad: 3 } : e)) }
    const k = construirModelo(l2).equipos.find((e) => e.id === 'kerajet-01')!
    expect(textoInstancias(k)).toBe('3 · cantidad del JSON')
  })

  it('marca las medidas típicas y el recorte del horno', () => {
    const h = eq('horno-01')
    expect(textoDimensiones(e3('horno-01'), h.dimensiones)).toBe('Largo 18,7 m · ancho 2 m (típico) · alto 1,9 m (típico)')
    expect(textoRecorte(e3('horno-01'), h.dimensiones)).toBe(
      'Largo según el layout 20 m (aprox.) · dibujado 18,7 m para caber en la zona',
    )
    expect(textoRecorte(e3('kerajet-01'), eq('kerajet-01').dimensiones)).toBeNull()
    const rep = representacion3D(h, m)
    expect(rep.dibujado).toBe(true)
    expect(rep.filas.map((f) => f.etiqueta)).toEqual(['Instancias', 'Dibujado', 'Ajuste'])
    expect(rep.filas[1]!.nota).toBe('Forma y tamaño representativos: tamaño típico, no medido')
  })

  it('distingue medidas completas del JSON y equipos sin ubicar', () => {
    const conMedidas = { ...eq('kerajet-01'), dimensiones: { largo: 4, ancho: 1.5, alto: 1.8, precision: 'medido' } }
    const l2: PlantLayout = { ...layout, equipos: layout.equipos.map((e) => (e.id === 'kerajet-01' ? conMedidas : e)) }
    const rep = representacion3D(conMedidas, construirModelo(l2))
    expect(rep.filas[1]!.texto).toBe('Largo 4 m · ancho 1,5 m · alto 1,8 m')
    expect(rep.filas[1]!.nota).toBe('Medidas del JSON; forma esquemática')
    const sinUbicar = representacion3D(eq('colado-vaciado'), m)
    expect(sinUbicar.dibujado).toBe(false)
    expect(representacion3D(eq('horno-01'), null).dibujado).toBe(false)
  })
})
