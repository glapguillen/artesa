// Botón de tema: rota sistema → claro → oscuro. La clase .dark la aplica useTheme.
import type { Tema } from '../store/usePlantStore'
import { usePlantStore } from '../store/usePlantStore'

const SIGUIENTE: Record<Tema, Tema> = { sistema: 'claro', claro: 'oscuro', oscuro: 'sistema' }
const NOMBRE: Record<Tema, string> = { sistema: 'del sistema', claro: 'claro', oscuro: 'oscuro' }

function Icono({ tema }: { tema: Tema }) {
  const comun = {
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    'aria-hidden': true,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (tema === 'claro') {
    return (
      <svg {...comun}>
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M3.4 12.6l1-1M11.6 4.4l1-1" />
      </svg>
    )
  }
  if (tema === 'oscuro') {
    return (
      <svg {...comun}>
        <path d="M13.5 9.5A5.5 5.5 0 0 1 6.5 2.5a5.5 5.5 0 1 0 7 7Z" />
      </svg>
    )
  }
  return (
    <svg {...comun}>
      <rect x="1.5" y="2.5" width="13" height="9" rx="1.5" />
      <path d="M5.5 14h5M8 11.5V14" />
    </svg>
  )
}

export function ThemeButton() {
  const tema = usePlantStore((s) => s.tema)
  const setTema = usePlantStore((s) => s.setTema)
  const etiqueta = `Tema ${NOMBRE[tema]}. Cambiar a tema ${NOMBRE[SIGUIENTE[tema]]}`
  return (
    <button
      type="button"
      data-testid="tema-boton"
      aria-label={etiqueta}
      title={etiqueta}
      onClick={() => setTema(SIGUIENTE[tema])}
      className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-borde bg-surface text-texto hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seleccion"
    >
      <Icono tema={tema} />
    </button>
  )
}
