// Estado del recorrido de presentación. En pantallas anchas cada paso selecciona su etapa en el
// store global (así el panel, el 2D y el diagrama la muestran) y la cámara vuela por la selección.
// En angostas el panel de detalle es una hoja que taparía la escena: el paso se resalta solo en 3D
// (useSeleccion3D) sin abrir el panel. Al salir con "Salir" o Esc se restauran vista y selección.
import { create } from 'zustand'
import { type Seleccion, usePlantStore } from '../../../store/usePlantStore'
import type { Encuadre } from '../modelo/tipos'
import { useVista3D } from '../useVista3D'
import { pasoAcotado, type PasoRecorrido } from './tour'

/** Ancho desde el que el panel de detalle va al costado y no tapa la escena (lg de Tailwind). */
const CONSULTA_ANCHA = '(min-width: 1024px)'
const pantallaAncha = () => typeof window === 'undefined' || !window.matchMedia || window.matchMedia(CONSULTA_ANCHA).matches

interface EstadoTour {
  activo: boolean
  /** true: cada paso selecciona su etapa en el store global; false: solo se resalta en 3D. */
  global: boolean
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
  global: true,
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
    const global = pantallaAncha()
    set({ activo: true, global, pausado: false, indice: 0, pasos, previo })
    if (!global) usePlantStore.getState().seleccionar(null)
    get().ir(0)
  },
  ir: (i) => {
    const { pasos, activo, global } = get()
    if (!activo) return
    const indice = pasoAcotado(i, pasos.length)
    set({ indice })
    const codigo = etapaDelPaso(pasos[indice])
    if (codigo && global) usePlantStore.getState().seleccionar({ tipo: 'etapa', id: codigo })
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

/** Etapa que representa al paso (la primera del grupo). */
export const etapaDelPaso = (p: PasoRecorrido | undefined) => p?.etapas[0]?.codigo ?? null

/**
 * ¿La selección global es la que corresponde al recorrido? Con selección global, una etapa del
 * paso; sin ella, ninguna. Si no, el usuario eligió otra cosa y el recorrido se detiene.
 */
export function esSeleccionDelPaso(sel: Seleccion | null, paso: PasoRecorrido | undefined, global = true): boolean {
  if (!global) return sel === null
  return !!sel && !!paso && sel.tipo === 'etapa' && paso.etapas.some((e) => e.codigo === sel.id)
}
