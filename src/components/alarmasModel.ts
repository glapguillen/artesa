// Presentación de alarmas compartida por la cabecera y la barra de KPIs (conteo y colores por nivel).
import type { Alarma, NivelAlarma } from '../domain/live'

/** Del más grave al menos grave. */
export const NIVELES: readonly NivelAlarma[] = ['critica', 'advertencia', 'info']

const COLOR_NIVEL: Record<NivelAlarma, string> = {
  critica: 'var(--c-estado-detenido)',
  advertencia: 'var(--c-estado-espera)',
  info: 'var(--c-seleccion)',
}

export const colorNivel = (n: NivelAlarma) => COLOR_NIVEL[n]

const PLURAL: Record<NivelAlarma, [string, string]> = {
  critica: ['crítica', 'críticas'],
  advertencia: ['advertencia', 'advertencias'],
  info: ['informativa', 'informativas'],
}

export type ConteoAlarmas = Record<NivelAlarma, number>

export function contarAlarmas(alarmas: readonly Alarma[] | null | undefined): ConteoAlarmas {
  const c: ConteoAlarmas = { critica: 0, advertencia: 0, info: 0 }
  for (const a of alarmas ?? []) if (a.nivel in c) c[a.nivel] += 1
  return c
}

/** "1 crítica · 2 advertencias" (solo los niveles presentes); "" si no hay alarmas. */
export function resumenAlarmas(c: ConteoAlarmas): string {
  return NIVELES.filter((n) => c[n] > 0)
    .map((n) => `${c[n]} ${PLURAL[n][c[n] === 1 ? 0 : 1]}`)
    .join(' · ')
}

/** Nivel más grave presente, o null si no hay alarmas. */
export function nivelMaximo(c: ConteoAlarmas): NivelAlarma | null {
  return NIVELES.find((n) => c[n] > 0) ?? null
}
