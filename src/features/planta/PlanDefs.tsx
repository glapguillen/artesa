// Patrones del plano: rayado (zonas sin rótulo o sin identificar) y puntos (exterior).
// El tamaño se compensa con k para que la trama se vea igual con cualquier zoom.
export function PlanDefs({ k }: { k: number }) {
  const u = 1 / k
  return (
    <defs>
      <pattern id="pv-rayado" patternUnits="userSpaceOnUse" width={6 * u} height={6 * u} patternTransform="rotate(45)">
        <line x1={0} y1={0} x2={0} y2={6 * u} style={{ stroke: 'var(--c-muted)' }} strokeWidth={1.2 * u} strokeOpacity={0.55} />
      </pattern>
      <pattern id="pv-puntos" patternUnits="userSpaceOnUse" width={7 * u} height={7 * u}>
        <circle cx={3.5 * u} cy={3.5 * u} r={1 * u} style={{ fill: 'var(--c-muted)' }} fillOpacity={0.6} />
      </pattern>
    </defs>
  )
}
