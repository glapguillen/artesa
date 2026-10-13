// Alternativa por teclado al clic en la escena: un <select> con las zonas y los equipos ubicados.
// Elegir una opción selecciona el elemento (panel, 2D y diagrama) y la cámara vuela hacia él.
import { usePlantStore } from '../../../store/usePlantStore'
import type { ModeloEscena } from '../modelo/tipos'

/** Prefijo del valor de las opciones de equipo (las de zona llevan el id tal cual). */
const EQUIPO = 'equipo:'

export function IrAZona({ modelo }: { modelo: ModeloEscena }) {
  const seleccion = usePlantStore((s) => s.seleccion)
  const seleccionar = usePlantStore((s) => s.seleccionar)
  const valor =
    seleccion?.tipo === 'zona' && modelo.losas.some((l) => l.id === seleccion.id)
      ? seleccion.id
      : seleccion?.tipo === 'equipo' && modelo.equipos.some((e) => e.id === seleccion.id)
        ? `${EQUIPO}${seleccion.id}`
        : ''
  const zonas = [...modelo.losas].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const equipos = [...modelo.equipos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  return (
    <label className="inline-flex min-w-0 items-center gap-1.5 text-xs text-tenue">
      <span className="shrink-0">Ir a</span>
      <select
        data-testid="ir-a-zona"
        aria-label="Ir a una zona o equipo de la escena"
        value={valor}
        onChange={(e) => {
          const v = e.target.value
          if (!v) return
          seleccionar(v.startsWith(EQUIPO) ? { tipo: 'equipo', id: v.slice(EQUIPO.length) } : { tipo: 'zona', id: v })
        }}
        className="h-10 w-full max-w-[14rem] min-w-0 cursor-pointer rounded-md border border-borde bg-surface px-2 text-xs text-texto focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-seleccion xl:h-8 pointer-coarse:h-10"
      >
        <option value="">Zona o equipo…</option>
        <optgroup label="Zonas">
          {zonas.map((z) => (
            <option key={z.id} value={z.id}>
              {z.nombre}
            </option>
          ))}
        </optgroup>
        {equipos.length > 0 && (
          <optgroup label="Equipos">
            {equipos.map((e) => (
              <option key={e.id} value={`${EQUIPO}${e.id}`}>
                {e.nombre}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </label>
  )
}
