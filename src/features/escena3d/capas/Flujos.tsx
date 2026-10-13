// Capa de flujos de material: tubos sobre los arcos elevados del modelo, color de su fase, con
// guiones que avanzan (hipótesis, sin ubicar y venta, más tenues) o pulsos (principales). El grosor
// sigue a piezas/h en vivo, normalizado como en el 2D (caudalRelativo); fino si no hay dato.
// Todos los tubos en una malla, las puntas en otra y las partículas en otra: 3 draw calls.
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Mesh } from 'three'
import { usePlantStore } from '../../../store/usePlantStore'
import { caudalRelativo } from '../../planta/planLive'
import { estiloFlujo, largoPunta, radioFlujo, realceFlujos } from '../capasModelo'
import { avanzar, crearMaterialFlujo, geometriaDeTubos, lineal } from '../formas/materialFlujo'
import { acortarFinal, construirTubos, type Trazo } from '../formas/trazos'
import type { ModeloEscena, V3 } from '../modelo/tipos'
import { usePaleta3D } from '../usePaleta3D'
import { ParticulasFlujo } from './ParticulasFlujo'
import { PuntasFlujo } from './PuntasFlujo'

export interface FlujoVisible {
  id: string
  puntos: V3[]
  radio: number
  color: string
  /** Opacidad final (estilo del tipo × realce por selección). */
  alfa: number
  discontinuo: boolean
  /** Caudal relativo cuantizado en décimos (null = sin dato). */
  rel: number | null
  /** false si la selección lo deja en segundo plano. */
  realzado: boolean
}

const decimos = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(v * 10) / 10)

export function Flujos({ modelo }: { modelo: ModeloEscena }) {
  const paleta = usePaleta3D()
  const live = usePlantStore((s) => s.live)
  const idx = usePlantStore((s) => s.idx)
  const sel = usePlantStore((s) => s.seleccion)
  const rutaActiva = usePlantStore((s) => s.rutaActiva)

  const caudal = useMemo(() => caudalRelativo(modelo.flujos.map((f) => f.id), live), [modelo, live])
  const realce = useMemo(() => realceFlujos(modelo.flujos, idx, sel), [modelo, idx, sel])
  // Firma cuantizada (caudal en décimos y realce): la geometría no se rehace con cada lectura en vivo.
  const firma = JSON.stringify(modelo.flujos.map((f) => [decimos(caudal[f.id]), realce[f.id] ?? 1]))
  const cuantizado = useMemo(() => JSON.parse(firma) as Array<[number | null, number]>, [firma])

  const flujos = useMemo<FlujoVisible[]>(
    () =>
      modelo.flujos.map((f, i) => {
        const est = estiloFlujo(f.tipo)
        const [rel, r] = cuantizado[i] ?? [null, 1]
        return {
          id: f.id,
          puntos: f.puntos,
          radio: radioFlujo(rel),
          color: paleta.fase[f.fase],
          alfa: est.alfa * r,
          discontinuo: est.discontinuo,
          rel,
          realzado: r >= 1,
        }
      }),
    [modelo, cuantizado, paleta],
  )

  const geometria = useMemo(() => {
    const trazos: Trazo[] = flujos.map((f) => ({
      puntos: acortarFinal(f.puntos, largoPunta(f.radio) * 0.9),
      radio: f.radio,
      color: lineal(f.color),
      alfa: f.alfa,
      discontinuo: f.discontinuo,
    }))
    return geometriaDeTubos(construirTubos(trazos, 7))
  }, [flujos])
  useEffect(() => () => geometria.dispose(), [geometria])

  const material = useMemo(() => crearMaterialFlujo(), [])
  useEffect(() => () => material.dispose(), [material])
  // Con una ruta activa los flujos pasan a segundo plano (como en el 2D).
  const atenuar = rutaActiva ? 0.3 : 1
  const tubos = useRef<Mesh>(null)
  useFrame((_, dt) => avanzar(tubos.current, dt, atenuar))

  if (!flujos.length) return null
  return (
    <group name="capa-flujos">
      <mesh ref={tubos} name="flujos-tubos" geometry={geometria} material={material} renderOrder={2} />
      <PuntasFlujo flujos={flujos} fondo={paleta.fondo} atenuar={atenuar} />
      {!rutaActiva && <ParticulasFlujo flujos={flujos} contraste={paleta.texto} />}
    </group>
  )
}
