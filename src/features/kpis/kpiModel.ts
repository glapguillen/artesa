// Ayudas de presentación de la barra de KPIs: orden, formato, series y desgloses.
// No calculan KPIs de negocio (llegan calculados en live.kpis); solo eligen qué mostrar y cómo.
import type { Kpi, PlantLayout } from '../../domain/types'
import type { PuntoHistorial } from '../../store/usePlantStore'
import { fmtNum, fmtPct, POR_DEFINIR } from '../../ui/tokens'

/** Orden de prioridad de las tarjetas. Un KPI nuevo del layout que no esté aquí va al final. */
export const ORDEN_KPIS: readonly string[] = [
  'prod_turno',
  'rend_bizcocho',
  'clasif_final',
  'wip_piscinas',
  'oee_horno',
  'inv_pt',
  'cc_formacion',
  'baja_pasta',
  'consumo_esmaltes',
]

/** Tarjetas que ocupan las dos filas de la barra (llevan detalle o son el KPI principal). */
export const KPIS_GRANDES: ReadonlySet<string> = new Set(['prod_turno', 'clasif_final', 'wip_piscinas'])

/** KPIs del layout en el orden de prioridad (orden estable para los que no están en la lista). */
export function kpisOrdenados(kpis: readonly Kpi[]): Kpi[] {
  const pos = (id: string) => {
    const i = ORDEN_KPIS.indexOf(id)
    return i < 0 ? ORDEN_KPIS.length : i
  }
  return [...kpis].sort((a, b) => pos(a.id) - pos(b.id))
}

/** Valor con su unidad ("62,5 %", "1.240 pzs", "38,2 kg"); null si no hay dato. */
export function fmtValorKpi(valor: number | null | undefined, unidad: string | null | undefined): string | null {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return null
  if (unidad === '%') return fmtPct(valor)
  const n = fmtNum(valor, Number.isInteger(valor) ? 0 : 1)
  return unidad ? `${n} ${unidad}` : n
}

/** Línea de meta de la tarjeta; sin meta en el layout → "Meta [POR DEFINIR]". */
export function fmtMeta(meta: number | null | undefined, unidad: string | null | undefined): string {
  return `Meta ${fmtValorKpi(meta, unidad) ?? POR_DEFINIR}`
}

export interface PuntoSerie {
  i: number
  v: number | null
}

/** Serie del mini gráfico a partir del historial del store. */
export function serieKpi(historial: readonly PuntoHistorial[], id: string): PuntoSerie[] {
  return historial.map((p, i) => ({ i, v: p.kpis[id] ?? null }))
}

/** Hacen falta al menos dos lecturas para dibujar una tendencia. */
export function serieDibujable(serie: readonly PuntoSerie[]): boolean {
  let n = 0
  for (const p of serie) if (p.v !== null && Number.isFinite(p.v) && ++n >= 2) return true
  return false
}

const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toUpperCase()

/** Conteo estático de la dotación (no es un KPI): total y personas del departamento de Producción. */
export function conteoPersonal(p: PlantLayout['personal']): { total: number; produccion: number } {
  const produccion = p.dotacion
    .filter((d) => normalizar(d.departamento) === 'PRODUCCION')
    .reduce((n, d) => n + d.cantidad, 0)
  return { total: p.total, produccion }
}

export interface SegmentoClasif {
  clave: string
  etiqueta: string
  corta: string
  color: string
  valor: number
}

const verde = (pct: number) => `color-mix(in srgb, var(--c-estado-operando) ${pct}%, var(--c-surface))`

/** Resultados de la clasificación final (3.3), en el orden de la barra. */
const CLASIF: ReadonlyArray<Omit<SegmentoClasif, 'valor'>> = [
  { clave: 'tipo_a', etiqueta: 'Tipo A', corta: 'A', color: 'var(--c-estado-operando)' },
  { clave: 'tipo_b', etiqueta: 'Tipo B', corta: 'B', color: verde(68) },
  { clave: 'tipo_c', etiqueta: 'Tipo C', corta: 'C', color: verde(42) },
  { clave: 'ok_falta_calcomania', etiqueta: 'OK, falta calcomanía', corta: 'Calc.', color: 'var(--c-seleccion)' },
  { clave: 'recuperable', etiqueta: 'Recuperable', corta: 'Recup.', color: 'var(--c-estado-espera)' },
  { clave: 'desecho', etiqueta: 'Desecho', corta: 'Des.', color: 'var(--c-estado-detenido)' },
]

/** Segmentos de la barra apilada; un resultado nuevo en el detalle se agrega al final en gris. */
export function segmentosClasif(detalle: Record<string, number> | undefined): SegmentoClasif[] | null {
  if (!detalle) return null
  const conocidos = new Set(CLASIF.map((s) => s.clave))
  const extra = Object.keys(detalle)
    .filter((k) => !conocidos.has(k))
    .map((k) => {
      const etiqueta = k.replaceAll('_', ' ')
      return { clave: k, etiqueta, corta: etiqueta, color: 'var(--c-muted)' }
    })
  return [...CLASIF, ...extra].map((s) => ({ ...s, valor: detalle[s.clave] ?? 0 }))
}

/** Piscinas de WIP que se listan bajo el KPI wip_piscinas (más las que traiga el detalle). */
export const PISCINAS: readonly string[] = ['1.4', '1.6', '2.6', '3.2']

export function codigosPiscinas(detalle: Record<string, number> | undefined): string[] {
  const extra = detalle ? Object.keys(detalle).filter((c) => !PISCINAS.includes(c)) : []
  return [...PISCINAS, ...extra]
}
