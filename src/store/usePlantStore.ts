// Estado global de la UI (zustand). Los componentes leen de aquí; no hay lógica de datos en las vistas.
import { create } from 'zustand'
import { CONFIG } from '../config'
import type { LiveState } from '../domain/live'
import { indexarLayout, type LayoutIndex } from '../domain/selectors'
import type { PlantLayout } from '../domain/types'

export type Seleccion = { tipo: 'zona' | 'etapa' | 'equipo'; id: string }
export type Tema = 'sistema' | 'claro' | 'oscuro'
export type ModoPlanta = '2d' | '3d'

/** Lectura resumida para los mini-gráficos. */
export interface PuntoHistorial {
  t: string
  wip: Record<string, number | null>
  kpis: Record<string, number | null>
}

interface PlantState {
  layout: PlantLayout | null
  idx: LayoutIndex | null
  avisosLayout: string[]
  live: LiveState | null
  simulado: boolean
  errorFuente: string | null
  historial: PuntoHistorial[]
  seleccion: Seleccion | null
  /** R1–R9 resaltada en ambas vistas, o null. */
  rutaActiva: string | null
  colorPor: 'estado' | 'grupo'
  /** Muestra aristas de insumo, registro y configuración en el diagrama de proceso. */
  mostrarSecundarias: boolean
  /** En pantallas angostas solo se ve una vista a la vez. */
  vistaMovil: 'planta' | 'proceso'
  /** La sección de planta muestra el plano 2D o la escena 3D. */
  modoPlanta: ModoPlanta
  tema: Tema
  setLayout: (layout: PlantLayout, avisos: string[]) => void
  recibirEstado: (s: LiveState, simulado: boolean) => void
  setErrorFuente: (e: string | null) => void
  seleccionar: (s: Seleccion | null) => void
  setRutaActiva: (r: string | null) => void
  setColorPor: (c: 'estado' | 'grupo') => void
  setMostrarSecundarias: (v: boolean) => void
  setVistaMovil: (v: 'planta' | 'proceso') => void
  setModoPlanta: (m: ModoPlanta) => void
  setTema: (t: Tema) => void
}

function resumir(s: LiveState): PuntoHistorial {
  const wip: Record<string, number | null> = {}
  for (const [c, e] of Object.entries(s.etapas)) wip[c] = e.wip
  const kpis: Record<string, number | null> = {}
  for (const [k, v] of Object.entries(s.kpis)) kpis[k] = v.valor
  return { t: s.timestamp, wip, kpis }
}

export const usePlantStore = create<PlantState>()((set) => ({
  layout: null,
  idx: null,
  avisosLayout: [],
  live: null,
  simulado: false,
  errorFuente: null,
  historial: [],
  seleccion: null,
  rutaActiva: null,
  colorPor: 'estado',
  mostrarSecundarias: false,
  vistaMovil: 'planta',
  modoPlanta: '2d',
  tema: 'sistema',
  setLayout: (layout, avisos) => set({ layout, idx: indexarLayout(layout), avisosLayout: avisos }),
  recibirEstado: (s, simulado) =>
    set((st) => {
      // Si el turno se reinicia (el simulador vuelve a empezar), se limpia el historial.
      const reinicio = st.live !== null && s.turno.id !== st.live.turno.id
      const base = reinicio ? [] : st.historial
      return { live: s, simulado, errorFuente: null, historial: [...base, resumir(s)].slice(-CONFIG.historialMax) }
    }),
  setErrorFuente: (errorFuente) => set({ errorFuente }),
  seleccionar: (seleccion) => set({ seleccion }),
  setRutaActiva: (rutaActiva) => set({ rutaActiva }),
  setColorPor: (colorPor) => set({ colorPor }),
  setMostrarSecundarias: (mostrarSecundarias) => set({ mostrarSecundarias }),
  setVistaMovil: (vistaMovil) => set({ vistaMovil }),
  setModoPlanta: (modoPlanta) => set({ modoPlanta }),
  setTema: (tema) => set({ tema }),
}))
