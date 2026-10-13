// Rótulos HTML de la ruta activa: número de paso sobre cada zona del recorrido ("1·4" si se
// repite) y el rótulo de la ruta fijo en la esquina inferior izquierda del lienzo.
import { useThree } from '@react-three/fiber'
import type { PasoRuta } from '../rutaAlarmasModelo'
import { HtmlEscena as Html } from './HtmlEscena'

export function PasosRuta({ pasos, color, texto }: { pasos: PasoRuta[]; color: string; texto: string }) {
  return (
    <>
      {pasos.map((p) => (
        <Html key={p.zonaId} position={p.pos} center zIndexRange={[24, 21]} pointerEvents="none">
          <span
            aria-hidden="true"
            data-paso-zona-3d={p.zonaId}
            className="pointer-events-none block -translate-y-[85%] rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap shadow-md"
            style={{ background: color, color: texto, border: `2px solid ${texto}` }}
          >
            {p.numeros.join('·')}
          </span>
        </Html>
      ))}
    </>
  )
}

/** Posición fija en pantalla: 8 px desde la esquina inferior izquierda del lienzo. */
const esquinaInferior = (_el: unknown, _cam: unknown, size: { width: number; height: number }) => [8, size.height - 8]

export function RotuloRuta({ id, texto, color }: { id: string; texto: string; color: string }) {
  const ancho = useThree((s) => s.size.width)
  return (
    <Html calculatePosition={esquinaInferior} zIndexRange={[26, 26]} pointerEvents="none">
      <p
        data-testid="ruta-rotulo-3d"
        data-ruta-activa={id}
        className="pointer-events-none w-max -translate-y-full rounded-lg px-2.5 py-1 text-xs leading-snug font-bold text-surface shadow-md"
        style={{ background: color, maxWidth: Math.max(160, ancho - 16) }}
      >
        {texto}
      </p>
    </Html>
  )
}
