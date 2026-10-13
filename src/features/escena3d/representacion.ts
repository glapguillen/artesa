// Textos de la sección "Representación 3D" del panel de un equipo (puro). Declaran qué se dibuja
// en la escena y de dónde sale: cantidad de instancias, medidas típicas y recortes.
import type { Equipo } from '../../domain/types'
import { fmtNum, POR_DEFINIR } from '../../ui/tokens'
import type { Equipo3D, ModeloEscena, OrigenCantidad } from './modelo/tipos'

export const TEXTO_ORIGEN: Record<OrigenCantidad, string> = {
  json: 'cantidad del JSON',
  minimo_observado: 'mínimo observado en fotos',
  uno: `una instancia representativa: cantidad ${POR_DEFINIR}`,
}

const m1 = (v: number) => `${fmtNum(v, 1)} m`

export interface FilaRepresentacion {
  etiqueta: string
  texto: string
  /** Aclaración en tono tenue (p. ej. "tamaño típico, no medido"). */
  nota?: string
}

export interface Representacion3D {
  /** false si el equipo no se dibuja porque su zona no tiene polígono. */
  dibujado: boolean
  filas: FilaRepresentacion[]
}

/** "5 · mínimo observado en fotos (Foto-2)". */
export function textoInstancias(e3: Pick<Equipo3D, 'instancias' | 'cantidadOrigen'>, fuente?: string): string {
  const origen = TEXTO_ORIGEN[e3.cantidadOrigen]
  const extra = e3.cantidadOrigen === 'minimo_observado' && fuente ? ` (${fuente})` : ''
  return `${fmtNum(e3.instancias.length)} · ${origen}${extra}`
}

type DimsJson = Equipo['dimensiones']

/** Medidas dibujadas; marca "(típico)" cada medida que no viene del JSON. */
export function textoDimensiones(e3: Pick<Equipo3D, 'dims'>, d: DimsJson): string {
  const tip = (v: number | null | undefined) => (v === null || v === undefined ? ' (típico)' : '')
  return (
    `Largo ${m1(e3.dims.largo)}${tip(d?.largo)} · ancho ${m1(e3.dims.ancho)}${tip(d?.ancho)} · ` +
    `alto ${m1(e3.dims.alto)}${tip(d?.alto)}`
  )
}

/** Si se recortó el largo: "Largo según el layout 20 m (aprox.) · dibujado 18,7 m para caber en la zona". */
export function textoRecorte(e3: Pick<Equipo3D, 'recortado' | 'largoOriginal' | 'dims'>, d: DimsJson): string | null {
  if (!e3.recortado) return null
  const origen =
    d?.largo !== null && d?.largo !== undefined
      ? `Largo según el layout ${m1(e3.largoOriginal)}${d.precision === 'medido' ? '' : ' (aprox.)'}`
      : `Largo típico ${m1(e3.largoOriginal)}`
  return `${origen} · dibujado ${m1(e3.dims.largo)} para caber en la zona`
}

/** Todo lo que la sección muestra para un equipo del layout. */
export function representacion3D(equipo: Equipo, m: ModeloEscena | null, fuente?: string): Representacion3D {
  const e3 = m?.equipos.find((x) => x.id === equipo.id)
  if (!e3) {
    return {
      dibujado: false,
      filas: [
        {
          etiqueta: 'En la escena',
          texto: 'No se dibuja dentro de la planta',
          nota: 'Su zona no está ubicada en el croquis; aparece en la lista "Sin ubicar".',
        },
      ],
    }
  }
  const d = equipo.dimensiones
  const tipico = !(d && d.largo !== null && d.ancho !== null && d.alto !== null)
  const filas: FilaRepresentacion[] = [
    { etiqueta: 'Instancias', texto: textoInstancias(e3, fuente) },
    {
      etiqueta: 'Dibujado',
      texto: textoDimensiones(e3, d),
      nota: tipico
        ? 'Forma y tamaño representativos: tamaño típico, no medido'
        : e3.recortado
          ? 'Medidas del JSON con el largo ajustado; forma esquemática'
          : 'Medidas del JSON; forma esquemática',
    },
  ]
  const recorte = textoRecorte(e3, d)
  if (recorte) filas.push({ etiqueta: 'Ajuste', texto: recorte })
  return { dibujado: true, filas }
}
