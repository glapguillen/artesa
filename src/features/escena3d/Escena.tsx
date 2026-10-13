// Lienzo R3F de la planta: luces locales (sin HDRI ni sombras dinámicas), piso, muros en corte,
// losas, etiquetas y las capas de contenido (equipos, flujos, ruta, alarmas). Fondo transparente:
// el color lo pone la tarjeta. Sin trabajo oculto: con la escena fuera de vista no se dibuja.
import { Canvas, type RootState } from '@react-three/fiber'
import { useCallback } from 'react'
import { CONFIG } from '../../config'
import type { PlantLayout } from '../../domain/types'
import { ControlCamara } from './camara/ControlCamara'
import { Alarmas } from './capas/Alarmas'
import { Equipos } from './capas/Equipos'
import { Etiquetas } from './capas/Etiquetas'
import { Flujos } from './capas/Flujos'
import { Losas } from './capas/Losas'
import { Muros } from './capas/Muros'
import { Piso } from './capas/Piso'
import { Ruta } from './capas/Ruta'
import { encuadreGeneral } from './modelo/camara'
import type { ModeloEscena } from './modelo/tipos'
import { SondaDebug } from './ui/SondaDebug'
import { usePaleta3D } from './usePaleta3D'
import { useVista3D } from './useVista3D'

/** Luces blancas neutras: el color de cada objeto lo da la paleta del tema, no la luz. */
const LUZ_CIELO = '#ffffff'
const LUZ_SUELO = '#a8a29a'

interface Props {
  modelo: ModeloEscena
  planta: PlantLayout['planta']
  visible: boolean
  descripcionId: string
}

export function Escena({ modelo, planta, visible, descripcionId }: Props) {
  const paleta = usePaleta3D()
  const etiquetas = useVista3D((s) => s.etiquetas)
  const muros = useVista3D((s) => s.muros)
  const flujos = useVista3D((s) => s.flujos)
  const inicial = encuadreGeneral(modelo.limites)

  const alCrear = useCallback(
    ({ gl }: RootState) => {
      const c = gl.domElement
      c.setAttribute('role', 'img')
      c.setAttribute('aria-label', 'Vista 3D de la planta generada desde el layout')
      c.setAttribute('aria-describedby', descripcionId)
    },
    [descripcionId],
  )

  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={visible ? 'always' : 'never'}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ fov: 45, near: 0.5, far: modelo.limites.tam * 8, position: inicial.posicion }}
      onCreated={alCrear}
    >
      {/* Iluminación local: cielo/suelo + un sol suave. La suma ≈ π deja las caras superiores con su color. */}
      <hemisphereLight args={[LUZ_CIELO, LUZ_SUELO, 1.9]} />
      <directionalLight position={[35, 100, 50]} intensity={1.45} />
      <ControlCamara modelo={modelo} />
      <Piso limites={modelo.limites} planta={planta} paleta={paleta} />
      {muros && <Muros muros={modelo.muros} paleta={paleta} />}
      <Losas modelo={modelo} paleta={paleta} />
      <Equipos modelo={modelo} />
      {flujos && <Flujos modelo={modelo} />}
      <Ruta modelo={modelo} />
      <Alarmas modelo={modelo} />
      <Etiquetas modelo={modelo} todas={etiquetas} />
      {CONFIG.debug && <SondaDebug modelo={modelo} />}
    </Canvas>
  )
}
