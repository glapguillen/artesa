// Valida plant-layout.json: forma (zod) + integridad referencial (ids y códigos que existen).
import { z } from 'zod'
import { PlantLayoutSchema } from './schema'
import type { PlantLayout } from './types'

export type ResultadoValidacion =
  | { ok: true; layout: PlantLayout; avisos: string[] }
  | { ok: false; errores: string[] }

function duplicados(ids: string[]): string[] {
  const vistos = new Set<string>()
  const repetidos = new Set<string>()
  for (const id of ids) (vistos.has(id) ? repetidos : vistos).add(id)
  return [...repetidos]
}

export function validarLayout(raw: unknown): ResultadoValidacion {
  const parsed = PlantLayoutSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, errores: z.prettifyError(parsed.error).split('\n').filter(Boolean) }
  }
  const l = parsed.data
  const errores: string[] = []
  const avisos: string[] = []

  const zonas = new Set(l.zonas.map((z) => z.id))
  const etapas = new Set(l.proceso.etapas.map((e) => e.codigo))
  const edificios = new Set(l.edificios.map((e) => e.id))
  const rutas = new Set(l.proceso.rutas_decoracion.map((r) => r.id))

  const unicos: Array<[string, string[]]> = [
    ['zonas', l.zonas.map((z) => z.id)],
    ['etapas', l.proceso.etapas.map((e) => e.codigo)],
    ['equipos', l.equipos.map((e) => e.id)],
    ['accesos', l.accesos.map((a) => a.id)],
    ['flujos', l.flujos.map((f) => f.id)],
    ['edificios', l.edificios.map((e) => e.id)],
    ['kpis', l.kpis.map((k) => k.id)],
    ['personal.dotacion', l.personal.dotacion.map((d) => d.id)],
  ]
  for (const [lista, ids] of unicos) {
    for (const id of duplicados(ids)) errores.push(`${lista}: el id "${id}" está repetido.`)
  }

  const zona = (donde: string, id: string) => {
    if (!zonas.has(id)) errores.push(`${donde}: la zona "${id}" no existe en zonas[].`)
  }
  const etapa = (donde: string, cod: string) => {
    if (!etapas.has(cod)) errores.push(`${donde}: la etapa "${cod}" no existe en proceso.etapas[].`)
  }

  for (const z of l.zonas) {
    if (z.edificio && !edificios.has(z.edificio)) errores.push(`zona ${z.id}: el edificio "${z.edificio}" no existe.`)
    for (const c of [...z.etapas, ...z.etapas_hipotesis]) etapa(`zona ${z.id}`, c)
  }
  for (const a of l.accesos) zona(`acceso ${a.id}`, a.zona)
  for (const e of l.equipos) {
    zona(`equipo ${e.id}`, e.zona)
    etapa(`equipo ${e.id}`, e.etapa)
  }
  for (const f of l.flujos) {
    zona(`flujo ${f.id}`, f.desde)
    zona(`flujo ${f.id}`, f.hasta)
    for (const r of f.rutas ?? []) {
      if (!rutas.has(r) && !l.proceso.rutas_formacion.some((rf) => rf.id === r)) {
        errores.push(`flujo ${f.id}: la ruta "${r}" no existe.`)
      }
    }
  }
  for (const t of l.proceso.transiciones) {
    etapa(`transición ${t.desde}→${t.hasta}`, t.desde)
    etapa(`transición ${t.desde}→${t.hasta}`, t.hasta)
  }
  for (const r of l.proceso.rutas_decoracion) {
    for (const c of [...r.pasos, r.siguiente]) etapa(`ruta ${r.id}`, c)
  }
  for (const r of l.proceso.rutas_formacion) for (const c of r.pasos) etapa(`ruta ${r.id}`, c)
  for (const [cod, resultados] of Object.entries(l.proceso.clasificaciones)) {
    etapa('clasificaciones', cod)
    for (const res of resultados) {
      etapa(`clasificación ${cod}/${res.resultado}`, res.destino)
      for (const c of res.luego ?? []) etapa(`clasificación ${cod}/${res.resultado}`, c)
    }
  }
  for (const cod of Object.keys(l.proceso.diagrama.celdas)) etapa('proceso.diagrama.celdas', cod)
  for (const e of l.proceso.etapas) {
    if (!l.proceso.diagrama.celdas[e.codigo]) avisos.push(`La etapa ${e.codigo} no tiene celda en el diagrama; se ubicará al final.`)
  }
  for (const d of l.personal.dotacion) {
    for (const c of d.etapas) etapa(`personal ${d.id}`, c)
    for (const z of [...d.zonas, ...d.zonas_hipotesis]) zona(`personal ${d.id}`, z)
  }
  const suma = l.personal.dotacion.reduce((s, d) => s + d.cantidad, 0)
  if (suma !== l.personal.total) avisos.push(`personal.total (${l.personal.total}) no coincide con la suma de la dotación (${suma}).`)

  return errores.length ? { ok: false, errores } : { ok: true, layout: l, avisos }
}
