// Sonda de depuración (solo con ?debug): mide draw calls y triángulos de TODO el cuadro (todas las
// pasadas, con gl.info.autoReset = false) y los FPS, y publica window.__artesa3d para los scripts
// de prueba: listo, drawCalls(), triangulos(), fps(), proyectar(id) y camara().
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { type Camera, type Object3D, Raycaster, Vector2, Vector3 } from 'three'
import { ESPESOR_LOSA, puntosLibres } from '../geometriaEscena'
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

const rayo = new Raycaster()

interface Contexto {
  modelo: ModeloEscena
  camara: Camera
  lienzo: HTMLCanvasElement
  /** Objetos con manejadores de eventos (los mismos que considera R3F al hacer clic). */
  interactivos: Object3D[]
}

/** NDC → coordenadas de ventana, si el punto se ve y lo que hay encima en la página es el lienzo. */
function aVentana(c: Contexto, p: Vector3): { x: number; y: number } | null {
  if (p.z > 1 || Math.abs(p.x) > 0.98 || Math.abs(p.y) > 0.98) return null
  const r = c.lienzo.getBoundingClientRect()
  const v = { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }
  return document.elementFromPoint(v.x, v.y) === c.lienzo ? v : null
}

/**
 * Punto de clic de una zona: el primer punto libre de equipos cuyo rayo desde la cámara toca
 * primero esa misma losa (no un equipo delante) y que no queda bajo un control superpuesto.
 * Para un equipo, el centro de su primera instancia.
 */
function proyectar(c: Contexto, id: string): { x: number; y: number } | null {
  const losa = c.modelo.losas.find((l) => l.id === id)
  if (losa) {
    for (const [x, z] of puntosLibres(losa, c.modelo.equipos)) {
      const p = new Vector3(x, ESPESOR_LOSA, z).project(c.camara)
      rayo.setFromCamera(new Vector2(p.x, p.y), c.camara)
      const hit = rayo.intersectObjects(c.interactivos, false)[0]
      const caras = hit?.object.userData.caras as string[] | undefined
      if (!hit || hit.faceIndex === undefined || hit.faceIndex === null || caras?.[hit.faceIndex] !== id) continue
      const v = aVentana(c, p)
      if (v) return v
    }
    return null
  }
  const e = c.modelo.equipos.find((q) => q.id === id)
  const i = e?.instancias[0]
  return e && i ? aVentana(c, new Vector3(i.pos[0], e.dims.alto * 0.6, i.pos[2]).project(c.camara)) : null
}

export function SondaDebug({ modelo }: { modelo: ModeloEscena }) {
  const get = useThree((s) => s.get)
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const d = useRef({ calls: 0, tris: 0, fps: 0, cuadros: 0, t0: 0 })
  const api = useRef<Api3D | null>(null)

  useEffect(() => {
    // Sin reinicio automático: el contador suma todas las pasadas del cuadro hasta el reset de abajo.
    get().gl.info.autoReset = false
    const datos = d.current
    const a: Api3D = {
      listo: false,
      drawCalls: () => datos.calls,
      triangulos: () => datos.tris,
      fps: () => Math.round(datos.fps),
      proyectar: (id) => proyectar({ modelo, camara: camera, lienzo: gl.domElement, interactivos: get().internal.interaction }, id),
      camara: () => {
        const t = useVista3D.getState().camara?.estado()
        return { pos: [camera.position.x, camera.position.y, camera.position.z], objetivo: t?.objetivo ?? [0, 0, 0] }
      },
    }
    api.current = a
    window.__artesa3d = a
    return () => {
      get().gl.info.autoReset = true
      if (window.__artesa3d === a) delete window.__artesa3d
      useVista3D.getState().setStats(null)
    }
  }, [get, gl, camera, modelo])

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
