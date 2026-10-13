// Recorrido de presentación (puro): pasos generados desde layout.proceso.etapas, en el orden del
// flujograma, por las fases del producto. Cada paso es una zona del croquis; las etapas
// consecutivas en la misma zona se agrupan y las que no están ubicadas se declaran, no se saltan
// en silencio.
import type { LiveState } from '../../../domain/live'
import { estadoDeEtapa, type LayoutIndex, zonaPrincipalDeEtapa } from '../../../domain/selectors'
import type { Fase, PlantLayout } from '../../../domain/types'
import { ESTADO_ETIQUETA, fmtNum } from '../../../ui/tokens'

/** Fases que recorre el producto: pasta → formación y bizcocho → decoración → esmalte → venta. */
export const FASES_RECORRIDO: readonly Fase[] = ['B', 'F1', 'F2', 'F3', 'venta']

/** Segundos que dura cada paso en reproducción automática. */
export const SEGUNDOS_POR_PASO = 6

export interface EtapaPaso {
  codigo: string
  nombre: string
  /** La zona del paso es solo probable para esta etapa (etapas_hipotesis). */
  probable: boolean
}

export interface PasoRecorrido {
  zonaId: string
  zonaNombre: string
  etapas: EtapaPaso[]
  /** Etapas sin ubicar en el croquis que el recorrido omite justo antes de este paso. */
  omitidas: EtapaPaso[]
}

export function pasosRecorrido(l: PlantLayout, idx: LayoutIndex, fases: readonly Fase[] = FASES_RECORRIDO): PasoRecorrido[] {
  const pasos: PasoRecorrido[] = []
  let omitidas: EtapaPaso[] = []
  for (const e of l.proceso.etapas) {
    if (!fases.includes(e.fase)) continue
    const z = zonaPrincipalDeEtapa(idx, e.codigo)
    const probable = !(idx.zonasPorEtapa.get(e.codigo)?.confirmadas.some((c) => c.id === z?.id) ?? false)
    const etapa: EtapaPaso = { codigo: e.codigo, nombre: e.nombre_corto, probable }
    if (!z) {
      omitidas.push({ ...etapa, probable: false })
      continue
    }
    const ultimo = pasos[pasos.length - 1]
    if (ultimo && ultimo.zonaId === z.id && omitidas.length === 0) {
      ultimo.etapas.push(etapa)
      continue
    }
    pasos.push({ zonaId: z.id, zonaNombre: z.nombre, etapas: [etapa], omitidas })
    omitidas = []
  }
  // Las omitidas al final se declaran en el último paso.
  const ultimo = pasos[pasos.length - 1]
  if (ultimo && omitidas.length) ultimo.omitidas = [...ultimo.omitidas, ...omitidas]
  return pasos
}

const codigos = (es: EtapaPaso[]) => es.map((e) => (e.probable ? `${e.codigo}?` : e.codigo)).join(', ')

/** Rótulo principal: "Paso n/N · códigos · nombres · zona" (con "?" en las etapas probables). */
export function rotuloPaso(p: PasoRecorrido, i: number, total: number): string {
  return `Paso ${i + 1}/${total} · ${codigos(p.etapas)} · ${p.etapas.map((e) => e.nombre).join('; ')} · ${p.zonaNombre}`
}

/** Datos en vivo de las etapas del paso (estado, WIP, piezas/h), tal como llegan de LiveState. */
export function datosEnVivo(p: PasoRecorrido, live: LiveState | null): string[] {
  return p.etapas.map((e) => {
    const d = live?.etapas[e.codigo]
    const partes = [`${e.codigo}: ${ESTADO_ETIQUETA[estadoDeEtapa(live, e.codigo)]}`]
    if (d?.wip !== null && d?.wip !== undefined) partes.push(`WIP ${fmtNum(d.wip)}`)
    if (d?.piezas_h !== null && d?.piezas_h !== undefined) partes.push(`${fmtNum(d.piezas_h)} piezas/h`)
    return partes.join(' · ')
  })
}

/** Aviso de las etapas omitidas por no estar ubicadas en el croquis. */
export function textoOmitidas(p: PasoRecorrido): string | null {
  if (!p.omitidas.length) return null
  return `Sin ubicar en el croquis (no se visitan): ${p.omitidas.map((e) => `${e.codigo} ${e.nombre}`).join('; ')}.`
}

/** Índice siguiente/anterior acotado a [0, total - 1]. */
export const pasoAcotado = (i: number, total: number) => Math.max(0, Math.min(total - 1, i))
