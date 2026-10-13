// Nombres de las zonas (Html de drei, tamaño fijo en px). Para que no se pisen, cada ~8 cuadros se
// proyectan las anclas y se muestran por prioridad (selección, luego zonas más grandes). Con
// "Etiquetas" apagado solo se rotulan las zonas resaltadas. Solo la seleccionada recibe clics.
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import { Vector3 } from 'three'
import { usePlantStore } from '../../../store/usePlantStore'
import { resaltadoDeSeleccion } from '../../planta/planLive'
import { anchoEtiquetaPx, anclaEtiqueta, type CandidatoEtiqueta, disponerEtiquetas, ESPESOR_LOSA } from '../geometriaEscena'
import type { Losa3D, ModeloEscena, V2 } from '../modelo/tipos'
import { esRayada } from '../presentacion'
import { useVista3D } from '../useVista3D'

const CADA_CUADROS = 8
const v = new Vector3()

const mismas = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x))

interface EtiquetaProps {
  losa: Losa3D
  ancla: V2
  resalte: 'solido' | 'discontinuo' | undefined
  seleccionada: boolean
  etapaElegida: string | null
}

function Etiqueta({ losa, ancla, resalte, seleccionada, etapaElegida }: EtiquetaProps) {
  const base = 'block max-w-[10.5rem] truncate rounded-md border px-1.5 py-0.5 text-[11px] leading-tight whitespace-nowrap shadow-sm'
  const tono = resalte ? 'border-seleccion bg-surface font-semibold text-texto' : 'border-borde bg-surface/85 font-medium text-texto'
  const nombre = <span className={`${base} ${tono} ${esRayada(losa.grupo) ? 'italic' : ''}`}>{losa.nombre}</span>
  const etapas = [...losa.etapas.map((c) => ({ c, p: false })), ...losa.etapasHipotesis.map((c) => ({ c, p: true }))]
  return (
    <Html position={[ancla[0], ESPESOR_LOSA + 0.05, ancla[1]]} center zIndexRange={[20, 13]} className={seleccionada ? '' : 'pointer-events-none'}>
      <div className="flex flex-col items-center gap-0.5 select-none">
        {seleccionada ? (
          <button
            type="button"
            aria-label={`Encuadrar ${losa.nombre}`}
            title="Encuadrar la zona"
            onClick={() => useVista3D.getState().camara?.vista('zona')}
            className="cursor-pointer rounded-md focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-seleccion"
          >
            {nombre}
          </button>
        ) : (
          nombre
        )}
        {resalte && etapas.length > 0 && (
          <span className="flex max-w-[12rem] flex-wrap justify-center gap-0.5">
            {etapas.map(({ c, p }) => (
              <span
                key={`${c}${p ? '?' : ''}`}
                className={`rounded border bg-surface px-1 text-[10px] leading-4 text-texto ${p ? 'border-dashed' : ''} ${
                  c === etapaElegida ? 'border-seleccion font-semibold' : 'border-borde'
                }`}
              >
                {p ? `${c}?` : c}
              </span>
            ))}
          </span>
        )}
      </div>
    </Html>
  )
}

export function Etiquetas({ modelo, todas }: { modelo: ModeloEscena; todas: boolean }) {
  const idx = usePlantStore((s) => s.idx)
  const seleccion = usePlantStore((s) => s.seleccion)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const resalte = useMemo(() => resaltadoDeSeleccion(idx, seleccion), [idx, seleccion])
  const anclas = useMemo(() => new Map(modelo.losas.map((l) => [l.id, anclaEtiqueta(l)])), [modelo.losas])
  const [visibles, setVisibles] = useState<Set<string>>(() => new Set())
  const actual = useRef(visibles)
  const cuadro = useRef(0)

  useFrame(() => {
    if (cuadro.current++ % CADA_CUADROS !== 0) return
    const cands: CandidatoEtiqueta[] = []
    for (const l of modelo.losas) {
      const r = resalte.get(l.id)
      const a = anclas.get(l.id)
      if (!a || (!todas && !r)) continue
      v.set(a[0], ESPESOR_LOSA, a[1]).project(camera)
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue
      const conEtapas = r && l.etapas.length + l.etapasHipotesis.length > 0
      cands.push({
        id: l.id,
        x: ((v.x + 1) / 2) * size.width,
        y: ((1 - v.y) / 2) * size.height,
        w: anchoEtiquetaPx(l.nombre),
        h: conEtapas ? 40 : 20,
        prioridad: r ? 1e9 + (r === 'solido' ? 1 : 0) : l.ancho * l.largo,
      })
    }
    const nuevas = disponerEtiquetas(cands)
    if (!mismas(nuevas, actual.current)) {
      actual.current = nuevas
      setVisibles(nuevas)
    }
  })

  const zonaElegida = seleccion?.tipo === 'zona' ? seleccion.id : null
  const etapaElegida = seleccion?.tipo === 'etapa' ? seleccion.id : null
  return (
    <>
      {modelo.losas.map((l) => {
        const a = anclas.get(l.id)
        if (!a || !visibles.has(l.id)) return null
        return <Etiqueta key={l.id} losa={l} ancla={a} resalte={resalte.get(l.id)} seleccionada={l.id === zonaElegida} etapaElegida={etapaElegida} />
      })}
    </>
  )
}
