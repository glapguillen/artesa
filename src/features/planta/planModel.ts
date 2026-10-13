// Modelo del plano: todo lo que depende solo del layout (se memoiza una vez por layout).
// Nada aquí depende del estado en vivo; eso está en planLive.ts.
import type { LayoutIndex } from '../../domain/selectors'
import { centroide, personasEnZona } from '../../domain/selectors'
import type { Acceso, Fase, Flujo, PlantLayout, Punto, Zona } from '../../domain/types'
import { POR_DEFINIR } from '../../ui/tokens'
import { type Caja, type Curva, curvaEntre, puntosSvg, rectInterior, viewBoxDe } from './geometry'
import { anchoTexto } from './textFit'

export type Patron = 'rayado' | 'puntos' | null

export interface InsigniaZona {
  clave: string
  tipo: 'etapa' | 'hipotesis' | 'personas'
  texto: string
  fase: Fase | null
  /** Ancho en píxeles de pantalla. */
  ancho: number
}

export interface GeoZona {
  id: string
  nombre: string
  grupo: string
  color: string
  recintoCerrado: boolean
  patron: Patron
  poligono: Punto[]
  puntos: string
  centro: Punto
  /** Rectángulo interior (metros) donde va la etiqueta. */
  etiqueta: Caja
  insignias: InsigniaZona[]
}

export interface GeoEdificio {
  id: string
  nombre: string
  puntos: string
}

export interface GeoAcceso {
  id: string
  tipo: Acceso['tipo']
  titulo: string
  /** Extremos del vano sobre el muro. */
  a: Punto
  b: Punto
  /** Dirección hacia el interior de la zona (unitaria). */
  adentro: Punto
  largo: number
}

export interface GeoFlujo {
  id: string
  fase: Flujo['fase']
  discontinuo: boolean
  titulo: string
  curva: Curva
}

export interface Plano {
  base: Caja
  zonas: GeoZona[]
  porId: Map<string, GeoZona>
  edificios: GeoEdificio[]
  accesos: GeoAcceso[]
  flujos: GeoFlujo[]
  sinUbicar: Zona[]
}

const GRUPOS_RAYADOS = new Set(['sin_rotulo', 'sin_identificar'])

export function patronDeGrupo(grupo: string): Patron {
  if (GRUPOS_RAYADOS.has(grupo)) return 'rayado'
  return grupo === 'exterior' ? 'puntos' : null
}

const anchoPildora = (t: string) => Math.ceil(anchoTexto(t, 9.5) + 10)

export function insigniasDeZona(z: Zona, idx: LayoutIndex): InsigniaZona[] {
  const fase = (c: string) => idx.etapasPorCodigo.get(c)?.fase ?? null
  const out: InsigniaZona[] = [
    ...z.etapas.map((c) => ({ clave: `e-${c}`, tipo: 'etapa' as const, texto: c, fase: fase(c), ancho: anchoPildora(c) })),
    ...z.etapas_hipotesis.map((c) => ({
      clave: `h-${c}`,
      tipo: 'hipotesis' as const,
      texto: `${c}?`,
      fase: fase(c),
      ancho: anchoPildora(`${c}?`),
    })),
  ]
  const p = personasEnZona(idx, z.id)
  const texto = p.confirmado > 0 ? String(p.confirmado) : p.hipotesis > 0 ? `~${p.hipotesis}` : null
  if (texto) out.push({ clave: 'personas', tipo: 'personas', texto, fase: null, ancho: anchoPildora(texto) + 10 })
  return out
}

const ADENTRO: Record<Acceso['lado'], Punto> = { este: [-1, 0], oeste: [1, 0], norte: [0, 1], sur: [0, -1] }
const TIPO_ACCESO: Record<Acceso['tipo'], string> = {
  puerta: 'Puerta',
  puerta_interna: 'Puerta interna',
  porton: 'Portón',
}

/** Vano de un acceso. El ancho es simbólico si el layout no lo trae (se rotula POR DEFINIR). */
export function geoAcceso(a: Acceso, nombreZona: string): GeoAcceso {
  const largo = a.ancho_m ?? (a.tipo === 'porton' ? 4 : 1.5)
  const adentro = ADENTRO[a.lado]
  const muro: Punto = [Math.abs(adentro[1]), Math.abs(adentro[0])]
  const [x, y] = a.posicion
  const ancho = a.ancho_m === null ? POR_DEFINIR : `${a.ancho_m} m`
  return {
    id: a.id,
    tipo: a.tipo,
    titulo: `${TIPO_ACCESO[a.tipo]} · ${nombreZona} (lado ${a.lado}) · ancho ${ancho}`,
    a: [x - (muro[0] * largo) / 2, y - (muro[1] * largo) / 2],
    b: [x + (muro[0] * largo) / 2, y + (muro[1] * largo) / 2],
    adentro,
    largo,
  }
}

const TIPO_FLUJO: Record<Flujo['tipo'], string> = {
  principal: 'principal',
  hipotesis: 'hipótesis',
  sin_ubicar: 'sin ubicar',
  venta: 'venta',
}

export function construirPlano(l: PlantLayout, idx: LayoutIndex): Plano {
  const zonas: GeoZona[] = []
  for (const z of l.zonas) {
    if (!z.poligono) continue
    zonas.push({
      id: z.id,
      nombre: z.nombre,
      grupo: z.grupo,
      color: z.color,
      recintoCerrado: z.recinto_cerrado,
      patron: patronDeGrupo(z.grupo),
      poligono: z.poligono,
      puntos: puntosSvg(z.poligono),
      centro: centroide(z.poligono),
      etiqueta: rectInterior(z.poligono),
      insignias: insigniasDeZona(z, idx),
    })
  }
  const porId = new Map(zonas.map((g) => [g.id, g]))
  const edificios = l.edificios.flatMap((e) => (e.poligono ? [{ id: e.id, nombre: e.nombre, puntos: puntosSvg(e.poligono) }] : []))
  const flujos: GeoFlujo[] = []
  for (const f of l.flujos) {
    const a = porId.get(f.desde)
    const b = porId.get(f.hasta)
    const curva = a && b ? curvaEntre(a.centro, b.centro) : null
    if (!a || !b || !curva) continue
    flujos.push({
      id: f.id,
      fase: f.fase,
      discontinuo: f.tipo !== 'principal',
      titulo: `${a.nombre} → ${b.nombre} · ${f.material} (${f.etapas}) · flujo ${TIPO_FLUJO[f.tipo]}`,
      curva,
    })
  }
  return {
    base: viewBoxDe([...zonas.map((z) => z.poligono), ...l.edificios.flatMap((e) => (e.poligono ? [e.poligono] : []))]),
    zonas,
    porId,
    edificios,
    accesos: l.accesos.map((a) => geoAcceso(a, idx.zonasPorId.get(a.zona)?.nombre ?? a.zona)),
    flujos,
    sinUbicar: l.zonas.filter((z) => !z.poligono),
  }
}
