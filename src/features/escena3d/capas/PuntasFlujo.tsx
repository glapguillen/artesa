// Puntas de flecha (conos) al final de cada flujo, orientadas según el último tramo del arco.
// Una malla instanciada; la transparencia de los flujos tenues se imita mezclando con el fondo.
import { useLayoutEffect, useRef } from 'react'
import { Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { largoPunta } from '../capasModelo'
import { mezclarColor } from '../formas/materialFlujo'
import { direccionFinal } from '../formas/trazos'
import type { FlujoVisible } from './Flujos'

interface Props {
  flujos: readonly FlujoVisible[]
  fondo: string
  /** Factor global (ruta activa → flujos en segundo plano). */
  atenuar: number
}

const ARRIBA = new Vector3(0, 1, 0)

export function PuntasFlujo({ flujos, fondo, atenuar }: Props) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new Matrix4()
    const q = new Quaternion()
    const d = new Vector3()
    const p = new Vector3()
    const s = new Vector3()
    const c = new Color()
    flujos.forEach((f, i) => {
      const fin = f.puntos[f.puntos.length - 1] ?? [0, 0, 0]
      const L = largoPunta(f.radio)
      const r = Math.max(0.45, f.radio * 2.6)
      d.fromArray(direccionFinal(f.puntos))
      q.setFromUnitVectors(ARRIBA, d)
      p.fromArray(fin).addScaledVector(d, -L / 2)
      mesh.setMatrixAt(i, m.compose(p, q, s.set(r, L, r)))
      mesh.setColorAt(i, mezclarColor(c, f.color, fondo, 1 - f.alfa * atenuar))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [flujos, fondo, atenuar])

  if (!flujos.length) return null
  return (
    <instancedMesh key={flujos.length} ref={ref} name="flujos-puntas" args={[undefined, undefined, flujos.length]} renderOrder={2}>
      <coneGeometry args={[1, 1, 12]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}
