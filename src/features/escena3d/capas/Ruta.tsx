// Ruta de decoración activa (R1–R9): trazo elevado grueso por los centros de sus zonas en orden
// (misma función de dominio que el 2D: zonasDeRuta), pulsos que avanzan en el sentido de la ruta,
// flechas por tramo, una esfera que recorre el camino, pasos numerados y el rótulo de la ruta.
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Mesh } from 'three'
import { usePlantStore } from '../../../store/usePlantStore'
import { avanzar, crearMaterialFlujo, geometriaDeTubos, lineal } from '../formas/materialFlujo'
import { acumuladas, construirTubos, puntoEn } from '../formas/trazos'
import type { ModeloEscena, V3 } from '../modelo/tipos'
import { rotuloRuta, rutaEscena } from '../rutaAlarmasModelo'
import { usePaleta3D } from '../usePaleta3D'
import { FlechasRuta } from './FlechasRuta'
import { PasosRuta, RotuloRuta } from './RutaRotulos'

const RADIO_RUTA = 0.32

function Recorrido({ camino, color }: { camino: V3[]; color: string }) {
  const pulso = useRef<Mesh>(null)
  const geometria = useMemo(
    () => geometriaDeTubos(construirTubos([{ puntos: camino, radio: RADIO_RUTA, color: lineal(color), alfa: 1, discontinuo: false }], 8)),
    [camino, color],
  )
  useEffect(() => () => geometria.dispose(), [geometria])
  const material = useMemo(() => crearMaterialFlujo(6, 5), [])
  useEffect(() => () => material.dispose(), [material])
  const acum = useMemo(() => acumuladas(camino), [camino])
  const largo = acum[acum.length - 1] ?? 0

  const trazo = useRef<Mesh>(null)
  useFrame(({ clock }, dt) => {
    avanzar(trazo.current, dt)
    // La esfera recorre el camino a 8 m/s y vuelve a empezar.
    const u = largo > 0 ? ((clock.elapsedTime * 8) / largo) % 1 : 0
    pulso.current?.position.fromArray(puntoEn(camino, u, acum))
  })

  if (camino.length < 2) return null
  return (
    <>
      <mesh ref={trazo} name="ruta-trazo" geometry={geometria} material={material} renderOrder={4} />
      <mesh ref={pulso} name="ruta-pulso" renderOrder={5}>
        <sphereGeometry args={[RADIO_RUTA * 2.4, 16, 12]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <FlechasRuta camino={camino} color={color} radio={RADIO_RUTA} />
    </>
  )
}

export function Ruta({ modelo }: { modelo: ModeloEscena }) {
  const layout = usePlantStore((s) => s.layout)
  const idx = usePlantStore((s) => s.idx)
  const rutaActiva = usePlantStore((s) => s.rutaActiva)
  const piezas = usePlantStore((s) => (s.rutaActiva ? s.live?.rutas?.[s.rutaActiva]?.piezas_turno : undefined))
  const paleta = usePaleta3D()
  const ruta = useMemo(
    () => (rutaActiva && layout && idx ? rutaEscena(layout, idx, modelo, rutaActiva) : null),
    [rutaActiva, layout, idx, modelo],
  )
  if (!ruta) return null
  return (
    <group name="capa-ruta" userData={{ ruta: ruta.id }}>
      <Recorrido camino={ruta.camino} color={paleta.ruta} />
      <PasosRuta pasos={ruta.pasos} color={paleta.ruta} texto={paleta.superficie} />
      <RotuloRuta id={ruta.id} texto={rotuloRuta(ruta, piezas)} color={paleta.ruta} />
    </group>
  )
}
