// Ajuste de texto e insignias dentro del rectángulo de una zona, en píxeles de pantalla.
// Puro: el ancho de los caracteres se estima (no se mide en el DOM), con margen conservador.

export interface OpcionesTexto {
  maxPx: number
  minPx: number
  /** Ancho medio de un carácter en "em". */
  factor?: number
  interlinea?: number
  maxLineas?: number
}

export interface TextoAjustado {
  lineas: string[]
  tam: number
  truncado: boolean
}

const FACTOR = 0.6
const INTERLINEA = 1.15

export const anchoTexto = (t: string, tam: number, factor = FACTOR) => t.length * tam * factor

/** Corte de líneas por palabras. Con `forzar`, parte las palabras largas; si no, devuelve null. */
export function partirLineas(texto: string, maxChars: number, forzar = false): string[] | null {
  if (maxChars < 1) return null
  const lineas: string[] = []
  let actual = ''
  for (let p of texto.split(/\s+/).filter(Boolean)) {
    if (p.length > maxChars) {
      if (!forzar) return null
      if (actual) lineas.push(actual)
      actual = ''
      while (p.length > maxChars) {
        lineas.push(p.slice(0, maxChars))
        p = p.slice(maxChars)
      }
    }
    if (!actual) actual = p
    else if (actual.length + 1 + p.length <= maxChars) actual += ` ${p}`
    else {
      lineas.push(actual)
      actual = p
    }
  }
  if (actual) lineas.push(actual)
  return lineas
}

/**
 * Mayor tamaño de letra (de maxPx a minPx, en pasos de 0,5) con el que el texto cabe en
 * ancho × alto con saltos de línea. Si no cabe ni al mínimo, recorta con "…"; si ni así, null.
 */
export function ajustarTexto(texto: string, ancho: number, alto: number, o: OpcionesTexto): TextoAjustado | null {
  const factor = o.factor ?? FACTOR
  const interlinea = o.interlinea ?? INTERLINEA
  const maxLineas = o.maxLineas ?? 4
  if (!texto.trim() || ancho <= 0 || alto <= 0) return null
  for (let tam = o.maxPx; tam >= o.minPx - 1e-9; tam -= 0.5) {
    const lineas = partirLineas(texto, Math.floor(ancho / (tam * factor)))
    if (lineas && lineas.length <= maxLineas && lineas.length * tam * interlinea <= alto) {
      return { lineas, tam, truncado: false }
    }
  }
  const maxChars = Math.floor(ancho / (o.minPx * factor))
  const n = Math.min(maxLineas, Math.floor(alto / (o.minPx * interlinea)))
  if (maxChars < 4 || n < 1) return null
  const todas = partirLineas(texto, maxChars, true) ?? []
  const lineas = todas.slice(0, n)
  if (todas.length > n) {
    const ultima = lineas[n - 1] ?? ''
    lineas[n - 1] = `${ultima.slice(0, maxChars - 1).trimEnd()}…`
  }
  return { lineas, tam: o.minPx, truncado: todas.length > n }
}

/** Elemento de una fila de insignias (píldora de etapa, personas…). */
export interface ItemInsignia {
  ancho: number
}

export const ALTO_INSIGNIA = 14
const SEP = 3
const PAD = 4
const SEP_BLOQUE = 4

/** Reparte los elementos en filas de a lo sumo `ancho`; null si alguno no cabe solo. */
export function fluirFilas<T extends ItemInsignia>(items: T[], ancho: number): T[][] | null {
  const filas: T[][] = []
  let fila: T[] = []
  let usado = 0
  for (const it of items) {
    if (it.ancho > ancho) return null
    const extra = fila.length ? SEP + it.ancho : it.ancho
    if (usado + extra > ancho) {
      filas.push(fila)
      fila = [it]
      usado = it.ancho
    } else {
      fila.push(it)
      usado += extra
    }
  }
  if (fila.length) filas.push(fila)
  return filas
}

export interface Disposicion<T> {
  /** Centro (cx, cy) del bloque del nombre respecto del centro del rectángulo. */
  nombre: (TextoAjustado & { rotado: boolean; cy: number }) | null
  /** Centro de cada insignia respecto del centro del rectángulo. */
  insignias: Array<{ item: T; x: number; y: number }>
}

const OPC_NOMBRE: OpcionesTexto = { maxPx: 14, minPx: 9 }

function ajustarNombre(nombre: string, w: number, h: number) {
  const horizontal = ajustarTexto(nombre, w, h, OPC_NOMBRE)
  if (horizontal && !horizontal.truncado) return { ...horizontal, rotado: false }
  // En zonas altas y angostas el nombre puede ir vertical.
  const vertical = h > w * 1.3 ? ajustarTexto(nombre, h, w, { ...OPC_NOMBRE, maxLineas: 2 }) : null
  if (vertical && (!vertical.truncado || !horizontal)) return { ...vertical, rotado: true }
  return horizontal ? { ...horizontal, rotado: false } : null
}

/**
 * Coloca el nombre (arriba) y las insignias (abajo, en filas) en una caja de `caja` píxeles.
 * Prioridad: nombre completo con insignias; nombre completo solo; nombre recortado con insignias;
 * solo insignias; nombre recortado solo. Al acercar el zoom aparece el resto.
 */
export function disponerEtiqueta<T extends ItemInsignia>(caja: { w: number; h: number }, nombre: string, items: T[]): Disposicion<T> {
  const w = caja.w - 2 * PAD
  const h = caja.h - 2 * PAD
  if (w <= 0 || h <= 0) return { nombre: null, insignias: [] }
  const filas = items.length ? fluirFilas(items, w) : []
  const altoIns = filas?.length ? filas.length * ALTO_INSIGNIA + (filas.length - 1) * SEP : 0
  const caben = altoIns > 0 && altoIns <= h

  const conAmbos = caben && altoIns + SEP_BLOQUE < h ? ajustarNombre(nombre, w, h - altoIns - SEP_BLOQUE) : null
  const soloNombre = ajustarNombre(nombre, w, h)
  let n: ReturnType<typeof ajustarNombre> = null
  let conInsignias = false
  if (conAmbos && !conAmbos.truncado) [n, conInsignias] = [conAmbos, true]
  else if (soloNombre && !soloNombre.truncado) n = soloNombre
  else if (conAmbos) [n, conInsignias] = [conAmbos, true]
  else if (caben) conInsignias = true
  else n = soloNombre

  const altoNombre = n ? bloqueAlto(n) : 0
  const total = altoNombre + (conInsignias ? altoIns + (n ? SEP_BLOQUE : 0) : 0)
  let y = -total / 2
  const salida: Disposicion<T> = { nombre: n ? { ...n, cy: y + altoNombre / 2 } : null, insignias: [] }
  if (!conInsignias || !filas) return salida
  y += altoNombre + (n ? SEP_BLOQUE : 0)
  for (const fila of filas) {
    const anchoFila = fila.reduce((s, it) => s + it.ancho, 0) + SEP * (fila.length - 1)
    let x = -anchoFila / 2
    for (const it of fila) {
      salida.insignias.push({ item: it, x: x + it.ancho / 2, y: y + ALTO_INSIGNIA / 2 })
      x += it.ancho + SEP
    }
    y += ALTO_INSIGNIA + SEP
  }
  return salida
}

/** Alto en pantalla del bloque del nombre (si va rotado, es el largo de la línea más larga). */
function bloqueAlto(n: TextoAjustado & { rotado: boolean }): number {
  if (!n.rotado) return n.lineas.length * n.tam * INTERLINEA
  return Math.max(...n.lineas.map((l) => anchoTexto(l, n.tam)))
}
