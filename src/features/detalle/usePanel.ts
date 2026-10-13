// Comportamiento del panel de detalle: foco al abrir/cambiar de elemento, retorno del foco al
// cerrar desde el panel, Esc para cerrar y borde inferior de la cabecera (para no taparla).
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/** Borde inferior visible de la cabecera (px desde arriba); 0 si no se ve o no existe. */
export function useBordeCabecera(activo: boolean): number {
  const [y, setY] = useState(0)
  useEffect(() => {
    if (!activo) return
    const cabecera = document.querySelector<HTMLElement>('[data-testid="header"]')
    if (!cabecera) return
    let raf = 0
    const medir = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setY(Math.max(0, Math.round(cabecera.getBoundingClientRect().bottom))))
    }
    medir()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    ro?.observe(cabecera)
    window.addEventListener('scroll', medir, { passive: true })
    window.addEventListener('resize', medir)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      window.removeEventListener('scroll', medir)
      window.removeEventListener('resize', medir)
    }
  }, [activo])
  return y
}

interface Refs {
  panel: RefObject<HTMLElement | null>
  titulo: RefObject<HTMLElement | null>
  cuerpo: RefObject<HTMLElement | null>
}

/**
 * Al abrir, el foco va al título (y se recuerda quién lo tenía). Al cambiar de elemento con el
 * panel abierto, va al título solo si estaba dentro del panel o se perdió. Al cerrar desde el
 * panel (botón, Esc o fondo), vuelve a donde estaba. Devuelve la función para cerrar.
 */
export function useFocoPanel(clave: string | null, cerrarSeleccion: () => void, { panel, titulo, cuerpo }: Refs) {
  const previa = useRef<string | null>(null)
  const retorno = useRef<HTMLElement | SVGElement | null>(null)
  const desdePanel = useRef(false)

  useEffect(() => {
    const antes = previa.current
    previa.current = clave
    const activo = document.activeElement
    if (clave === null) {
      const r = retorno.current
      retorno.current = null
      if (antes !== null && desdePanel.current && r?.isConnected) r.focus({ preventScroll: true })
      desdePanel.current = false
      return
    }
    if (antes === clave) return
    cuerpo.current?.scrollTo({ top: 0 })
    if (antes === null) {
      retorno.current =
        (activo instanceof HTMLElement || activo instanceof SVGElement) && activo !== document.body ? activo : null
      titulo.current?.focus({ preventScroll: true })
    } else if (!activo || activo === document.body || panel.current?.contains(activo)) {
      titulo.current?.focus({ preventScroll: true })
    }
  }, [clave, panel, titulo, cuerpo])

  const cerrar = useCallback(() => {
    desdePanel.current = true
    cerrarSeleccion()
  }, [cerrarSeleccion])

  useEffect(() => {
    if (clave === null) return
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) cerrar()
    }
    document.addEventListener('keydown', alTeclado)
    return () => document.removeEventListener('keydown', alTeclado)
  }, [clave, cerrar])

  return cerrar
}
