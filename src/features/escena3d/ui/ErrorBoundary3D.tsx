// Si la escena 3D falla (o el equipo no tiene WebGL) se muestra un mensaje en español y el plano 2D
// sigue disponible. El resto de la app no se ve afectado.
import { Component, type ReactNode } from 'react'
import { usePlantStore } from '../../../store/usePlantStore'

const BOTON =
  'inline-flex h-10 cursor-pointer items-center rounded-md border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-seleccion'

export function MensajeSin3D({ titulo, detalle, onReintentar }: { titulo: string; detalle: string; onReintentar?: () => void }) {
  const setModoPlanta = usePlantStore((s) => s.setModoPlanta)
  return (
    <div role="alert" data-testid="sin-3d" className="grid h-full place-items-center p-4 text-center">
      <div className="max-w-md space-y-3">
        <p className="text-sm font-semibold text-texto">{titulo}</p>
        <p className="text-sm text-tenue">{detalle}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={`${BOTON} border-transparent bg-acento text-sobre-acento`} onClick={() => setModoPlanta('2d')}>
            Volver al plano 2D
          </button>
          {onReintentar && (
            <button type="button" className={`${BOTON} border-borde bg-surface text-texto hover:bg-bg`} onClick={onReintentar}>
              Reintentar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface Estado {
  error: Error | null
}

export class ErrorBoundary3D extends Component<{ children: ReactNode }, Estado> {
  state: Estado = { error: null }

  static getDerivedStateFromError(error: unknown): Estado {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <MensajeSin3D
        titulo="La vista 3D se detuvo por un error."
        detalle={`El plano 2D sigue funcionando. Detalle técnico: ${error.message || 'error desconocido'}.`}
        onReintentar={() => this.setState({ error: null })}
      />
    )
  }
}
