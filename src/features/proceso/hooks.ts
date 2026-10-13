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

/** Cambio de tamaño (px) a partir del cual se reencuadra un lienzo que el usuario no movió. */
const UMBRAL_REENCUADRE = 24

/**
 * Llama a `encuadrar` cuando el contenedor pasa de tamaño 0 (oculto) a visible y, si el usuario no
 * movió ni acercó el diagrama (`movidoAMano`), también cuando su tamaño cambia de forma notable
 * (p. ej. al abrirse o cerrarse el panel de detalle en escritorio, o al girar la tableta).
 */
export function useEncuadreAlMostrar(
  ref: RefObject<HTMLElement | null>,
  encuadrar: () => void,
  movidoAMano: RefObject<boolean>,
) {
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const oculto = () => el.clientWidth === 0 || el.clientHeight === 0
    let estabaOculto = oculto()
    let ancho = el.clientWidth
    let alto = el.clientHeight
    let cuadro = 0
    const ro = new ResizeObserver(() => {
      const ahora = oculto()
      const cambio = Math.abs(el.clientWidth - ancho) > UMBRAL_REENCUADRE || Math.abs(el.clientHeight - alto) > UMBRAL_REENCUADRE
      if (!ahora && (estabaOculto || (cambio && !movidoAMano.current))) {
        // Un cuadro después, para que React Flow ya haya registrado su nuevo tamaño.
        cancelAnimationFrame(cuadro)
        cuadro = requestAnimationFrame(encuadrar)
      }
      estabaOculto = ahora
      if (!ahora) {
        ancho = el.clientWidth
        alto = el.clientHeight
      }
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(cuadro)
    }
  }, [ref, encuadrar, movidoAMano])
}
