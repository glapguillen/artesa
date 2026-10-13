// Aplica el tema (claro/oscuro/sistema) como clase .dark en <html>.
import { useEffect } from 'react'
import { usePlantStore } from '../store/usePlantStore'

export function useTheme() {
  const tema = usePlantStore((s) => s.tema)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const aplicar = () => {
      const oscuro = tema === 'oscuro' || (tema === 'sistema' && mq.matches)
      document.documentElement.classList.toggle('dark', oscuro)
    }
    aplicar()
    mq.addEventListener('change', aplicar)
    return () => mq.removeEventListener('change', aplicar)
  }, [tema])
}
