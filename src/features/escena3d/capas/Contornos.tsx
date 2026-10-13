// Bordes de las losas: continuos en los recintos cerrados y discontinuos en las áreas abiertas
// (como en el 2D), con el color de borde de cada zona; y el contorno grueso de la selección
// (sólido = confirmada, discontinuo = probable para la etapa elegida).
import { Line } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry, Color, LineBasicMaterial, LineDashedMaterial, LineSegments } from 'three'
import { usePlantStore } from '../../../store/usePlantStore'
import { resaltadoDeSeleccion } from '../../planta/planLive'
import { ESPESOR_LOSA } from '../geometriaEscena'
import type { Losa3D, ModeloEscena, V3 } from '../modelo/tipos'
import type { Paleta3D } from '../usePaleta3D'
import { pintarRangos, type RangoLosa, segmentosContorno } from './losasGeometria'

const Y_BORDE = ESPESOR_LOSA + 0.012
const Y_RESALTE = ESPESOR_LOSA + 0.03

function crearLineas(losas: Losa3D[], discontinua: boolean): { objeto: LineSegments; rangos: RangoLosa[] } {
  const { posiciones, rangos } = segmentosContorno(losas, Y_BORDE)
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(posiciones, 3))
  g.setAttribute('color', new BufferAttribute(new Float32Array(posiciones.length).fill(1), 3))
  const m = discontinua
    ? new LineDashedMaterial({ vertexColors: true, dashSize: 0.9, gapSize: 0.6 })
    : new LineBasicMaterial({ vertexColors: true })
  const objeto = new LineSegments(g, m)
  objeto.name = discontinua ? 'bordes-abiertos' : 'bordes-cerrados'
  if (discontinua) objeto.computeLineDistances()
  return { objeto, rangos }
}

interface Props {
  modelo: ModeloEscena
  colores: Map<string, { relleno: string; borde: string }>
  paleta: Paleta3D
}

export function Contornos({ modelo, colores, paleta }: Props) {
  const lineas = useMemo(
    () => [crearLineas(modelo.losas.filter((l) => l.recintoCerrado), false), crearLineas(modelo.losas.filter((l) => !l.recintoCerrado), true)],
    [modelo.losas],
  )
  useEffect(
    () => () => {
      for (const { objeto } of lineas) {
        objeto.geometry.dispose()
        ;(objeto.material as LineBasicMaterial).dispose()
      }
    },
    [lineas],
  )
  const bordes = useMemo(() => new Map([...colores].map(([id, c]) => [id, new Color(c.borde)])), [colores])
  useLayoutEffect(() => {
    for (const { objeto, rangos } of lineas) pintarRangos(objeto.geometry, rangos, (id) => bordes.get(id))
  }, [lineas, bordes])

  return (
    <>
      {lineas.map(({ objeto }) => (
        <primitive key={objeto.name} object={objeto} />
      ))}
      <ResalteSeleccion losas={modelo.losas} color={paleta.seleccion} />
    </>
  )
}

/** Pares de puntos de los lados de las losas resaltadas, separados en sólidos y discontinuos. */
function puntosResalte(losas: Losa3D[], resalte: Map<string, 'solido' | 'discontinuo'>) {
  const solido: V3[] = []
  const discontinuo: V3[] = []
  for (const l of losas) {
    const r = resalte.get(l.id)
    if (!r) continue
    const destino = r === 'solido' ? solido : discontinuo
    l.contorno.forEach(([x, z], i) => {
      const [x2, z2] = l.contorno[(i + 1) % l.contorno.length]!
      destino.push([x, Y_RESALTE, z], [x2, Y_RESALTE, z2])
    })
  }
  return { solido, discontinuo }
}

function ResalteSeleccion({ losas, color }: { losas: Losa3D[]; color: string }) {
  const idx = usePlantStore((s) => s.idx)
  const seleccion = usePlantStore((s) => s.seleccion)
  const { solido, discontinuo } = useMemo(() => puntosResalte(losas, resaltadoDeSeleccion(idx, seleccion)), [losas, idx, seleccion])
  return (
    <>
      {solido.length > 0 && <Line name="resalte-solido" segments points={solido} color={color} lineWidth={4} toneMapped={false} />}
      {discontinuo.length > 0 && (
        <Line name="resalte-probable" segments points={discontinuo} color={color} lineWidth={3} dashed dashSize={1.2} gapSize={0.8} toneMapped={false} />
      )}
    </>
  )
}
