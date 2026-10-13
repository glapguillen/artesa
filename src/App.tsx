import { lazy, Suspense } from 'react'
import { useBootstrap } from './app/useBootstrap'
import { useTheme } from './app/useTheme'
import { Header } from './components/Header'
import { LayoutError } from './components/LayoutError'
import { Legend } from './components/Legend'
import { ModoPlantaToggle } from './components/ModoPlantaToggle'
import { Toolbar } from './components/Toolbar'
import { SidePanel } from './features/detalle/SidePanel'
import { KpiBar } from './features/kpis/KpiBar'
import { PlanView } from './features/planta/PlanView'
import { ProcessView } from './features/proceso/ProcessView'
import { usePlantStore } from './store/usePlantStore'

// three.js pesa: la escena 3D se descarga solo cuando se abre la vista 3D.
const Scene3DView = lazy(() => import('./features/escena3d/Scene3DView').then((m) => ({ default: m.Scene3DView })))

const SECCION = 'h-[70dvh] min-h-[440px] flex-col gap-2 lg:flex lg:h-[74dvh] lg:min-h-[560px]'

export default function App() {
  useTheme()
  const carga = useBootstrap()
  const vista = usePlantStore((s) => s.vistaMovil)
  const modoPlanta = usePlantStore((s) => s.modoPlanta)

  if (carga.fase === 'cargando') {
    return (
      <div className="grid min-h-dvh place-items-center text-tenue" role="status">
        Cargando el layout de la planta…
      </div>
    )
  }
  if (carga.fase === 'error') return <LayoutError errores={carga.errores} />

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <KpiBar />
      <Toolbar />
      <main className="grid flex-1 gap-3 px-4 pb-4 lg:grid-cols-2">
        <section aria-label="Planta" className={`${vista === 'planta' ? 'flex' : 'hidden'} ${SECCION}`}>
          <ModoPlantaToggle />
          {modoPlanta === '3d' ? (
            <Suspense
              fallback={
                <div className="grid flex-1 place-items-center rounded-xl border border-borde bg-surface text-tenue" role="status">
                  Cargando la vista 3D…
                </div>
              }
            >
              <Scene3DView />
            </Suspense>
          ) : (
            <PlanView />
          )}
        </section>
        <section aria-label="Diagrama de proceso" className={`${vista === 'proceso' ? 'flex' : 'hidden'} ${SECCION}`}>
          <ProcessView />
        </section>
      </main>
      <Legend />
      <SidePanel />
    </div>
  )
}
