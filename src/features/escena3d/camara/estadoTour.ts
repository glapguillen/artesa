// Estado del recorrido de presentación. Cada paso selecciona su etapa en el store global (así el
// panel, el 2D y el diagrama la muestran) y la cámara vuela por la selección. Al salir con
// "Salir" o Esc se restauran la vista y la selección previas.
import { create } from 'zustand'
import { type Seleccion, usePlantStore } from '../../../store/usePlantStore'
import type { Encuadre } from '../modelo/tipos'
import { useVista3D } from '../useVista3D'
import { pasoAcotado, type PasoRecorrido } from './tour'

interface EstadoTour {
  activo: boolean
  pausado: boolean
  indice: number
  pasos: PasoRecorrido[]
  previo: { seleccion: Seleccion | null; camara: Encuadre | null } | null
  iniciar: (pasos: PasoRecorrido[]) => void
  ir: (i: number) => void
  setPausado: (p: boolean) => void
  /** Termina el recorrido; con `restaurar`, vuelve a la vista y la selección de antes. */
  detener: (restaurar: boolean) => void
}

export const useTour = create<EstadoTour>()((set, get) => ({
  activo: false,
  pausado: false,
  indice: 0,
  pasos: [],
  previo: null,
  iniciar: (pasos) => {
    if (!pasos.length) return
    const previo = {
      seleccion: usePlantStore.getState().seleccion,
      camara: useVista3D.getState().camara?.estado(true) ?? null,
    }
    set({ activo: true, pausado: false, indice: 0, pasos, previo })
    get().ir(0)
  },
  ir: (i) => {
    const { pasos, activo } = get()
    if (!activo) return
    const indice = pasoAcotado(i, pasos.length)
    set({ indice })
    const codigo = pasos[indice]?.etapas[0]?.codigo
    if (codigo) usePlantStore.getState().seleccionar({ tipo: 'etapa', id: codigo })
  },
  setPausado: (pausado) => set({ pausado }),
  detener: (restaurar) => {
    const { activo, previo } = get()
    if (!activo) return
    set({ activo: false, pausado: false, previo: null })
    if (!restaurar || !previo) return
    // Primero el encuadre pendiente: así ControlCamara no vuela a la selección restaurada.
    if (previo.camara) useVista3D.getState().setRestaurar(previo.camara)
    usePlantStore.getState().seleccionar(previo.seleccion)
  },
}))

/** ¿La selección pertenece al paso en curso? (si no, el usuario eligió otra cosa). */
export function esSeleccionDelPaso(sel: Seleccion | null, paso: PasoRecorrido | undefined): boolean {
  return !!sel && !!paso && sel.tipo === 'etapa' && paso.etapas.some((e) => e.codigo === sel.id)
}
