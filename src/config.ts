// Configuración de la app. Para pasar a datos reales en la Fase 3 basta cambiar `fuenteDatos`.
export const CONFIG = {
  /** 'mock' = simulador determinista. En la Fase 3: 'rest' (webhook de n8n). */
  fuenteDatos: 'mock' as 'mock' | 'rest',
  /** El layout se lee en tiempo de ejecución: editar el JSON no requiere recompilar. */
  layoutUrl: `${import.meta.env.BASE_URL}plant-layout.json`,
  mock: {
    /** Misma semilla = misma secuencia de datos (turno reproducible). */
    semilla: 20261013,
    /** Duración del turno simulado, en minutos. */
    duracionTurnoMin: 480,
    /** Hora local de inicio del turno simulado (HH:MM). */
    inicioTurno: '07:00',
    /** Minutos simulados que avanza cada tick. 2 → un turno de 8 h dura 4 min reales. */
    minutosPorTick: 2,
    intervaloMs: 1000,
  },
  /** Cantidad de lecturas que se guardan para los mini-gráficos. */
  historialMax: 120,
} as const

export type OpcionesMock = typeof CONFIG.mock
