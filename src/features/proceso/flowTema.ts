// Ajustes de React Flow: colores desde las variables del tema (claro/oscuro) y textos en español.
import type { AriaLabelConfig, ColorMode, FitViewOptions, ProOptions } from '@xyflow/react'
import type { CSSProperties } from 'react'
import type { Tema } from '../../store/usePlantStore'

export const COLOR_MODE: Record<Tema, ColorMode> = { sistema: 'system', claro: 'light', oscuro: 'dark' }

export const ENCUADRE: FitViewOptions = { padding: 0.04 }

/** Se deja visible la atribución de React Flow (licencia MIT). */
export const PRO_OPTIONS: ProOptions = { hideAttribution: false }

/** Variables --xy-* de React Flow apuntando a los tokens de src/index.css. */
export const ESTILO_FLUJO = {
  '--xy-background-color': 'transparent',
  '--xy-edge-label-background-color': 'var(--c-surface)',
  '--xy-edge-label-color': 'var(--c-muted)',
  '--xy-controls-button-background-color': 'var(--c-surface)',
  '--xy-controls-button-background-color-hover': 'var(--c-surface-2)',
  '--xy-controls-button-color': 'var(--c-text)',
  '--xy-controls-button-color-hover': 'var(--c-text)',
  '--xy-controls-button-border-color': 'var(--c-border)',
  '--xy-controls-box-shadow': '0 0 0 1px var(--c-border)',
  '--xy-minimap-background-color': 'var(--c-surface)',
  '--xy-minimap-mask-background-color': 'color-mix(in srgb, var(--c-bg) 65%, transparent)',
  '--xy-minimap-mask-stroke-color': 'var(--c-border)',
  '--xy-minimap-node-background-color': 'var(--c-surface-2)',
  '--xy-attribution-background-color': 'color-mix(in srgb, var(--c-surface) 70%, transparent)',
} as CSSProperties

export const ARIA_FLUJO: Partial<AriaLabelConfig> = {
  'node.a11yDescription.default': 'Pulse Enter o Espacio para ver el detalle de la etapa.',
  'node.a11yDescription.keyboardDisabled': 'Pulse Enter o Espacio para ver el detalle de la etapa.',
  'edge.a11yDescription.default': 'Transición entre etapas del proceso.',
  'controls.ariaLabel': 'Controles del diagrama',
  'controls.zoomIn.ariaLabel': 'Acercar',
  'controls.zoomOut.ariaLabel': 'Alejar',
  'controls.fitView.ariaLabel': 'Encuadrar todo el diagrama',
  'controls.interactive.ariaLabel': 'Bloquear o permitir la interacción',
  'minimap.ariaLabel': 'Minimapa del diagrama',
  'handle.ariaLabel': 'Conector',
}
