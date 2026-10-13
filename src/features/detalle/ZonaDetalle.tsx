// Detalle de una zona: ficha del croquis, medidas aproximadas, estado en vivo, etapas,
// equipos, personal, alarmas, fotos y notas.
import { estadoDeZona } from '../../domain/selectors'
import type { Zona } from '../../domain/types'
import { usePlantStore } from '../../store/usePlantStore'
import { fmtNum } from '../../ui/tokens'
import { alarmasDeSeleccion, medidasZona } from './detalleModel'
import { CONFIANZA, etiquetaGrupo, etiquetaTipoZona, PRECISION } from './etiquetas'
import { SeccionAlarmas, SeccionEquipos, SeccionPersonal } from './listas'
import { ChipEstado, Datos, Fila, PctVivo, Seccion, Texto, ValorVivo } from './piezas'
import { EtapasDeZona, FotosYNotas } from './ZonaSecciones'

function Aprox() {
  return <span className="text-tenue"> aprox.</span>
}

function ChipGrupo({ zona }: { zona: Zona }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-borde px-2 py-0.5 text-xs text-texto">
      <span
        aria-hidden="true"
        className="inline-block size-3 shrink-0 rounded-sm border border-borde"
        style={{ background: zona.color, opacity: 'var(--zona-opacidad)' }}
      />
      Grupo: {etiquetaGrupo(zona.grupo)}
    </span>
  )
}

function Ficha({ zona }: { zona: Zona }) {
  const edificio = usePlantStore((s) => s.layout?.edificios.find((e) => e.id === zona.edificio))
  const m = medidasZona(zona.poligono)
  return (
    <Seccion titulo="Ficha">
      <Datos>
        <Fila etiqueta="Rótulo del croquis">
          {zona.rotulo_croquis ? `«${zona.rotulo_croquis}»` : <span className="text-tenue">Sin rótulo en el croquis</span>}
        </Fila>
        <Fila etiqueta="Tipo">{etiquetaTipoZona(zona.tipo)}</Fila>
        <Fila etiqueta="Recinto">{zona.recinto_cerrado ? 'Cerrado' : 'Abierto'}</Fila>
        <Fila etiqueta="Edificio">{edificio?.nombre ?? <Texto v={zona.edificio} />}</Fila>
        {m ? (
          <>
            <Fila etiqueta="Ancho × largo">
              <span className="tabular-nums">
                {fmtNum(m.ancho, 1)} × {fmtNum(m.largo, 1)} m
              </span>
              <Aprox />
            </Fila>
            <Fila etiqueta="Área">
              <span className="tabular-nums">{fmtNum(m.area, 1)} m²</span>
              <Aprox />
            </Fila>
          </>
        ) : (
          <Fila etiqueta="Medidas">
            <span className="text-tenue">Sin ubicar en el croquis</span>
          </Fila>
        )}
        <Fila etiqueta="Precisión">{PRECISION[zona.precision] ?? <Texto v={null} />}</Fila>
        <Fila etiqueta="Confianza">{CONFIANZA[zona.confianza] ?? <Texto v={null} />}</Fila>
        <Fila etiqueta="Responsable">
          <Texto v={zona.responsable} />
        </Fila>
      </Datos>
    </Seccion>
  )
}

function EnVivo({ zona }: { zona: Zona }) {
  const estado = usePlantStore((s) => (s.idx ? estadoDeZona(s.idx, s.live, zona.id) : 'sin_datos'))
  const hayFuente = usePlantStore((s) => s.live !== null)
  const vivo = usePlantStore((s) => s.live?.zonas?.[zona.id])
  return (
    <Seccion titulo="En vivo">
      <Datos>
        <Fila etiqueta="Estado">
          <ChipEstado estado={estado} />
          {hayFuente && !vivo && (
            <span className="mt-0.5 block text-[11px] text-tenue">Peor estado de sus etapas y equipos.</span>
          )}
        </Fila>
        {vivo && (
          <>
            <Fila etiqueta="WIP">
              <ValorVivo v={vivo.wip} unidad="pzs" />
            </Fila>
            <Fila etiqueta="Merma">
              <PctVivo v={vivo.merma_pct} />
            </Fila>
          </>
        )}
      </Datos>
    </Seccion>
  )
}

export function ZonaDetalle({ zona }: { zona: Zona }) {
  const idx = usePlantStore((s) => s.idx)
  const live = usePlantStore((s) => s.live)
  if (!idx) return null
  const personal = idx.personalPorZona.get(zona.id)
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <ChipGrupo zona={zona} />
      </div>
      <Ficha zona={zona} />
      <EnVivo zona={zona} />
      <EtapasDeZona zona={zona} />
      <SeccionEquipos equipos={idx.equiposPorZona.get(zona.id) ?? []} vacio="Sin equipos registrados en esta zona." />
      <SeccionPersonal
        confirmado={personal?.confirmado ?? []}
        hipotesis={personal?.hipotesis ?? []}
        vacio="Sin personal asignado a esta zona."
      />
      <SeccionAlarmas
        titulo="Alarmas (zona, etapas y equipos)"
        alarmas={alarmasDeSeleccion(live, idx, { tipo: 'zona', id: zona.id })}
      />
      <FotosYNotas zona={zona} />
    </>
  )
}
