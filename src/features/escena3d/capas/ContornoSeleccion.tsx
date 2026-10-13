// Contorno del equipo seleccionado (o de los equipos de la etapa seleccionada): aristas de su caja
// envolvente en el color de selección, todas en una sola línea gruesa (un draw call).
import { Line } from '@react-three/drei'
import { useMemo } from 'react'
import type { VistaEquipo } from '../capasModelo'
import { aristasDeCaja, envolventes } from '../formas/envolventes'
import type { ModeloEscena, V3 } from '../modelo/tipos'

interface Props {
  modelo: ModeloEscena
  vista: Map<string, VistaEquipo>
  color: string
}

export function ContornoSeleccion({ modelo, vista, color }: Props) {
  const { puntos, fuerte } = useMemo(() => {
    const pts: V3[] = []
    let f = false
    for (const e of modelo.equipos) {
      const r = vista.get(e.id)?.resalte
      if (!r) continue
      f ||= r === 'fuerte'
      for (const c of envolventes(e)) pts.push(...aristasDeCaja(c.pos, c.rotY, c.escala))
    }
    return { puntos: pts, fuerte: f }
  }, [modelo, vista])
  if (!puntos.length) return null
  return <Line name="contorno-seleccion" points={puntos} segments color={color} lineWidth={fuerte ? 3 : 2} toneMapped={false} />
}
