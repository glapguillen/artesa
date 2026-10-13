// Lógica pura de las capas Ruta y Alarmas de la escena 3D: recorrido de la ruta activa (misma
// función de dominio que el 2D) y una baliza por referencia con alarmas activas.
import type { Alarma, LiveState, NivelAlarma } from '../../domain/live'
import { type LayoutIndex, zonaPrincipalDeEtapa, zonasDeRuta } from '../../domain/selectors'
import type { PlantLayout } from '../../domain/types'
import { fmtNum, NIVEL_ALARMA_ETIQUETA } from '../../ui/tokens'
import { pasosPorZona } from '../planta/planLive'
import { caminoPorZonas } from './modelo/camara'
import type { ModeloEscena, V3 } from './modelo/tipos'
import type { Paleta3D } from './usePaleta3D'

// ---------- Ruta ----------

/** Altura (m) del trazo de la ruta: por encima de muros en corte (2,4 m) y equipos. */
export const ALTURA_RUTA = 3.2

export interface PasoRuta {
  zonaId: string
  nombre: string
  /** Números de paso de esa zona (una zona puede repetirse: "1·4"). */
  numeros: number[]
  pos: V3
}

export interface RutaEscena {
  id: string
  codigo: string
  camino: V3[]
  pasos: PasoRuta[]
  /** Etapas del recorrido sin zona ubicada (código y nombre corto). */
  sinZona: Array<{ codigo: string; nombre: string }>
}

/** Ruta activa en la escena: misma función de dominio que el 2D (zonasDeRuta) + camino elevado. */
export function rutaEscena(l: PlantLayout, idx: LayoutIndex, m: ModeloEscena, rutaId: string): RutaEscena | null {
  const r = l.proceso.rutas_decoracion.find((x) => x.id === rutaId)
  if (!r) return null
  const zonas = zonasDeRuta(l, idx, rutaId)
  const camino = caminoPorZonas(m, zonas.map((z) => z.id), ALTURA_RUTA)
  const pasos: PasoRuta[] = []
  for (const [zonaId, numeros] of pasosPorZona(zonas)) {
    const s = m.losas.find((x) => x.id === zonaId)
    if (s) pasos.push({ zonaId, nombre: s.nombre, numeros, pos: [s.centro[0], ALTURA_RUTA, s.centro[1]] })
  }
  const sinZona = [...r.pasos, '3.1']
    .filter((c, i, a) => a.indexOf(c) === i && !zonaPrincipalDeEtapa(idx, c))
    .map((c) => ({ codigo: c, nombre: idx.etapasPorCodigo.get(c)?.nombre_corto ?? c }))
  return { id: r.id, codigo: r.codigo, camino, pasos, sinZona }
}

/** "Ruta R7 · D+E+ID+D · 120 pzs/turno", con los pasos sin zona si los hay. */
export function rotuloRuta(r: RutaEscena, piezas: number | null | undefined): string {
  const partes = [`Ruta ${r.id}${r.codigo ? ` · ${r.codigo}` : ''}`]
  if (typeof piezas === 'number' && Number.isFinite(piezas)) partes.push(`${fmtNum(piezas)} pzs/turno`)
  if (r.camino.length === 0) partes.push('sin zonas ubicadas')
  else if (r.sinZona.length) partes.push(`sin zona: ${r.sinZona.map((s) => `${s.codigo} ${s.nombre}`).join(', ')}`)
  return partes.join(' · ')
}

// ---------- Alarmas ----------

const GRAVEDAD: Record<NivelAlarma, number> = { info: 0, advertencia: 1, critica: 2 }

export interface Baliza {
  clave: string
  ref: NonNullable<Alarma['ref']>
  /** Nombre del equipo, zona o etapa (para el aria-label). */
  nombre: string
  /** Peor nivel de las alarmas de esa referencia. */
  nivel: NivelAlarma
  alarmas: Alarma[]
  /** Centro del anillo (sobre el equipo o el piso de la zona). */
  pos: V3
  /** Altura de la cima de la columna (donde va el "!"). */
  cima: number
  /** Radio del anillo (m). */
  radio: number
}

/** Alto de la columna de una baliza sobre su base (m). */
export const ALTO_BALIZA = 5

/**
 * Una baliza por referencia con alarmas activas. Equipo → sobre su primera instancia; zona → centro
 * de su losa; etapa → zona principal de la etapa (zonaPrincipalDeEtapa). Lo que no está ubicado en
 * el croquis no se dibuja dentro de la planta.
 */
export function balizasDeAlarmas(m: ModeloEscena, idx: LayoutIndex | null, live: LiveState | null): Baliza[] {
  if (!idx || !live) return []
  const porClave = new Map<string, Baliza>()
  const losa = (id: string | undefined) => (id ? m.losas.find((s) => s.id === id) : undefined)
  for (const a of live.alarmas ?? []) {
    const ref = a?.ref
    if (!ref) continue
    const clave = `${ref.tipo}:${ref.id}`
    const previa = porClave.get(clave)
    if (previa) {
      previa.alarmas.push(a)
      if (GRAVEDAD[a.nivel] > GRAVEDAD[previa.nivel]) previa.nivel = a.nivel
      continue
    }
    let pos: V3 | null = null
    let radio = 2
    let nombre = ref.id
    if (ref.tipo === 'equipo') {
      const e = m.equipos.find((x) => x.id === ref.id)
      const i = e?.instancias[0]
      if (e && i) {
        pos = [i.pos[0], e.dims.alto + 0.15, i.pos[2]]
        radio = Math.min(2.5, Math.max(0.9, e.dims.ancho * 0.75))
        nombre = e.nombre
      }
    } else {
      const s = losa(ref.tipo === 'zona' ? ref.id : zonaPrincipalDeEtapa(idx, ref.id)?.id)
      if (s) {
        pos = [s.centro[0], 0.08, s.centro[1]]
        radio = Math.min(3, Math.max(1.2, Math.min(s.ancho, s.largo) * 0.25))
      }
      nombre = ref.tipo === 'zona' ? (s?.nombre ?? ref.id) : (idx.etapasPorCodigo.get(ref.id)?.nombre_corto ?? ref.id)
    }
    if (!pos) continue
    porClave.set(clave, { clave, ref, nombre, nivel: a.nivel, alarmas: [a], pos, cima: pos[1] + ALTO_BALIZA, radio })
  }
  const out = [...porClave.values()]
  for (const b of out) b.alarmas.sort((x, y) => GRAVEDAD[y.nivel] - GRAVEDAD[x.nivel])
  return out.sort((a, b) => GRAVEDAD[b.nivel] - GRAVEDAD[a.nivel] || a.clave.localeCompare(b.clave))
}

/** Color de la baliza: crítica = detenido (rojo), advertencia = espera (ámbar), información = tenue. */
export function colorNivel(nivel: NivelAlarma, p: Pick<Paleta3D, 'estado' | 'tenue'>): string {
  return nivel === 'critica' ? p.estado.detenido : nivel === 'advertencia' ? p.estado.espera : p.tenue
}

/** Etiqueta accesible del botón de una baliza (sin repetir el nombre si el mensaje ya lo trae). */
export function etiquetaBaliza(b: Pick<Baliza, 'nivel' | 'nombre' | 'alarmas'>): string {
  const n = b.alarmas.length
  const nivel = NIVEL_ALARMA_ETIQUETA[b.nivel].toLowerCase()
  const mensajes = b.alarmas.map((a) => (a.mensaje.startsWith(b.nombre) ? a.mensaje : `${b.nombre}: ${a.mensaje}`)).join(' ')
  return `Alarma ${nivel}${n > 1 ? ` (${n} alarmas)` : ''}. ${mensajes} Abrir el detalle.`
}
