// Tarjetas propias de la barra que no son KPIs de negocio: alarmas activas y dotación de personal.
import { colorNivel, contarAlarmas, NIVELES, nivelMaximo } from '../../components/alarmasModel'
import { usePlantStore } from '../../store/usePlantStore'
import { fmtNum, NIVEL_ALARMA_ETIQUETA } from '../../ui/tokens'
import { conteoPersonal } from './kpiModel'
import { KpiTile } from './KpiTile'

export function AlarmasTile() {
  const alarmas = usePlantStore((s) => s.live?.alarmas)
  const c = contarAlarmas(alarmas)
  const max = nivelMaximo(c)
  return (
    <KpiTile
      id="alarmas"
      nombre="Alarmas activas"
      valor={alarmas ? fmtNum(alarmas.length) : null}
      colorValor={max === 'critica' ? colorNivel('critica') : undefined}
      meta={
        alarmas ? (
          <span className="flex gap-2">
            {NIVELES.map((n) => (
              <span key={n} className="inline-flex items-center gap-1" title={NIVEL_ALARMA_ETIQUETA[n]}>
                <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: colorNivel(n) }} />
                <span className="sr-only">{NIVEL_ALARMA_ETIQUETA[n]}:</span>
                <span className="tabular-nums">{c[n]}</span>
              </span>
            ))}
          </span>
        ) : (
          'Sin datos de la fuente'
        )
      }
    />
  )
}

export function PersonalTile() {
  const personal = usePlantStore((s) => s.layout?.personal)
  const conteo = personal ? conteoPersonal(personal) : null
  return (
    <KpiTile
      id="personal"
      nombre="Personal"
      ayuda={personal?.nota}
      valor={conteo ? `${fmtNum(conteo.total)} personas` : null}
      meta={conteo ? `${fmtNum(conteo.produccion)} en Producción · nómina` : 'Sin dotación en el layout'}
    />
  )
}
