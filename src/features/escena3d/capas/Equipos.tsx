// Capa de equipos: primitivas paramétricas por forma, a escala de las dimensiones del modelo y con
// las instancias del modelo (nunca inventadas). Todas las piezas van en 3 mallas instanciadas
// (cajas, cilindros y franjas de calor de los hornos) + rombos de "representativo" + contorno de
// selección. Color del cuerpo = estado en vivo; clic → selecciona el equipo.
import { useCursor } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useMemo, useState } from 'react'
import { Color } from 'three'
import { usePlantStore } from '../../../store/usePlantStore'
import { type VistaEquipo, vistaEquipos } from '../capasModelo'
import { mezclarColor } from '../formas/materialFlujo'
import { type MallaPieza, type PiezaUbicada, piezasPorMalla } from '../formas/piezas'
import type { ModeloEscena } from '../modelo/tipos'
import { type Paleta3D, usePaleta3D } from '../usePaleta3D'
import { ContornoSeleccion } from './ContornoSeleccion'
import { EquipoTooltip } from './EquipoTooltip'
import { MallaPiezas } from './MallaPiezas'
import { MarcasRepresentativas } from './MarcasRepresentativas'

/** Color de una pieza: cuerpo = estado; estructura = gris del tema; calor = del borde frío al naranja. */
function colorPieza(out: Color, p: PiezaUbicada, v: VistaEquipo | undefined, paleta: Paleta3D): Color {
  if (p.rol === 'calor') mezclarColor(out, paleta.borde, paleta.fase.F1, v?.calor ?? 0)
  else if (p.rol === 'estructura') mezclarColor(out, paleta.tenue, paleta.superficie, paleta.oscuro ? 0.35 : 0.15)
  else out.set(paleta.estado[v?.estado ?? 'sin_datos'])
  if (v?.resalte && p.rol !== 'calor') out.lerp(new Color(paleta.seleccion), v.resalte === 'fuerte' ? 0.45 : 0.25)
  return out
}

function coloresDe(piezas: readonly PiezaUbicada[], vista: Map<string, VistaEquipo>, paleta: Paleta3D): Float32Array {
  const out = new Float32Array(piezas.length * 3)
  const c = new Color()
  piezas.forEach((p, i) => colorPieza(c, p, vista.get(p.equipoId), paleta).toArray(out, i * 3))
  return out
}

const MALLAS: Array<{ malla: MallaPieza; geometria: 'caja' | 'cilindro'; material: 'estandar' | 'basico' }> = [
  { malla: 'caja', geometria: 'caja', material: 'estandar' },
  { malla: 'cilindro', geometria: 'cilindro', material: 'estandar' },
  { malla: 'calor', geometria: 'caja', material: 'basico' },
]

export function Equipos({ modelo }: { modelo: ModeloEscena }) {
  const paleta = usePaleta3D()
  const live = usePlantStore((s) => s.live)
  const sel = usePlantStore((s) => s.seleccion)
  const seleccionar = usePlantStore((s) => s.seleccionar)
  const [hover, setHover] = useState<string | null>(null)
  useCursor(hover !== null)

  const piezas = useMemo(() => piezasPorMalla(modelo.equipos), [modelo])
  const vista = useMemo(() => vistaEquipos(modelo.equipos, live, sel), [modelo, live, sel])
  const colores = useMemo(
    () => ({
      caja: coloresDe(piezas.caja, vista, paleta),
      cilindro: coloresDe(piezas.cilindro, vista, paleta),
      calor: coloresDe(piezas.calor, vista, paleta),
    }),
    [piezas, vista, paleta],
  )

  const eventos = (malla: MallaPieza) => {
    const idDe = (e: { instanceId?: number }) => (e.instanceId === undefined ? undefined : piezas[malla][e.instanceId]?.equipoId)
    return {
      onClick: (e: ThreeEvent<MouseEvent>) => {
        const id = idDe(e)
        if (!id) return
        e.stopPropagation()
        seleccionar({ tipo: 'equipo', id })
      },
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        const id = idDe(e)
        if (!id) return
        e.stopPropagation()
        setHover(id)
      },
      onPointerOut: () => setHover(null),
    }
  }

  const hovered = hover ? modelo.equipos.find((e) => e.id === hover) : undefined
  return (
    <group name="capa-equipos">
      {MALLAS.map((m) => (
        <MallaPiezas
          key={m.malla}
          nombre={`equipos-${m.malla}`}
          piezas={piezas[m.malla]}
          geometria={m.geometria}
          material={m.material}
          colores={colores[m.malla]}
          {...eventos(m.malla)}
        />
      ))}
      <MarcasRepresentativas modelo={modelo} color={paleta.tenue} onElegir={(id) => seleccionar({ tipo: 'equipo', id })} />
      <ContornoSeleccion modelo={modelo} vista={vista} color={paleta.seleccion} />
      {hovered && <EquipoTooltip equipo={hovered} estado={vista.get(hovered.id)?.estado ?? 'sin_datos'} />}
    </group>
  )
}
