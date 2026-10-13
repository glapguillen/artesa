# ARTESA · Planta Viva

Gemelo digital ligero de la planta ARTESA (Cuenca, Ecuador). Muestra en una sola pantalla:

- el **plano de planta 2D**, reinterpretado del croquis, con el estado de cada zona;
- el **Flujograma ARTESA 2025** como diagrama interactivo, con sus etapas, piscinas de WIP, clasificaciones y rutas de decoración R1–R9;
- una **barra de KPIs**: producción del turno, rendimiento de bizcocho, mix de clasificación final, WIP por piscina, OEE de hornos y alarmas.

Todo se genera desde un único archivo, [`public/plant-layout.json`](public/plant-layout.json). En esta fase los datos en vivo son **simulados**: un turno de 8 horas, determinista, con arranque de hornos, WIP que fluctúa y una alarma.

> **Estado:** Fase 1 (MVP 2D). El layout es **preliminar**: la escala y el norte son supuestos y hay zonas sin ubicar. Ver [`docs/datos-faltantes.md`](docs/datos-faltantes.md).

## Requisitos y uso

Node.js 20 o superior.

```bash
npm install
npm run dev        # servidor de desarrollo (http://localhost:5173)
npm run build      # sitio estático en dist/ (se puede publicar en cualquier carpeta)
npm run preview    # sirve dist/ en http://localhost:4173
```

| Script | Qué hace |
|---|---|
| `npm run typecheck` | TypeScript estricto en todo el proyecto |
| `npm run lint` | oxlint sobre `src/` |
| `npm test` | Pruebas unitarias (vitest): validación del layout, selectores, simulador, grafos |
| `npm run smoke` | Prueba de humo con navegador real (Playwright). Requiere `npm run preview` corriendo |

## Cómo se usa la pantalla

- **Clic en una zona del plano** o **en una etapa del diagrama**: se abre el panel de detalle con estado, WIP, equipos, personal asignado, transiciones y rutas. La selección se marca en ambas vistas.
- **Selector de ruta (R1–R9)**: resalta el recorrido de esa ruta de decoración en el diagrama y su trayecto físico en el plano. Por ejemplo, R7 pasa por Decorado → Esmaltado → Kerajet → Decorado → Hornos.
- **Color: Estado | Grupo** cambia cómo se colorean las zonas: por estado operativo o por tipo de área.
- **Insumos y configuración** muestra u oculta, en el diagrama, las conexiones secundarias (recetas, consumo de esmaltes, bajas).
- En celular, las pestañas **Planta | Proceso** alternan entre las dos vistas.
- Botón de tema: sistema, claro u oscuro.

## Cómo editar el layout (sin tocar código)

`public/plant-layout.json` se lee al abrir la app y se valida con zod. Si algo está mal, la app muestra la lista de errores en español en lugar de fallar.

| Sección | Para qué sirve |
|---|---|
| `zonas[]` | Áreas del plano: `poligono` en metros (`[x, z]`; X hacia la derecha, Z hacia abajo), `etapas` que ocurren ahí y `etapas_hipotesis` por confirmar. `poligono: null` = existe pero no está ubicada. `responsable` lleva un **cargo** (p. ej. "Jefe de producción"), nunca el nombre de una persona |
| `proceso.etapas[]` | Etapas del flujograma, con código, fase, tipo y control por FORMA o SKU |
| `proceso.transiciones[]` | Conexiones del diagrama (flujo, clasificación, insumo, registro, configuración) |
| `proceso.diagrama` | Posición `[columna, fila]` de cada etapa en el diagrama y franjas de fase |
| `proceso.rutas_decoracion[]` | Rutas R1–R9 como secuencia de etapas |
| `equipos[]`, `accesos[]`, `flujos[]` | Equipos por zona y etapa, puertas del croquis y flechas de flujo del plano |
| `kpis[]` | Indicadores que muestra la barra; `meta: null` se muestra como "[POR DEFINIR]" |
| `personal` | Dotación **agregada** por sección y cargo, enlazada a etapas y zonas |

Reglas:

- No se inventan medidas ni cantidades. Lo desconocido va en `null` y la app lo muestra como **[POR DEFINIR]**.
- Para agregar una zona, se agrega al arreglo con su polígono y sus etapas. Aparece en el plano, en el panel y en el cálculo de ubicación de las etapas.
- Para mover una etapa en el diagrama, se cambia su celda en `proceso.diagrama.celdas`.

## Arquitectura

```
public/plant-layout.json ──► validarLayout (zod + integridad) ──► store (zustand) ──► vistas
                                                                      ▲
DataSource (hoy MockDataSource; Fase 3: webhook n8n) ──► LiveState ──┘
```

| Carpeta | Contenido |
|---|---|
| `src/domain/` | Esquema zod, tipos, contrato `LiveState`, validación y selectores puros (con pruebas) |
| `src/data/` | Interfaz `DataSource`, fábrica y simulador determinista (`mock/`) |
| `src/store/` | Estado global: layout, estado en vivo, historial, selección, ruta activa, tema |
| `src/features/planta/` | Plano SVG con zoom y desplazamiento, estados, rutas y flujos |
| `src/features/proceso/` | Diagrama del flujograma con React Flow |
| `src/features/kpis/` | Barra de KPIs con mini gráficos |
| `src/features/detalle/` | Panel de detalle de zona, etapa o equipo |
| `src/components/` | Cabecera, barra de herramientas, leyenda y pantalla de error |

Principios:

- **Los KPIs de negocio no se calculan en el frontend**: llegan calculados en `LiveState.kpis`. Las vistas solo combinan datos para mostrarlos; por ejemplo, el color de una zona es el peor estado de sus etapas.
- **Un id sin datos nunca rompe la app**: se muestra en gris como "Sin datos".
- **Cambiar de datos simulados a reales es una línea**: `fuenteDatos` en [`src/config.ts`](src/config.ts). La fuente REST (n8n) llega en la Fase 3.

## Contrato de datos en vivo (resumen)

La fuente de datos entrega periódicamente un `LiveState` (definido en [`src/domain/live.ts`](src/domain/live.ts)), indexado por los ids del layout:

```jsonc
{
  "timestamp": "2026-10-13T10:30:00-05:00",
  "turno":   { "id": "T1", "nombre": "Turno 1", "inicio": "…", "fin": "…", "progreso": 0.44 },
  "etapas":  { "1.4": { "estado": "espera", "wip": 1840, "piezas_h": null, "merma_pct": null } },
  "equipos": { "horno-01": { "estado": "operando", "metricas": { "temp_c": 1092, "temp_objetivo_c": 1100 } } },
  "zonas":   {},                       // opcional: si falta, se deriva de las etapas
  "flujos":  { "d3": { "piezas_h": 120 } },
  "rutas":   { "R7": { "piezas_turno": 340 } },
  "clasificaciones": { "bizcocho": { "buena": 0, "mala": 0 }, "final": { "tipo_a": 0 } },
  "kpis":    { "rend_bizcocho": { "valor": 96.2, "unidad": "%" } },
  "alarmas": [ { "id": "…", "nivel": "critica", "mensaje": "…", "ref": { "tipo": "equipo", "id": "horno-01" }, "desde": "…" } ]
}
```

## Privacidad y seguridad

- El repositorio es **público**. La nómina se incorpora solo **agregada** por sección y cargo; nunca se versionan nombres, cédulas, contactos ni salarios.
- Antes de agregar cámaras, accesos detallados o URLs de n8n, conviene hacer privado el repositorio y publicar la app con autenticación.

## Documentación

- [`docs/fase-0/`](docs/fase-0/README.md): lectura del croquis, fotos y flujograma, más el plano reinterpretado.
- [`docs/datos-faltantes.md`](docs/datos-faltantes.md): preguntas abiertas, faltantes y contradicciones.
- [`CLAUDE.md`](CLAUDE.md): reglas permanentes del proyecto.

## Licencias

Las dependencias de la app (React, @xyflow/react, zustand, zod, recharts) y las herramientas (Vite, Tailwind CSS, vitest, oxlint, playwright-core) tienen licencias MIT, Apache-2.0, ISC o BSD. La única excepción es `lightningcss` (MPL-2.0), que Tailwind usa solo al compilar y no se incluye en el sitio publicado. No se usan dependencias AGPL.
