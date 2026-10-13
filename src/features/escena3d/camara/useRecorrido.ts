// Comportamiento del recorrido mientras está activo: avance automático, teclado (← → Espacio Esc),
// parada si el usuario elige otra cosa y limpieza al desmontar la vista 3D.
import { useEffect } from 'react'
import { usePlantStore } from '../../../store/usePlantStore'
import { esSeleccionDelPaso, useTour } from './estadoTour'
import { SEGUNDOS_POR_PASO } from './tour'

const CAMPO = 'input, select, textarea, [contenteditable="true"]'
const CONTROL = 'button, a[href], [role="button"], summary'

function alTeclado(e: KeyboardEvent) {
  const st = useTour.getState()
  if (!st.activo || e.altKey || e.ctrlKey || e.metaKey) return
  const destino = e.target instanceof Element ? e.target : null
  if (destino?.closest(CAMPO)) return
  if (e.key === 'ArrowRight') st.ir(st.indice + 1)
  else if (e.key === 'ArrowLeft') st.ir(st.indice - 1)
  else if (e.key === 'Escape') st.detener(true)
  else if (e.key === ' ' && !destino?.closest(CONTROL)) st.setPausado(!st.pausado)
  else return
  // Captura en window: el panel (Esc) y la navegación de la escena (flechas) no lo reciben.
  e.preventDefault()
  e.stopPropagation()
}

export function useRecorrido() {
  const activo = useTour((s) => s.activo)
  const global = useTour((s) => s.global)
  const pausado = useTour((s) => s.pausado)
  const indice = useTour((s) => s.indice)
  const pasos = useTour((s) => s.pasos)
  const seleccion = usePlantStore((s) => s.seleccion)

  useEffect(() => {
    if (!activo || pausado) return
    const t = window.setTimeout(() => {
      const st = useTour.getState()
      if (st.indice + 1 < st.pasos.length) st.ir(st.indice + 1)
      else st.setPausado(true)
    }, SEGUNDOS_POR_PASO * 1000)
    return () => window.clearTimeout(t)
  }, [activo, pausado, indice])

  useEffect(() => {
    if (activo && !esSeleccionDelPaso(seleccion, pasos[indice], global)) useTour.getState().detener(false)
  }, [activo, global, seleccion, pasos, indice])

  useEffect(() => {
    if (!activo) return
    window.addEventListener('keydown', alTeclado, true)
    return () => window.removeEventListener('keydown', alTeclado, true)
  }, [activo])

  useEffect(() => () => useTour.getState().detener(false), [])
}
