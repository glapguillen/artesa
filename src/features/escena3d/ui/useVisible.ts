// ¿El elemento se ve en pantalla? (IntersectionObserver). Con la sección oculta (pestaña "Proceso"
// en móvil) o fuera de la ventana, la escena deja de dibujar cuadros.
import { type RefObject, useEffect, useState } from 'react'

export function useVisible(ref: RefObject<HTMLElement | null>): boolean {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((entradas) => {
      const e = entradas[entradas.length - 1]
      if (e) setVisible(e.isIntersecting)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return visible
}
