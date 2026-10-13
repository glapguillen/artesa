// Formas y tamaños típicos de los equipos. Se usan SOLO cuando el JSON no trae la medida,
// y el modelo marca el equipo como "representativo" para que la UI lo declare.
import type { FormaEquipo } from './tipos'

export const FORMA_POR_TIPO: Record<string, FormaEquipo> = {
  horno_continuo: 'horno',
  molino: 'molino',
  filtro_prensa: 'filtro_prensa',
  extrusora: 'extrusora',
  impresora_inkjet_ceramica: 'kerajet',
  formacion_impresora_3d: 'impresora_3d',
  esmaltadora: 'esmaltadora',
  puesto_decoracion: 'mesa',
  rack_secado: 'rack',
  formacion_colado_vaciado: 'puesto_formacion',
  formacion_colado_presion: 'puesto_formacion',
  formacion_torno_alfarero: 'puesto_formacion',
  formacion_torno_roller: 'puesto_formacion',
  formacion_prensa_ram: 'puesto_formacion',
  formacion_modelado: 'puesto_formacion',
}

/** Tamaño típico [largo, ancho, alto] en metros (no son medidas de ARTESA). */
export const DIMS_TIPICAS: Record<FormaEquipo, [number, number, number]> = {
  horno: [20, 2, 1.9],
  molino: [2.4, 1.6, 1.8],
  filtro_prensa: [4.5, 1.4, 1.6],
  extrusora: [3.2, 1, 1.3],
  kerajet: [5, 2, 1.9],
  impresora_3d: [1, 1, 1.7],
  esmaltadora: [2.6, 2.2, 2.4],
  mesa: [1.6, 0.8, 0.75],
  rack: [2, 0.6, 2],
  puesto_formacion: [1.4, 1, 1],
  generico: [1.5, 1.5, 1.5],
}

/** Pasillo libre entre instancias (m). Las mesas dejan espacio para la silla. */
export const PASILLO: Record<FormaEquipo, number> = {
  horno: 0.5,
  molino: 1.2,
  filtro_prensa: 1.2,
  extrusora: 1.2,
  kerajet: 1.5,
  impresora_3d: 0.8,
  esmaltadora: 1.2,
  mesa: 1.4,
  rack: 1.2,
  puesto_formacion: 1,
  generico: 1,
}

/** Alturas de muro en "corte" para ver el interior (la altura real de las naves está por definir). */
export const ALTO_MURO_EDIFICIO = 2.4
export const ALTO_TABIQUE = 1.2
export const GROSOR_MURO_EDIFICIO = 0.3
export const GROSOR_TABIQUE = 0.12
/** Margen libre entre equipos y el borde de la zona (m). */
export const MARGEN_ZONA = 1
