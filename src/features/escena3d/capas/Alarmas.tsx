// Alarmas activas en la escena: una baliza por referencia (equipo, zona o etapa) con anillo
// pulsante + columna en el color del nivel, y un botón "!" que abre su detalle. Coincide con la
// barra de alarmas (mismo LiveState) y con el 2D. Lo no ubicado en el croquis no se dibuja.
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { Color, type InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import { usePlantStore } from '../../../store/usePlantStore'
import type { ModeloEscena } from '../modelo/tipos'
import { balizasDeAlarmas, colorNivel } from '../rutaAlarmasModelo'
import { usePaleta3D } from '../usePaleta3D'
import { BotonAlarma } from './BotonAlarma'

const ACOSTADO = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2)
const SIN_GIRO = new Quaternion()

export function Alarmas({ modelo }: { modelo: ModeloEscena }) {
  const idx = usePlantStore((s) => s.idx)
  const live = usePlantStore((s) => s.live)
  const seleccionar = usePlantStore((s) => s.seleccionar)
  const paleta = usePaleta3D()
  const balizas = useMemo(() => balizasDeAlarmas(modelo, idx, live), [modelo, idx, live])
  const anillos = useRef<InstancedMesh>(null)
  const columnas = useRef<InstancedMesh>(null)
  const tmp = useMemo(() => ({ m: new Matrix4(), p: new Vector3(), s: new Vector3() }), [])

  useLayoutEffect(() => {
    const c = new Color()
    balizas.forEach((b, i) => {
      c.set(colorNivel(b.nivel, paleta))
      anillos.current?.setColorAt(i, c)
      columnas.current?.setColorAt(i, c)
    })
    for (const mesh of [anillos.current, columnas.current]) if (mesh?.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [balizas, paleta])

  useFrame(({ clock }) => {
    const a = anillos.current
    const col = columnas.current
    if (!a || !col) return
    const t = clock.elapsedTime
    balizas.forEach((b, i) => {
      // Crítica y advertencia laten (la crítica más rápido); información queda quieta.
      const f = b.nivel === 'critica' ? 1.6 : 1
      const k = b.nivel === 'info' ? 0.8 : 1 + 0.45 * ((t * f) % 1)
      tmp.p.set(b.pos[0], b.pos[1] + 0.05, b.pos[2])
      a.setMatrixAt(i, tmp.m.compose(tmp.p, ACOSTADO, tmp.s.set(b.radio * k, b.radio * k, b.radio * k)))
      const alto = b.cima - b.pos[1]
      tmp.p.set(b.pos[0], b.pos[1] + alto / 2, b.pos[2])
      const g = b.nivel === 'info' ? 0.08 : 0.14
      col.setMatrixAt(i, tmp.m.compose(tmp.p, SIN_GIRO, tmp.s.set(g, alto, g)))
    })
    a.instanceMatrix.needsUpdate = true
    col.instanceMatrix.needsUpdate = true
  })

  if (!balizas.length) return null
  return (
    <group name="capa-alarmas">
      <instancedMesh key={`a${balizas.length}`} ref={anillos} name="alarmas-anillos" args={[undefined, undefined, balizas.length]} frustumCulled={false} renderOrder={6}>
        <torusGeometry args={[1, 0.09, 8, 40]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh key={`c${balizas.length}`} ref={columnas} name="alarmas-columnas" args={[undefined, undefined, balizas.length]} frustumCulled={false} renderOrder={6}>
        <cylinderGeometry args={[1, 1, 1, 10]} />
        <meshBasicMaterial transparent opacity={0.75} toneMapped={false} />
      </instancedMesh>
      {balizas.map((b) => (
        <BotonAlarma key={b.clave} baliza={b} color={colorNivel(b.nivel, paleta)} texto={paleta.superficie} onElegir={() => seleccionar(b.ref)} />
      ))}
    </group>
  )
}
