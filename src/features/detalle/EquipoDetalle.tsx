// Detalle de un equipo: ficha del layout (cantidades y medidas nunca estimadas: [POR DEFINIR]),
// estado y métricas en vivo, y sus alarmas.
import type { Equipo } from '../../domain/types'
import { usePlantStore } from '../../store/usePlantStore'
import { fmtNum } from '../../ui/tokens'
import { alarmasDeSeleccion } from './detalleModel'
import { CONFIANZA, etiquetaFuente, etiquetaPrecisionDim, etiquetaTipoEquipo, nombreMetrica } from './etiquetas'
import { ChipEtapa, ChipZona } from './chips'
import { SeccionAlarmas } from './listas'
import { ChipEstado, Chips, Datos, Fila, PorDefinir, Seccion, SinDatos, Texto, Vacio, ValorVivo } from './piezas'
import { Representacion3D } from './Representacion3D'

/** "20 m" o [POR DEFINIR]. */
function Metros({ v }: { v: number | null | undefined }) {
  return v === null || v === undefined ? <PorDefinir /> : <span className="tabular-nums">{fmtNum(v, 1)} m</span>
}

function Dimensiones({ d }: { d: Equipo['dimensiones'] }) {
  if (!d) return <PorDefinir />
  return (
    <span className="flex flex-col">
      <span>
        Largo <Metros v={d.largo} /> · ancho <Metros v={d.ancho} /> · alto <Metros v={d.alto} />
      </span>
      <span className="text-[11px] text-tenue">Precisión: {etiquetaPrecisionDim(d.precision)}</span>
    </span>
  )
}

function Ficha({ equipo }: { equipo: Equipo }) {
  const e = equipo
  const min = e.cantidad_min_observada
  return (
    <Seccion titulo="Ficha">
      <Datos>
        <Fila etiqueta="Tipo">{etiquetaTipoEquipo(e.tipo)}</Fila>
        <Fila etiqueta="Zona">
          <Chips>
            <ChipZona id={e.zona} />
          </Chips>
        </Fila>
        <Fila etiqueta="Etapa">
          <Chips>
            <ChipEtapa codigo={e.etapa} />
          </Chips>
        </Fila>
        <Fila etiqueta="Cantidad">
          {e.cantidad === null ? <PorDefinir /> : <span className="tabular-nums">{fmtNum(e.cantidad)}</span>}
        </Fila>
        {min !== undefined && (
          <Fila etiqueta="Mín. observado">
            <span className="tabular-nums">{fmtNum(min)}</span>
            <span className="text-tenue"> (fuente: {etiquetaFuente(e.fuente)})</span>
          </Fila>
        )}
        <Fila etiqueta="Dimensiones">
          <Dimensiones d={e.dimensiones} />
        </Fila>
        {e.layout && (
          <Fila etiqueta="Distribución">
            Filas {e.layout.filas ?? <PorDefinir />} · columnas {e.layout.columnas ?? <PorDefinir />} · separación{' '}
            <Metros v={e.layout.separacion} />
          </Fila>
        )}
        <Fila etiqueta="Posición">
          {e.posicion ? (
            <span className="tabular-nums">
              x {fmtNum(e.posicion[0], 1)} m · z {fmtNum(e.posicion[1], 1)} m
            </span>
          ) : (
            <span className="text-tenue">Sin posición en el croquis</span>
          )}
        </Fila>
        <Fila etiqueta="Confianza">{CONFIANZA[e.confianza] ?? <Texto v={null} />}</Fila>
        <Fila etiqueta="Fuente">{etiquetaFuente(e.fuente)}</Fila>
        <Fila etiqueta="Notas">{e.notas ? e.notas : <span className="text-tenue">Sin notas</span>}</Fila>
      </Datos>
    </Seccion>
  )
}

function EnVivo({ equipo }: { equipo: Equipo }) {
  const hayFuente = usePlantStore((s) => s.live !== null)
  const vivo = usePlantStore((s) => s.live?.equipos?.[equipo.id])
  const metricas = Object.entries(vivo?.metricas ?? {})
  return (
    <Seccion titulo="En vivo">
      <div className="mb-2">
        <ChipEstado estado={vivo?.estado ?? 'sin_datos'} />
      </div>
      {!vivo ? (
        <Vacio>
          <SinDatos texto={hayFuente ? 'Sin datos de este equipo en la fuente.' : 'Sin datos de la fuente.'} />
        </Vacio>
      ) : metricas.length === 0 ? (
        <Vacio>Sin métricas.</Vacio>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Métricas en vivo de {equipo.nombre}</caption>
          <thead className="sr-only">
            <tr>
              <th scope="col">Métrica</th>
              <th scope="col">Valor</th>
            </tr>
          </thead>
          <tbody>
            {metricas.map(([k, v]) => (
              <tr key={k} className="border-t border-borde first:border-t-0">
                <th scope="row" className="py-1 pr-2 text-left text-xs font-normal text-tenue">
                  {nombreMetrica(k)}
                </th>
                <td className="py-1 text-right">
                  <ValorVivo v={v} decimales={Number.isInteger(v) ? 0 : 1} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Seccion>
  )
}

export function EquipoDetalle({ equipo }: { equipo: Equipo }) {
  const idx = usePlantStore((s) => s.idx)
  const live = usePlantStore((s) => s.live)
  if (!idx) return null
  return (
    <>
      <Ficha equipo={equipo} />
      <Representacion3D equipo={equipo} />
      <EnVivo equipo={equipo} />
      <SeccionAlarmas titulo="Alarmas del equipo" alarmas={alarmasDeSeleccion(live, idx, { tipo: 'equipo', id: equipo.id })} />
    </>
  )
}
