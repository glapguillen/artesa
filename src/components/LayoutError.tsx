import { CONFIG } from '../config'

/** Pantalla cuando plant-layout.json no se puede leer o no pasa la validación. */
export function LayoutError({ errores }: { errores: string[] }) {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-xl font-semibold">No se pudo cargar el layout de la planta</h1>
      <p className="mt-2 text-tenue">
        Revise <code className="rounded bg-surface-2 px-1">{CONFIG.layoutUrl}</code>. Errores encontrados:
      </p>
      <ul className="mt-4 space-y-1 rounded-lg border border-borde bg-surface p-4 font-mono text-sm">
        {errores.map((e, i) => (
          <li key={i} className="break-words">
            {e}
          </li>
        ))}
      </ul>
    </main>
  )
}
