// Turno en curso: nombre, hora del último estado y barra de avance del turno.
import { usePlantStore } from '../store/usePlantStore'
import { fmtHora } from '../ui/tokens'

/** progreso llega como fracción 0–1; se tolera también 0–100. */
function porcentaje(p: number | null | undefined): number | null {
  if (p === null || p === undefined || !Number.isFinite(p)) return null
  const f = p > 1 ? p / 100 : p
  return Math.round(Math.min(1, Math.max(0, f)) * 100)
}

export function TurnoReloj() {
  const turno = usePlantStore((s) => s.live?.turno)
  const timestamp = usePlantStore((s) => s.live?.timestamp)
  const pct = porcentaje(turno?.progreso)
  const rango = turno ? `${fmtHora(turno.inicio)} a ${fmtHora(turno.fin)}` : null
  return (
    <div className="flex min-w-[8.5rem] flex-col gap-1" title={rango ? `Turno de ${rango}` : undefined}>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate text-tenue">{turno?.nombre ?? 'Turno sin datos'}</span>
        <time dateTime={timestamp} className="text-sm font-semibold tabular-nums text-texto">
          {fmtHora(timestamp)}
        </time>
      </div>
      <div
        role="progressbar"
        aria-label={rango ? `Avance del turno (${rango})` : 'Avance del turno'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
        aria-valuetext={pct === null ? 'Sin datos' : `${pct} %`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full" style={{ width: `${pct ?? 0}%`, background: 'var(--c-accent)' }} />
      </div>
    </div>
  )
}
