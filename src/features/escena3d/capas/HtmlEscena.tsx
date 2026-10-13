// Html de drei que se monta recién cuando R3F conectó sus eventos. Si se monta en el primer
// render, drei cambia de contenedor al conectarse los eventos (del padre del canvas al elemento de
// eventos), desmonta su raíz React mientras React renderiza (console.error "Attempted to
// synchronously unmount a root…") y el contenido queda vacío.
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import type { ComponentProps } from 'react'

export function HtmlEscena(props: ComponentProps<typeof Html>) {
  const conectado = useThree((s) => Boolean(s.events.connected))
  return conectado ? <Html {...props} /> : null
}
