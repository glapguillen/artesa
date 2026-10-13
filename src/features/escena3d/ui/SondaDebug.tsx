// Sonda de depuración (solo con ?debug): mide draw calls y triángulos de TODO el cuadro (todas las
// pasadas, con gl.info.autoReset = false) y los FPS, y publica window.__artesa3d para los scripts
// de prueba: listo, drawCalls(), triangulos(), fps(), proyectar(id) y camara().
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'
import { ESPESOR_LOSA, puntoLibre } from '../geometriaEscena'
import type { ModeloEscena, V3 } from '../modelo/tipos'
import { useVista3D } from '../useVista3D'

export interface Api3D {
  listo: boolean
  drawCalls: () => number
  triangulos: () => number
  fps: () => number
  /** Coordenadas de ventana (px) de un punto clicable de la zona (o de un equipo), o null si no se ve. */
  proyectar: (id: string) => { x: number; y: number } | null
  camara: () => { pos: V3; objetivo: V3 }
}

declare global {
  interface Window {
    __artesa3d?: Api3D
  }
}

function puntoDe(m: ModeloEscena, id: string): Vector3 | null {
  const losa = m.losas.find((l) => l.id === id)
  if (losa) {
    const [x, z] = puntoLibre(losa, m.equipos)
    return new Vector3(x, ESPESOR_LOSA, z)
  }
  const i = m.equipos.find((e) => e.id === id)
  const p = i?.instancias[0]
  return i && p ? new Vector3(p.pos[0], i.dims.alto * 0.6, p.pos[2]) : null
}

export function SondaDebug({ modelo }: { modelo: ModeloEscena }) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const d = useRef({ calls: 0, tris: 0, fps: 0, cuadros: 0, t0: 0 })
  const api = useRef<Api3D | null>(null)

  useEffect(() => {
    gl.info.autoReset = false
    const datos = d.current
    const a: Api3D = {
      listo: false,
      drawCalls: () => datos.calls,
      triangulos: () => datos.tris,
      fps: () => Math.round(datos.fps),
      proyectar: (id) => {
        const p = puntoDe(modelo, id)
        if (!p) return null
        p.project(camera)
        if (p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) return null
        const r = gl.domElement.getBoundingClientRect()
        return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }
      },
      camara: () => {
        const t = useVista3D.getState().camara?.estado()
        return { pos: [camera.position.x, camera.position.y, camera.position.z], objetivo: t?.objetivo ?? [0, 0, 0] }
      },
    }
    api.current = a
    window.__artesa3d = a
    return () => {
      gl.info.autoReset = true
      if (window.__artesa3d === a) delete window.__artesa3d
      useVista3D.getState().setStats(null)
    }
  }, [gl, camera, modelo])

  useFrame(() => {
    const x = d.current
    // Lo acumulado desde el reinicio anterior = todas las pasadas del cuadro anterior.
    x.calls = gl.info.render.calls
    x.tris = gl.info.render.triangles
    gl.info.reset()
    const ahora = performance.now()
    if (!x.t0) x.t0 = ahora
    x.cuadros++
    if (ahora - x.t0 >= 500) {
      x.fps = (x.cuadros * 1000) / (ahora - x.t0)
      x.cuadros = 0
      x.t0 = ahora
      useVista3D.getState().setStats({ fps: Math.round(x.fps), drawCalls: x.calls, triangulos: x.tris })
    }
    if (api.current && !api.current.listo && x.calls > 0) api.current.listo = true
  })
  return null
}
