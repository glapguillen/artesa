// Material de los tubos de flujo y de la ruta: color por vértice, guiones que avanzan en el
// sentido del trazo (discontinuos) o pulsos de brillo (sólidos). Un solo material para todos los
// tubos de una capa: un draw call. Sin texturas ni recursos externos.
import { BufferAttribute, BufferGeometry, Color, type Mesh, NormalBlending, ShaderMaterial } from 'three'
import type { V3 } from '../modelo/tipos'
import type { GeometriaTubos } from './trazos'

const VERTEX = /* glsl */ `
attribute vec3 aColor;
attribute float aDist;
attribute vec2 aEstilo;
varying vec3 vColor;
varying float vDist;
varying vec2 vEstilo;
void main() {
  vColor = aColor;
  vDist = aDist;
  vEstilo = aEstilo;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAGMENT = /* glsl */ `
uniform float uTiempo;
uniform float uAtenuar;
uniform float uVelocidad;
uniform float uPeriodo;
varying vec3 vColor;
varying float vDist;
varying vec2 vEstilo;
void main() {
  float f = fract((vDist - uTiempo * uVelocidad) / uPeriodo);
  if (vEstilo.y > 0.5 && f > 0.55) discard;
  float pulso = vEstilo.y > 0.5 ? 0.0 : smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.12, 0.4, f));
  vec3 c = mix(vColor, vec3(1.0), 0.45 * pulso);
  gl_FragColor = vec4(c, vEstilo.x * uAtenuar);
  #include <colorspace_fragment>
}
`

/** Material animado; avanzar `uniforms.uTiempo.value` en useFrame. */
export function crearMaterialFlujo(velocidad = 4, periodo = 3): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uTiempo: { value: 0 },
      uAtenuar: { value: 1 },
      uVelocidad: { value: velocidad },
      uPeriodo: { value: periodo },
    },
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
    toneMapped: false,
  })
}

/** Avanza la animación del material de una malla (en useFrame) y fija su atenuación global. */
export function avanzar(malla: Mesh | null, dt: number, atenuar = 1): void {
  const m = malla?.material
  if (!(m instanceof ShaderMaterial)) return
  const u = m.uniforms
  if (u.uTiempo) u.uTiempo.value += Math.min(dt, 0.1)
  if (u.uAtenuar) u.uAtenuar.value = atenuar
}

/** BufferGeometry a partir de los arreglos de construirTubos. */
export function geometriaDeTubos(g: GeometriaTubos): BufferGeometry {
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(g.posiciones, 3))
  geo.setAttribute('aColor', new BufferAttribute(g.colores, 3))
  geo.setAttribute('aDist', new BufferAttribute(g.distancias, 1))
  geo.setAttribute('aEstilo', new BufferAttribute(g.estilos, 2))
  geo.setIndex(new BufferAttribute(g.indices, 1))
  geo.computeBoundingSphere()
  return geo
}

const tmp = new Color()

/** Color CSS (#rrggbb) en valores lineales [r, g, b] para atributos de vértice. */
export function lineal(css: string): V3 {
  tmp.set(css)
  return [tmp.r, tmp.g, tmp.b]
}

/** Mezcla dos colores CSS (t = 0 → a, 1 → b) y deja el resultado en `out`. */
export function mezclarColor(out: Color, a: string, b: string, t: number): Color {
  return out.set(a).lerp(tmp.set(b), Math.min(1, Math.max(0, t)))
}
