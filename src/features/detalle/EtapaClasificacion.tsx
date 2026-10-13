// Etapas de decisión (1.7, 3.3…): resultados con su destino y el conteo del turno, más las
// salidas no productivas que el layout declara para la etapa.
import { usePlantStore } from '../../store/usePlantStore'
import { conteoClasificacion } from './detalleModel'
import { etiquetaResultado } from './etiquetas'
import { ChipEtapa } from './chips'
import { Chips, PorDefinir, Seccion, Subtitulo, ValorVivo } from './piezas'

function Resultados({ codigo }: { codigo: string }) {
  const resultados = usePlantStore((s) => s.layout?.proceso.clasificaciones[codigo])
  const live = usePlantStore((s) => s.live)
  if (!resultados || resultados.length === 0) return null
  return (
    <ul className="flex flex-col gap-1.5">
      {resultados.map((r) => (
        <li key={r.resultado} className="flex flex-col gap-1 rounded-md border border-borde px-2 py-1.5">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">{etiquetaResultado(r.resultado)}</span>
            <span className="shrink-0 text-xs">
              <ValorVivo v={conteoClasificacion(live, codigo, r.resultado)} unidad="pzs" />
            </span>
          </div>
          <Chips>
            <ChipEtapa codigo={r.destino} nota="destino" />
            {r.luego?.map((c) => (
              <ChipEtapa key={c} codigo={c} nota="después" />
            ))}
          </Chips>
          {r.luego === null && (
            <p className="text-[11px] text-tenue">
              Después: <PorDefinir />
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

function SalidasNoProductivas({ codigo }: { codigo: string }) {
  const salidas = usePlantStore((s) => s.layout?.proceso.salidas_no_productivas)
  const propias = (salidas ?? []).filter((x) => x.en === codigo)
  if (propias.length === 0) return null
  return (
    <>
      <Subtitulo>Salidas no productivas</Subtitulo>
      <ul className="flex flex-col gap-0.5 text-sm">
        {propias.map((x) => (
          <li key={`${x.en}:${x.accion}`} className="leading-snug">
            {x.tipos.join(', ')} <span className="text-tenue">→ {x.accion}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

export function ClasificacionDeEtapa({ codigo }: { codigo: string }) {
  const nResultados = usePlantStore((s) => s.layout?.proceso.clasificaciones[codigo]?.length ?? 0)
  const haySalidas = usePlantStore(
    (s) => s.layout?.proceso.salidas_no_productivas.some((x) => x.en === codigo) ?? false,
  )
  if (nResultados === 0 && !haySalidas) return null
  return (
    <Seccion
      titulo={nResultados > 0 ? 'Clasificación' : 'Salidas'}
      extra={nResultados > 0 ? 'Conteo del turno' : undefined}
    >
      <Resultados codigo={codigo} />
      <SalidasNoProductivas codigo={codigo} />
    </Seccion>
  )
}
