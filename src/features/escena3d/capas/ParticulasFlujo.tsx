// Partículas que recorren cada flujo en su sentido (1 a 3 según el caudal; más rápidas con más
// piezas/h). Una malla instanciada que se actualiza en cada cuadro.
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { particulasDeFlujo } from '../capasModelo'
import { mezclarColor } from '../formas/materialFlujo'
import { acumuladas, puntoEn } from '../formas/trazos'
import type { V3 } from '../modelo/tipos'
import type { FlujoVisible } from './Flujos'

interface Particula {
  puntos: readonly V3[]
  acum: number[]
  largo: number
  /** Desfase inicial (0–1) y velocidad (m/s). */
  fase: number
  velocidad: number
  radio: number
  color: string
}

export function ParticulasFlujo({ flujos, contraste }: { flujos: readonly FlujoVisible[]; contraste: string }) {
  const ref = useRef<InstancedMesh>(null)
  const particulas = useMemo<Particula[]>(
    () =>
      flujos
        .filter((f) => f.realzado && f.puntos.length > 1)
        .flatMap((f) => {
          const acum = acumuladas(f.puntos)
          const n = particulasDeFlujo(f.rel)
          return Array.from({ length: n }, (_, k) => ({
            puntos: f.puntos,
            acum,
            largo: acum[acum.length - 1] ?? 1,
            fase: k / n,
            velocidad: 3 + 5 * (f.rel ?? 0),
            radio: f.radio * 1.5,
            color: f.color,
          }))
        }),
    [flujos],
  )
  const tmp = useMemo(() => ({ m: new Matrix4(), q: new Quaternion(), p: new Vector3(), s: new Vector3() }), [])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const c = new Color()
    particulas.forEach((p, i) => mesh.setColorAt(i, mezclarColor(c, p.color, contraste, 0.3)))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [particulas, contraste])

  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const t = clock.elapsedTime
    particulas.forEach((p, i) => {
      const u = (p.fase + (t * p.velocidad) / Math.max(1, p.largo)) % 1
      tmp.s.setScalar(p.radio)
      mesh.setMatrixAt(i, tmp.m.compose(tmp.p.fromArray(puntoEn(p.puntos, u, p.acum)), tmp.q, tmp.s))
    })
    mesh.instanceMatrix.needsUpdate = true
  })

  if (!particulas.length) return null
  return (
    <instancedMesh
      key={particulas.length}
      ref={ref}
      name="flujos-particulas"
      args={[undefined, undefined, particulas.length]}
      frustumCulled={false}
      renderOrder={3}
    >
      <sphereGeometry args={[1, 10, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}
