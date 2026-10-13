// Carga el layout (fetch + validación zod) y arranca la fuente de datos.
import { useEffect, useState } from 'react'
import { CONFIG } from '../config'
import { createDataSource } from '../data/createDataSource'
import { validarLayout } from '../domain/validate'
import { usePlantStore } from '../store/usePlantStore'
import { interpretarRespuesta } from './cargarLayout'

export type EstadoCarga = { fase: 'cargando' } | { fase: 'error'; errores: string[] } | { fase: 'listo' }

export function useBootstrap(): EstadoCarga {
  const [estado, setEstado] = useState<EstadoCarga>({ fase: 'cargando' })
  const layout = usePlantStore((s) => s.layout)

  useEffect(() => {
    let cancelado = false
    fetch(CONFIG.layoutUrl, { cache: 'no-store' })
      .then(async (r) => interpretarRespuesta(CONFIG.layoutUrl, r.status, r.headers.get('content-type'), await r.text()))
      .then((lectura) => {
        if (cancelado) return
        if (!lectura.ok) return setEstado({ fase: 'error', errores: [lectura.error] })
        const res = validarLayout(lectura.raw)
        if (!res.ok) return setEstado({ fase: 'error', errores: res.errores })
        for (const a of res.avisos) console.warn('[plant-layout]', a)
        usePlantStore.getState().setLayout(res.layout, res.avisos)
        setEstado({ fase: 'listo' })
      })
      .catch((e: unknown) => {
        const detalle = e instanceof Error ? e.message : String(e)
        if (!cancelado) setEstado({ fase: 'error', errores: [`No se pudo conectar para leer el layout (${detalle}).`] })
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
