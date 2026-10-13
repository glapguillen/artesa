// Ruteo de las aristas: elige el lado de salida y de llegada de cada una para que el trazo
// "smoothstep" no pase por detrás de otros nodos ni se encime con otras aristas. Función pura.
import {
  cajaNodo,
  cruzaCaja,
  idManija,
  LADOS,
  longitud,
  polilinea,
  superposicion,
  type Caja,
  type Lado,
  type Punto2,
} from './geometria'

const COSTO_CHOQUE = 2000
const COSTO_CURVA = 40
const COSTO_SUPERPOSICION = 2
/** Compartir la manija de salida (bifurcación) o de llegada (confluencia) se penaliza menos. */
const FACTOR_MISMA_MANIJA = 0.15
const COSTO_LADO_MIXTO = 150
const RONDAS = 4

export interface Ruteo {
  sourceHandle: string
  targetHandle: string
  desde: string
  hasta: string
  ls: Lado
  lt: Lado
  /** Polilínea aproximada del trazo (para ubicar etiquetas y evitar superposiciones). */
  pts: Punto2[]
}

interface Candidato {
  ls: Lado
  lt: Lado
  pts: Punto2[]
  /** Choques con nodos + largo + curvas (no cambia entre rondas). */
  base: number
}

function candidatos(centros: ReadonlyMap<string, Punto2>, desde: string, hasta: string): Candidato[] {
  const s = centros.get(desde)!
  const t = centros.get(hasta)!
  const obstaculos: Caja[] = []
  for (const [id, c] of centros) obstaculos.push(id === desde || id === hasta ? cajaNodo(c, -3) : cajaNodo(c, 4))
  const out: Candidato[] = []
  for (const ls of LADOS) {
    for (const lt of LADOS) {
      const pts = polilinea(s, ls, t, lt)
      let choques = 0
      for (const caja of obstaculos) {
        for (let i = 0; i + 1 < pts.length; i++) {
          if (cruzaCaja(pts[i]!, pts[i + 1]!, caja)) {
            choques++
            break
          }
        }
      }
      const curvas = Math.max(0, pts.length - 2) / 3
      out.push({ ls, lt, pts, base: choques * COSTO_CHOQUE + longitud(pts) + curvas * COSTO_CURVA })
    }
  }
  return out
}

type Trazo = Pick<Ruteo, 'desde' | 'hasta' | 'ls' | 'lt' | 'pts'>

function costoSuperposicion(c: Trazo, otros: Trazo[]): number {
  let costo = 0
  for (const o of otros) {
    let sup = 0
    for (let i = 0; i + 1 < c.pts.length; i++) {
      for (let j = 0; j + 1 < o.pts.length; j++) sup += superposicion(c.pts[i]!, c.pts[i + 1]!, o.pts[j]!, o.pts[j + 1]!)
    }
    const mismaManija = (o.desde === c.desde && o.ls === c.ls) || (o.hasta === c.hasta && o.lt === c.lt)
    costo += sup * COSTO_SUPERPOSICION * (mismaManija ? FACTOR_MISMA_MANIJA : 1)
    // Entrar por el mismo lado por donde sale otra arista (o al revés) confunde el sentido del flujo.
    if ((o.desde === c.hasta && o.ls === c.lt) || (o.hasta === c.desde && o.lt === c.ls)) costo += COSTO_LADO_MIXTO
  }
  return costo
}

/**
 * Elige, para cada arista, el par de lados que minimiza: nodos atravesados, largo, curvas y tramos
 * superpuestos con las demás aristas. Se negocia en varias rondas (cada arista se reubica viendo
 * el trazado actual de todas las otras) hasta que nada cambia. `fijos`: trazos ya decididos que
 * también se evitan (p. ej. las aristas principales al rutear las secundarias). Determinista.
 */
export function rutear(
  centros: ReadonlyMap<string, Punto2>,
  aristas: ReadonlyArray<{ id: string; desde: string; hasta: string }>,
  fijos: ReadonlyArray<Trazo> = [],
): Map<string, Ruteo> {
  const validas = aristas.filter((a) => centros.has(a.desde) && centros.has(a.hasta))
  const cands = validas.map((a) => candidatos(centros, a.desde, a.hasta))
  const elegido = cands.map((cs) => cs.reduce((m, c, i) => (c.base < cs[m]!.base - 1e-6 ? i : m), 0))
  const trazo = (k: number, c: Candidato): Trazo => ({ desde: validas[k]!.desde, hasta: validas[k]!.hasta, ...c })
  for (let ronda = 0; ronda < RONDAS; ronda++) {
    let cambios = 0
    for (let k = 0; k < cands.length; k++) {
      const otros = [...fijos, ...elegido.flatMap((e, j) => (j === k ? [] : [trazo(j, cands[j]![e]!)]))]
      let mejor = elegido[k]!
      let costoMejor = Infinity
      cands[k]!.forEach((c, i) => {
        const costo = c.base + costoSuperposicion(trazo(k, c), otros)
        if (costo < costoMejor - 1e-6) {
          costoMejor = costo
          mejor = i
        }
      })
      if (mejor !== elegido[k]) cambios++
      elegido[k] = mejor
    }
    if (!cambios) break
  }
  const out = new Map<string, Ruteo>()
  validas.forEach((a, k) => {
    const c = cands[k]![elegido[k]!]!
    out.set(a.id, {
      sourceHandle: idManija('source', c.ls),
      targetHandle: idManija('target', c.lt),
      desde: a.desde,
      hasta: a.hasta,
      ls: c.ls,
      lt: c.lt,
      pts: c.pts,
    })
  })
  return out
}
