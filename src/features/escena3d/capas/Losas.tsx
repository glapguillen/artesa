// Zonas del croquis como losas con su polígono exacto. Una malla por estilo (cerrada, abierta
// translúcida, con trama si no tiene rótulo), con color por vértice: pocas draw calls para todas
// las zonas. Clic → selecciona la zona; hover → cursor de mano, realce y tooltip.
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { CanvasTexture, Color, RepeatWrapping, SRGBColorSpace } from 'three'
import { usePlantStore } from '../../../store/usePlantStore'
import { ESTADO_ETIQUETA } from '../../../ui/tokens'
import { ESPESOR_LOSA } from '../geometriaEscena'
import type { Losa3D, ModeloEscena } from '../modelo/tipos'
import { esRayada } from '../presentacion'
import type { Paleta3D } from '../usePaleta3D'
import { useVista3D } from '../useVista3D'
import { Contornos } from './Contornos'
import { agruparLosas, type GrupoLosas, pintarRangos } from './losasGeometria'
import { useColoresLosas } from './useColoresLosas'

/** Opacidad de los recintos abiertos (sin muros propios). */
const OPACIDAD_ABIERTA = 0.6
/** Más desplazamiento que esto (px) entre pulsar y soltar es un arrastre de cámara, no un clic. */
const ARRASTRE_PX = 6

const estilo = (l: Losa3D) => ({ abierta: !l.recintoCerrado, rayada: esRayada(l.grupo) })

/** Trama diagonal (1 m entre rayas) para las zonas sin rótulo o por identificar; se tiñe con el color de la losa. */
function crearTrama(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, 32, 32)
    g.strokeStyle = '#9a9a9a'
    g.lineWidth = 5
    for (const d of [-32, -16, 0, 16, 32, 48]) {
      g.beginPath()
      g.moveTo(d, 32)
      g.lineTo(d + 32, 0)
      g.stroke()
    }
  }
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(0.5, 0.5)
  t.colorSpace = SRGBColorSpace
  return t
}

export function Losas({ modelo, paleta }: { modelo: ModeloEscena; paleta: Paleta3D }) {
  const seleccionar = usePlantStore((s) => s.seleccionar)
  const setHover = useVista3D((s) => s.setHover)
  const lienzo = useThree((s) => s.gl.domElement)
  const grupos = useMemo(() => agruparLosas(modelo.losas, ESPESOR_LOSA, estilo), [modelo.losas])
  useEffect(() => () => grupos.forEach((g) => g.geometria.dispose()), [grupos])
  const [trama] = useState(crearTrama)
  useEffect(() => () => trama.dispose(), [trama])

  const { colores, estados } = useColoresLosas(modelo, paleta)
  const lineales = useMemo(() => new Map([...colores].map(([id, c]) => [id, new Color(c.relleno)])), [colores])
  useLayoutEffect(() => {
    for (const g of grupos) pintarRangos(g.geometria, g.rangos, (id) => lineales.get(id))
  }, [grupos, lineales])
  const nombres = useMemo(() => new Map(modelo.losas.map((l) => [l.id, l.nombre])), [modelo.losas])

  useEffect(
    () => () => {
      lienzo.style.cursor = ''
      setHover(null)
    },
    [lienzo, setHover],
  )

  const zonaDe = (g: GrupoLosas, e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.faceIndex === undefined || e.faceIndex === null ? undefined : g.caras[e.faceIndex]

  const alClic = (g: GrupoLosas) => (e: ThreeEvent<MouseEvent>) => {
    const id = zonaDe(g, e)
    if (!id || e.delta > ARRASTRE_PX) return
    e.stopPropagation()
    seleccionar({ tipo: 'zona', id })
  }
  const alMover = (g: GrupoLosas) => (e: ThreeEvent<PointerEvent>) => {
    const id = zonaDe(g, e)
    if (!id) return
    lienzo.style.cursor = 'pointer'
    const titulo = `${nombres.get(id) ?? id} · ${ESTADO_ETIQUETA[estados[id] ?? 'sin_datos']}`
    setHover({ id, titulo, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
  }
  const alSalir = () => {
    lienzo.style.cursor = ''
    setHover(null)
  }

  return (
    <group name="losas">
      {grupos.map((g) => (
        <mesh key={g.clave} geometry={g.geometria} onClick={alClic(g)} onPointerMove={alMover(g)} onPointerOut={alSalir}>
          <meshLambertMaterial
            vertexColors
            transparent={g.abierta}
            opacity={g.abierta ? OPACIDAD_ABIERTA : 1}
            depthWrite={!g.abierta}
            map={g.rayada ? trama : null}
          />
        </mesh>
      ))}
      <Contornos modelo={modelo} colores={colores} paleta={paleta} />
    </group>
  )
}
