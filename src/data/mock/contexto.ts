// Contexto del simulador: lo que se deriva una sola vez del layout (rutas, pesos, capacidades).
// Todo sale de plant-layout.json; los ids que no tengan parámetro propio reciben un valor por defecto.
import type { PlantLayout } from '../../domain/types'
import { enIntervalo, HISTORIA, noNeg } from './curvas'
import { PARAM, type ParamHorno } from './parametros'
import { ruidoSuave } from './rng'

export interface RutaFormacionSim {
  id: string
  /** Método normalizado ('colado_vaciado'); el equipo 'formacion_<clave>' le pertenece. */
  clave: string
  peso: number
  insumo: string | null
  rechazoBasePct: number
}

export interface RutaDecoracionSim {
  id: string
  peso: number
  pasos: string[]
  siguiente: string
}

export interface HornoSim extends ParamHorno {
  /** Código de la etapa de quema (1.5, 3.1). */
  etapa: string
}

export interface Resultado {
  resultado: string
  destino: string
  peso: number
}

export interface Ctx {
  /** Semilla del turno (semilla de la configuración mezclada con el ciclo). */
  semilla: number
  rf: RutaFormacionSim[]
  rutas: RutaDecoracionSim[]
  /** Etapas que aparecen en las rutas de decoración, en el orden en que se procesan. */
  etapasDecoracion: string[]
  hornos: HornoSim[]
  /** Etapa del horno con alarma y etapa en mantenimiento (se leen de los equipos del guion). */
  etapaAlarmaHorno: string
  etapaMantenimiento: string
  /** Personas por código de etapa, según personal.dotacion. */
  personas: Record<string, number>
  resultadosBizcocho: Resultado[]
  resultadosFinal: Resultado[]
}

/** 'Colado presión' → 'colado_presion'. */
export const normalizarClave = (t: string): string =>
  t
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

/** Normaliza pesos para que sumen 1 (si todos son 0, reparte en partes iguales). */
function normalizar<T extends { peso: number }>(items: T[]): T[] {
  const total = items.reduce((s, i) => s + i.peso, 0)
  return items.map((i) => ({ ...i, peso: total > 0 ? i.peso / total : 1 / Math.max(1, items.length) }))
}

function resultados(
  l: PlantLayout,
  codigo: string,
  mix: Readonly<Record<string, number>>,
  porDefecto: string[],
): Resultado[] {
  const lista = l.proceso.clasificaciones[codigo]
  const base = lista?.length
    ? lista.map((r) => ({ resultado: r.resultado, destino: r.destino }))
    : porDefecto.map((r) => ({ resultado: r, destino: '' }))
  return normalizar(base.map((r) => ({ ...r, peso: mix[r.resultado] ?? 0.01 })))
}

export function construirContexto(l: PlantLayout, semilla: number): Ctx {
  const personas: Record<string, number> = {}
  for (const d of l.personal.dotacion) for (const c of d.etapas) personas[c] = (personas[c] ?? 0) + d.cantidad

  const rf = normalizar(
    l.proceso.rutas_formacion.map((r) => ({
      id: r.id,
      clave: normalizarClave(r.metodo),
      peso: PARAM.pesoRutaFormacion[r.id] ?? 0.1,
      insumo: r.insumo,
      rechazoBasePct: PARAM.rechazoCcPct[r.id] ?? 5,
    })),
  )
  const rutas = normalizar(
    l.proceso.rutas_decoracion.map((r) => ({
      id: r.id,
      peso: PARAM.pesoRutaDecoracion[r.id] ?? 0.05,
      pasos: [...r.pasos],
      siguiente: r.siguiente,
    })),
  )
  const etapasDecoracion = [...new Set(rutas.flatMap((r) => r.pasos))].sort((a, b) =>
    a.localeCompare(b, 'es', { numeric: true }),
  )
  const etapaDeEquipo = (id: string, def: string) => l.equipos.find((e) => e.id === id)?.etapa ?? def

  return {
    semilla,
    rf,
    rutas,
    etapasDecoracion,
    hornos: Object.entries(PARAM.hornos).map(([etapa, p]) => ({ ...p, etapa })),
    etapaAlarmaHorno: etapaDeEquipo(HISTORIA.alarmaHorno.equipo, HISTORIA.alarmaHorno.etapa),
    etapaMantenimiento: etapaDeEquipo(HISTORIA.cambioEsmalte.equipo, HISTORIA.cambioEsmalte.etapa),
    personas,
    resultadosBizcocho: resultados(l, '1.7', PARAM.mixBizcocho, ['buena', 'mala']),
    resultadosFinal: resultados(l, '3.3', PARAM.mixFinal, Object.keys(PARAM.mixFinal)),
  }
}

/**
 * Capacidad (pzs/min) de una etapa sin contar pausas: manual = dotación × productividad;
 * de máquina = PARAM.capacidad; si no hay parámetro, 1 pza/min.
 */
export function capacidadBase(ctx: Ctx, codigo: string): number {
  const prod = PARAM.productividad[codigo]
  if (prod !== undefined) {
    const gente = ctx.personas[codigo] ?? 0
    return (Math.max(gente, PARAM.personasMin[codigo] ?? 1) * prod) / 60
  }
  return PARAM.capacidad[codigo] ?? 1
}

export const enAlmuerzo = (codigo: string, m: number): boolean =>
  HISTORIA.almuerzo.etapas.includes(codigo) && enIntervalo(m, HISTORIA.almuerzo)

export const enMantenimiento = (ctx: Ctx, codigo: string, m: number): boolean =>
  codigo === ctx.etapaMantenimiento && enIntervalo(m, HISTORIA.cambioEsmalte)

/** Capacidad (pzs/min) en el minuto m: 0 en almuerzo o mantenimiento; si no, la base con ruido suave. */
export function capacidad(ctx: Ctx, codigo: string, m: number): number {
  if (enAlmuerzo(codigo, m) || enMantenimiento(ctx, codigo, m)) return 0
  return noNeg(capacidadBase(ctx, codigo) * (1 + 0.08 * ruidoSuave(ctx.semilla, `cap:${codigo}`, m, 40)))
}

/**
 * Reparte `cant` piezas clasificadas entre los resultados según la mezcla nominal con ruido suave.
 * Los resultados dominantes varían menos (amplitud proporcional a 1 - peso).
 */
export function repartirMix(ctx: Ctx, codigo: string, res: Resultado[], m: number, cant: number): number[] {
  const w = res.map((r) => {
    const r1 = ruidoSuave(ctx.semilla, `mix:${codigo}:${r.resultado}`, m, 45)
    return noNeg(r.peso * (1 + 0.35 * (1 - r.peso) * r1))
  })
  const total = w.reduce((a, b) => a + b, 0)
  return w.map((x) => (total > 0 ? (cant * x) / total : cant / Math.max(1, res.length)))
}
