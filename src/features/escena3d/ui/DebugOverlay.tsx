// Estadísticas de render en pantalla (solo con ?debug): FPS, draw calls del último cuadro (todas las
// pasadas) y triángulos. Los números también quedan en data-* para los scripts.
import { fmtNum } from '../../../ui/tokens'
import { useVista3D } from '../useVista3D'

export function DebugOverlay() {
  const s = useVista3D((x) => x.stats)
  return (
    <div
      data-testid="debug-3d"
      data-fps={s?.fps ?? ''}
      data-draw-calls={s?.drawCalls ?? ''}
      data-triangulos={s?.triangulos ?? ''}
      className="pointer-events-none absolute top-2 right-2 z-30 rounded-md border border-borde bg-surface/90 px-2 py-1 font-mono text-[11px] leading-tight text-texto shadow-sm"
    >
      <div>FPS {s ? s.fps : '…'}</div>
      <div>Draw calls {s ? s.drawCalls : '…'}</div>
      <div>Triángulos {s ? fmtNum(s.triangulos) : '…'}</div>
    </div>
  )
}
