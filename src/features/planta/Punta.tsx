// Punta de flecha de tamaño constante en pantalla (tam en píxeles), orientada según `angulo`.
interface Props {
  x: number
  y: number
  angulo: number
  /** Píxeles por metro de la vista actual. */
  k: number
  color: string
  tam?: number
}

export function Punta({ x, y, angulo, k, color, tam = 9 }: Props) {
  const r = (n: number) => Math.round(n * 100) / 100
  return (
    <polygon
      points={`0,0 ${-tam},${-tam / 2} ${-tam * 0.8},0 ${-tam},${tam / 2}`}
      transform={`translate(${r(x)} ${r(y)}) rotate(${r(angulo)}) scale(${1 / k})`}
      style={{ fill: color }}
    />
  )
}
