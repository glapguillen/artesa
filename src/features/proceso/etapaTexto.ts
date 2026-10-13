// Textos de presentación de un nodo de etapa: métrica principal según el tipo y etiqueta accesible.
import { ESTADO_ETIQUETA, fmtNum, NIVEL_ALARMA_ETIQUETA, UBICACION_ETIQUETA } from '../../ui/tokens'
import type { EtapaNodeData } from './buildGraph'

export interface MetricaEtapa {
  /** Nombre para lectores de pantalla. */
  nombre: string
  valor: number | null
  texto: string
  unidad: string
  grande: boolean
}

/** Inventarios (piscinas, bodegas, stocks): WIP grande; procesos y decisiones: piezas/h; configuración: nada. */
export function metricaEtapa(d: EtapaNodeData): MetricaEtapa | null {
  if (d.tipo === 'configuracion') return null
  if (d.tipo === 'inventario' || d.tipo === 'registro') {
    return { nombre: 'WIP', valor: d.wip, texto: fmtNum(d.wip, 0, 'Sin datos'), unidad: 'pzs', grande: d.tipo === 'inventario' }
  }
  return { nombre: 'Ritmo', valor: d.piezasH, texto: fmtNum(d.piezasH, 0, 'Sin datos'), unidad: 'pzs/h', grande: false }
}

export function describirEtapa(d: EtapaNodeData, m: MetricaEtapa | null): string {
  const partes = [`Etapa ${d.codigo}: ${d.nombre}`, `Estado: ${ESTADO_ETIQUETA[d.estado]}`]
  if (m) partes.push(m.valor === null ? `${m.nombre}: sin datos` : `${m.nombre}: ${m.texto} ${m.unidad}`)
  partes.push(UBICACION_ETIQUETA[d.ubicacion])
  if (d.controlPor) partes.push(`Control por ${d.controlPor === 'forma' ? 'FORMA' : 'SKU'}`)
  if (d.alarma) partes.push(`Alarma ${NIVEL_ALARMA_ETIQUETA[d.alarma].toLowerCase()}`)
  if (d.enRuta) partes.push('En la ruta activa')
  return `${partes.join('. ')}.`
}
