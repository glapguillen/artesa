import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CONFIG } from '../../config'
import type { LiveState } from '../../domain/live'
import type { PlantLayout } from '../../domain/types'
import { validarLayout } from '../../domain/validate'
import { inicioDeTurnoHoy, MockDataSource } from './MockDataSource'
import { PARAM } from './parametros'
import { simularEstado, type OpcionesSimulacion } from './simulador'

const json = readFileSync(new URL('../../../public/plant-layout.json', import.meta.url), 'utf-8')
const validado = validarLayout(JSON.parse(json))
if (!validado.ok) throw new Error(validado.errores.join('\n'))
const layout: PlantLayout = validado.layout
const INICIO = '2026-10-13T12:00:00.000Z'
const OPC: OpcionesSimulacion = { semilla: 20261013, duracionTurnoMin: 480, inicioTurnoISO: INICIO, ciclo: 1 }
const sim = (m: number, o: Partial<OpcionesSimulacion> = {}): LiveState => simularEstado(layout, m, { ...OPC, ...o })
const KPIS_PCT = ['rend_bizcocho', 'clasif_final', 'cc_formacion', 'oee_horno']
const ordenados = (xs: Iterable<string>) => [...xs].sort()

/** Todos los números del estado, con su ruta (para mensajes legibles). */
function numeros(v: unknown, ruta = '', out: Array<[string, number]> = []): Array<[string, number]> {
  if (typeof v === 'number') out.push([ruta, v])
  else if (Array.isArray(v)) v.forEach((x, i) => numeros(x, `${ruta}[${i}]`, out))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) numeros(x, `${ruta}.${k}`, out)
  return out
}

describe('simularEstado', () => {
  it('es determinista: mismas entradas, mismo resultado', () => {
    expect(sim(137)).toEqual(sim(137))
    expect(JSON.stringify(sim(311))).toBe(JSON.stringify(sim(311)))
  })

  it('otra semilla u otro ciclo cambian los valores', () => {
    expect(sim(137, { semilla: 1 }).kpis).not.toEqual(sim(137).kpis)
    const ciclo2 = sim(137, { ciclo: 2 })
    expect(ciclo2.turno.id).toBe('T2')
    expect(ciclo2.etapas).not.toEqual(sim(137).etapas)
  })

  it('no usa Math.random ni Date.now', () => {
    const azar = vi.spyOn(Math, 'random')
    const ahora = vi.spyOn(Date, 'now')
    sim(240)
    expect(azar).not.toHaveBeenCalled()
    expect(ahora).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('arma el turno y el timestamp desde inicioTurnoISO', () => {
    const s = sim(137)
    expect(s.fuente).toBe('mock')
    expect(s.timestamp).toBe('2026-10-13T14:17:00.000Z')
    const fin = '2026-10-13T20:00:00.000Z'
    expect(s.turno).toEqual({ id: 'T1', nombre: 'Turno simulado', inicio: INICIO, fin, progreso: 137 / 480 })
    expect(s.zonas).toEqual({})
    expect(sim(9999).turno.progreso).toBe(1)
    expect(sim(-5).turno.progreso).toBe(0)
  })

  it('cubre todas las etapas salvo V; N0 llega como "sin datos"', () => {
    const s = sim(100)
    const esperadas = layout.proceso.etapas.map((e) => e.codigo).filter((c) => c !== 'V')
    expect(ordenados(Object.keys(s.etapas))).toEqual(ordenados(esperadas))
    expect(s.etapas.V).toBeUndefined()
    expect(s.etapas.N0).toEqual({ estado: 'sin_datos', wip: null, piezas_h: null, merma_pct: null })
  })

  it('cubre todos los equipos, flujos, KPIs y rutas', () => {
    const s = sim(100)
    expect(ordenados(Object.keys(s.equipos))).toEqual(ordenados(layout.equipos.map((e) => e.id)))
    for (const eq of layout.equipos) {
      const m = s.equipos[eq.id]?.metricas ?? {}
      const claves = eq.tipo.startsWith('horno') ? ['temp_c', 'temp_objetivo_c', 'gas_m3_h', 'carga_pct'] : ['piezas_h']
      for (const k of claves) expect(m[k], `${eq.id}.${k}`).toBeTypeOf('number')
    }
    expect(ordenados(Object.keys(s.flujos))).toEqual(ordenados(layout.flujos.map((f) => f.id)))
    for (const [id, f] of Object.entries(s.flujos)) expect(f.piezas_h, id).toBeTypeOf('number')
    expect(ordenados(Object.keys(s.kpis))).toEqual(ordenados(layout.kpis.map((k) => k.id)))
    for (const [id, k] of Object.entries(s.kpis)) {
      expect(k.valor, id).toBeTypeOf('number')
      expect(k.unidad, id).toBeTypeOf('string')
    }
    const rutas = [...layout.proceso.rutas_decoracion, ...layout.proceso.rutas_formacion].map((r) => r.id)
    expect(rutas).toEqual(expect.arrayContaining(['R1', 'R9', 'RF1', 'RF7']))
    expect(ordenados(Object.keys(s.rutas))).toEqual(ordenados(rutas))
    const { bizcocho, final } = s.clasificaciones
    expect(ordenados([...Object.keys(bizcocho), ...Object.keys(final)])).toEqual(
      ordenados(['buena', 'mala', 'ok_falta_calcomania', 'tipo_a', 'tipo_b', 'tipo_c', 'desecho', 'recuperable']),
    )
    expect(ordenados(Object.keys(s.kpis.wip_piscinas?.detalle ?? {}))).toEqual(['1.4', '1.6', '2.6', '3.2'])
  })

  it('los acumulados del turno no decrecen', () => {
    let previo = sim(0)
    for (let m = 6; m <= 480; m += 6) {
      const s = sim(m)
      for (const g of ['bizcocho', 'final'] as const)
        for (const [k, v] of Object.entries(s.clasificaciones[g]))
          expect(v, `${g}.${k} en ${m}`).toBeGreaterThanOrEqual(previo.clasificaciones[g][k] ?? 0)
      for (const [id, r] of Object.entries(s.rutas))
        expect(r.piezas_turno, id).toBeGreaterThanOrEqual(previo.rutas[id]?.piezas_turno ?? 0)
      for (const k of ['prod_turno', 'baja_pasta', 'consumo_esmaltes']) {
        expect(s.kpis[k]?.valor, `${k} en ${m}`).toBeGreaterThanOrEqual(previo.kpis[k]?.valor ?? 0)
      }
      previo = s
    }
    expect(previo.kpis.prod_turno?.valor).toBeGreaterThan(0)
  })

  it('los hornos arrancan en espera y operan desde el minuto 45', () => {
    const [s10, s100] = [sim(10), sim(100)]
    for (const id of ['horno-01', 'horno-02', '1.5', '3.1']) {
      expect((s10.equipos[id] ?? s10.etapas[id])?.estado, id).toBe('espera')
      expect((s100.equipos[id] ?? s100.etapas[id])?.estado, id).toBe('operando')
    }
    for (const h of [s10.equipos['horno-01'], s10.equipos['horno-02']]) {
      expect(h?.metricas.temp_c ?? 0).toBeLessThan(h?.metricas.temp_objetivo_c ?? 0)
    }
    expect(sim(40).etapas['1.4']?.wip ?? 0).toBeGreaterThan(sim(0).etapas['1.4']?.wip ?? 0)
  })

  it('alarma crítica de temperatura en horno-01 entre los minutos 210 y 240', () => {
    const s = sim(220)
    const criticas = s.alarmas.filter((a) => a.nivel === 'critica')
    expect(criticas).toHaveLength(1)
    expect(criticas[0]?.ref).toEqual({ tipo: 'equipo', id: 'horno-01' })
    expect(criticas[0]?.desde).toBe('2026-10-13T15:30:00.000Z')
    expect(s.alarmas[0]?.nivel).toBe('critica')
    const h = s.equipos['horno-01']
    expect(h?.estado).toBe('detenido')
    expect(Math.abs((h?.metricas.temp_c ?? 0) - (h?.metricas.temp_objetivo_c ?? 0))).toBeGreaterThan(25)
    expect(s.etapas['3.1']?.estado).toBe('detenido')
    expect(sim(238).etapas['2.6']?.wip ?? 0).toBeGreaterThan(sim(212).etapas['2.6']?.wip ?? 0)
    for (const m of [200, 250]) expect(sim(m).alarmas.some((a) => a.nivel === 'critica'), `minuto ${m}`).toBe(false)
    expect(sim(250).equipos['horno-01']?.estado).toBe('operando')
  })

  it('cambio de esmalte (mantenimiento) entre los minutos 300 y 330', () => {
    const s = sim(310)
    expect(s.etapas['2.4']?.estado).toBe('mantenimiento')
    expect(s.equipos['esmaltado-maquinas']?.estado).toBe('mantenimiento')
    const aviso = s.alarmas.find((a) => a.nivel === 'advertencia')
    expect(aviso?.ref).toEqual({ tipo: 'etapa', id: '2.4' })
    expect(sim(340).alarmas.some((a) => a.nivel === 'advertencia')).toBe(false)
  })

  it('en el almuerzo las etapas manuales quedan en espera', () => {
    const [s285, s250] = [sim(285), sim(250)]
    for (const c of ['1.3', '2.1', '2.2', '2.3']) {
      expect(s285.etapas[c]?.estado, c).toBe('espera')
      expect(s250.etapas[c]?.estado, c).toBe('operando')
    }
  })

  it('marca en espera una piscina con WIP alto', () => {
    const s = sim(45)
    const altas = Object.entries(PARAM.umbralWipAlto).filter(([c, u]) => (s.etapas[c]?.wip ?? 0) > u)
    expect(altas.length).toBeGreaterThan(0)
    for (const [c] of altas) expect(s.etapas[c]?.estado, c).toBe('espera')
    expect(s.alarmas.some((a) => a.nivel === 'info' && a.ref?.tipo === 'etapa')).toBe(true)
  })

  it('todos los números son finitos y ≥ 0; los porcentajes, entre 0 y 100', () => {
    for (const m of [0, 10, 45, 100, 220, 285, 310, 480]) {
      const s = sim(m)
      for (const [ruta, v] of numeros(s)) {
        expect(Number.isFinite(v), `${ruta} en ${m}`).toBe(true)
        expect(v, `${ruta} en ${m}`).toBeGreaterThanOrEqual(0)
      }
      for (const id of KPIS_PCT) {
        const k = s.kpis[id]
        for (const v of [k?.valor ?? 0, ...Object.values(k?.detalle ?? {})]) {
          expect(v, `${id} en ${m}`).toBeGreaterThanOrEqual(0)
          expect(v, `${id} en ${m}`).toBeLessThanOrEqual(100)
        }
      }
      const mix = Object.values(s.kpis.clasif_final?.detalle ?? {}).reduce((a, b) => a + b, 0)
      expect(mix, `clasif_final en ${m}`).toBeCloseTo(100, 0)
    }
  })
})

describe('MockDataSource', () => {
  afterEach(() => vi.useRealTimers())
  const { intervaloMs, minutosPorTick, duracionTurnoMin } = CONFIG.mock
  const inicioHoy = () => new Date(2026, 9, 13, 7, 0).toISOString()

  it('calcula el inicio del turno de hoy a la hora configurada', () => {
    const hoy = new Date(2026, 9, 13, 15, 42)
    expect(inicioDeTurnoHoy('07:00', hoy)).toBe(inicioHoy())
    expect(inicioDeTurnoHoy('no-es-hora', hoy)).toBe(inicioHoy())
  })

  it('emite el minuto 0 al iniciar, avanza con el temporizador y deja de emitir tras stop', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 13, 9, 30))
    const fuente = new MockDataSource(layout, CONFIG.mock)
    expect([fuente.id, fuente.simulado]).toEqual(['mock', true])
    const estados: LiveState[] = []
    fuente.start((s) => estados.push(s), (e) => { throw e })
    expect(estados).toHaveLength(1)
    expect(estados[0]?.turno.progreso).toBe(0)
    expect(estados[0]?.timestamp).toBe(inicioHoy())
    vi.advanceTimersByTime(intervaloMs * 3)
    expect(estados).toHaveLength(4)
    expect(estados[3]?.turno.progreso).toBeCloseTo((3 * minutosPorTick) / duracionTurnoMin)
    fuente.stop()
    vi.advanceTimersByTime(intervaloMs * 5)
    expect(estados).toHaveLength(4)
  })

  it('tolera start → stop → start (StrictMode) sin duplicar el temporizador', () => {
    vi.useFakeTimers()
    const fuente = new MockDataSource(layout, CONFIG.mock)
    let n = 0
    const contar = () => void n++
    fuente.start(contar, () => {})
    fuente.stop()
    fuente.start(contar, () => {})
    fuente.start(contar, () => {})
    expect(n).toBe(3)
    vi.advanceTimersByTime(intervaloMs * 2)
    expect(n).toBe(5)
    fuente.stop()
  })

  it('al terminar el turno empieza otro con ciclo + 1', () => {
    vi.useFakeTimers()
    const fuente = new MockDataSource(layout, CONFIG.mock)
    const estados: LiveState[] = []
    fuente.start((s) => estados.push(s), () => {})
    const ticks = Math.floor(duracionTurnoMin / minutosPorTick) + 1
    vi.advanceTimersByTime(intervaloMs * ticks)
    fuente.stop()
    const [penultimo, ultimo] = estados.slice(-2)
    expect(penultimo?.turno.id).toBe('T1')
    expect(penultimo?.turno.progreso).toBe(1)
    expect(ultimo?.turno.id).toBe('T2')
    expect(ultimo?.turno.progreso).toBe(0)
    expect(ultimo?.turno.inicio).toBe(penultimo?.turno.fin)
  })
})
