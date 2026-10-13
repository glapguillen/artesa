// Funciones puras sobre el layout: índices, ubicación de etapas, rutas y estado agregado.
// No calculan KPIs de negocio: solo relacionan ids y eligen qué mostrar.
import type { EstadoOperativo, LiveState } from './live'
import type { Dotacion, Equipo, Etapa, PlantLayout, Punto, Ubicacion, Zona } from './types'

export interface ZonasDeEtapa {
  confirmadas: Zona[]
  hipotesis: Zona[]
}

export interface LayoutIndex {
  zonasPorId: Map<string, Zona>
  etapasPorCodigo: Map<string, Etapa>
  equiposPorId: Map<string, Equipo>
  equiposPorZona: Map<string, Equipo[]>
  equiposPorEtapa: Map<string, Equipo[]>
  zonasPorEtapa: Map<string, ZonasDeEtapa>
  personalPorZona: Map<string, { confirmado: Dotacion[]; hipotesis: Dotacion[] }>
  personalPorEtapa: Map<string, Dotacion[]>
}

function agregar<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const lista = m.get(k)
  if (lista) lista.push(v)
  else m.set(k, [v])
}

export function indexarLayout(l: PlantLayout): LayoutIndex {
  const zonasPorEtapa = new Map<string, ZonasDeEtapa>()
  for (const e of l.proceso.etapas) zonasPorEtapa.set(e.codigo, { confirmadas: [], hipotesis: [] })
  for (const z of l.zonas) {
    for (const c of z.etapas) zonasPorEtapa.get(c)?.confirmadas.push(z)
    for (const c of z.etapas_hipotesis) zonasPorEtapa.get(c)?.hipotesis.push(z)
  }
  const equiposPorZona = new Map<string, Equipo[]>()
  const equiposPorEtapa = new Map<string, Equipo[]>()
  for (const e of l.equipos) {
    agregar(equiposPorZona, e.zona, e)
    agregar(equiposPorEtapa, e.etapa, e)
  }
  const personalPorZona = new Map<string, { confirmado: Dotacion[]; hipotesis: Dotacion[] }>()
  const personalPorEtapa = new Map<string, Dotacion[]>()
  const slot = (id: string) => {
    let s = personalPorZona.get(id)
    if (!s) personalPorZona.set(id, (s = { confirmado: [], hipotesis: [] }))
    return s
  }
  for (const d of l.personal.dotacion) {
    for (const z of d.zonas) slot(z).confirmado.push(d)
    for (const z of d.zonas_hipotesis) slot(z).hipotesis.push(d)
    for (const c of d.etapas) agregar(personalPorEtapa, c, d)
  }
  return {
    zonasPorId: new Map(l.zonas.map((z) => [z.id, z])),
    etapasPorCodigo: new Map(l.proceso.etapas.map((e) => [e.codigo, e])),
    equiposPorId: new Map(l.equipos.map((e) => [e.id, e])),
    equiposPorZona,
    equiposPorEtapa,
    zonasPorEtapa,
    personalPorZona,
    personalPorEtapa,
  }
}

/** Ubicada = al menos una zona confirmada con polígono; hipótesis = solo zonas probables con polígono. */
export function ubicacionEtapa(idx: LayoutIndex, codigo: string): Ubicacion {
  const z = idx.zonasPorEtapa.get(codigo)
  if (!z) return 'sin_ubicar'
  if (z.confirmadas.some((x) => x.poligono)) return 'ubicada'
  if (z.hipotesis.some((x) => x.poligono)) return 'hipotesis'
  return 'sin_ubicar'
}

/** Primera zona con polígono donde ocurre la etapa (confirmada antes que probable). */
export function zonaPrincipalDeEtapa(idx: LayoutIndex, codigo: string): Zona | null {
  const z = idx.zonasPorEtapa.get(codigo)
  if (!z) return null
  return z.confirmadas.find((x) => x.poligono) ?? z.hipotesis.find((x) => x.poligono) ?? null
}

export function bbox(pol: Punto[]): { x1: number; z1: number; x2: number; z2: number } {
  const xs = pol.map((p) => p[0])
  const zs = pol.map((p) => p[1])
  return { x1: Math.min(...xs), z1: Math.min(...zs), x2: Math.max(...xs), z2: Math.max(...zs) }
}

/** Centroide de área del polígono (si el área es ~0, centro del rectángulo envolvente). */
export function centroide(pol: Punto[]): Punto {
  let a = 0
  let cx = 0
  let cz = 0
  for (let i = 0; i < pol.length; i++) {
    const [x0, z0] = pol[i]!
    const [x1, z1] = pol[(i + 1) % pol.length]!
    const f = x0 * z1 - x1 * z0
    a += f
    cx += (x0 + x1) * f
    cz += (z0 + z1) * f
  }
  if (Math.abs(a) < 1e-9) {
    const b = bbox(pol)
    return [(b.x1 + b.x2) / 2, (b.z1 + b.z2) / 2]
  }
  return [cx / (3 * a), cz / (3 * a)]
}

/** Secuencia de etapas de una ruta de decoración: 2.0 → pasos → siguiente (2.6). */
export function etapasDeRuta(l: PlantLayout, rutaId: string): string[] {
  const r = l.proceso.rutas_decoracion.find((x) => x.id === rutaId)
  return r ? ['2.0', ...r.pasos, r.siguiente] : []
}

/** Aristas [desde, hasta] de una ruta, para resaltarlas en el diagrama de proceso. */
export function aristasDeRuta(l: PlantLayout, rutaId: string): Array<[string, string]> {
  const s = etapasDeRuta(l, rutaId)
  const out: Array<[string, string]> = []
  for (let i = 0; i + 1 < s.length; i++) out.push([s[i]!, s[i + 1]!])
  return out
}

/**
 * Recorrido físico de una ruta: zona de cada paso (sin 2.0 ni la piscina) y al final la zona
 * de la quema de esmalte (3.1). Se omiten pasos sin zona y repeticiones consecutivas.
 */
export function zonasDeRuta(l: PlantLayout, idx: LayoutIndex, rutaId: string): Zona[] {
  const r = l.proceso.rutas_decoracion.find((x) => x.id === rutaId)
  if (!r) return []
  const out: Zona[] = []
  for (const c of [...r.pasos, '3.1']) {
    const z = zonaPrincipalDeEtapa(idx, c)
    if (z && out[out.length - 1]?.id !== z.id) out.push(z)
  }
  return out
}

const GRAVEDAD: Record<EstadoOperativo, number> = {
  sin_datos: 0,
  operando: 1,
  espera: 2,
  mantenimiento: 3,
  detenido: 4,
}

/** El estado más grave; "sin_datos" solo si no hay ningún otro. */
export function peorEstado(estados: EstadoOperativo[]): EstadoOperativo {
  return estados.reduce<EstadoOperativo>((peor, e) => (GRAVEDAD[e] > GRAVEDAD[peor] ? e : peor), 'sin_datos')
}

export function estadoDeEtapa(live: LiveState | null, codigo: string): EstadoOperativo {
  return live?.etapas[codigo]?.estado ?? 'sin_datos'
}

/** Estado de una zona: el que envía la fuente o, si falta, el peor de sus etapas y equipos. */
export function estadoDeZona(idx: LayoutIndex, live: LiveState | null, zonaId: string): EstadoOperativo {
  if (!live) return 'sin_datos'
  const directo = live.zonas[zonaId]?.estado
  if (directo) return directo
  const z = idx.zonasPorId.get(zonaId)
  if (!z) return 'sin_datos'
  const estados: EstadoOperativo[] = z.etapas.map((c) => estadoDeEtapa(live, c))
  for (const e of idx.equiposPorZona.get(zonaId) ?? []) estados.push(live.equipos[e.id]?.estado ?? 'sin_datos')
  return peorEstado(estados)
}

/** Personas asignadas (asignación principal) a una zona. */
export function personasEnZona(idx: LayoutIndex, zonaId: string): { confirmado: number; hipotesis: number } {
  const s = idx.personalPorZona.get(zonaId)
  const suma = (ds: Dotacion[]) => ds.reduce((n, d) => n + d.cantidad, 0)
  return { confirmado: suma(s?.confirmado ?? []), hipotesis: suma(s?.hipotesis ?? []) }
}
