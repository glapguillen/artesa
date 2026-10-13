// Etiquetas legibles del panel de detalle (solo presentación). Lo que no está en un mapa
// se muestra "humanizado": guiones bajos → espacios y primera letra en mayúscula.
import type { Equipo, Etapa, Transicion, Zona } from '../../domain/types'
import { POR_DEFINIR } from '../../ui/tokens'

/** "materias_primas" → "Materias primas". */
export function humanizar(s: string): string {
  const t = s.replace(/_/g, ' ').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t
}

const de = (mapa: Readonly<Record<string, string>>, clave: string) => mapa[clave] ?? humanizar(clave)

const GRUPO: Readonly<Record<string, string>> = {
  materias_primas: 'Materias primas',
  preparacion: 'Preparación',
  laboratorio_id: 'Laboratorio / I+D',
  decoracion: 'Decoración',
  formacion: 'Formación',
  almacen: 'Almacén',
  almacen_pt: 'Almacén de producto terminado',
  clasificacion: 'Clasificación',
  administrativo: 'Administrativo',
  sin_rotulo: 'Sin rótulo',
  sin_identificar: 'Sin identificar',
}
export const etiquetaGrupo = (g: string) => de(GRUPO, g)

const TIPO_ZONA: Readonly<Record<string, string>> = {
  almacen: 'Almacén',
  formacion_personal: 'Formación de personal',
  por_definir: POR_DEFINIR,
}
export const etiquetaTipoZona = (t: string) => de(TIPO_ZONA, t)

const TIPO_EQUIPO: Readonly<Record<string, string>> = {
  formacion_colado_vaciado: 'Formación · colado vaciado',
  formacion_colado_presion: 'Formación · colado a presión',
  formacion_torno_alfarero: 'Formación · torno alfarero',
  formacion_torno_roller: 'Formación · torno roller',
  formacion_prensa_ram: 'Formación · prensa RAM',
  formacion_impresora_3d: 'Formación · impresora 3D',
  formacion_modelado: 'Formación · modelado',
  impresora_inkjet_ceramica: 'Impresora inkjet cerámica',
  puesto_decoracion: 'Puesto de decoración',
  rack_secado: 'Estantería de secado',
}
export const etiquetaTipoEquipo = (t: string) => de(TIPO_EQUIPO, t)

export const TIPO_ETAPA: Readonly<Record<Etapa['tipo'], string>> = {
  configuracion: 'Configuración',
  inventario: 'Inventario / piscina',
  proceso: 'Proceso',
  registro: 'Registro',
  control_calidad: 'Control de calidad',
  decision: 'Decisión / clasificación',
  comercial: 'Comercial',
}

export function etiquetaControl(c: Etapa['control_por']): string {
  if (c === 'forma') return 'Por FORMA'
  if (c === 'sku') return 'Por SKU (artículo)'
  return 'No aplica'
}

export const TIPO_TRANSICION: Readonly<Record<Transicion['tipo'], string>> = {
  flujo: 'flujo',
  insumo: 'insumo',
  registro: 'registro',
  configuracion: 'configuración',
  clasificacion: 'clasificación',
}

export const CONFIANZA: Readonly<Record<Zona['confianza'], string>> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

export const PRECISION: Readonly<Record<Zona['precision'], string>> = {
  medido: 'Medida en planta',
  aprox: 'Aproximada (croquis, escala supuesta)',
  estimacion_visual_fotos: 'Estimación visual (fotos)',
  por_definir: POR_DEFINIR,
}

const PRECISION_DIM: Readonly<Record<string, string>> = {
  medido: 'medida en planta',
  aprox: 'aproximada',
  aprox_croquis: 'aproximada (croquis)',
  estimacion_visual_fotos: 'estimación visual (fotos)',
  por_definir: POR_DEFINIR,
}
/** Precisión de unas dimensiones de equipo (texto libre del JSON). */
export const etiquetaPrecisionDim = (p: string) => PRECISION_DIM[p] ?? p.replace(/_/g, ' ')

const RESULTADO:Readonly<Record<string, string>> = {
  buena: 'Buena',
  mala: 'Mala',
  ok_falta_calcomania: 'OK, falta calcomanía',
  tipo_a: 'Tipo A',
  tipo_b: 'Tipo B',
  tipo_c: 'Tipo C',
  desecho: 'Desecho',
  recuperable: 'Recuperable',
}
export const etiquetaResultado = (r: string) => de(RESULTADO, r)

const METRICA: Readonly<Record<string, string>> = {
  temp_c: 'Temperatura (°C)',
  temp_objetivo_c: 'Temperatura objetivo (°C)',
  gas_m3_h: 'Gas (m³/h)',
  carga_pct: 'Carga (%)',
  piezas_h: 'Piezas/h',
  kg_h: 'Material (kg/h)',
}
/** Nombre legible de una métrica de equipo; las desconocidas se muestran tal cual. */
export const nombreMetrica = (k: string) => METRICA[k] ?? k

/** Sección de la nómina (en mayúsculas y sin tildes) → "Clasificación de bizcocho", "Bodega PT". */
export function etiquetaSeccion(s: string): string {
  const t = s
    .toLowerCase()
    .replace(/cion\b/g, 'ción')
    .replace(/\blogistica\b/g, 'logística')
    .replace(/\bpt\b/g, 'PT')
    .trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : POR_DEFINIR
}

/** "croquis+foto-4" → "Croquis + foto-4". */
export function etiquetaFuente(f: Equipo['fuente']): string {
  const t = f
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' + ')
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : POR_DEFINIR
}
