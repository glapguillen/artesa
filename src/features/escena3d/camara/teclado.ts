// Navegación de la escena con teclado (puro): tecla → acción de cámara.
// Flechas: girar e inclinar; Mayús + flechas: desplazar; + y −: acercar y alejar; Inicio o 0: vista general.
import type { AccionCamara } from '../useVista3D'

/** Paso de giro (15°) e inclinación (10°) por pulsación. */
export const GIRO = Math.PI / 12
export const INCLINACION = Math.PI / 18

export const AYUDA_TECLADO =
  'Flechas: girar e inclinar · Mayús + flechas: desplazar · + y −: acercar y alejar · Inicio: vista general'

export function accionDeTecla(tecla: string, mayus: boolean): AccionCamara | null {
  switch (tecla) {
    case 'ArrowLeft':
      return mayus ? { tipo: 'desplazar', dx: -1, dz: 0 } : { tipo: 'rotar', az: GIRO, pol: 0 }
    case 'ArrowRight':
      return mayus ? { tipo: 'desplazar', dx: 1, dz: 0 } : { tipo: 'rotar', az: -GIRO, pol: 0 }
    case 'ArrowUp':
      return mayus ? { tipo: 'desplazar', dx: 0, dz: 1 } : { tipo: 'rotar', az: 0, pol: -INCLINACION }
    case 'ArrowDown':
      return mayus ? { tipo: 'desplazar', dx: 0, dz: -1 } : { tipo: 'rotar', az: 0, pol: INCLINACION }
    case '+':
    case '=':
      return { tipo: 'zoom', dir: 1 }
    case '-':
    case '_':
      return { tipo: 'zoom', dir: -1 }
    case 'Home':
    case '0':
      return { tipo: 'vista', vista: 'general' }
    default:
      return null
  }
}
