// Tipos del layout, inferidos del esquema zod (no se duplican a mano).
import type { z } from 'zod'
import type {
  AccesoSchema,
  DotacionSchema,
  EdificioSchema,
  EquipoSchema,
  EtapaSchema,
  FaseFlujoSchema,
  FaseSchema,
  FlujoSchema,
  KpiSchema,
  PlantLayoutSchema,
  PuntoSchema,
  TransicionSchema,
  ZonaSchema,
} from './schema'

export type PlantLayout = z.infer<typeof PlantLayoutSchema>
export type Punto = z.infer<typeof PuntoSchema>
export type Zona = z.infer<typeof ZonaSchema>
export type Edificio = z.infer<typeof EdificioSchema>
export type Acceso = z.infer<typeof AccesoSchema>
export type Equipo = z.infer<typeof EquipoSchema>
export type Flujo = z.infer<typeof FlujoSchema>
export type Etapa = z.infer<typeof EtapaSchema>
export type Transicion = z.infer<typeof TransicionSchema>
export type Kpi = z.infer<typeof KpiSchema>
export type Dotacion = z.infer<typeof DotacionSchema>
export type Fase = z.infer<typeof FaseSchema>
export type FaseFlujo = z.infer<typeof FaseFlujoSchema>
export type RutaDecoracion = PlantLayout['proceso']['rutas_decoracion'][number]
export type RutaFormacion = PlantLayout['proceso']['rutas_formacion'][number]

/** Dónde está una etapa en el croquis, calculado a partir de las zonas. */
export type Ubicacion = 'ubicada' | 'hipotesis' | 'sin_ubicar'
