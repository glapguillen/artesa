// Rombo pequeño que gira sobre cada equipo de forma y tamaño representativos (no medido). Una malla
// instanciada para todos; el clic selecciona el equipo, igual que el clic en el equipo.
import type { ThreeEvent } from '@react-three/fiber'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { type InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { marcasRepresentativas } from '../capasModelo'
import type { ModeloEscena } from '../modelo/tipos'

interface Props {
  modelo: ModeloEscena
  color: string
  onElegir: (equipoId: string) => void
}

const TAM = 0.45
const EJE_Y = new Vector3(0, 1, 0)

export function MarcasRepresentativas({ modelo, color, onElegir }: Props) {
  const ref = useRef<InstancedMesh>(null)
  const marcas = useMemo(() => marcasRepresentativas(modelo.equipos), [modelo])
  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3(TAM, TAM * 1.4, TAM) }), [])

  const ubicar = (angulo: number) => {
    const mesh = ref.current
    if (!mesh) return
    marcas.forEach((k, i) => {
      tmp.q.setFromAxisAngle(EJE_Y, angulo)
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p.fromArray(k.pos), tmp.q, tmp.s))
    })
    mesh.instanceMatrix.needsUpdate = true
  }
  useLayoutEffect(() => {
    ubicar(0)
    ref.current?.computeBoundingSphere()
  })
  useFrame(({ clock }) => ubicar(clock.elapsedTime * 0.8))

  if (!marcas.length) return null
  const elegir = (e: ThreeEvent<MouseEvent>) => {
    const k = e.instanceId === undefined ? undefined : marcas[e.instanceId]
    if (!k) return
    e.stopPropagation()
    onElegir(k.equipoId)
  }
  return (
    <instancedMesh key={marcas.length} ref={ref} name="marcas-representativas" args={[undefined, undefined, marcas.length]} onClick={elegir}>
      <octahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  )
}
