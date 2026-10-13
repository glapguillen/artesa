// Piso con cuadrícula en metros (celda 1 m, sección 10 m), la envolvente de planta.dimensiones y el
// norte rotulado como supuesto si el layout no lo trae. Colores del tema.
import { Grid, Html, Line } from '@react-three/drei'
import { useMemo } from 'react'
import { Shape } from 'three'
import type { PlantLayout } from '../../../domain/types'
import { CELDA, rectPiso, SECCION } from '../geometriaEscena'
import type { Limites, V3 } from '../modelo/tipos'
import { mezclar } from '../presentacion'
import type { Paleta3D } from '../usePaleta3D'

/** Flecha plana de 6 m que apunta al norte del croquis (−Z). */
const FLECHA = new Shape()
FLECHA.moveTo(0, 6)
FLECHA.lineTo(2.2, 0)
FLECHA.lineTo(0, 1.4)
FLECHA.lineTo(-2.2, 0)
FLECHA.closePath()

interface Props {
  limites: Limites
  planta: PlantLayout['planta']
  paleta: Paleta3D
}

export function Piso({ limites, planta, paleta }: Props) {
  const env = useMemo(
    () => ({ x: planta.origen.x, z: planta.origen.z, w: planta.dimensiones.largo_x, h: planta.dimensiones.ancho_z }),
    [planta],
  )
  const r = useMemo(() => rectPiso(limites, env), [limites, env])
  const contorno = useMemo<V3[]>(() => {
    const y = 0.02
    return [
      [env.x, y, env.z],
      [env.x + env.w, y, env.z],
      [env.x + env.w, y, env.z + env.h],
      [env.x, y, env.z + env.h],
      [env.x, y, env.z],
    ]
  }, [env])
  const norte = planta.norte_grados === null ? 'Norte supuesto' : `Norte a ${planta.norte_grados}°`
  // Esquina noroeste del piso, fuera de lo dibujado; girada si el layout trae el norte.
  const ancla: V3 = [r.cx - r.w / 2 + 5, 0.03, r.cz - r.h / 2 + 9]
  const giro = ((planta.norte_grados ?? 0) * Math.PI) / 180
  return (
    <group name="piso">
      <mesh rotation-x={-Math.PI / 2} position={[r.cx, -0.02, r.cz]}>
        <planeGeometry args={[r.w, r.h]} />
        <meshLambertMaterial color={paleta.fondo} />
      </mesh>
      <Grid
        args={[r.w, r.h]}
        position={[r.cx, 0.004, r.cz]}
        cellSize={CELDA}
        sectionSize={SECCION}
        cellThickness={0.6}
        sectionThickness={1.1}
        cellColor={mezclar(paleta.fondo, paleta.borde, paleta.oscuro ? 0.9 : 1)}
        sectionColor={mezclar(paleta.fondo, paleta.tenue, paleta.oscuro ? 0.28 : 0.4)}
        fadeDistance={limites.tam * 3}
        fadeStrength={1}
      />
      <Line name="envolvente" points={contorno} color={paleta.tenue} lineWidth={1} dashed dashSize={2} gapSize={1.5} />
      <mesh name="flecha-norte" position={ancla} rotation={[-Math.PI / 2, 0, giro]}>
        <shapeGeometry args={[FLECHA]} />
        <meshBasicMaterial color={paleta.tenue} />
      </mesh>
      <Html position={[ancla[0], 0.05, ancla[2] + 3]} center zIndexRange={[12, 10]} className="pointer-events-none">
        <span className="rounded-md border border-borde bg-surface/90 px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-tenue shadow-sm">
          {norte}
        </span>
      </Html>
    </group>
  )
}
