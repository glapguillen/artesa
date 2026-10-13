// Detalle de una etapa del flujograma: ficha, ubicación, estado en vivo con su WIP histórico,
// transiciones, rutas, clasificación, equipos, personal y alarmas.
import { useMemo } from 'react'
import { ubicacionEtapa } from '../../domain/selectors'
import type { Etapa } from '../../domain/types'
import { usePlantStore } from '../../store/usePlantStore'
import { colorFase, FASE_ETIQUETA, UBICACION_ETIQUETA } from '../../ui/tokens'
import { alarmasDeSeleccion, serieWip } from './detalleModel'
import { ClasificacionDeEtapa } from './EtapaClasificacion'
import { RutasDeEtapa, TransicionesDeEtapa } from './EtapaFlujo'
import { etiquetaControl, TIPO_ETAPA } from './etiquetas'
import { ChipZona } from './chips'
import { SeccionAlarmas, SeccionEquipos, SeccionPersonal } from './listas'
import { MiniGrafico } from './MiniGrafico'
import { ChipEstado, Chips, Datos, Fila, PctVivo, Punto, Seccion, Subtitulo, Vacio, ValorVivo } from './piezas'

function ChipFase({ etapa }: { etapa: Etapa }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-borde px-2 py-0.5 text-xs text-texto">
      <Punto color={colorFase(etapa.fase)} />
      {FASE_ETIQUETA[etapa.fase] ?? etapa.fase}
    </span>
  )
}

function Ficha({ etapa }: { etapa: Etapa }) {
  return (
    <Seccion titulo="Ficha">
      <Datos>
        <Fila etiqueta="Código">
          <span className="font-semibold tabular-nums">{etapa.codigo}</span>
        </Fila>
        <Fila etiqueta="Nombre corto">{etapa.nombre_corto}</Fila>
        <Fila etiqueta="Tipo">{TIPO_ETAPA[etapa.tipo] ?? etapa.tipo}</Fila>
        <Fila etiqueta="Control">{etiquetaControl(etapa.control_por)}</Fila>
      </Datos>
    </Seccion>
  )
}

function Ubicacion({ codigo }: { codigo: string }) {
  const zonas = usePlantStore((s) => s.idx?.zonasPorEtapa.get(codigo))
  const ubic = usePlantStore((s) => (s.idx ? ubicacionEtapa(s.idx, codigo) : 'sin_ubicar'))
  const confirmadas = zonas?.confirmadas ?? []
  const probables = zonas?.hipotesis ?? []
  return (
    <Seccion titulo="Ubicación" extra={UBICACION_ETIQUETA[ubic]}>
      {confirmadas.length === 0 && probables.length === 0 && <Vacio>Ninguna zona asignada a esta etapa.</Vacio>}
      {confirmadas.length > 0 && (
        <>
          <Subtitulo>Zonas confirmadas</Subtitulo>
          <Chips>
            {confirmadas.map((z) => (
              <ChipZona key={z.id} id={z.id} />
            ))}
          </Chips>
        </>
      )}
      {probables.length > 0 && (
        <>
          <Subtitulo>Zonas probables (por confirmar)</Subtitulo>
          <Chips>
            {probables.map((z) => (
              <ChipZona key={z.id} id={z.id} probable />
            ))}
          </Chips>
        </>
      )}
    </Seccion>
  )
}

function EnVivo({ etapa }: { etapa: Etapa }) {
  const vivo = usePlantStore((s) => s.live?.etapas?.[etapa.codigo])
  const historial = usePlantStore((s) => s.historial)
  const serie = useMemo(() => serieWip(historial, etapa.codigo), [historial, etapa.codigo])
  return (
    <Seccion titulo="En vivo">
      <Datos>
        <Fila etiqueta="Estado">
          <ChipEstado estado={vivo?.estado ?? 'sin_datos'} />
        </Fila>
        <Fila etiqueta="WIP">
          <ValorVivo v={vivo?.wip} unidad="pzs" />
        </Fila>
        <Fila etiqueta="Piezas/h">
          <ValorVivo v={vivo?.piezas_h} />
        </Fila>
        <Fila etiqueta="Merma">
          <PctVivo v={vivo?.merma_pct} />
        </Fila>
      </Datos>
      <Subtitulo>WIP en el turno</Subtitulo>
      <MiniGrafico serie={serie} color={colorFase(etapa.fase)} unidad="pzs" titulo={`WIP de la etapa ${etapa.codigo}`} />
    </Seccion>
  )
}

export function EtapaDetalle({ etapa }: { etapa: Etapa }) {
  const idx = usePlantStore((s) => s.idx)
  const live = usePlantStore((s) => s.live)
  if (!idx) return null
  const codigo = etapa.codigo
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-1.5">
        <ChipFase etapa={etapa} />
      </div>
      <Ficha etapa={etapa} />
      <Ubicacion codigo={codigo} />
      <EnVivo etapa={etapa} />
      <TransicionesDeEtapa codigo={codigo} />
      <RutasDeEtapa codigo={codigo} />
      <ClasificacionDeEtapa codigo={codigo} />
      <SeccionEquipos equipos={idx.equiposPorEtapa.get(codigo) ?? []} vacio="Sin equipos registrados para esta etapa." />
      <SeccionPersonal confirmado={idx.personalPorEtapa.get(codigo) ?? []} vacio="Sin personal asignado a esta etapa." />
      <SeccionAlarmas
        titulo="Alarmas (etapa y equipos)"
        alarmas={alarmasDeSeleccion(live, idx, { tipo: 'etapa', id: codigo })}
      />
    </>
  )
}
