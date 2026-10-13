// Flecha de norte y barra de escala, fijas en pantalla. Ambas son supuestas: el croquis no
// trae norte ni escala calibrada (norte_grados null → "N?" apuntando arriba).
import { escalaBonita } from './geometry'

interface Props {
  k: number
  norteGrados: number | null
}

export function NorteEscala({ k, norteGrados }: Props) {
  const esc = escalaBonita(k)
  const supuesto = norteGrados === null
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute right-2 top-2 flex flex-col items-center rounded-md bg-surface/80 px-1 py-0.5">
        <svg width="18" height="22" viewBox="-9 -11 18 22">
          <g transform={`rotate(${norteGrados ?? 0})`}>
            <polygon points="0,-10 6,8 0,4 -6,8" style={{ fill: 'var(--c-text)' }} />
          </g>
        </svg>
        <span className="text-[10px] font-semibold leading-none text-texto">{supuesto ? 'N?' : 'N'}</span>
      </div>
      <div className="absolute bottom-2 right-2 rounded-md bg-surface/80 px-1.5 py-1 text-[10px] leading-tight text-tenue">
        <svg width={Math.round(esc.px) + 2} height="8" className="block">
          <path
            d={`M1 1V7H${Math.round(esc.px) + 1}V1`}
            style={{ fill: 'none', stroke: 'var(--c-text)' }}
            strokeWidth={1.5}
          />
        </svg>
        <span>
          {esc.metros} m · escala supuesta
        </span>
      </div>
    </div>
  )
}
