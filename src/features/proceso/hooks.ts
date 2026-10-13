// Hooks de la vista de proceso: grafo memoizado desde el store, consultas de medios y reencuadre
// cuando la sección pasa de oculta (pestaña móvil) a visible.
import { type RefObject, useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { LayoutIndex } from '../../domain/selectors'
import type { PlantLayout } from '../../domain/types'
import { usePlantStore } from '../../store/usePlantStore'
import { buildGraph } from './buildGraph'

export function useMediaQuery(consulta: string): boolean {
  const suscribir = useCallback(
    (avisar: () => void) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mq = window.matchMedia(consulta)
      mq.addEventListener('change', avisar)
      return () => mq.removeEventListener('change', avisar)
    },
    [consulta],
  )
  return useSyncExternalStore(
    suscribir,
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(consulta).matches,
    () => false,
  )
}

export function useGrafoProceso(layout: PlantLayout, idx: LayoutIndex) {
  const live = usePlantStore((s) => s.live)
  const mostrarSecundarias = usePlantStore((s) => s.mostrarSecundarias)
  const rutaActiva = usePlantStore((s) => s.rutaActiva)
  const seleccion = usePlantStore((s) => s.seleccion)
  const reducir = useMediaQuery('(prefers-reduced-motion: reduce)')
  return useMemo(
    () => buildGraph(layout, idx, live, { mostrarSecundarias, rutaActiva, seleccion, animar: !reducir }),
    [layout, idx, live, mostrarSecundarias, rutaActiva, seleccion, reducir],
  )
}

/** Llama a `encuadrar` cuando el contenedor pasa de tamaño 0 (oculto) a visible. */
export function useEncuadreAlMostrar(ref: RefObject<HTMLElement | null>, encuadrar: () => void) {
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const oculto = () => el.clientWidth === 0 || el.clientHeight === 0
    let estabaOculto = oculto()
    let cuadro = 0
    const ro = new ResizeObserver(() => {
      const ahora = oculto()
      // Un cuadro después, para que React Flow ya haya registrado su nuevo tamaño.
      if (estabaOculto && !ahora) cuadro = requestAnimationFrame(encuadrar)
      estabaOculto = ahora
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(cuadro)
    }
  }, [ref, encuadrar])
}
