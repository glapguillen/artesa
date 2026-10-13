// Interpreta la respuesta HTTP de plant-layout.json con mensajes en español para el usuario.
export type Lectura = { ok: true; raw: unknown } | { ok: false; error: string }

/** Línea y columna (desde 1) de una posición dentro del texto. */
export function lineaColumna(texto: string, pos: number): { linea: number; columna: number } {
  const antes = texto.slice(0, Math.max(0, Math.min(pos, texto.length)))
  const lineas = antes.split('\n')
  return { linea: lineas.length, columna: (lineas[lineas.length - 1]?.length ?? 0) + 1 }
}

function posicionDelError(e: unknown): number | null {
  const m = e instanceof Error ? /position (\d+)/.exec(e.message) : null
  return m?.[1] ? Number(m[1]) : null
}

export function interpretarRespuesta(url: string, status: number, contentType: string | null, texto: string): Lectura {
  const archivo = url.split('/').pop() || url
  if (status === 404) {
    return { ok: false, error: `No se encontró ${archivo} en el servidor (HTTP 404). Debe estar junto a index.html.` }
  }
  if (status >= 400) return { ok: false, error: `No se pudo leer ${archivo} (HTTP ${status}).` }
  if ((contentType ?? '').includes('text/html') || texto.trimStart().startsWith('<')) {
    return {
      ok: false,
      error: `No se encontró ${archivo}: el servidor devolvió una página HTML en lugar del archivo JSON. Verifique que exista y que el nombre sea correcto.`,
    }
  }
  if (!texto.trim()) return { ok: false, error: `${archivo} está vacío.` }
  try {
    return { ok: true, raw: JSON.parse(texto) as unknown }
  } catch (e) {
    const pos = posicionDelError(e)
    if (pos === null) return { ok: false, error: `${archivo} no es un JSON válido (error de sintaxis).` }
    const { linea, columna } = lineaColumna(texto, pos)
    const cerca = texto.slice(Math.max(0, pos - 30), pos + 10).replace(/\s+/g, ' ').trim()
    return {
      ok: false,
      error: `${archivo} no es un JSON válido: error de sintaxis en la línea ${linea}, columna ${columna}. Revise comas, comillas y llaves cerca de «${cerca}».`,
    }
  }
}
