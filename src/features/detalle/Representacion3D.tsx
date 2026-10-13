// Sección "Representación 3D" del detalle de un equipo: cuántas instancias se dibujan y de dónde
// sale ese número, qué medidas se dibujan (típicas o del JSON) y si el largo se recortó para caber.
import type { Equipo } from '../../domain/types'
import { representacion3D } from '../escena3d/representacion'
import { useModeloEscena } from '../escena3d/useModeloEscena'
import { etiquetaFuente } from './etiquetas'
import { Datos, Fila, Seccion } from './piezas'

export function Representacion3D({ equipo }: { equipo: Equipo }) {
  const modelo = useModeloEscena()
  const r = representacion3D(equipo, modelo, etiquetaFuente(equipo.fuente))
  return (
    <Seccion titulo="Representación 3D" extra={r.dibujado ? undefined : 'Sin ubicar'}>
      <div data-testid="representacion-3d">
        <Datos>
          {r.filas.map((f) => (
            <Fila key={f.etiqueta} etiqueta={f.etiqueta}>
              <span className="flex flex-col">
                <span className="tabular-nums">{f.texto}</span>
                {f.nota && <span className="text-[11px] text-tenue">{f.nota}</span>}
              </span>
            </Fila>
          ))}
        </Datos>
      </div>
    </Seccion>
  )
}
