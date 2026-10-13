# Supervisión de calidad · ARTESA Planta Viva

Bitácora del **supervisor de calidad**. Acompaña al agente principal desde la Fase 1 (MVP 2D) hasta la Fase 2 (escena 3D) y decide cuándo el producto está **terminado**: funcional y con una **vista 3D lista para usar en ARTESA** (fábrica de vajilla y cerámica decorada a mano, Cuenca).

- El supervisor **no modifica** código ni datos (`src/`, `public/`, `scripts/`, `package.json`…). Solo escribe en este archivo y en `/tmp` (scripts y capturas temporales). No hace commit ni push.
- Cada **bloqueante** trae cómo reproducirlo (pasos, URL, comando o captura) y el archivo probable.
- **APROBADO** solo cuando todos los ítems de la DoD están cumplidos (`[x]`) o diferidos con acuerdo explícito del agente principal, registrado en la sección 4 (`[~]`).

Leyenda: `[ ]` pendiente · `[x]` verificado (ronda N) · `[~]` diferido con acuerdo · `[!]` falla en la última ronda.

---

## 1. Definición de terminado (DoD)

Cada ítem tiene un código para citarlo en las rondas. Entre paréntesis, cómo se verifica.

### 1.A Funcional (F)

- [ ] **F1 · Checks en verde.** `npm run typecheck`, `npm run lint` (0 errores), `npm test` y `npm run build` terminan con código 0. Los avisos de build (p. ej. tamaño de chunk) están explicados o resueltos. *(Ejecución en cada ronda.)*
- [ ] **F2 · Prueba de humo.** Existe `npm run smoke` (script en `package.json` y archivo en `scripts/`). Lee `SMOKE_URL`, cubre 2D **y** 3D (canvas presente, draw calls, clic en zona, conmutador 2D/3D) y sale con código ≠ 0 si algo falla. *(`SMOKE_URL=http://localhost:4174/ npm run smoke`.)*
- [ ] **F3 · Consola limpia.** 0 `console.error` y 0 `pageerror` al cargar en 2D, pasar a 3D, hacer el tour, cambiar de tema y en los 3 tamaños de pantalla. Ninguna petición 4xx/5xx. Los avisos se revisan uno por uno. *(Script playwright propio.)*
- [ ] **F4 · Todo sale del JSON.** En un `vite preview`, al editar `dist/plant-layout.json` y recargar (renombrar una zona, mover un vértice, agregar una zona con polígono, agregar un equipo y cambiar una celda del diagrama), el cambio aparece en el plano 2D, en la escena 3D, en el diagrama y en el panel, sin recompilar. *(Edición con python3, recarga, capturas y restauración del original.)*
- [ ] **F5 · JSON inválido.** Con sintaxis rota, un tipo erróneo o una referencia a una zona inexistente, la app muestra una pantalla de errores legible en español con la ruta del campo. Nunca queda en blanco, tampoco si el usuario estaba en 3D. *(Tres variantes del JSON en `dist/`.)*
- [ ] **F6 · Ids sin datos en gris.** Una zona, etapa o equipo sin entrada en `LiveState` se muestra en gris "Sin datos" en 2D, 3D, diagrama y panel, y no rompe nada. *(La zona nueva de F4 no la conoce el simulador.)*
- [ ] **F7 · Simulador determinista.** Con la misma semilla, el mismo minuto da los mismos valores al recargar. Se cumple el guion del turno:
  - arranque de hornos en los minutos 0–45 (en espera);
  - alarma crítica de `horno-01` en los minutos 210–240 (detenido, con alarma visible en la barra, el 2D y el 3D);
  - almuerzo en los minutos 270–300 (las etapas manuales no producen);
  - mantenimiento de esmaltado en los minutos 300–330;
  - avance de 2 minutos simulados por segundo real.

  Hace falta una forma reproducible de llegar a un minuto dado (parámetro de URL o control), o la prueba espera en tiempo real (≈105 s hasta la alarma). *(Test unitario y comparación de textos en dos cargas.)*
- [ ] **F8 · Selección y ruta sincronizadas.** Una selección hecha en el plano 2D, el diagrama, la escena 3D o el panel se refleja en las otras vistas. Cerrar el panel o pulsar Esc limpia la selección en todas. La ruta R1–R9 activa se ve en el diagrama, el 2D y el 3D. *(Script.)*
- [ ] **F9 · Robustez del 3D.**
  - Un ErrorBoundary rodea la escena: si el 3D falla, aparece un mensaje y el 2D sigue funcionando.
  - Sin WebGL (`chromium --disable-3d-apis`), aparece un mensaje en español y el 2D sigue funcionando.
  - Al alternar 2D↔3D 20 veces, no aparece "Too many active WebGL contexts" y `renderer.info.memory` no crece.

  *(Script.)*

### 1.B Vista 3D lista para ARTESA (V)

**Generación desde el JSON**

- [ ] **V1 · 100 % desde el JSON.** `src/features/escena3d/` no tiene coordenadas, nombres de zonas, ids de equipos ni etapas escritos a mano. Las constantes de presentación (alturas representativas, grosores, colores) están centralizadas y comentadas. *(grep de `z-`, `horno-`, números de coordenadas y textos de zonas.)*
- [ ] **V2 · Piso.** Hay un piso con la envolvente de `planta.dimensiones` y una cuadrícula o escala en metros. Como `norte_grados` es null, se rotula "Norte supuesto".
- [ ] **V3 · Naves con muros en corte.** Los edificios con polígono tienen muros extruidos en corte (bajos o recortados, de modo que el interior se ve). La altura viene de `altura_m`; si es null, se usa una representativa y se declara como tal.
  - El `ed-complejo-central` (polígono null, altura estimada de 8 m) se trata de forma **explícita**: con una envolvente derivada de sus zonas rotulada "envolvente supuesta", o sin dibujar y con una nota. Nunca se inventa en silencio.
- [ ] **V4 · Zonas como losas.** Cada zona con polígono es una losa con su polígono exacto, coloreada por estado (`LiveState`) o por grupo con el mismo conmutador "Color: Estado | Grupo" y la misma paleta que el 2D.
  - `recinto_cerrado` se distingue (borde o murete).
  - Las zonas `[Sin rótulo]` o por identificar se distinguen visualmente.
  - Las etiquetas se leen bien: tamaño en pantalla adecuado, sin solapes graves, buen contraste en claro y oscuro, y nombres largos ajustados.
- [ ] **V5 · Equipos a escala o representativos.**
  - Se dibujan a escala cuando hay dimensiones (los hornos miden 20 m de largo aprox.). Si no las hay, son representativos y se declara así en el panel o tooltip ("Forma y tamaño representativos · [POR DEFINIR]") y en la leyenda.
  - Deben estar todos: los **2 hornos continuos** (en la posición del JSON y sin atravesar muros; ojo: 20 m de largo en una zona de 19,5 m), los molinos (2 zonas), el filtro prensa, la extrusora, el Kerajet, las impresoras 3D, las cabinas de esmaltado y los **puestos de decoración instanciados**.
  - Instancias = `cantidad ?? cantidad_min_observada ?? 1`; **nunca se inventan**. Si se usa el mínimo observado, se rotula "mín. observado (foto N)".
- [ ] **V6 · Zonas sin ubicar explícitas.** `z-formacion` y `z-secado` (polígono null) y sus equipos (5 métodos de formación y los racks de secado) tienen un tratamiento visible y explícito, por ejemplo un área "Sin ubicar" fuera del perímetro, rayada y rotulada, o un listado sobre la escena.
  - No se colocan dentro de la planta como si se supiera dónde están.
  - El clic abre el panel con [POR DEFINIR].

**Navegación**

- [ ] **V7 · Controles con límites.** OrbitControls o CameraControls con:
  - ángulo polar < 90°, para no atravesar el piso;
  - distancia mínima y máxima;
  - desplazamiento acotado a la planta;
  - gestos táctiles: 1 dedo rota y 2 dedos hacen zoom y desplazamiento.
- [ ] **V8 · Vistas de cámara.** Botones General, Cenital y "Por zona" (selector de zonas operable con teclado), más "Reiniciar vista". Las transiciones son suaves, sin saltos. *(Captura de cada vista y posición de cámara antes y después.)*
- [ ] **V9 · Clic → acercamiento y panel.** El clic en una zona o un equipo (o un toque en móvil) acerca la cámara suavemente, resalta el objeto y abre el panel de detalle. En escritorio, el hover pone el cursor de mano y muestra un tooltip. Un clic en el vacío no rompe nada. *(Coordenadas de pantalla del objeto con el hook de depuración; ver V14.)*
- [ ] **V10 · Selección sincronizada con 2D y diagrama.**
  - Seleccionar una etapa en el diagrama resalta en 3D su zona o zonas. Una etapa sin zona muestra el aviso "sin ubicar".
  - Seleccionar en 3D se refleja en el diagrama y en el 2D al volver.

**Datos en vivo**

- [ ] **V11 · Flujos animados por fase.** Los `flujos[]` del JSON están animados (partículas o guiones en movimiento) y coloreados por fase con la paleta del 2D. Se pueden filtrar por fase, o se resaltan los de la fase o ruta activa. Los de tipo `hipotesis` y `sin_ubicar` tienen un estilo distinto.
- [ ] **V12 · Ruta R1–R9 en 3D.** La ruta activa se dibuja como un trayecto por zonas en orden, numerado y con sentido. Sale de la misma función de dominio que la del 2D, sin duplicar lógica. Al quitar la ruta, desaparece.
- [ ] **V13 · Estados, leyenda y alarmas.**
  - Hay una leyenda de estados visible en 3D: operando, espera, detenido, mantenimiento y sin datos.
  - Las alarmas se ven en 3D: un marcador sobre `horno-01` en los minutos 210–240, destacado y clicable, que abre el panel.
  - La escena coincide con la barra de alarmas y con el 2D.

**Rendimiento**

- [ ] **V14 · Instancing y < 100 draw calls.**
  - Los objetos repetidos usan InstancedMesh o `<Instances>`: puestos, racks, impresoras, partículas de flujo.
  - En la vista general hay **< 100 draw calls**, también con una ruta activa y los flujos encendidos.
  - Se mide con `renderer.info.render.calls` en el modo `?debug`, que muestra el número en pantalla y lo deja legible para el script (p. ej. `window.__planta3d.drawCalls()` y `proyectar(id)` → {x, y}, o atributos `data-*`).
- [ ] **V15 · Carga diferida y sin terceros.**
  - three, R3F y drei van en un chunk aparte: la carga inicial en 2D no lo descarga (comprobado en la red), y mientras carga se ve "Cargando la vista 3D…".
  - **No hay peticiones a dominios externos**: ni fuentes de troika, ni HDRI de drei, ni modelos remotos. Todo es del mismo origen, así que funciona sin internet en la red de la planta.
- [ ] **V16 · Sin trabajo oculto.** Cuando la escena no se ve (2D activo, o "Proceso" en móvil), está desmontada o en pausa. Además, el tamaño del chunk 3D se informa en cada ronda.

**Presentación y uso**

- [ ] **V17 · Modo presentación (tour).** Un botón visible inicia un recorrido por las etapas en el orden del flujograma (B → F1 → F2 → F3 → venta), **generado desde el JSON**.
  - En cada paso, la cámara vuela a la zona y un rótulo muestra la etapa, su descripción y los datos en vivo. Las etapas sin ubicar o [POR DEFINIR] se dicen explícitamente.
  - Tiene controles para reproducir, pausar, ir al anterior o al siguiente y salir; también con teclado (←, →, Espacio, Esc).
  - **DATOS SIMULADOS** sigue visible durante el tour.
  - Al salir, la vista vuelve a como estaba.
- [ ] **V18 · Claro y oscuro.** Al cambiar el tema, el fondo, el piso, los muros, las etiquetas y la leyenda de la escena cambian sin recargar, y el texto sigue legible.
- [ ] **V19 · Tablet y móvil.** A 1024×768, 390×844 y 360 px de ancho:
  - el canvas ocupa la sección;
  - los controles no tapan la escena;
  - los botones táctiles miden ≥ 40 px;
  - el panel no cubre todo;
  - no hay scroll horizontal.
- [ ] **V20 · Accesibilidad del 3D.** El canvas tiene `aria-label` y una descripción. Existe una alternativa con teclado (lista de zonas y equipos) que hace lo mismo que el clic.

### 1.C Uso real en ARTESA (U)

- [ ] **U1 · README de la Fase 2.** El README en español explica el uso del 2D y del 3D (vistas, clic, tour, `?debug`) e incluye capturas actuales en `docs/` (2D, 3D, tour, móvil y oscuro), sin personas.
- [ ] **U2 · Editar y publicar.** El README explica:
  - cómo editar el layout para que se refleje en 3D: alturas, posición y dimensiones de equipos, cantidades, colores;
  - cómo publicar el sitio estático: `npm run build`, copiar `dist/` a cualquier carpeta o servidor y editar `dist/plant-layout.json` sin recompilar.

  *(Verificado sirviendo `dist/` desde una subcarpeta, p. ej. `http://localhost:PUERTO/artesa/`, incluidos el favicon y el chunk 3D.)*
- [ ] **U3 · Honestidad visible en la app, no solo en el README.**
  - El distintivo **DATOS SIMULADOS** siempre está visible: 2D, 3D, tour y móvil.
  - **[POR DEFINIR]** aparece donde hay null: metas de KPI, anchos de acceso, dimensiones y cantidades de equipos, alturas.
  - La app indica "Layout preliminar · escala y norte supuestos" en 2D y en 3D.
- [ ] **U4 · `docs/datos-faltantes.md` al día.** Incluye lo que pide el 3D (alturas de naves, envolvente del complejo central, dimensiones y cantidades de equipos, ubicación de formación y secado, posición exacta de los hornos) y marca lo que se resolvió.
- [ ] **U5 · Listo para n8n (Fase 3).**
  - Cambiar `fuenteDatos` es 1 línea.
  - Ninguna vista importa de `src/data/mock` (grep).
  - El 2D y el 3D consumen solo `LiveState` desde el store.
  - El contrato está documentado.
  - Un `LiveState` parcial o vacío no rompe nada (prueba unitaria o manual).

### 1.D Calidad (Q)

- [ ] **Q1 · Pruebas de la lógica del 3D.** Además de F1, hay tests unitarios de la lógica pura del 3D: polígono → forma, conteo de instancias, trayecto de ruta, encuadre y límites de cámara, pasos del tour.
- [ ] **Q2 · Tamaño de componentes.** Todos los `.tsx` tienen < 200 líneas (`wc -l`). Un `.ts` de más de 200 líneas que no sea de pruebas se justifica. Los componentes no tienen lógica de datos.
- [ ] **Q3 · Sin KPIs calculados en las vistas.** `src/features/**` no tiene fórmulas de OEE, rendimiento ni porcentajes de negocio; solo agregación de presentación (peor estado, sumas de WIP para pintar). *(grep y lectura.)*
- [ ] **Q4 · Accesibilidad básica.**
  - Todo se opera con teclado (Tab, Enter, Espacio, Esc) y el foco es visible.
  - Los conmutadores tienen `aria-pressed` o `role="tab"`; los botones de ícono, `aria-label`; las alarmas, `aria-live`.
  - El contraste de los textos principales cumple AA en claro y en oscuro (medido).
  - La página tiene `lang="es"`.
- [ ] **Q5 · UI 100 % en español.** Incluye tooltips, `aria-label`, errores y textos del tour.
- [ ] **Q6 · Sin restos.** Ni el build ni la UI tienen textos "STUB", "en construcción" ni TODO visibles.

### 1.E Seguridad y privacidad (S)

- [ ] **S1 · Sin datos personales.** Ni el repo ni el historial de la rama tienen nombres, cédulas, correos, teléfonos o salarios de personas.
  - `personal` está solo agregado.
  - `zona.responsable` es null o un cargo, nunca un nombre.
  - Las capturas no muestran personas y las fotos de planta quedan fuera del repo.
- [ ] **S2 · Sin secretos.** Sin secretos ni URLs privadas: `.env` no se versiona y las URLs de n8n siguen en null en el JSON.
- [ ] **S3 · Licencias.**
  - El árbol de producción (`npm ls --omit=dev --all`) solo tiene MIT, Apache-2.0, BSD, ISC o CC0. Nada GPL ni AGPL. `lightningcss` (MPL-2.0) se acepta solo para compilar.
  - Si hay assets 3D, su licencia está en `public/models/LICENSES.md`.
  - El README menciona three, R3F y drei en Licencias.

---

## 2. Protocolo de verificación por ronda

En `/home/user/artesa`, sin instalar nada:

```bash
npm run typecheck && npm run lint && npm test && npm run build
npx vite preview --port 4174 --strictPort &          # en segundo plano
SMOKE_URL=http://localhost:4174/ npm run smoke        # si existe
node /tmp/supervision/revisar.mjs                     # script playwright-core propio
pkill -f "vite preview --port 4174"
```

El script propio revisa:

- en 1440×900, 1024×768 y 390×844 (más 360 px), en claro y oscuro: plano 2D, diagrama, panel y rutas;
- en 3D: canvas, `renderer.info.render.calls` con `?debug`, clic en una zona, vistas de cámara y tour;
- los errores de consola, las peticiones externas y la carga diferida.

Guarda las capturas en `/tmp/supervision/` y el supervisor **las mira** antes de dar el veredicto. Las pruebas de datos (F4–F6) editan `dist/plant-layout.json` y lo restauran al terminar.

---

## 3. Observaciones iniciales · ronda 0 (lectura estática, sin builds)

**Fecha:** 2026-10-13 18:19 UTC. **Commit:** `6308e25` ("wip: punto de control de la Fase 1… aún no compila"), con unos 40 archivos modificados o nuevos sin commit: el árbol está en cambio. No se ejecutaron builds ni pruebas, a pedido.

| # | Observación | Afecta | Archivo |
|---|---|---|---|
| O1 | El README documenta `npm run smoke`, pero `package.json` no tiene ese script y no existe `scripts/`. Debe existir antes de la ronda 1 | F2 | `package.json`, `README.md` |
| O2 | `ed-complejo-central` no tiene polígono y su altura es estimada (8 m). Casi toda la producción está en él, así que el 3D tiene que resolver su envolvente de forma explícita | V3 | `public/plant-layout.json` |
| O3 | `altura_m` es null en 5 de los 6 edificios. Hace falta una altura representativa declarada | V3, U3 | `public/plant-layout.json` |
| O4 | Ningún equipo tiene `cantidad`. Solo esmaltado tiene `cantidad_min_observada` (2). En los puestos de decoración, el "al menos 5" (foto 2) solo está en `notas`. Para instanciar 5 hay que registrarlo como `cantidad_min_observada: 5` con su fuente; si no, se dibuja 1 representativo | V5 | `public/plant-layout.json` |
| O5 | Los hornos miden 20 m de largo, pero `z-horno` mide 19,5 m (z 70–89,5) y están centrados en z = 79,5. Sobresalen unos 0,25 m por cada extremo: hay que revisar que no atraviesen muros, o declararlo | V5 | `public/plant-layout.json` |
| O6 | `z-formacion` y `z-secado` no tienen polígono y tienen 6 equipos (5 métodos de formación y los racks de secado). Necesitan un tratamiento explícito en 3D | V6 | `public/plant-layout.json` |
| O7 | CLAUDE.md exige `public/models/LICENSES.md` si hay assets 3D, y hoy no existe. Si solo se usan primitivas, no aplica | S3 | `CLAUDE.md` |
| O8 | En `index.html`, el favicon usa la ruta absoluta `/favicon.svg` con `base: './'`. Hay que verificar en `dist/` que funcione desde una subcarpeta | U2 | `index.html` |
| O9 | `personal.dotacion` es agregado y no tiene nombres ni salarios: cumple. Hay cargos únicos (cantidad 1: Gerencia general, Jefe de producción…), con un riesgo bajo de reidentificación. Es aceptable, pero no se debe agregar más detalle por persona | S1 | `public/plant-layout.json` |
| O10 | `zona.responsable` es texto libre en el esquema, así que alguien podría escribir un nombre. Recomendado: documentar que es un **cargo** | S1 | `src/domain/schema.ts`, `README.md` |
| O11 | `LiveState` no se valida en tiempo de ejecución. Para la Fase 3 (n8n), un payload incompleto debe degradar a "Sin datos" | U5 | `src/domain/live.ts` |
| O12 | El remoto público tiene otras ramas ajenas al proyecto (`feat/aforo-inteligente-mvp`, `codex/…`). Se revisaron: `config.example.yaml` tiene `api_key: ""`, sin secretos | S2 | — |
| O13 | Bien: `fetch(..., { cache: 'no-store' })` en `useBootstrap` (facilita F4), carga diferida de `Scene3DView` ya en `App.tsx` y `CONFIG.debug` previsto para `?debug` | F4, V14, V15 | `src/app/useBootstrap.ts`, `src/App.tsx`, `src/config.ts` |

### 3.1 Decisiones del agente principal sobre la ronda 0 (commit `97c6e4d`)

Comunicadas por mensaje. Todavía **no** se han verificado: se comprueban en la Ronda 1.

| Obs. | Decisión | Qué se verificará en la Ronda 1 |
|---|---|---|
| O4 | **Adoptada.** `puesto-decoracion` tiene `cantidad_min_observada: 5` en el JSON y se eliminó la estimación por dotación. La regla vive en `src/features/escena3d/modelo/construirModelo.ts` → `cantidadEquipo`: `cantidad ?? cantidad_min_observada ?? 1`, con el origen declarado (`'json' \| 'minimo_observado' \| 'uno'`) | El JSON trae el campo y la fuente (foto-2) está en `notas`. Hay un test unitario de `cantidadEquipo` con los 3 orígenes. El panel o tooltip muestra el origen ("mín. observado (foto 2)" o "representativo · [POR DEFINIR]"). La dotación no se usa para contar equipos (grep) |
| O5 | **Adoptada.** El largo de un equipo se recorta al eje mayor de su zona menos 0,4 m por extremo y queda marcado como representativo | Los hornos no atraviesan muros (captura cenital y lateral). El panel declara el ajuste, p. ej. "Largo según croquis 20 m (aprox.) · dibujado 18,7 m para caber en la zona", sin ocultar el dato del JSON. Hay un test del recorte. Una zona más corta que 0,8 m no produce un largo ≤ 0 |
| O10 | **Adoptada.** El README documenta que `responsable` lleva un cargo, nunca un nombre | Texto presente en el README |
| O2, O3, O6 | **En las instrucciones del 3D:** alturas y envolvente supuestas y declaradas en la UI. Las zonas y los equipos sin ubicar van fuera de la planta, en un panel aparte | V3, V6 y U3 en la Ronda 1 |
| O1 | **Pendiente:** el integrador de la Fase 1 crea `npm run smoke` | F2 en la Ronda 1 |

---

## 4. Acuerdos de diferimiento

Ítems de la DoD que el agente principal y el supervisor acuerdan diferir, con el motivo y la fase destino.

| Ítem | Motivo | Fase destino | Ronda del acuerdo |
|---|---|---|---|
| — | — | — | — |

---

## 5. Bitácora de revisiones

Plantilla de cada ronda:

```
### Ronda N · AAAA-MM-DD HH:MM UTC · commit <hash>
Veredicto: APROBADO | NO APROBADO
Bloqueantes: 1. … (repro · archivo)
Mejoras: …
Verificación: comandos y resultados; capturas revisadas (/tmp/supervision/…)
Estado de bloqueantes de rondas anteriores: …
```

### Ronda 1A · 2026-10-13 19:24 UTC · commit `570ae65` (Fase 1, 2D)

**Alcance:** ítems de la DoD aplicables a la Fase 1, es decir F1–F8, U, Q y S, más lo del 2D. V y F9 quedan para la Ronda 1B, porque en este commit la vista 3D sigue siendo un stub.

**Aislamiento:** un worktree `--detach` en `/tmp/artesa-r1` con `npm ci` propio, sin enlace a `node_modules` del árbol principal. Ningún `tsc` corrió con el enlace que se borró, así que no hubo caché compartida: los `*.tsbuildinfo` del árbol principal tienen hora 19:11, anterior al worktree. El worktree se quitó al terminar.

**Veredicto: NO APROBADO** (alcance de la Fase 1). Hay 3 bloqueantes, todos acotados y de arreglo rápido. El resto del 2D cumple y está bien hecho.

**Bloqueantes**

1. **F5 / Q5 · Los errores de un JSON inválido salen en inglés o confunden.**
   - Repro: en un preview, editar `dist/plant-layout.json` y recargar.
     - Con `zonas[2].poligono = "texto"` aparece «✖ Invalid input: expected array, received string → at zonas[2].poligono».
     - Truncado (sintaxis rota) aparece «Expected double-quoted property name in JSON at position 5000 (line 161 column 22)».
     - Borrado (404) aparece «Unexpected token '<', "<!doctype "... is not valid JSON»: el servidor devuelve `index.html` y el mensaje no dice que falta el archivo.
     - Capturas: `/tmp/supervision/r1a/j-error-tipo.png`, `j-error-sintaxis.png` y `j-error-ausente.png`.
   - Archivos: `src/domain/validate.ts` y `src/app/useBootstrap.ts`.
   - Sugerencia: `z.config(z.locales.es())` (zod 4.6.7 trae `es`; verificado: «Entrada inválida: se esperaba arreglo, recibido texto») y formatear cada issue como `ruta: mensaje`, sin el «→ at» de `prettifyError`. Además, capturar el SyntaxError («plant-layout.json no es JSON válido cerca de la línea L, columna C») y detectar una respuesta HTML o un 404 («No se encontró plant-layout.json en …»).
2. **Q4 · Contraste por debajo de AA en textos principales.** Mediciones con un script propio, sobre texto HTML visible:
   - «Sin datos» mide **2,54:1** en claro (rgb 156,163,175 sobre blanco) y **3,46:1** en oscuro. Aparece en los nodos del diagrama (11 px), en el panel (14 px, p. ej. «Merma: Sin datos») y en los chips de ruta sin dato. Es justo el texto que exige F6.
   - El botón activo **«Plano 2D»** en oscuro mide **2,26:1** (blanco sobre rgb 251,146,60).
   - Archivos: `src/features/proceso/EtapaNode.tsx` (`Metrica` usa `colorEstado('sin_datos')` como color de texto), `src/features/detalle/*` (mismo patrón), `src/components/RouteChips.tsx`, `src/components/ModoPlantaToggle.tsx` (`bg-acento text-white`) y los tokens de `src/index.css`.
   - Sugerencia: dejar el gris de estado para el punto o el relleno y usar `text-tenue` (o un gris ≥ 4,5:1) para el texto. En oscuro, texto oscuro sobre el acento, o un acento más oscuro.
3. **F1 · El aviso del build no está resuelto ni explicado.** `vite build` avisa «Some chunks are larger than 500 kB» (`index-*.js`: 963,56 kB, 292,81 kB gzip). La DoD pide resolverlo o explicarlo.
   - Repro: `npm run build`.
   - Archivos: `vite.config.ts` y `README.md`.
   - Sugerencia: separar `@xyflow/react`, `recharts` y `zod` en chunks de proveedor, o subir `chunkSizeWarningLimit` con la justificación escrita en el README (el chunk 3D ya está aparte).

**Mejoras** (por prioridad, no bloquean)

- **P1 · Diagrama ilegible en el encuadre inicial.** A 1440×900 y en móvil, el diagrama se encuadra entero y el texto de los nodos queda en ~4 px; hay que acercar para leer cualquier cosa (`d-1440-claro.png`, `movil-390-dark-proceso.png`).
  - Para gerencia conviene un encuadre inicial legible (p. ej. la franja de la fase de la selección o de la ruta activa) o un zoom mínimo mayor con desplazamiento.
  - En móvil hay además mucho espacio vacío sobre el diagrama.
- **P1 · Contrastes límite (4,0–4,5:1, texto de 11–12 px).**
  - El distintivo «DATOS SIMULADOS» en claro mide 4,21. Es un elemento de honestidad, conviene subirlo.
  - Los códigos de etapa de la Fase 1 (1.x) miden 4,21 y los de la Fase 3 (3.x) quedan justo en el borde de 4,5 (4,497).
  - El chip «V» mide 4,05 y el chip de ruta pulsado, 3,63.
- **P2 · Tablet 1024×768 con el panel abierto.** Las dos columnas quedan de ~290 px y el plano se vuelve muy chico (`tablet-1024-light-panel.png`). Se podría apilar las vistas o usar el panel superpuesto por debajo de ~1280 px.
- **P2 · Objetivos táctiles de 28 px en móvil.** Afecta a «Plano 2D» / «Vista 3D», «Estado» / «Grupo», «Flujos» y al zoom. Cumple AA de WCAG 2.5.8 (≥ 24 px), pero conviene ≥ 40 px, y en el conmutador 2D/3D lo exige V19 en la Ronda 1B.
- **P2 · Rótulos truncados en el plano a 100 %.** Por ejemplo «Materi…», «Kera… (imp… digi…», «CF (¿Cl…». Hay tooltip; se podría usar un rótulo corto desde el JSON.
- **P3 · KPIs cortados con el panel abierto a 1440.** La barra de KPIs se corta en el borde del panel (las tarjetas siguen accesibles con scroll). Un degradado indicaría que hay más.
- **Pendientes para el cierre** (no se evalúan en esta ronda):
  - U1: el README no tiene capturas;
  - U2: faltan los pasos para publicar `dist/` y editar `dist/plant-layout.json` sin recompilar;
  - S3: el apartado de Licencias del README no nombra three, R3F ni drei, que ya son dependencias;
  - Q2: `construirModelo.ts` tiene 244 líneas;
  - Q6: el stub «Vista 3D (en construcción)».

**Verificación**

- `npm run typecheck` → 0. `npm run lint` → 0, sin avisos. `npm test` → **9 archivos, 114 pruebas OK**. `npm run build` → 0, con aviso de chunk (bloqueante 3).
- `SMOKE_URL=http://localhost:4174/ npm run smoke` → **20/20 PASS** (escritorio 11/11, móvil 9/9).
- Script propio `/tmp/supervision/revisar-r1a.mjs` → **87 PASS, 4 FAIL, 13 NOTE**. Los 4 FAIL son el contraste en claro y en oscuro y los mensajes en inglés (×2).
  - **2D:** 35 zonas (2 sin ubicar) y 35 etapas.
  - **Ids sin datos:** N0, V, Tienda, una zona nueva y un equipo nuevo aparecen en gris «Sin datos» (relleno rgb 156,163,175).
  - **Sincronía:** zona Hornos ↔ nodos 1.5 y 3.1; nodo 2.4 ↔ zona Esmaltado; equipo ↔ resalte de su zona; alarma → panel del equipo; etapa 1.7 sin zona → «sin ubicar».
  - **Rutas:** R7 en el plano (pasos 1·4→2→3→5) y en el diagrama (5 nodos en ruta); «Sin ruta» la quita; R5 funciona por toque en móvil.
  - **Conmutadores:** Color Estado/Grupo y Flujos (19 → 0).
  - **Teclado:** Tab llega a zonas y nodos. Enter abre el panel y el foco entra; Esc lo cierra y devuelve el foco a la zona.
  - **Guion con `page.clock`:**
    - min 20: hornos en espera;
    - min 120: hornos operando;
    - min 220: 3.1 detenido con alarma crítica, la zona Hornos con marcador y «Alarmas activas: 1 (1 crítica)»; 1.5 sigue operando;
    - min 250: la alarma terminó;
    - min 286: almuerzo, con 1.3, 2.1, 2.2 y 2.3 a 0 pzs/h;
    - min 316: 2.4 y la zona Esmaltado en mantenimiento;
    - min 346: vuelve a operar;
    - el reloj avanza 2 min por segundo; tras el minuto 480 empieza el turno siguiente (15:04).
  - **Determinismo:** dos cargas en el minuto 150 dan KPIs y estados de etapas idénticos.
  - **JSON en `dist/`:** se verificaron la zona agregada, el renombre, el vértice movido, la celda 2.5 movida en el diagrama y el equipo nuevo; con una referencia rota aparece un error legible con el id. El archivo se restauró y se comprobó con `cmp`.
  - **Responsive:** sin scroll horizontal ni errores de consola a 1440, 1024, 390 y 360 px, en claro y oscuro; el tema del sistema se respeta.
  - **Carga diferida:** el chunk `Scene3DView-*.js` no se pide en 2D y sí al abrir la Vista 3D.
  - **Red y consola:** 0 peticiones a terceros, 0 fallidas y 0 avisos de consola.
- **Subcarpeta:** `dist/` servido en `http://localhost:4175/artesa/` (python http.server) carga sin fallas, con el favicon en 200. O8 queda cerrada.
- **S1/S2:** no hay correos, teléfonos, cédulas ni salarios. `responsable` sigue en null y las URLs de `fuentes_de_datos` en null.
- **S3:** el árbol de producción tiene 91 MIT, 19 ISC, 5 Apache-2.0, 2 BSD-3, `victory-vendor` (MIT AND ISC) y `webgl-constants` (sin campo en `package.json`, pero su LICENSE es MIT). Nada GPL.
- **Q2:** el `.tsx` más largo tiene 152 líneas.
- **Q3:** `kpiModel.ts` solo da formato; el «Personal 64» es un conteo de la dotación del JSON.
- **U5:** ningún `import` de `data/mock` fuera de `src/data/`.
- **Capturas revisadas** en `/tmp/supervision/r1a/`: `d-1440-claro`, `d-1440-oscuro`, `d-ruta-R7`, `g-min220-alarma`, `j-modificado`, `j-error-tipo`, `tablet-1024-light-panel`, `tablet-1024-dark-planta`, `movil-360-light-planta`, `movil-390-dark-proceso` y `movil-390-dark-panel-etapa`.

**Estado de la ronda 0:**

- Cerradas: O1 (existe `npm run smoke`), O4 (`cantidad_min_observada: 5` en el JSON), O8 (favicon en subcarpeta) y O10 (README).
- Pendientes de la Ronda 1B: O2, O3, O5, O6 y la verificación del panel de O4/O5.

**Tablero de la DoD tras la R1A**

| Ítem | Estado | Nota |
|---|---|---|
| F1 | `[!]` | Aviso de chunk (bloqueante 3) |
| F2 | `[ ]` | El 2D está bien (20/20); falta la parte 3D (R1B) |
| F3, F4, F6, F8 | `[x]` en 2D, diagrama y panel | Falta el 3D (R1B) |
| F5 | `[!]` | Bloqueante 1 |
| F7 | `[x]` | Guion y determinismo |
| F9, V1–V14, V16–V20 | `[ ]` | R1B |
| V15 | `[ ]` | Parcial: diferido y sin terceros en 2D; se revalida con el 3D real |
| U1, U2, U4 | `[ ]` | Cierre. Subcarpeta verificada |
| U3, U5 | `[x]` en 2D | — |
| Q1, Q6 | `[ ]` | R1B |
| Q2, Q3 | `[x]` en 2D | — |
| Q4, Q5 | `[!]` | Bloqueantes 1 y 2 |
| S1, S2 | `[x]` | — |
| S3 | `[ ]` | Falta el README de Licencias con three/R3F/drei |
