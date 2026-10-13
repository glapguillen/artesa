// Detección de WebGL 2 (three.js r163+ lo exige). Se prueba una sola vez por carga de página y el
// contexto de prueba se libera enseguida, para no acercarse al límite de contextos del navegador.
let cache: boolean | null = null

export function soportaWebGL2(): boolean {
  if (cache !== null) return cache
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    cache = !!gl
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    cache = false
  }
  return cache
}
