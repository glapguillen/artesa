// Leyenda de las capas de contenido de la escena 3D (DOM, fuera del lienzo): equipos
// representativos, franja de calor de los hornos, estilos de flujo, ruta y niveles de alarma.
// Usa las variables CSS del tema, así que cambia con claro/oscuro sin recargar.
import type { ReactNode } from 'react'

function Item({ simbolo, children }: { simbolo: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg aria-hidden="true" viewBox="0 0 24 12" className="h-3 w-6 shrink-0">
        {simbolo}
      </svg>
      <span>{children}</span>
    </li>
  )
}

const ALARMA = (color: string) => <circle cx="12" cy="6" r="5" style={{ fill: color, stroke: 'var(--c-surface)' }} strokeWidth={1.5} />

export function LeyendaCapas3D() {
  return (
    <ul data-testid="leyenda-capas-3d" className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] leading-tight text-tenue">
      <Item simbolo={<path d="M12 0 L17 6 L12 12 L7 6 Z" style={{ fill: 'var(--c-muted)' }} />}>
        Equipo con forma y tamaño representativos (no medido)
      </Item>
      <Item simbolo={<rect x="1" y="4" width="22" height="4" rx="1" style={{ fill: 'var(--c-fase-F1)' }} />}>
        Franja de calor del horno (más intensa cerca de su temperatura objetivo)
      </Item>
      <Item simbolo={<path d="M1 6 H23" style={{ stroke: 'var(--c-fase-F2)' }} strokeWidth={3} />}>
        Flujo principal (color de su fase; más grueso con más piezas/h)
      </Item>
      <Item simbolo={<path d="M1 6 H23" style={{ stroke: 'var(--c-fase-F1)' }} strokeWidth={3} strokeDasharray="4 3" opacity={0.6} />}>
        Flujo hipotético, sin ubicar o de venta
      </Item>
      <Item simbolo={<path d="M1 6 H23" style={{ stroke: 'var(--c-ruta)' }} strokeWidth={4} />}>Ruta activa con pasos numerados</Item>
      <Item simbolo={ALARMA('var(--c-estado-detenido)')}>Alarma crítica</Item>
      <Item simbolo={ALARMA('var(--c-estado-espera)')}>Advertencia</Item>
      <Item simbolo={ALARMA('var(--c-muted)')}>Información</Item>
    </ul>
  )
}
