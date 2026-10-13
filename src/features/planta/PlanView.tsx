// Vista de planta 2D: tarjeta con encabezado, SVG con zoom/desplazamiento, norte y escala
// supuestos y la lista de zonas sin ubicar en el croquis. Todo sale de plant-layout.json.
import { useCallback, useMemo, useState } from 'react'
import { usePlantStore } from '../../store/usePlantStore'
import { NorteEscala } from './NorteEscala'
import { PlanCanvas } from './PlanCanvas'
import { PlanHeader } from './PlanHeader'
import { construirPlano, type Plano } from './planModel'
import { RouteBadge } from './RouteOverlay'
import { Unplaced } from './Unplaced'
import { usePanZoom } from './usePanZoom'
import { usePlanoVivo, useRutaPlano } from './usePlanoVivo'

// contain:inline-size → el contenido (chips en una fila con scroll) nunca ensancha la grilla de la
// página: la tarjeta toma el ancho de su sección.
const TARJETA =
  'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-borde bg-surface [contain:inline-size]'

function PlanoListo({ plano, version, norte }: { plano: Plano; version: string; norte: number | null }) {
  const pz = usePanZoom(plano.base)
  const vivo = usePlanoVivo(plano)
  const ruta = useRutaPlano(plano)
  const [flujos, setFlujos] = useState(true)
  const seleccionar = usePlantStore((s) => s.seleccionar)
  const onSeleccionar = useCallback((id: string) => seleccionar({ tipo: 'zona', id }), [seleccionar])
  return (
    <div data-testid="plan-view" className={TARJETA}>
      <PlanHeader
        version={version}
        flujos={flujos}
        onFlujos={setFlujos}
        ampliado={pz.ampliado}
        acercar={pz.acercar}
        alejar={pz.alejar}
        encuadrar={pz.encuadrar}
      />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <PlanCanvas plano={plano} pz={pz} vivo={vivo} ruta={ruta} mostrarFlujos={flujos} />
        <NorteEscala k={pz.k} norteGrados={norte} />
        {ruta && <RouteBadge ruta={ruta} piezas={vivo.live?.rutas?.[ruta.id]?.piezas_turno ?? null} />}
      </div>
      <Unplaced zonas={plano.sinUbicar} estados={vivo.estados} resalte={vivo.resalte} onSeleccionar={onSeleccionar} />
    </div>
  )
}

export function PlanView() {
  const layout = usePlantStore((s) => s.layout)
  const idx = usePlantStore((s) => s.idx)
  const plano = useMemo(() => (layout && idx ? construirPlano(layout, idx) : null), [layout, idx])
  if (!layout || !plano) {
    return (
      <div data-testid="plan-view" className={`${TARJETA} items-center justify-center text-sm text-tenue`}>
        Sin layout cargado.
      </div>
    )
  }
  return <PlanoListo plano={plano} version={layout.version} norte={layout.planta.norte_grados} />
}
