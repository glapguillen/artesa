// Una malla instanciada con las piezas de todos los equipos que comparten geometría y material
// (un draw call). El índice de instancia es el índice en `piezas`, y el padre lo usa para saber
// qué equipo se tocó.
import type { ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import type { PiezaUbicada } from '../formas/piezas'

export interface EventosPiezas {
  onClick?: (e: ThreeEvent<MouseEvent>) => void
  onPointerMove?: (e: ThreeEvent<PointerEvent>) => void
  onPointerOut?: (e: ThreeEvent<PointerEvent>) => void
}

interface Props extends EventosPiezas {
  piezas: readonly PiezaUbicada[]
  geometria: 'caja' | 'cilindro'
  /** 'basico' no recibe luz: sirve para la franja de calor (se ve encendida). */
  material: 'estandar' | 'basico'
  /** Colores lineales [r, g, b] por pieza, en el mismo orden que `piezas`. */
  colores: Float32Array
  nombre: string
}

const EJE_Y = new Vector3(0, 1, 0)
const GIRO_Z = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2)

export function MallaPiezas({ piezas, geometria, material, colores, nombre, ...eventos }: Props) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new Matrix4()
    const q = new Quaternion()
    const p = new Vector3()
    const s = new Vector3()
    piezas.forEach((pz, i) => {
      q.setFromAxisAngle(EJE_Y, pz.rotY)
      if (pz.girarZ) q.multiply(GIRO_Z)
      mesh.setMatrixAt(i, m.compose(p.fromArray(pz.pos), q, s.fromArray(pz.escala)))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    mesh.computeBoundingBox()
  }, [piezas])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const c = new Color()
    for (let i = 0; i < piezas.length; i++) mesh.setColorAt(i, c.fromArray(colores, i * 3))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [piezas, colores])

  if (!piezas.length) return null
  return (
    <instancedMesh key={piezas.length} ref={ref} name={nombre} args={[undefined, undefined, piezas.length]} {...eventos}>
      {geometria === 'caja' ? <boxGeometry /> : <cylinderGeometry args={[0.5, 0.5, 1, 20]} />}
      {material === 'basico' ? (
        <meshBasicMaterial toneMapped={false} />
      ) : (
        <meshStandardMaterial roughness={0.75} metalness={0.08} />
      )}
    </instancedMesh>
  )
}
