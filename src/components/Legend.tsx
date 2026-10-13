// Pie con la leyenda (estados, fases y notación) y la procedencia del layout.
import type { ReactNode } from 'react'
import { FaseSchema } from '../domain/schema'
import { usePlantStore } from '../store/usePlantStore'
import { colorEstado, colorFase, ESTADO_ETIQUETA, ESTADOS, FASE_ETIQUETA } from '../ui/tokens'
import { MuestraDiscontinua, MuestraProbable, MuestraRayado } from './LegendNotacion'

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="min-w-0">
      <h2 className="mb-1 text-[11px] font-semibold tracking-wide text-texto uppercase">{titulo}</h2>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">{children}</ul>
    </section>
  )
}

function Item({ muestra, children }: { muestra: ReactNode; children: ReactNode }) {
  return (
    <li className="inline-flex min-w-0 items-center gap-1.5">
      {muestra}
      <span>{children}</span>
    </li>
  )
}

const punto = (color: string) => (
  <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
)

export function Legend() {
  const layout = usePlantStore((s) => s.layout)
  const avisos = usePlantStore((s) => s.avisosLayout.length)
  return (
    <footer data-testid="legend" className="border-t border-borde bg-surface px-4 py-3 text-xs text-tenue">
      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <Grupo titulo="Estado">
          {ESTADOS.map((e) => (
            <Item key={e} muestra={punto(colorEstado(e))}>
              {ESTADO_ETIQUETA[e]}
            </Item>
          ))}
        </Grupo>
        <Grupo titulo="Fase">
          {FaseSchema.options.map((f) => (
            <Item key={f} muestra={punto(colorFase(f))}>
              {FASE_ETIQUETA[f]}
            </Item>
          ))}
        </Grupo>
        <Grupo titulo="Notación">
          <Item muestra={<MuestraDiscontinua />}>Línea discontinua: área abierta o tramo sin ubicar</Item>
          <Item muestra={<MuestraProbable />}>Asignación probable</Item>
          <Item muestra={<MuestraRayado />}>Rayado: sin rótulo en el croquis</Item>
        </Grupo>
      </div>
      {layout && (
        <div className="mt-3 space-y-0.5 border-t border-borde pt-2 text-[11px] leading-snug">
          <p>
            Layout preliminar v{layout.version} · escala y norte supuestos · Fuentes: {layout.fuentes.join(', ')}
          </p>
          <p>Personal: {layout.personal.nota}</p>
          {avisos > 0 && (
            <p style={{ color: colorEstado('espera') }}>
              {avisos === 1
                ? 'El layout tiene 1 aviso de validación (ver la consola del navegador).'
                : `El layout tiene ${avisos} avisos de validación (ver la consola del navegador).`}
            </p>
          )}
        </div>
      )}
    </footer>
  )
}
