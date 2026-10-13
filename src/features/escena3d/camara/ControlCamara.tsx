// Cámara orbital con límites (CameraControls de drei): encuadre general al montar, vuelo suave a
// la selección hecha desde cualquier vista y API para los botones, el teclado y el recorrido.
// Gestos: 1 dedo gira, 2 dedos acercan y desplazan; ratón: izquierdo gira, derecho desplaza, rueda acerca.
import { CameraControls } from '@react-three/drei'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { Box3, Vector3 } from 'three'
import { usePlantStore } from '../../../store/usePlantStore'
import { cajaObjetivo } from '../geometriaEscena'
import { encuadreCenital, encuadreGeneral } from '../modelo/camara'
import type { Encuadre, ModeloEscena } from '../modelo/tipos'
import { destinoDeSeleccion } from '../presentacion'
import { type ApiCamara, useVista3D } from '../useVista3D'
import { useTour } from './estadoTour'

/** Inclinación máxima: 85° desde la vertical, para no pasar bajo el piso. */
const MAX_POLAR = (85 * Math.PI) / 180
const DISTANCIA_MIN = 5
const FACTOR_DISTANCIA_MAX = 2.2

const destinoActual = (m: ModeloEscena) => {
  const s = usePlantStore.getState()
  return destinoDeSeleccion(m, s.idx, s.seleccion)
}

export function ControlCamara({ modelo }: { modelo: ModeloEscena }) {
  const ref = useRef<CameraControls>(null)
  const idx = usePlantStore((s) => s.idx)
  const clave = usePlantStore((s) => (s.seleccion ? `${s.seleccion.tipo}:${s.seleccion.id}` : ''))
  const restaurar = useVista3D((s) => s.restaurar)
  const { limites } = modelo

  const ir = useCallback((e: Encuadre, suave: boolean) => {
    void ref.current?.setLookAt(...e.posicion, ...e.objetivo, suave)
  }, [])

  // Límites del desplazamiento y encuadre inicial (también si se recarga el layout).
  useLayoutEffect(() => {
    const c = ref.current
    if (!c) return
    const b = cajaObjetivo(limites)
    c.setBoundary(new Box3(new Vector3(...b.min), new Vector3(...b.max)))
    ir(encuadreGeneral(limites), false)
  }, [limites, ir])

  // Vuelo a la selección hecha en cualquier vista (salvo que haya que restaurar un encuadre).
  useEffect(() => {
    if (useVista3D.getState().restaurar) return
    const d = destinoActual(modelo)
    if (d?.tipo === 'escena') ir(d.encuadre, true)
  }, [clave, modelo, idx, ir])

  useEffect(() => {
    if (!restaurar) return
    ir(restaurar, true)
    useVista3D.getState().setRestaurar(null)
  }, [restaurar, ir])

  useEffect(() => {
    const vista: ApiCamara['vista'] = (v) => {
      if (v === 'general') ir(encuadreGeneral(limites), true)
      else if (v === 'cenital') ir(encuadreCenital(limites), true)
      else {
        const d = destinoActual(modelo)
        if (d?.tipo === 'escena') ir(d.encuadre, true)
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
  }, [ir, limites, modelo])

  // Si el usuario mueve la cámara, el recorrido se detiene (sin restaurar: manda el usuario).
  const alInteractuar = useCallback(() => useTour.getState().detener(false), [])

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minDistance={DISTANCIA_MIN}
      maxDistance={limites.tam * FACTOR_DISTANCIA_MAX}
      maxPolarAngle={MAX_POLAR}
      smoothTime={0.6}
      draggingSmoothTime={0.12}
      dollyToCursor
      onControlStart={alInteractuar}
    />
  )
}
