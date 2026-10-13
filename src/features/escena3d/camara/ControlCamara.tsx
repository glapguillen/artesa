// Cámara orbital con límites (CameraControls de drei): encuadre general al montar, vuelo suave a
// la selección hecha desde cualquier vista y API para los botones, el teclado y el recorrido.
// Gestos: 1 dedo gira, 2 dedos acercan y desplazan; ratón: izquierdo gira, derecho desplaza, rueda acerca.
import { CameraControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { Box3, type PerspectiveCamera, Vector3 } from 'three'
import { usePlantStore } from '../../../store/usePlantStore'
import { cajaObjetivo } from '../geometriaEscena'
import { encuadreCenital, encuadreGeneral } from '../modelo/camara'
import type { Encuadre, ModeloEscena } from '../modelo/tipos'
import { destinoDeSeleccion } from '../presentacion'
import { type ApiCamara, useVista3D } from '../useVista3D'
import { ajustarEncuadre, type Caja3, cajaPlanta } from './ajuste'
import { useTour } from './estadoTour'

/** Inclinación máxima: 85° desde la vertical, para no pasar bajo el piso. */
const MAX_POLAR = (85 * Math.PI) / 180
const DISTANCIA_MIN = 5
const FACTOR_DISTANCIA_MAX = 2.2
/** Aire alrededor de lo encuadrado: poco para la planta entera, más para ver el entorno de una zona. */
const MARGEN_PLANTA = 1.04
const MARGEN_DETALLE = 1.35

const destinoActual = (m: ModeloEscena) => {
  const s = usePlantStore.getState()
  return destinoDeSeleccion(m, s.idx, s.seleccion)
}

export function ControlCamara({ modelo }: { modelo: ModeloEscena }) {
  const ref = useRef<CameraControls>(null)
  const idx = usePlantStore((s) => s.idx)
  const clave = usePlantStore((s) => (s.seleccion ? `${s.seleccion.tipo}:${s.seleccion.id}` : ''))
  const restaurar = useVista3D((s) => s.restaurar)
  const camara = useThree((s) => s.camera) as PerspectiveCamera
  const { width, height } = useThree((s) => s.size)
  const { limites } = modelo
  const dMax = limites.tam * FACTOR_DISTANCIA_MAX

  const ir = useCallback((e: Encuadre, suave: boolean) => {
    void ref.current?.setLookAt(...e.posicion, ...e.objetivo, suave)
  }, [])
  // Campo de visión y proporción actuales, leídos al encuadrar: cambiar el tamaño del lienzo no
  // mueve la cámara del usuario, solo afecta al próximo encuadre.
  const medida = useRef({ fov: 45, aspecto: 1 })
  useLayoutEffect(() => {
    medida.current = { fov: camara.fov, aspecto: width / Math.max(1, height) }
  }, [camara, width, height])
  /** Encuadre con la distancia ajustada para que la caja quepa en el lienzo actual. */
  const encajar = useCallback(
    (e: Encuadre, caja: Caja3 | null, margen: number, suave: boolean) => {
      const { fov, aspecto } = medida.current
      ir(caja ? ajustarEncuadre(e, caja, fov, aspecto, margen, DISTANCIA_MIN, dMax) : e, suave)
    },
    [ir, dMax],
  )
  const planta = useCallback(
    (e: Encuadre, suave: boolean) => encajar(e, cajaPlanta(limites), MARGEN_PLANTA, suave),
    [encajar, limites],
  )

  // Límites del desplazamiento y encuadre inicial (también si se recarga el layout).
  useLayoutEffect(() => {
    const c = ref.current
    if (!c) return
    const b = cajaObjetivo(limites)
    c.setBoundary(new Box3(new Vector3(...b.min), new Vector3(...b.max)))
    planta(encuadreGeneral(limites), false)
  }, [limites, planta])

  // Vuelo a la selección hecha en cualquier vista (salvo que haya que restaurar un encuadre).
  useEffect(() => {
    if (useVista3D.getState().restaurar) return
    const d = destinoActual(modelo)
    if (d?.tipo === 'escena') encajar(d.encuadre, d.caja, MARGEN_DETALLE, true)
  }, [clave, modelo, idx, encajar])

  useEffect(() => {
    if (!restaurar) return
    ir(restaurar, true)
    useVista3D.getState().setRestaurar(null)
  }, [restaurar, ir])

  useEffect(() => {
    const vista: ApiCamara['vista'] = (v) => {
      if (v === 'general') planta(encuadreGeneral(limites), true)
      else if (v === 'cenital') planta(encuadreCenital(limites), true)
      else {
        const d = destinoActual(modelo)
        if (d?.tipo === 'escena') encajar(d.encuadre, d.caja, MARGEN_DETALLE, true)
      }
    }
    const api: ApiCamara = {
      ir,
      vista,
      estado: (fin = false) => {
        const c = ref.current
        if (!c) return encuadreGeneral(limites)
        const p = c.getPosition(new Vector3(), fin)
        const t = c.getTarget(new Vector3(), fin)
        return { posicion: [p.x, p.y, p.z], objetivo: [t.x, t.y, t.z] }
      },
      accion: (a) => {
        const c = ref.current
        if (!c) return
        if (a.tipo === 'vista') vista(a.vista)
        else if (a.tipo === 'rotar') void c.rotate(a.az, a.pol, true)
        else if (a.tipo === 'zoom') void c.dolly(c.distance * 0.25 * a.dir, true)
        else {
          const paso = Math.max(2, c.distance * 0.08)
          void c.truck(a.dx * paso, 0, true)
          void c.forward(a.dz * paso, true)
        }
      },
    }
    useVista3D.getState().setCamara(api)
    return () => useVista3D.getState().setCamara(null)
  }, [ir, encajar, planta, limites, modelo])

  // Si el usuario mueve la cámara, el recorrido se detiene (sin restaurar: manda el usuario).
  const alInteractuar = useCallback(() => useTour.getState().detener(false), [])

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={DISTANCIA_MIN}
      maxDistance={dMax}
      maxPolarAngle={MAX_POLAR}
      smoothTime={0.6}
      draggingSmoothTime={0.12}
      dollyToCursor
      onControlStart={alInteractuar}
    />
  )
}
