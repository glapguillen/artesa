// PRNG determinista del simulador: mulberry32 sembrado con un hash de (semilla, clave, minuto).
// No guarda estado entre llamadas: el mismo trío siempre da el mismo número.
// Aquí no se usa Math.random ni el reloj: así el turno simulado es reproducible.

const FNV_BASE = 0x811c9dc5
const FNV_PRIMO = 0x01000193

/** Hash FNV-1a de 32 bits de un texto. */
function hashTexto(texto: string, h0 = FNV_BASE): number {
  let h = h0
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, FNV_PRIMO)
  }
  return h >>> 0
}

/** Mezcla dos enteros de 32 bits (finalizador de murmur3). */
function mezclar(a: number, b: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ b
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b)
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35)
  return (h ^ (h >>> 16)) >>> 0
}

/** Hash de 32 bits de una lista de partes (texto o número). */
export function hash32(...partes: ReadonlyArray<string | number>): number {
  let h = FNV_BASE
  for (const p of partes) h = mezclar(hashTexto(String(p), h), 0x2f)
  return h >>> 0
}

/** Generador mulberry32: devuelve una función que produce uniformes en [0, 1). */
export function mulberry32(semilla: number): () => number {
  let a = semilla >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Las claves se repiten miles de veces por turno: se memoriza su hash (memoización pura).
const cacheClaves = new Map<string, number>()
function hashClave(clave: string): number {
  let h = cacheClaves.get(clave)
  if (h === undefined) {
    h = hashTexto(clave)
    cacheClaves.set(clave, h)
  }
  return h
}

/** Uniforme en [0, 1) para (semilla, clave, minuto entero). */
export function azar(semilla: number, clave: string, minuto: number): number {
  const semillaLocal = mezclar(mezclar(semilla >>> 0, hashClave(clave)), Math.floor(minuto) | 0)
  return mulberry32(semillaLocal)()
}

/** Uniforme en [-1, 1). */
export function ruido(semilla: number, clave: string, minuto: number): number {
  return azar(semilla, clave, minuto) * 2 - 1
}

/**
 * Ruido suave en [-1, 1]: un valor al azar cada `periodo` minutos, interpolado con smoothstep.
 * Sirve para que las tasas varíen como en una planta real (sin saltos de un minuto a otro).
 */
export function ruidoSuave(semilla: number, clave: string, minuto: number, periodo: number): number {
  const p = Math.max(1, Math.floor(periodo))
  const k = Math.floor(minuto / p)
  const t = minuto / p - k
  const a = ruido(semilla, `~${clave}`, k)
  const b = ruido(semilla, `~${clave}`, k + 1)
  const s = t * t * (3 - 2 * t)
  return a + (b - a) * s
}
