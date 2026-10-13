// Cabecera: título, planta, fuente de datos, turno con reloj, alarmas y tema. Se acomoda en dos
// líneas en pantallas angostas. Si la fuente falla, un aviso lo dice sin ocultar los últimos datos.
import { usePlantStore } from '../store/usePlantStore'
import { colorEstado } from '../ui/tokens'
import { AlarmasMenu } from './AlarmasMenu'
import { FuenteBadge } from './FuenteBadge'
import { ThemeButton } from './ThemeButton'
import { TurnoReloj } from './TurnoReloj'

function AvisoFuente({ error, hayDatos }: { error: string; hayDatos: boolean }) {
  const rojo = colorEstado('detenido')
  return (
    <div
      role="alert"
      className="border-t px-4 py-2 text-xs text-texto"
      style={{ borderColor: rojo, background: `color-mix(in srgb, ${rojo} 10%, var(--c-surface))` }}
    >
      <strong className="font-semibold" style={{ color: rojo }}>
        Fuente de datos con problemas.
      </strong>{' '}
      <span className="break-words">{error}</span>{' '}
      <span className="text-tenue">
        {hayDatos ? 'Se muestran los últimos datos recibidos.' : 'Aún no hay datos en vivo.'}
      </span>
    </div>
  )
}

export function Header() {
  const nombrePlanta = usePlantStore((s) => s.layout?.planta.nombre)
  const errorFuente = usePlantStore((s) => s.errorFuente)
  const hayDatos = usePlantStore((s) => s.live !== null)
  return (
    <header data-testid="header" className="border-b border-borde bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <div className="flex min-w-0 flex-1 basis-56 flex-wrap items-center gap-x-3 gap-y-1">
          <div className="min-w-0">
            <h1 className="text-base leading-tight font-semibold whitespace-nowrap text-texto">
              ARTESA <span className="text-acento">·</span> Planta Viva
            </h1>
            {nombrePlanta && <p className="truncate text-[11px] leading-tight text-tenue">{nombrePlanta}</p>}
          </div>
          <FuenteBadge />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <TurnoReloj />
          <ThemeButton />
          <AlarmasMenu />
        </div>
      </div>
      {errorFuente && <AvisoFuente error={errorFuente} hayDatos={hayDatos} />}
    </header>
  )
}
