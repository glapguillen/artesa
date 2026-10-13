// Lógica pura de las capas 3D (equipos, flujos, ruta y alarmas) sobre el modelo de escena y el
// estado en vivo. Solo agregación de presentación: elegir colores, grosores y posiciones.
// Reutiliza las funciones del plano 2D (planta/planLive) para que ambas vistas digan lo mismo.
import type { Alarma, EstadoOperativo, LiveState, NivelAlarma } from '../../domain/live'
import { type LayoutIndex, zonaPrincipalDeEtapa, zonasDeRuta } from '../../domain/selectors'
import type { PlantLayout } from '../../domain/types'
import type { Seleccion } from '../../store/usePlantStore'
import { fmtNum } from '../../ui/tokens'
import { pasosPorZona, resaltadoDeSeleccion } from '../planta/planLive'
import { cimaDeEquipo } from './formas/piezas'
import { caminoPorZonas } from './modelo/camara'
import type { Equipo3D, Flujo3D, ModeloEscena, V3 } from './modelo/tipos'

// ---------- Equipos ----------

/** Temperatura ambiente de referencia para el brillo de los hornos (°C, solo presentación). */
export const TEMP_AMBIENTE_C = 20

/**
 * Brillo de la franja de calor de un horno (0 = frío, 1 = en temperatura objetivo), a partir de
 * las métricas en vivo temp_c y temp_objetivo_c. null si la fuente no las envía.
 */
export function calorRelativo(metricas: Record<string, number> | undefined): number | null {
  const t = metricas?.temp_c
  const o = metricas?.temp_objetivo_c
  if (typeof t !== 'number' || typeof o !== 'number' || !Number.isFinite(t) || !Number.isFinite(o)) return null
  if (o <= TEMP_AMBIENTE_C) return null
  return Math.min(1, Math.max(0, (t - TEMP_AMBIENTE_C) / (o - TEMP_AMBIENTE_C)))
}

export type ResalteEquipo = 'fuerte' | 'suave'

/** Equipos a resaltar: el equipo elegido (fuerte) o los equipos de la etapa elegida (suave). */
export function equiposResaltados(equipos: readonly Equipo3D[], sel: Seleccion | null): Map<string, ResalteEquipo> {
  const out = new Map<string, ResalteEquipo>()
  if (!sel) return out
  for (const e of equipos) {
    if (sel.tipo === 'equipo' && e.id === sel.id) out.set(e.id, 'fuerte')
    else if (sel.tipo === 'etapa' && e.etapa === sel.id) out.set(e.id, 'suave')
  }
  return out
}

export interface VistaEquipo {
  estado: EstadoOperativo
  calor: number | null
  resalte: ResalteEquipo | null
}

/** Estado visual de cada equipo dibujado (ids sin datos → 'sin_datos'). */
export function vistaEquipos(equipos: readonly Equipo3D[], live: LiveState | null, sel: Seleccion | null): Map<string, VistaEquipo> {
  const resalte = equiposResaltados(equipos, sel)
  const out = new Map<string, VistaEquipo>()
  for (const e of equipos) {
    const vivo = live?.equipos?.[e.id]
    out.set(e.id, { estado: vivo?.estado ?? 'sin_datos', calor: calorRelativo(vivo?.metricas), resalte: resalte.get(e.id) ?? null })
  }
  return out
}

// ---------- Flujos ----------

/** Radio del tubo (m) según el caudal relativo 0–1 (de caudalRelativo, como en 2D); fino sin dato. */
export function radioFlujo(rel: number | null): number {
  if (rel === null || !Number.isFinite(rel)) return 0.1
  // Se cuantiza en décimos para no reconstruir la geometría con cada lectura.
  const q = Math.round(Math.min(1, Math.max(0, rel)) * 10) / 10
  return 0.14 + 0.3 * q
}

/** Principal: sólido; hipótesis, sin ubicar y venta: discontinuo y más tenue (como en 2D). */
export function estiloFlujo(tipo: Flujo3D['tipo']): { alfa: number; discontinuo: boolean } {
  if (tipo === 'principal') return { alfa: 0.92, discontinuo: false }
  if (tipo === 'venta') return { alfa: 0.6, discontinuo: true }
  return { alfa: 0.5, discontinuo: true }
}

/**
 * Factor de realce por flujo según la selección: con una zona, etapa o equipo elegido, los flujos
 * que entran o salen de sus zonas quedan en 1 y el resto baja a `tenue`. Sin selección, todos en 1.
 */
export function realceFlujos(
  flujos: readonly Flujo3D[],
  idx: LayoutIndex | null,
  sel: Seleccion | null,
  tenue = 0.25,
): Record<string, number> {
  const zonas = resaltadoDeSeleccion(idx, sel)
  const out: Record<string, number> = {}
  for (const f of flujos) out[f.id] = zonas.size === 0 || zonas.has(f.desde) || zonas.has(f.hasta) ? 1 : tenue
  return out
}

/** Partículas que recorren un flujo: 1 sin dato, hasta 3 con el mayor caudal. */
export function particulasDeFlujo(rel: number | null): number {
  return rel === null || !Number.isFinite(rel) ? 1 : 1 + Math.round(Math.min(1, Math.max(0, rel)) * 2)
}

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

/** Marca de "forma y tamaño representativos" sobre cada equipo que no está medido. */
export function marcasRepresentativas(equipos: readonly Equipo3D[]): Array<{ equipoId: string; pos: V3 }> {
  return equipos.flatMap((e) => {
    const p = e.representativo ? cimaDeEquipo(e) : null
    return p ? [{ equipoId: e.id, pos: p }] : []
  })
}
