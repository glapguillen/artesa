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

// En lg las dos secciones comparten filas (subgrilla): arriba el conmutador 2D/3D (y un hueco del
// mismo alto en Proceso), abajo las tarjetas, que así quedan alineadas arriba y abajo.
const SECCION =
  'h-[70dvh] min-h-[440px] min-w-0 flex-col gap-2 lg:row-span-2 lg:grid lg:h-auto lg:min-h-0 lg:grid-rows-subgrid'

export default function App() {
  useTheme()
  const carga = useBootstrap()
  const vista = usePlantStore((s) => s.vistaMovil)
  const modoPlanta = usePlantStore((s) => s.modoPlanta)
  // En escritorio el panel de detalle (400 px, fijo a la derecha) no tapa las vistas: se les deja sitio.
  const conPanel = usePlantStore((s) => s.seleccion !== null)

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
      <div className={`flex min-w-0 flex-1 flex-col ${conPanel ? 'lg:pr-[400px]' : ''}`}>
        <KpiBar />
        <Toolbar />
        <main className="grid flex-1 grid-cols-1 gap-3 px-4 pb-4 lg:grid-cols-2 lg:grid-rows-[auto_max(520px,70dvh)] lg:content-start">
          <section id="vista-planta" aria-label="Planta" className={`${vista === 'planta' ? 'flex' : 'hidden'} ${SECCION}`}>
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
          <section
            id="vista-proceso"
            aria-label="Diagrama de proceso"
            className={`${vista === 'proceso' ? 'flex' : 'hidden'} ${SECCION}`}
          >
            <div aria-hidden="true" className="hidden lg:block" />
            <ProcessView />
          </section>
        </main>
        <Legend />
      </div>
      <SidePanel />
    </div>
  )
}
