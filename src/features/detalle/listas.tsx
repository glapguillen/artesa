// Secciones compartidas por los detalles de zona, etapa y equipo: equipos, personal y alarmas.
import { AlarmaItem } from '../../components/AlarmaItem'
import type { Alarma } from '../../domain/live'
import type { Dotacion, Equipo } from '../../domain/types'
import { usePlantStore } from '../../store/usePlantStore'
import { fmtNum } from '../../ui/tokens'
import { BotonEquipo } from './chips'
import { etiquetaSeccion } from './etiquetas'
import { Seccion, Subtitulo, Vacio } from './piezas'

export function SeccionEquipos({ equipos, vacio }: { equipos: readonly Equipo[]; vacio: string }) {
  return (
    <Seccion titulo="Equipos" extra={equipos.length > 0 ? `${equipos.length}` : undefined}>
      {equipos.length === 0 ? (
        <Vacio>{vacio}</Vacio>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {equipos.map((e) => (
            <BotonEquipo key={e.id} equipo={e} />
          ))}
        </ul>
      )}
    </Seccion>
  )
}

const suma = (ds: readonly Dotacion[]) => ds.reduce((n, d) => n + d.cantidad, 0)
const personas = (n: number) => `${fmtNum(n)} ${n === 1 ? 'persona' : 'personas'}`

function Lineas({ dotacion }: { dotacion: readonly Dotacion[] }) {
  return (
    <ul className="flex flex-col gap-0.5 text-sm">
      {dotacion.map((d) => (
        <li key={d.id} className="leading-snug" title={d.notas ?? undefined}>
          {d.cargo} <span className="text-tenue">· {etiquetaSeccion(d.seccion)} ·</span>{' '}
          <span className="font-semibold tabular-nums">{fmtNum(d.cantidad)}</span>
        </li>
      ))}
    </ul>
  )
}

interface PersonalProps {
  confirmado: readonly Dotacion[]
  hipotesis?: readonly Dotacion[]
  vacio: string
}

/** Dotación agregada (cargo · sección · n), confirmada y probable, con la nota del layout. */
export function SeccionPersonal({ confirmado, hipotesis = [], vacio }: PersonalProps) {
  const nota = usePlantStore((s) => s.layout?.personal.nota)
  const total = suma(confirmado)
  const probable = suma(hipotesis)
  const extra = [total > 0 ? personas(total) : null, probable > 0 ? `${fmtNum(probable)} probables` : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <Seccion titulo="Personal" extra={extra || undefined}>
      {confirmado.length === 0 && hipotesis.length === 0 ? (
        <Vacio>{vacio}</Vacio>
      ) : (
        <>
          {confirmado.length > 0 && <Lineas dotacion={confirmado} />}
          {hipotesis.length > 0 && (
            <>
              <Subtitulo>Asignación probable (por confirmar)</Subtitulo>
              <Lineas dotacion={hipotesis} />
            </>
          )}
        </>
      )}
      {nota && <p className="mt-2 text-[11px] leading-snug text-tenue">{nota}</p>}
    </Seccion>
  )
}

/** Alarmas activas relacionadas; elegir una selecciona su referencia. */
export function SeccionAlarmas({ alarmas, titulo = 'Alarmas' }: { alarmas: readonly Alarma[]; titulo?: string }) {
  const hayFuente = usePlantStore((s) => s.live !== null)
  const sel = usePlantStore((s) => s.seleccion)
  const seleccionar = usePlantStore((s) => s.seleccionar)
  return (
    <Seccion titulo={titulo} extra={alarmas.length > 0 ? `${alarmas.length}` : undefined}>
      {alarmas.length === 0 ? (
        <Vacio>{hayFuente ? 'Sin alarmas activas.' : 'Sin datos de la fuente.'}</Vacio>
      ) : (
        <ul className="flex flex-col gap-1">
          {alarmas.map((a) => {
            const ref = a.ref
            // Si la alarma apunta a lo que ya está abierto, no hay a dónde ir.
            const otra = ref && !(sel?.tipo === ref.tipo && sel.id === ref.id)
            return (
              <AlarmaItem
                key={a.id}
                alarma={a}
                onElegir={otra ? () => seleccionar({ tipo: ref.tipo, id: ref.id }) : undefined}
              />
            )
          })}
        </ul>
      )}
    </Seccion>
  )
}
