// Muros "en corte": una caja unitaria escalada por tramo, con instancing (una malla para las naves
// y otra para los tabiques de los recintos cerrados). La altura es la de corte del catálogo, no la
// real de las naves (declarado en el aviso de supuestos).
import { useLayoutEffect, useMemo, useRef } from 'react'
import { type InstancedMesh, Object3D } from 'three'
import { transformacionMuro } from '../geometriaEscena'
import type { Muro3D, TipoMuro } from '../modelo/tipos'
import { mezclar } from '../presentacion'
import type { Paleta3D } from '../usePaleta3D'

function MallaMuros({ tramos, color, nombre }: { tramos: Muro3D[]; color: string; nombre: string }) {
  const ref = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    const o = new Object3D()
    tramos.forEach((t, i) => {
      const { pos, rotY, escala } = transformacionMuro(t)
      o.position.set(...pos)
      o.rotation.set(0, rotY, 0)
      o.scale.set(...escala)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
    })
    m.instanceMatrix.needsUpdate = true
    m.computeBoundingBox()
    m.computeBoundingSphere()
  }, [tramos])
  if (!tramos.length) return null
  return (
    <instancedMesh key={tramos.length} ref={ref} name={nombre} args={[undefined, undefined, tramos.length]}>
      <boxGeometry />
      <meshLambertMaterial color={color} />
    </instancedMesh>
  )
}

export function Muros({ muros, paleta }: { muros: Muro3D[]; paleta: Paleta3D }) {
  const porTipo = useMemo(() => {
    const de = (t: TipoMuro) => muros.filter((m) => m.tipo === t)
    return { edificio: de('edificio'), tabique: de('tabique') }
  }, [muros])
  // Tonos neutros derivados del tema: naves algo más oscuras que los tabiques.
  const colorNave = mezclar(paleta.borde, paleta.tenue, paleta.oscuro ? 0.25 : 0.4)
  const colorTabique = mezclar(paleta.borde, paleta.superficie, paleta.oscuro ? 0.1 : 0.25)
  return (
    <group name="muros">
      <MallaMuros tramos={porTipo.edificio} color={colorNave} nombre="muros-naves" />
      <MallaMuros tramos={porTipo.tabique} color={colorTabique} nombre="muros-tabiques" />
    </group>
  )
}
