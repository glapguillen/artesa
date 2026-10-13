// Curvas suaves y guion del turno simulado (qué pasa en cada minuto). Todo es determinista.
import type { EstadoOperativo } from '../../domain/live'

export const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t
/** Smoothstep en [0, 1]. */
export const suavizado = (t: number): number => {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}
/** Nunca negativo (y sin -0). */
export const noNeg = (v: number): number => (v > 0 && Number.isFinite(v) ? v : 0)
/** Porcentaje 0..100; 0 si no hay base. */
export const pct = (parte: number, total: number): number => (total > 0 ? clamp((parte / total) * 100, 0, 100) : 0)
export const redondear = (v: number, decimales = 0): number => {
  const f = 10 ** decimales
  return noNeg(Math.round(v * f) / f)
}

export interface Intervalo {
  /** Minuto de inicio (incluido). */
  inicio: number
  /** Minuto de fin (excluido). */
  fin: number
}

export const enIntervalo = (m: number, iv: Intervalo): boolean => m >= iv.inicio && m < iv.fin

/**
 * Guion del turno simulado (minutos desde el inicio del turno, intervalos [inicio, fin)):
 * - 0–45: los hornos arrancan ('espera'); la piscina de pulido (1.4) acumula WIP.
 * - 210–240: alarma CRÍTICA en horno-01 (temperatura fuera de rango): horno y etapa 3.1 'detenido';
 *   crece el WIP de la piscina de esmaltado (2.6). Desde 240 se recupera.
 * - 270–300: almuerzo; las etapas manuales quedan en 'espera'.
 * - 300–330: cambio de esmalte en esmaltado-maquinas ('mantenimiento' de la etapa 2.4).
 * Si el turno dura menos, los eventos que caen fuera simplemente no ocurren.
 */
export const HISTORIA = {
  arranqueHornos: { inicio: 0, fin: 45 },
  alarmaHorno: { inicio: 210, fin: 240, equipo: 'horno-01', etapa: '3.1' },
  almuerzo: { inicio: 270, fin: 300, etapas: ['1.3', '2.1', '2.2', '2.3'] as readonly string[] },
  cambioEsmalte: { inicio: 300, fin: 330, equipo: 'esmaltado-maquinas', etapa: '2.4' },
} as const

/** Rango aceptable de temperatura alrededor del objetivo (°C), solo para el guion. */
export const RANGO_TEMP_C = 25

/** Estado de un horno (por su etapa de quema) en el minuto m. */
export function estadoHorno(etapa: string, m: number, etapaAlarma: string): EstadoOperativo {
  if (enIntervalo(m, HISTORIA.arranqueHornos)) return 'espera'
  if (etapa === etapaAlarma && enIntervalo(m, HISTORIA.alarmaHorno)) return 'detenido'
  return 'operando'
}

/**
 * Temperatura simulada de un horno (°C). Arranque: sube hacia el objetivo con smoothstep.
 * Alarma: cae fuera del rango; al terminar vuelve al objetivo en ~20 min (ya dentro del rango).
 * `r` es un ruido suave en [-1, 1].
 */
export function temperaturaHorno(objetivo: number, m: number, conAlarma: boolean, r: number): number {
  const arr = HISTORIA.arranqueHornos
  const al = HISTORIA.alarmaHorno
  let t = enIntervalo(m, arr)
    ? lerp(objetivo * 0.4, objetivo - 10, suavizado((m - arr.inicio + 1) / (arr.fin - arr.inicio))) + 4 * r
    : objetivo + 6 * r
  if (conAlarma && enIntervalo(m, al)) t -= 150 * (0.35 + 0.65 * suavizado((m - al.inicio) / 8))
  else if (conAlarma && m >= al.fin) t -= 15 * (1 - suavizado((m - al.fin) / 20))
  return noNeg(t)
}

/** Factor de consumo de gas de un horno según su estado (arranque consume más; detenido, casi nada). */
export function factorGas(estado: EstadoOperativo): number {
  if (estado === 'espera') return 1.35
  if (estado === 'detenido') return 0.3
  return 1
}
