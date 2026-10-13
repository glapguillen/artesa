// Flechas de sentido en el punto medio de cada tramo de la ruta activa (una malla instanciada).
import { useLayoutEffect, useMemo, useRef } from 'react'
import { type InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { mediosDeTramos } from '../formas/trazos'
import type { V3 } from '../modelo/tipos'

const ARRIBA = new Vector3(0, 1, 0)

export function FlechasRuta({ camino, color, radio }: { camino: V3[]; color: string; radio: number }) {
  const ref = useRef<InstancedMesh>(null)
  const flechas = useMemo(() => mediosDeTramos(camino), [camino])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new Matrix4()
    const q = new Quaternion()
    const d = new Vector3()
    const p = new Vector3()
    const s = new Vector3(radio * 3.2, radio * 7, radio * 3.2)
    flechas.forEach((f, i) => {
      q.setFromUnitVectors(ARRIBA, d.fromArray(f.dir))
      mesh.setMatrixAt(i, m.compose(p.fromArray(f.pos), q, s))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [flechas, radio])

  if (!flechas.length) return null
  return (
    <instancedMesh key={flechas.length} ref={ref} name="ruta-flechas" args={[undefined, undefined, flechas.length]} renderOrder={5}>
      <coneGeometry args={[1, 1, 16]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  )
}
