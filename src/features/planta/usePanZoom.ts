// Zoom y desplazamiento del plano sin dependencias: el estado es el viewBox del SVG.
// Rueda = zoom en el cursor; arrastre = desplazar (en táctil, solo con zoom); dos dedos = pellizco.
import { type PointerEvent, type MouseEvent, useCallback, useEffect, useRef, useState } from 'react'
import {
  type Caja,
  type Tam,
  desplazarVista,
  escalaMeet,
  pantallaAMundo,
  zoomEn,
} from './geometry'

export interface PanZoom {
  vb: Caja
  /** Píxeles de pantalla por metro con la vista actual. */
  k: number
  ampliado: boolean
  ref: (el: SVGSVGElement | null) => (() => void) | undefined
  handlers: {
    onPointerDown: (e: PointerEvent<SVGSVGElement>) => void
    onPointerMove: (e: PointerEvent<SVGSVGElement>) => void
    onPointerUp: (e: PointerEvent<SVGSVGElement>) => void
    onPointerCancel: (e: PointerEvent<SVGSVGElement>) => void
    onClickCapture: (e: MouseEvent<SVGSVGElement>) => void
  }
  acercar: () => void
  alejar: () => void
  encuadrar: () => void
}

const PASO_BOTON = 1.5
const UMBRAL_ARRASTRE = 5
const K_POR_DEFECTO = 4

interface Gesto {
  punteros: Map<number, { x: number; y: number }>
  recorrido: number
  arrastro: boolean
}

export function usePanZoom(base: Caja): PanZoom {
  const [vista, setVista] = useState({ base, vb: base })
  const [tam, setTam] = useState<Tam>({ w: 0, h: 0 })
  const vb = vista.base === base ? vista.vb : base
  const svg = useRef<SVGSVGElement | null>(null)
  const tamRef = useRef(tam)
  const vbRef = useRef(vb)
  const gesto = useRef<Gesto>({ punteros: new Map(), recorrido: 0, arrastro: false })

  useEffect(() => {
    vbRef.current = vb
    tamRef.current = tam
  }, [vb, tam])

  const actualizar = useCallback(
    (f: (v: Caja) => Caja) => setVista((prev) => ({ base, vb: f(prev.base === base ? prev.vb : base) })),
    [base],
  )

  const local = (cx: number, cy: number) => {
    const r = svg.current?.getBoundingClientRect()
    return { x: cx - (r?.left ?? 0), y: cy - (r?.top ?? 0) }
  }

  const ref = useCallback(
    (el: SVGSVGElement | null) => {
      svg.current = el
      if (!el) return undefined
      const ro = new ResizeObserver(([e]) => {
        if (e) setTam({ w: e.contentRect.width, h: e.contentRect.height })
      })
      ro.observe(el)
      const onWheel = (e: WheelEvent) => {
        const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1)
        // Alejar sin zoom no hace nada: se deja que la página haga scroll.
        if (delta > 0 && vbRef.current.w >= base.w - 1e-6) return
        e.preventDefault()
        const r = el.getBoundingClientRect()
        const p = { x: e.clientX - r.left, y: e.clientY - r.top }
        const f = Math.exp(-delta * 0.0015)
        actualizar((v) => zoomEn(v, f, pantallaAMundo(p.x, p.y, v, tamRef.current), base))
      }
      el.addEventListener('wheel', onWheel, { passive: false })
      return () => {
        ro.disconnect()
        el.removeEventListener('wheel', onWheel)
      }
    },
    [actualizar, base],
  )

  const ampliado = vb.w < base.w - 1e-6

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const g = gesto.current
    if (g.punteros.size === 0) {
      g.recorrido = 0
      g.arrastro = false
    }
    g.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const g = gesto.current
    const antes = g.punteros.get(e.pointerId)
    if (!antes) return
    const ahora = { x: e.clientX, y: e.clientY }
    if (g.punteros.size >= 2) {
      const otro = [...g.punteros.entries()].find(([id]) => id !== e.pointerId)?.[1]
      if (otro) {
        const f = Math.hypot(ahora.x - otro.x, ahora.y - otro.y) / Math.max(1, Math.hypot(antes.x - otro.x, antes.y - otro.y))
        const m = local((ahora.x + otro.x) / 2, (ahora.y + otro.y) / 2)
        g.arrastro = true
        actualizar((v) => zoomEn(v, f, pantallaAMundo(m.x, m.y, v, tamRef.current), base))
      }
    } else if (e.pointerType !== 'touch' || ampliado) {
      const dx = ahora.x - antes.x
      const dy = ahora.y - antes.y
      g.recorrido += Math.abs(dx) + Math.abs(dy)
      if (g.recorrido > UMBRAL_ARRASTRE) {
        // La captura se toma recién al arrastrar, para no robarle el clic a las zonas.
        if (!g.arrastro) e.currentTarget.setPointerCapture(e.pointerId)
        g.arrastro = true
        actualizar((v) => {
          const s = escalaMeet(v, tamRef.current) || K_POR_DEFECTO
          return desplazarVista(v, -dx / s, -dy / s, base)
        })
      }
    }
    g.punteros.set(e.pointerId, ahora)
  }

  const onPointerUp = (e: PointerEvent<SVGSVGElement>) => {
    gesto.current.punteros.delete(e.pointerId)
  }

  const onClickCapture = (e: MouseEvent<SVGSVGElement>) => {
    // Un arrastre no debe seleccionar la zona donde se soltó el puntero.
    if (gesto.current.arrastro) {
      e.stopPropagation()
      gesto.current.arrastro = false
    }
  }

  const zoomCentro = (f: number) => actualizar((v) => zoomEn(v, f, [v.x + v.w / 2, v.y + v.h / 2], base))

  return {
    vb,
    k: escalaMeet(vb, tam) || K_POR_DEFECTO,
    ampliado,
    ref,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture },
    acercar: () => zoomCentro(PASO_BOTON),
    alejar: () => zoomCentro(1 / PASO_BOTON),
    encuadrar: () => actualizar(() => base),
  }
}
