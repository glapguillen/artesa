// Esquema zod de public/plant-layout.json (fuente única de verdad del layout y del proceso).
// Cambiar el JSON no requiere tocar código; si falta un campo, la app muestra el error legible.
import { z } from 'zod'

const texto = z.string()
const textoNulo = z.string().nullable()
const numeroNulo = z.number().nullable()

/** [x, z] en metros. X = este (derecha del croquis), Z = sur (abajo del croquis). */
export const PuntoSchema = z.tuple([z.number(), z.number()])
export const PoligonoSchema = z.array(PuntoSchema).min(3)
export const ConfianzaSchema = z.enum(['alta', 'media', 'baja'])
export const PrecisionSchema = z.enum(['medido', 'aprox', 'estimacion_visual_fotos', 'por_definir'])
export const FaseSchema = z.enum(['nivel_0', 'A', 'B', 'F1', 'F2', 'F3', 'venta'])
export const FaseFlujoSchema = z.enum(['A', 'B', 'F1', 'F2', 'F3', 'venta'])

export const PlantaSchema = z.object({
  id: texto,
  nombre: texto,
  unidades: z.literal('metros'),
  origen: z.object({ descripcion: texto, x: z.number(), z: z.number() }),
  dimensiones: z.object({ largo_x: z.number(), ancho_z: z.number(), precision: texto, nota: textoNulo.optional() }),
  norte_grados: numeroNulo,
  plano_referencia: z.object({ archivo: texto, escala_px_por_m: numeroNulo }),
})

export const EdificioSchema = z.object({
  id: texto,
  nombre: texto,
  poligono: PoligonoSchema.nullable(),
  altura_m: numeroNulo,
  precision: texto,
  notas: textoNulo,
})

export const ZonaSchema = z.object({
  id: texto,
  nombre: texto,
  rotulo_croquis: textoNulo,
  tipo: texto,
  grupo: texto,
  /** Etapas del flujograma asignadas con razonable seguridad. */
  etapas: z.array(texto),
  /** Etapas probables, por confirmar. */
  etapas_hipotesis: z.array(texto),
  edificio: textoNulo,
  /** null = la zona existe pero no está ubicada en el croquis. */
  poligono: PoligonoSchema.nullable(),
  recinto_cerrado: z.boolean(),
  precision: PrecisionSchema,
  confianza: ConfianzaSchema,
  fotos: z.array(texto),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  responsable: textoNulo,
  notas: textoNulo,
})

export const AccesoSchema = z.object({
  id: texto,
  tipo: z.enum(['puerta', 'puerta_interna', 'porton']),
  zona: texto,
  lado: z.enum(['norte', 'sur', 'este', 'oeste']),
  posicion: PuntoSchema,
  ancho_m: numeroNulo,
  fuente: texto,
})

export const EquipoSchema = z.object({
  id: texto,
  nombre: texto,
  tipo: texto,
  zona: texto,
  etapa: texto,
  cantidad: numeroNulo,
  confianza: ConfianzaSchema,
  fuente: texto,
  notas: textoNulo,
  instanciado: z.boolean().optional(),
  cantidad_min_observada: z.number().optional(),
  posicion: PuntoSchema.optional(),
  rotacion_grados: z.number().optional(),
  dimensiones: z
    .object({ largo: numeroNulo, ancho: numeroNulo, alto: numeroNulo, precision: texto })
    .optional(),
  layout: z.object({ filas: numeroNulo, columnas: numeroNulo, separacion: numeroNulo }).optional(),
})

export const FlujoSchema = z.object({
  id: texto,
  desde: texto,
  hasta: texto,
  material: texto,
  fase: FaseFlujoSchema,
  etapas: texto,
  rutas: z.array(texto).nullable(),
  tipo: z.enum(['principal', 'hipotesis', 'sin_ubicar', 'venta']),
  confianza: ConfianzaSchema,
  volumen_tag: texto,
})

export const EtapaSchema = z.object({
  codigo: texto,
  nombre: texto,
  nombre_corto: texto,
  fase: FaseSchema,
  tipo: z.enum(['configuracion', 'inventario', 'proceso', 'registro', 'control_calidad', 'decision', 'comercial']),
  control_por: z.enum(['forma', 'sku']).nullable(),
})

export const TransicionSchema = z.object({
  desde: texto,
  hasta: texto,
  tipo: z.enum(['flujo', 'insumo', 'registro', 'configuracion', 'clasificacion']),
  etiqueta: textoNulo,
})

export const ProcesoSchema = z.object({
  fuente: texto,
  unidad_de_control: z.object({ F1: texto, F2: texto, F3: texto, transformacion: texto }),
  etapas: z.array(EtapaSchema).min(1),
  rutas_formacion: z.array(
    z.object({ id: texto, metodo: texto, pasos: z.array(texto), insumo: textoNulo, insumo_confianza: textoNulo }),
  ),
  rutas_decoracion: z.array(
    z.object({ id: texto, codigo: texto, pasos: z.array(texto).min(1), siguiente: texto }),
  ),
  clasificaciones: z.record(
    z.string(),
    z.array(z.object({ resultado: texto, destino: texto, luego: z.array(texto).nullable().optional() })),
  ),
  salidas_no_productivas: z.array(z.object({ en: texto, tipos: z.array(texto), accion: texto })),
  transiciones: z.array(TransicionSchema),
  diagrama: z.object({
    nota: texto.optional(),
    /** Posición [columna, fila] de cada etapa en la vista de proceso. */
    celdas: z.record(z.string(), PuntoSchema),
    bandas: z.array(
      z.object({ id: texto, titulo: texto, fases: z.array(FaseSchema), filas: z.tuple([z.number(), z.number()]) }),
    ),
  }),
})

export const KpiSchema = z.object({
  id: texto,
  nombre: texto,
  ambito: texto,
  unidad: textoNulo,
  meta: numeroNulo,
  formula: texto.optional(),
  fuente: texto.optional(),
})

export const FuenteDatosSchema = z.object({
  id: texto,
  tipo: z.enum(['mock', 'rest', 'sse', 'mqtt-ws']),
  activo: z.boolean(),
  url: textoNulo.optional(),
  intervalo_s: z.number().optional(),
  topic_base: texto.optional(),
})

export const DotacionSchema = z.object({
  id: texto,
  departamento: texto,
  seccion: texto,
  cargo: texto,
  cantidad: z.number().int().nonnegative(),
  etapas: z.array(texto),
  zonas: z.array(texto),
  zonas_hipotesis: z.array(texto),
  notas: textoNulo,
})

export const PersonalSchema = z.object({
  fuente: texto,
  nota: texto,
  total: z.number().int().nonnegative(),
  dotacion: z.array(DotacionSchema),
})

export const FotoSchema = z.object({
  id: texto,
  zona_probable: texto,
  etapas_probables: z.array(texto),
  confianza: ConfianzaSchema,
  resumen: texto,
})

export const PlantLayoutSchema = z.object({
  version: texto,
  fuentes: z.array(texto),
  convenciones: z.record(z.string(), z.unknown()),
  planta: PlantaSchema,
  proceso: ProcesoSchema,
  edificios: z.array(EdificioSchema),
  zonas: z.array(ZonaSchema).min(1),
  accesos: z.array(AccesoSchema),
  equipos: z.array(EquipoSchema),
  flujos: z.array(FlujoSchema),
  kpis: z.array(KpiSchema),
  fuentes_de_datos: z.array(FuenteDatosSchema),
  personal: PersonalSchema,
  fotos: z.array(FotoSchema),
})
