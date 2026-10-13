// Estado de la UI de la vista 3D (capas visibles, hover, aviso) y puente con la cámara.
// Vive fuera del <Canvas> para que los controles HTML y la escena lo compartan; no se guarda
// nada del layout aquí (eso está en usePlantStore).
import { create } from 'zustand'
import type { Encuadre } from './modelo/tipos'

export type Vista3D = 'general' | 'cenital' | 'zona'

/** Acciones de cámara accesibles desde teclado y botones (dirección, no magnitud). */
export type AccionCamara =
  | { tipo: 'rotar'; az: number; pol: number }
  | { tipo: 'desplazar'; dx: number; dz: number }
  | { tipo: 'zoom'; dir: 1 | -1 }
  | { tipo: 'vista'; vista: Vista3D }

/** Lo que ControlCamara expone a la UI HTML (se registra al montar la escena). */
export interface ApiCamara {
  vista: (v: Vista3D) => void
  ir: (e: Encuadre, suave: boolean) => void
  /** Posición y objetivo actuales; con `fin` = true, los del final de la transición en curso. */
  estado: (fin?: boolean) => Encuadre
  accion: (a: AccionCamara) => void
}

export interface Hover {
  id: string
  titulo: string
  /** Coordenadas de ventana del puntero. */
  x: number
  y: number
}

export interface Estadisticas3D {
  fps: number
  drawCalls: number
  triangulos: number
}

interface EstadoVista3D {
  etiquetas: boolean
  muros: boolean
  flujos: boolean
  /** Aviso de supuestos: 'auto' = abierto en tarjetas anchas y plegado en angostas; o lo que eligió el usuario. */
  aviso: 'auto' | 'abierto' | 'cerrado'
  hover: Hover | null
  camara: ApiCamara | null
  /** Encuadre a restaurar (al salir del recorrido); lo consume ControlCamara. */
  restaurar: Encuadre | null
  stats: Estadisticas3D | null
  setEtiquetas: (v: boolean) => void
  setMuros: (v: boolean) => void
  setFlujos: (v: boolean) => void
  setAviso: (v: 'abierto' | 'cerrado') => void
  setHover: (h: Hover | null) => void
  setCamara: (c: ApiCamara | null) => void
  setRestaurar: (e: Encuadre | null) => void
  setStats: (s: Estadisticas3D | null) => void
}

export const useVista3D = create<EstadoVista3D>()((set) => ({
  etiquetas: true,
  muros: true,
  flujos: true,
  aviso: 'auto',
  hover: null,
  camara: null,
  restaurar: null,
  stats: null,
  setEtiquetas: (etiquetas) => set({ etiquetas }),
  setMuros: (muros) => set({ muros }),
  setFlujos: (flujos) => set({ flujos }),
  setAviso: (aviso) => set({ aviso }),
  setHover: (hover) => set({ hover }),
  setCamara: (camara) => set({ camara }),
  setRestaurar: (restaurar) => set({ restaurar }),
  setStats: (stats) => set({ stats }),
}))
