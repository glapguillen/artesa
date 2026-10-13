// Modelo de escena 3D derivado de plant-layout.json (puro, sin three.js).
// Ejes three.js: X = x del layout (este), Y = altura, Z = z del layout (sur). Unidades: metros.
import type { FaseFlujo, Flujo } from '../../../domain/types'

export type V2 = [number, number]
export type V3 = [number, number, number]

export interface Limites {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  centro: V2
  /** Lado mayor del rectángulo envolvente. */
  tam: number
}

export interface Losa3D {
  id: string
  nombre: string
  grupo: string
  /** Color de grupo del JSON (#RRGGBB). */
  color: string
  recintoCerrado: boolean
  contorno: V2[]
  centro: V2
  /** Ancho (X) y largo (Z) del rectángulo envolvente. */
  ancho: number
  largo: number
  etapas: string[]
  etapasHipotesis: string[]
}

export type TipoMuro = 'edificio' | 'tabique'

/** Tramo de muro; se dibuja con instancing (una caja escalada por tramo). */
export interface Muro3D {
  tipo: TipoMuro
  /** Zona o edificio al que pertenece. */
  de: string
  desde: V2
  hasta: V2
  alto: number
  grosor: number
}

export type FormaEquipo =
  | 'horno'
  | 'molino'
  | 'filtro_prensa'
  | 'extrusora'
  | 'kerajet'
  | 'impresora_3d'
  | 'esmaltadora'
  | 'mesa'
  | 'rack'
  | 'puesto_formacion'
  | 'generico'

/** De dónde sale el número de instancias dibujadas. */
export type OrigenCantidad = 'json' | 'minimo_observado' | 'uno'

export interface Instancia {
  /** Centro de la base (Y = 0). */
  pos: V3
  rotY: number
}

export interface Equipo3D {
  id: string
  nombre: string
  tipo: string
  forma: FormaEquipo
  zona: string
  etapa: string
  /** largo (eje X local), ancho (eje Z local), alto (Y), en metros. */
  dims: { largo: number; ancho: number; alto: number }
  /** true si alguna dimensión no viene del JSON (tamaño típico) o se recortó para caber en la zona. */
  representativo: boolean
  cantidadOrigen: OrigenCantidad
  instancias: Instancia[]
}

export interface Flujo3D {
  id: string
  desde: string
  hasta: string
  fase: FaseFlujo
  tipo: Flujo['tipo']
  /** Curva muestreada (arco elevado entre centroides). */
  puntos: V3[]
}

export interface ElementoSinUbicar {
  id: string
  nombre: string
  etapas: string[]
}

export interface ModeloEscena {
  limites: Limites
  losas: Losa3D[]
  muros: Muro3D[]
  equipos: Equipo3D[]
  flujos: Flujo3D[]
  /** Zonas con poligono null (existen pero no están en el croquis). */
  zonasSinUbicar: ElementoSinUbicar[]
  /** Equipos cuya zona no tiene polígono. */
  equiposSinUbicar: ElementoSinUbicar[]
}

export interface Encuadre {
  posicion: V3
  objetivo: V3
}
