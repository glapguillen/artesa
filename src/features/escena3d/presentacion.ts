// Presentación de la escena 3D (puro, sin three.js): colores de las losas, destino de cámara de
// una selección y textos de los supuestos. Todo sale del layout y de la paleta del tema.
import type { EstadoOperativo } from '../../domain/live'
import { type LayoutIndex, zonaPrincipalDeEtapa } from '../../domain/selectors'
import type { PlantLayout } from '../../domain/types'
import type { Seleccion } from '../../store/usePlantStore'
import { POR_DEFINIR } from '../../ui/tokens'
import { patronDeGrupo } from '../planta/planModel'
import { encuadrePara } from './modelo/camara'
import { ALTO_MURO_EDIFICIO, ALTO_TABIQUE } from './modelo/catalogo'
import type { Encuadre, ModeloEscena } from './modelo/tipos'
import type { Paleta3D } from './usePaleta3D'

function rgb(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null
  const n = Number.parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Mezcla lineal de dos colores #rgb/#rrggbb (t = 0 → a, t = 1 → b). Si uno no es hex, devuelve el otro. */
export function mezclar(a: string, b: string, t: number): string {
  const ca = rgb(a)
  const cb = rgb(b)
  if (!ca) return cb ? b : a
  if (!cb) return a
  const k = Math.min(1, Math.max(0, t))
  return `#${ca.map((v, i) => Math.round(v + ((cb[i] ?? v) - v) * k).toString(16).padStart(2, '0')).join('')}`
}

/** Las zonas sin rótulo o por identificar llevan trama, como en el 2D. */
export const esRayada = (grupo: string) => patronDeGrupo(grupo) === 'rayado'

export interface EntradaColorLosa {
  colorPor: 'estado' | 'grupo'
  estado: EstadoOperativo
  /** Color de grupo del JSON. */
  colorGrupo: string
  rayada: boolean
  /** Fuera de la ruta activa. */
  atenuada: boolean
  hover: boolean
}

/**
 * Relleno y borde de una losa. Equivale al 2D: por estado, el color del estado translúcido sobre
 * la superficie y borde del mismo color; por grupo, el color del JSON con la opacidad del tema.
 */
export function colorLosa(p: Paleta3D, e: EntradaColorLosa): { relleno: string; borde: string } {
  let relleno: string
  let borde: string
  if (e.colorPor === 'estado') {
    relleno = mezclar(p.superficie, p.estado[e.estado], p.oscuro ? 0.5 : 0.42)
    borde = p.estado[e.estado]
  } else if (e.rayada) {
    relleno = mezclar(p.superficie, p.tenue, p.oscuro ? 0.3 : 0.12)
    borde = p.tenue
  } else {
    relleno = mezclar(p.superficie, e.colorGrupo, p.opacidadZona)
    borde = p.tenue
  }
  if (e.atenuada) {
    relleno = mezclar(relleno, p.fondo, 0.7)
    borde = mezclar(borde, p.fondo, 0.7)
  }
  if (e.hover) relleno = mezclar(relleno, p.seleccion, 0.3)
  return { relleno, borde }
}

/** A dónde va la cámara al seleccionar algo, o por qué no puede ir (no está en el croquis). */
export type Destino =
  | { tipo: 'escena'; encuadre: Encuadre; zonaId: string | null }
  | { tipo: 'sin_ubicar'; nombre: string }

export function destinoDeSeleccion(m: ModeloEscena, idx: LayoutIndex | null, sel: Seleccion | null): Destino | null {
  if (!sel || !idx) return null
  if (sel.tipo === 'zona') {
    const e = encuadrePara(m, 'zona', sel.id)
    if (e) return { tipo: 'escena', encuadre: e, zonaId: sel.id }
    const z = idx.zonasPorId.get(sel.id)
    return z ? { tipo: 'sin_ubicar', nombre: z.nombre } : null
  }
  if (sel.tipo === 'equipo') {
    const q = idx.equiposPorId.get(sel.id)
    const e = encuadrePara(m, 'equipo', sel.id)
    if (e) return { tipo: 'escena', encuadre: e, zonaId: q?.zona ?? null }
    return q ? { tipo: 'sin_ubicar', nombre: q.nombre } : null
  }
  const etapa = idx.etapasPorCodigo.get(sel.id)
  if (!etapa) return null
  const z = zonaPrincipalDeEtapa(idx, sel.id)
  const e = z ? encuadrePara(m, 'zona', z.id) : null
  if (z && e) return { tipo: 'escena', encuadre: e, zonaId: z.id }
  return { tipo: 'sin_ubicar', nombre: `${etapa.codigo} · ${etapa.nombre_corto}` }
}

const m1 = (v: number) => v.toLocaleString('es-EC', { maximumFractionDigits: 1 })

/** Supuestos de la escena que la UI declara (escala, norte, alturas, envolventes, equipos). */
export function supuestosDeEscena(l: PlantLayout, m: ModeloEscena): string[] {
  const out: string[] = []
  const escala = l.planta.plano_referencia.escala_px_por_m === null
  const norte = l.planta.norte_grados === null
  if (escala && norte) out.push('Escala y norte supuestos: el croquis no está calibrado.')
  else if (escala) out.push('Escala supuesta: el croquis no está calibrado.')
  else if (norte) out.push('Norte supuesto.')
  const sinAltura = l.edificios.filter((e) => e.altura_m === null).length
  out.push(
    `Muros en corte a ${m1(ALTO_MURO_EDIFICIO)} m (naves) y ${m1(ALTO_TABIQUE)} m (tabiques) para ver el interior` +
      (sinAltura ? `; altura real ${POR_DEFINIR} en ${sinAltura} de ${l.edificios.length} edificios.` : '.'),
  )
  for (const e of l.edificios) {
    if (!e.poligono) out.push(`${e.nombre}: sin contorno en el croquis, sus muros no se dibujan (envolvente ${POR_DEFINIR}).`)
  }
  if (m.equipos.some((e) => e.representativo))
    out.push('Equipos con forma y tamaño representativos salvo las medidas del JSON; cantidades del JSON o mínimo observado.')
  const nz = m.zonasSinUbicar.length
  const ne = m.equiposSinUbicar.length
  if (nz || ne) out.push(`${nz} zonas y ${ne} equipos sin ubicar en el croquis: se listan aparte, fuera de la planta.`)
  return out
}
