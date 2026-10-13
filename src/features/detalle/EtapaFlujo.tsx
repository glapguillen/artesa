// Relaciones de una etapa en el flujograma: transiciones entrantes y salientes, rutas de
// decoración que pasan por ella (resaltables) y rutas de formación que parten de ella.
import type { Transicion } from '../../domain/types'
import { usePlantStore } from '../../store/usePlantStore'
import { fmtNum } from '../../ui/tokens'
import { rutasConEtapa, transicionesDeEtapa } from './detalleModel'
import { TIPO_TRANSICION } from './etiquetas'
import { ChipEtapa } from './chips'
import { CHIP, Chips, FOCO, PorDefinir, Seccion, Subtitulo, Vacio, ValorVivo } from './piezas'

/** "insumo: colores"; en el flujo principal, solo la etiqueta (si la hay). */
function notaTransicion(t: Transicion): string | null {
  const tipo = t.tipo === 'flujo' ? null : (TIPO_TRANSICION[t.tipo] ?? t.tipo)
  return [tipo, t.etiqueta].filter(Boolean).join(': ') || null
}

function ListaTransiciones({ ts, lado }: { ts: Transicion[]; lado: 'desde' | 'hasta' }) {
  if (ts.length === 0) return <Vacio>Ninguna.</Vacio>
  return (
    <Chips>
      {ts.map((t) => (
        <ChipEtapa key={`${t.desde}>${t.hasta}:${t.tipo}`} codigo={t[lado]} nota={notaTransicion(t)} />
      ))}
    </Chips>
  )
}

export function TransicionesDeEtapa({ codigo }: { codigo: string }) {
  const layout = usePlantStore((s) => s.layout)
  if (!layout) return null
  const { entrantes, salientes } = transicionesDeEtapa(layout, codigo)
  return (
    <Seccion titulo="Transiciones">
      <Subtitulo>Llega desde</Subtitulo>
      <ListaTransiciones ts={entrantes} lado="desde" />
      <Subtitulo>Sigue hacia</Subtitulo>
      <ListaTransiciones ts={salientes} lado="hasta" />
    </Seccion>
  )
}

function RutasDecoracion({ codigo }: { codigo: string }) {
  const layout = usePlantStore((s) => s.layout)
  const rutaActiva = usePlantStore((s) => s.rutaActiva)
  const setRutaActiva = usePlantStore((s) => s.setRutaActiva)
  const rutas = usePlantStore((s) => s.live?.rutas)
  if (!layout) return null
  const lista = rutasConEtapa(layout, codigo)
  if (lista.length === 0) return null
  return (
    <>
      <Subtitulo>Rutas de decoración que la incluyen</Subtitulo>
      <Chips>
        {lista.map((r) => {
          const activa = rutaActiva === r.id
          const piezas = rutas?.[r.id]?.piezas_turno
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-pressed={activa}
                aria-label={`Ruta ${r.id} (${r.codigo}): ${activa ? 'quitar el resaltado' : 'resaltar en el plano y el diagrama'}`}
                title={activa ? 'Quitar el resaltado de la ruta' : 'Resaltar la ruta en el plano y el diagrama'}
                onClick={() => setRutaActiva(activa ? null : r.id)}
                className={CHIP}
                style={activa ? { borderColor: 'var(--c-ruta)', boxShadow: '0 0 0 1px var(--c-ruta)' } : undefined}
              >
                <span className="font-semibold" style={activa ? { color: 'var(--c-ruta)' } : undefined}>
                  {r.id}
                </span>
                <span className="text-tenue">{r.codigo}</span>
                {piezas !== undefined && <span className="text-tenue tabular-nums">· {fmtNum(piezas)} pzs</span>}
              </button>
            </li>
          )
        })}
      </Chips>
    </>
  )
}

/** Etapa de insumo de una ruta de formación (clicable) o [POR DEFINIR]. */
function Insumo({ codigo }: { codigo: string | null }) {
  const seleccionar = usePlantStore((s) => s.seleccionar)
  if (!codigo) return <PorDefinir />
  return (
    <button
      type="button"
      aria-label={`Insumo: etapa ${codigo}. Ver detalle`}
      onClick={() => seleccionar({ tipo: 'etapa', id: codigo })}
      className={`cursor-pointer rounded font-medium text-texto underline decoration-dotted underline-offset-2 hover:text-seleccion ${FOCO}`}
    >
      {codigo}
    </button>
  )
}

function RutasFormacion({ codigo }: { codigo: string }) {
  const lista = usePlantStore((s) => s.layout?.proceso.rutas_formacion)
  const rutas = usePlantStore((s) => s.live?.rutas)
  const propias = (lista ?? []).filter((r) => r.pasos[0] === codigo)
  if (propias.length === 0) return null
  return (
    <>
      <Subtitulo>Rutas de formación (método)</Subtitulo>
      <ul className="flex flex-col gap-1.5 text-sm">
        {propias.map((r) => (
          <li key={r.id} className="rounded-md border border-borde px-2 py-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0">
                <span className="font-semibold">{r.id}</span> · {r.metodo}
              </span>
              <span className="shrink-0 text-xs">
                <ValorVivo v={rutas?.[r.id]?.piezas_turno} unidad="pzs en el turno" />
              </span>
            </div>
            <div className="text-xs text-tenue">
              Insumo: <Insumo codigo={r.insumo} />
              {r.insumo_confianza && ` (${r.insumo_confianza})`}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

export function RutasDeEtapa({ codigo }: { codigo: string }) {
  const hay = usePlantStore(
    (s) =>
      !!s.layout &&
      (rutasConEtapa(s.layout, codigo).length > 0 || s.layout.proceso.rutas_formacion.some((r) => r.pasos[0] === codigo)),
  )
  if (!hay) return null
  return (
    <Seccion titulo="Rutas">
      <RutasDecoracion codigo={codigo} />
      <RutasFormacion codigo={codigo} />
    </Seccion>
  )
}
