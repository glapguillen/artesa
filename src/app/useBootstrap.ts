// Carga el layout (fetch + validación zod) y arranca la fuente de datos.
import { useEffect, useState } from 'react'
import { CONFIG } from '../config'
import { createDataSource } from '../data/createDataSource'
import { validarLayout } from '../domain/validate'
import { usePlantStore } from '../store/usePlantStore'

export type EstadoCarga = { fase: 'cargando' } | { fase: 'error'; errores: string[] } | { fase: 'listo' }

export function useBootstrap(): EstadoCarga {
  const [estado, setEstado] = useState<EstadoCarga>({ fase: 'cargando' })
  const layout = usePlantStore((s) => s.layout)

  useEffect(() => {
    let cancelado = false
    fetch(CONFIG.layoutUrl, { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(`No se pudo leer ${CONFIG.layoutUrl} (HTTP ${r.status}).`)
        return r.json() as Promise<unknown>
      })
      .then((raw) => {
        if (cancelado) return
        const res = validarLayout(raw)
        if (!res.ok) return setEstado({ fase: 'error', errores: res.errores })
        for (const a of res.avisos) console.warn('[plant-layout]', a)
        usePlantStore.getState().setLayout(res.layout, res.avisos)
        setEstado({ fase: 'listo' })
      })
      .catch((e: unknown) => {
        if (!cancelado) setEstado({ fase: 'error', errores: [e instanceof Error ? e.message : String(e)] })
      })
    return () => {
      cancelado = true
    }
  }, [])

  useEffect(() => {
    if (!layout) return
    const { recibirEstado, setErrorFuente } = usePlantStore.getState()
    let fuente
    try {
      fuente = createDataSource(layout)
    } catch (e) {
      setErrorFuente(e instanceof Error ? e.message : String(e))
      return
    }
    const simulado = fuente.simulado
    fuente.start(
      (s) => recibirEstado(s, simulado),
      (e) => setErrorFuente(e.message),
    )
    return () => fuente.stop()
  }, [layout])

  return estado
}
