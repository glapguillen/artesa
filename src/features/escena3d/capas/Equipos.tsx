// Capa de equipos: primitivas paramétricas por forma, a escala de las dimensiones del modelo y con
// las instancias del modelo (nunca inventadas). Todas las piezas van en 3 mallas instanciadas
// (cajas, cilindros y franjas de calor de los hornos) + rombos de "representativo" + contorno de
// selección. Color del cuerpo = estado en vivo; clic → selecciona el equipo; hover → cursor de mano
// y tooltip compartido de la escena (nombre, estado, instancias y si es representativo).
import { type ThreeEvent, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Color } from 'three'
import { usePlantStore } from '../../../store/usePlantStore'
import { tituloEquipo, type VistaEquipo, vistaEquipos } from '../capasModelo'
import { mezclarColor } from '../formas/materialFlujo'
import { type MallaPieza, type PiezaUbicada, piezasPorMalla } from '../formas/piezas'
import type { ModeloEscena } from '../modelo/tipos'
import { type Paleta3D, usePaleta3D } from '../usePaleta3D'
import { useVista3D } from '../useVista3D'
import { ContornoSeleccion } from './ContornoSeleccion'
import { type EventosPiezas, MallaPiezas } from './MallaPiezas'
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

/** Más desplazamiento que esto (px) entre pulsar y soltar es un arrastre de cámara, no un clic. */
const ARRASTRE_PX = 6

export function Equipos({ modelo }: { modelo: ModeloEscena }) {
  const paleta = usePaleta3D()
  const live = usePlantStore((s) => s.live)
  const sel = usePlantStore((s) => s.seleccion)
  const seleccionar = usePlantStore((s) => s.seleccionar)
  const setHover = useVista3D((s) => s.setHover)
  const get = useThree((s) => s.get)

  const piezas = useMemo(() => piezasPorMalla(modelo.equipos), [modelo])
  const porId = useMemo(() => new Map(modelo.equipos.map((e) => [e.id, e])), [modelo])
  const vista = useMemo(() => vistaEquipos(modelo.equipos, live, sel), [modelo, live, sel])
  const colores = useMemo(
    () => ({
      caja: coloresDe(piezas.caja, vista, paleta),
      cilindro: coloresDe(piezas.cilindro, vista, paleta),
      calor: coloresDe(piezas.calor, vista, paleta),
    }),
    [piezas, vista, paleta],
  )

  // Cursor de mano en el propio <canvas> (como las losas) y tooltip compartido de la escena.
  const cursor = (valor: string) => {
    get().gl.domElement.style.cursor = valor
  }
  useEffect(
    () => () => {
      get().gl.domElement.style.cursor = ''
    },
    [get],
  )
  const elegir = (id: string, e: ThreeEvent<MouseEvent>) => {
    if (e.delta > ARRASTRE_PX) return
    e.stopPropagation()
    seleccionar({ tipo: 'equipo', id })
  }
  const pasar = (id: string, e: ThreeEvent<PointerEvent>) => {
    // Primero se detiene la propagación: R3F saca el hover de la losa de abajo y luego se pone el nuestro.
    e.stopPropagation()
    const eq = porId.get(id)
    if (!eq) return
    cursor('pointer')
    setHover({ id, titulo: tituloEquipo(eq, vista.get(id)?.estado ?? 'sin_datos'), x: e.nativeEvent.clientX, y: e.nativeEvent.clientY })
  }
  const salir = () => {
    cursor('')
    setHover(null)
  }

  const eventos = (malla: MallaPieza): EventosPiezas => {
    const idDe = (e: { instanceId?: number }) => (e.instanceId === undefined ? undefined : piezas[malla][e.instanceId]?.equipoId)
    return {
      onClick: (e) => {
        const id = idDe(e)
        if (id) elegir(id, e)
      },
      onPointerMove: (e) => {
        const id = idDe(e)
        if (id) pasar(id, e)
      },
      onPointerOut: salir,
    }
  }

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
      <MarcasRepresentativas modelo={modelo} color={paleta.tenue} onElegir={elegir} />
      <ContornoSeleccion modelo={modelo} vista={vista} color={paleta.seleccion} />
    </group>
  )
}
