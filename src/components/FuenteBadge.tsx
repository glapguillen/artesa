// Distintivo de la fuente de datos: DATOS SIMULADOS (ámbar), EN VIVO (verde) o SIN DATOS (gris).
import { usePlantStore } from '../store/usePlantStore'
import { colorEstado } from '../ui/tokens'

export function FuenteBadge() {
  const hayDatos = usePlantStore((s) => s.live !== null)
  const simulado = usePlantStore((s) => s.simulado)
  const [texto, color, colorTexto, ayuda] = !hayDatos
    ? ['SIN DATOS', colorEstado('sin_datos'), 'var(--c-muted)', 'Todavía no llega ningún estado de la fuente de datos']
    : simulado
      ? ['DATOS SIMULADOS', colorEstado('espera'), 'var(--c-aviso-texto)', 'Los datos provienen del simulador, no de la planta']
      : ['EN VIVO', colorEstado('operando'), 'var(--c-text)', 'Datos recibidos de la fuente en vivo']
  return (
    <span
      data-testid="badge-fuente"
      title={ayuda}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide whitespace-nowrap"
      style={{ color: colorTexto, borderColor: color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: color }} />
      {texto}
    </span>
  )
}
