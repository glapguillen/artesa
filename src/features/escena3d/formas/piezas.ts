// Primitivas paramétricas de los equipos (puro, sin three.js). Cada forma se arma con 1 a 6
// piezas (cajas y cilindros) a escala de las dimensiones del modelo. Las piezas de TODOS los
// equipos se dibujan en 3 mallas instanciadas (cajas, cilindros y franjas de calor), así que
// sumar piezas no suma draw calls.
import type { Equipo3D, FormaEquipo, V3 } from '../modelo/tipos'

/** 'cilindroX' es un cilindro acostado sobre el eje largo (X local) del equipo. */
export type GeomPieza = 'caja' | 'cilindro' | 'cilindroX'
/** cuerpo = color del estado; estructura = gris neutro; calor = franja que brilla con la temperatura. */
export type RolPieza = 'cuerpo' | 'estructura' | 'calor'
/** Malla instanciada donde va cada pieza. */
export type MallaPieza = 'caja' | 'cilindro' | 'calor'

export interface Pieza {
  geom: GeomPieza
  rol: RolPieza
  /** Centro de la pieza relativo al centro de la base del equipo (m, ejes locales). */
  centro: V3
  /** Tamaño [x (largo), y (alto), z (ancho)] en metros. */
  tam: V3
}

interface Dims {
  largo: number
  ancho: number
  alto: number
}

const caja = (rol: RolPieza, centro: V3, tam: V3): Pieza => ({ geom: 'caja', rol, centro, tam })
const GROSOR = 0.06

/** Cuatro patas o postes en las esquinas de un rectángulo L × W. */
function esquinas(L: number, W: number, alto: number, y: number): Pieza[] {
  const dx = L / 2 - GROSOR
  const dz = W / 2 - GROSOR
  return [-1, 1].flatMap((sx) => [-1, 1].map((sz) => caja('estructura', [sx * dx, y, sz * dz], [GROSOR, alto, GROSOR])))
}

const FORMAS: Record<FormaEquipo, (d: Dims) => Pieza[]> = {
  // Cuerpo largo + boca de carga más alta en un extremo + franja de calor a lo largo.
  horno: ({ largo: L, ancho: W, alto: H }) => {
    const b = Math.min(1.6, L * 0.15)
    return [
      caja('estructura', [-L / 2 + b / 2, H / 2, 0], [b, H, W * 1.1]),
      caja('cuerpo', [b / 2, H * 0.42, 0], [L - b, H * 0.84, W]),
      caja('calor', [b / 2, H * 0.55, 0], [(L - b) * 0.96, H * 0.14, W * 1.06]),
    ]
  },
  // Tambor horizontal sobre una base.
  molino: ({ largo: L, ancho: W, alto: H }) => {
    const d = Math.min(W * 0.9, H * 0.7)
    return [
      caja('estructura', [0, H * 0.15, 0], [L * 0.9, H * 0.3, W * 0.85]),
      { geom: 'cilindroX', rol: 'cuerpo', centro: [0, H * 0.3 + d / 2, 0], tam: [L * 0.8, d, d] },
    ]
  },
  // Bastidor (dos cabezales) + paquete de placas.
  filtro_prensa: ({ largo: L, ancho: W, alto: H }) => {
    const c = Math.min(0.3, L * 0.1)
    return [
      caja('estructura', [-L / 2 + c / 2, H / 2, 0], [c, H, W]),
      caja('estructura', [L / 2 - c / 2, H / 2, 0], [c, H, W]),
      caja('cuerpo', [0, H * 0.55, 0], [L - 2 * c, H * 0.7, W * 0.8]),
    ]
  },
  // Base + cilindro de extrusión + tolva.
  extrusora: ({ largo: L, ancho: W, alto: H }) => {
    const d = Math.min(W * 0.7, H * 0.4)
    const yCil = H * 0.35 + d / 2
    const tolva = Math.max(0.2, H - (H * 0.35 + d))
    return [
      caja('estructura', [0, H * 0.175, 0], [L * 0.9, H * 0.35, W * 0.8]),
      { geom: 'cilindroX', rol: 'cuerpo', centro: [L * 0.08, yCil, 0], tam: [L * 0.75, d, d] },
      caja('cuerpo', [-L * 0.32, H - tolva / 2, 0], [Math.min(0.8, L * 0.25), tolva, W * 0.6]),
    ]
  },
  // Cuerpo de impresión atravesado por la cinta.
  kerajet: ({ largo: L, ancho: W, alto: H }) => [
    caja('estructura', [0, H * 0.42, 0], [L, H * 0.06, W * 0.55]),
    caja('cuerpo', [0, H / 2, 0], [L * 0.4, H, W]),
  ],
  // Caja con marco: base, cuatro postes y techo.
  impresora_3d: ({ largo: L, ancho: W, alto: H }) => [
    caja('cuerpo', [0, H * 0.15, 0], [L, H * 0.3, W]),
    ...esquinas(L, W, H * 0.7 - GROSOR, H * 0.3 + (H * 0.7 - GROSOR) / 2),
    caja('estructura', [0, H - GROSOR / 2, 0], [L, GROSOR, W]),
  ],
  // Cabina con boca de trabajo al frente y extractor arriba.
  esmaltadora: ({ largo: L, ancho: W, alto: H }) => {
    const d = Math.min(L, W) * 0.35
    return [
      caja('cuerpo', [0, H * 0.45, 0], [L, H * 0.9, W]),
      caja('estructura', [0, H * 0.45, W / 2 + GROSOR / 2], [L * 0.55, H * 0.5, GROSOR]),
      { geom: 'cilindro', rol: 'estructura', centro: [0, H * 0.95, 0], tam: [d, H * 0.1, d] },
    ]
  },
  // Tablero + cuatro patas.
  mesa: ({ largo: L, ancho: W, alto: H }) => [
    caja('cuerpo', [0, H - GROSOR / 2, 0], [L, GROSOR, W]),
    ...esquinas(L, W, H - GROSOR, (H - GROSOR) / 2),
  ],
  // Dos laterales + cuatro bandejas.
  rack: ({ largo: L, ancho: W, alto: H }) => [
    caja('estructura', [-L / 2 + GROSOR / 2, H / 2, 0], [GROSOR, H, W]),
    caja('estructura', [L / 2 - GROSOR / 2, H / 2, 0], [GROSOR, H, W]),
    ...[0.12, 0.38, 0.64, 0.9].map((f) => caja('cuerpo', [0, H * f, 0], [L - 2 * GROSOR, 0.04, W * 0.95])),
  ],
  puesto_formacion: ({ largo: L, ancho: W, alto: H }) => [
    caja('estructura', [0, H * 0.425, 0], [L, H * 0.85, W]),
    caja('cuerpo', [0, H * 0.925, 0], [L, H * 0.15, W]),
  ],
  generico: ({ largo: L, ancho: W, alto: H }) => [caja('cuerpo', [0, H / 2, 0], [L, H, W])],
}

export function piezasDeForma(forma: FormaEquipo, d: Dims): Pieza[] {
  return (FORMAS[forma] ?? FORMAS.generico)(d)
}

export function mallaDePieza(p: Pieza): MallaPieza {
  if (p.rol === 'calor') return 'calor'
  return p.geom === 'caja' ? 'caja' : 'cilindro'
}

/** Una pieza de una instancia ya ubicada en la planta. */
export interface PiezaUbicada {
  equipoId: string
  rol: RolPieza
  pos: V3
  rotY: number
  /** Cilindro acostado: se gira 90° sobre Z antes de rotar en Y. */
  girarZ: boolean
  /** Escala de la geometría unitaria (caja 1×1×1; cilindro de diámetro 1 y alto 1). */
  escala: V3
}

/** Rotación sobre Y con la misma convención que three.js (Matrix4.makeRotationY). */
export function rotarY([x, y, z]: V3, a: number): V3 {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return [c * x + s * z, y, -s * x + c * z]
}

export type PiezasPorMalla = Record<MallaPieza, PiezaUbicada[]>

/**
 * Todas las piezas de todas las instancias, agrupadas por malla instanciada. El índice de cada
 * pieza en su lista es su instanceId: así un clic devuelve el equipo sin buscar nada más.
 */
export function piezasPorMalla(equipos: readonly Equipo3D[]): PiezasPorMalla {
  const out: PiezasPorMalla = { caja: [], cilindro: [], calor: [] }
  for (const e of equipos) {
    const piezas = piezasDeForma(e.forma, e.dims)
    for (const inst of e.instancias) {
      for (const p of piezas) {
        const [dx, dy, dz] = rotarY(p.centro, inst.rotY)
        const girarZ = p.geom === 'cilindroX'
        out[mallaDePieza(p)].push({
          equipoId: e.id,
          rol: p.rol,
          pos: [inst.pos[0] + dx, inst.pos[1] + dy, inst.pos[2] + dz],
          rotY: inst.rotY,
          girarZ,
          escala: girarZ ? [p.tam[1], p.tam[0], p.tam[2]] : p.tam,
        })
      }
    }
  }
  return out
}

/** Equipos agrupados por forma (para la leyenda y las pruebas de conteo). */
export function instanciasPorForma(equipos: readonly Equipo3D[]): Map<FormaEquipo, number> {
  const out = new Map<FormaEquipo, number>()
  for (const e of equipos) out.set(e.forma, (out.get(e.forma) ?? 0) + e.instancias.length)
  return out
}

/** Caja envolvente de una instancia (para el contorno de selección y el rombo de "representativo"). */
export function envolventes(e: Equipo3D, holgura = 0.25): Array<{ pos: V3; rotY: number; escala: V3 }> {
  const { largo, ancho, alto } = e.dims
  return e.instancias.map((i) => ({
    pos: [i.pos[0], i.pos[1] + alto / 2, i.pos[2]],
    rotY: i.rotY,
    escala: [largo + 2 * holgura, alto + holgura, ancho + 2 * holgura],
  }))
}

/** Punto sobre el equipo (centro de sus instancias, por encima del más alto) para marcas y balizas. */
export function cimaDeEquipo(e: Equipo3D, sobre = 0.9): V3 | null {
  if (!e.instancias.length) return null
  let x = 0
  let z = 0
  for (const i of e.instancias) {
    x += i.pos[0]
    z += i.pos[2]
  }
  return [x / e.instancias.length, e.dims.alto + sobre, z / e.instancias.length]
}
