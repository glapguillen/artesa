// Secciones de la zona: etapas (confirmadas y probables) y fotos con notas.
import type { Zona } from '../../domain/types'
import { usePlantStore } from '../../store/usePlantStore'
import { CONFIANZA } from './etiquetas'
import { ChipEtapa } from './chips'
import { Chips, Seccion, Subtitulo, Vacio } from './piezas'

export function EtapasDeZona({ zona }: { zona: Zona }) {
  const total = zona.etapas.length + zona.etapas_hipotesis.length
  return (
    <Seccion titulo="Etapas del proceso" extra={total > 0 ? `${total}` : undefined}>
      {total === 0 && <Vacio>Ninguna etapa del flujograma asignada.</Vacio>}
      {zona.etapas.length > 0 && (
        <>
          <Subtitulo>Confirmadas</Subtitulo>
          <Chips>
            {zona.etapas.map((c) => (
              <ChipEtapa key={c} codigo={c} />
            ))}
          </Chips>
        </>
      )}
      {zona.etapas_hipotesis.length > 0 && (
        <>
          <Subtitulo>Probables (por confirmar)</Subtitulo>
          <Chips>
            {zona.etapas_hipotesis.map((c) => (
              <ChipEtapa key={c} codigo={c} probable />
            ))}
          </Chips>
        </>
      )}
    </Seccion>
  )
}

export function FotosYNotas({ zona }: { zona: Zona }) {
  const fotos = usePlantStore((s) => s.layout?.fotos)
  return (
    <Seccion titulo="Fotos y notas">
      <Subtitulo>Fotos</Subtitulo>
      {zona.fotos.length === 0 ? (
        <Vacio>Sin fotos asociadas.</Vacio>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {zona.fotos.map((id) => {
            const f = fotos?.find((x) => x.id === id)
            return (
              <li key={id} className="leading-snug">
                <span className="font-medium">{id}</span>
                {f && (
                  <span className="text-tenue">
                    {' '}
                    · {f.resumen} (confianza {CONFIANZA[f.confianza]?.toLowerCase() ?? f.confianza})
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <Subtitulo>Notas</Subtitulo>
      {zona.notas ? <p className="text-sm leading-snug break-words">{zona.notas}</p> : <Vacio>Sin notas.</Vacio>}
    </Seccion>
  )
}
