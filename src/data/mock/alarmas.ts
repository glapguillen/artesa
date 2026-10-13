// Alarmas del guion del turno: horno fuera de rango (crítica), cambio de esmalte (advertencia)
// y piscinas con WIP alto (información). Se ordenan por gravedad y antigüedad.
import type { Alarma, NivelAlarma } from '../../domain/live'
import type { PlantLayout } from '../../domain/types'
import type { Ctx } from './contexto'
import { enIntervalo, HISTORIA, redondear } from './curvas'
import { lecturaHorno } from './equipos'
import type { Sim } from './modelo'
import { PARAM } from './parametros'

const GRAVEDAD: Record<NivelAlarma, number> = { critica: 0, advertencia: 1, info: 2 }

export function construirAlarmas(
  l: PlantLayout,
  ctx: Ctx,
  sim: Sim,
  m: number,
  isoEn: (minuto: number) => string,
): Alarma[] {
  const out: Alarma[] = []
  const nombreEquipo = (id: string) => l.equipos.find((e) => e.id === id)?.nombre ?? id
  const nombreEtapa = (c: string) => l.proceso.etapas.find((e) => e.codigo === c)?.nombre_corto ?? c

  const al = HISTORIA.alarmaHorno
  const horno = ctx.hornos.find((h) => h.etapa === ctx.etapaAlarmaHorno)
  if (enIntervalo(m, al) && horno) {
    const { temp_c, temp_objetivo_c } = lecturaHorno(ctx, sim, horno, m).metricas
    out.push({
      id: `alarma-${al.equipo}-temperatura`,
      nivel: 'critica',
      mensaje:
        `${nombreEquipo(al.equipo)}: temperatura fuera de rango ` +
        `(${temp_c} °C; objetivo ${temp_objetivo_c} °C). Horno detenido.`,
      ref: { tipo: 'equipo', id: al.equipo },
      desde: isoEn(al.inicio),
    })
  }

  const ce = HISTORIA.cambioEsmalte
  if (enIntervalo(m, ce)) {
    out.push({
      id: `aviso-${ce.equipo}-cambio-esmalte`,
      nivel: 'advertencia',
      mensaje:
        `${nombreEtapa(ctx.etapaMantenimiento)}: cambio de esmalte en ` +
        `${nombreEquipo(ce.equipo)} (mantenimiento programado).`,
      ref: { tipo: 'etapa', id: ctx.etapaMantenimiento },
      desde: isoEn(ce.inicio),
    })
  }

  for (const [codigo, desde] of Object.entries(sim.wipAltoDesde)) {
    const umbral = PARAM.umbralWipAlto[codigo] ?? 0
    out.push({
      id: `info-wip-alto-${codigo}`,
      nivel: 'info',
      mensaje: `${nombreEtapa(codigo)}: WIP alto (${redondear(sim.q[codigo] ?? 0)} pzs; umbral ${umbral} pzs).`,
      ref: { tipo: 'etapa', id: codigo },
      desde: isoEn(desde),
    })
  }

  return out.sort(
    (a, b) => GRAVEDAD[a.nivel] - GRAVEDAD[b.nivel] || a.desde.localeCompare(b.desde) || a.id.localeCompare(b.id),
  )
}
