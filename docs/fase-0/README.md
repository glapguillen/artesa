# Fase 0 – Lectura de insumos y plan (sin código) · v0.2

**Estado:** preliminar, pendiente de validación. No se ha escrito código de la aplicación.

**Insumos recibidos**

- Croquis a lápiz de la planta (foto, sin escala ni norte).
- 5 fotos del interior de la planta (F1–F5).
- Documento de contexto con el stack recomendado y el prompt maestro.
- **Flujograma ARTESA 2025**, que en la v0.2 pasa a ser la fuente del proceso.

**Entregables**

| Archivo | Contenido |
|---|---|
| `docs/fase-0/README.md` | Este informe |
| `docs/fase-0/plant-layout.preliminar.json` | Planta física (zonas del croquis) + proceso oficial (etapas, rutas y clasificaciones del flujograma), enlazados entre sí |
| `docs/fase-0/plano-reinterpretado.svg` | Plano con la etapa del flujograma en cada zona y los flujos coloreados por fase |
| `docs/datos-faltantes.md` | Preguntas abiertas, faltantes y contradicciones |

> **Medidas.** El croquis no tiene cotas. Se supuso **10 px de la foto = 1 m** y que la parte superior de la hoja es el norte. Todas las medidas son "aprox.". Con 2 medidas reales se recalibra todo de una vez.

**Cambios respecto de la v0.1**

- El proceso ya no es una interpretación mía: sale del flujograma.
- Se resolvieron o encaminaron 6 preguntas: Kerajet, Impresión 3D, CF, hornos, trazado y moliendas.
- Aparecieron etapas que no tienen lugar en el croquis: piscinas, bodega de bizcocho, señalado, calcomanía y recuperación.

---

## 1. Flujograma ARTESA 2025: lectura

Cada etapa recibe un código, que es el que usan el JSON y el plano.

| Bloque | Etapas | Unidad de control |
|---|---|---|
| **Nivel 0 · Ingeniería** | **N0** Fichas técnicas. La de FORMA define la ruta de formación y la receta de pasta; la de ARTÍCULO/SKU define la ruta de decoración y las recetas de color y esmalte. Ambas se apoyan en bases de datos de recetas | — |
| **A · Stock de esmaltes y colores** | **A1** Stock MP para esmaltes → **A2** Preparación de colores/esmaltes (según receta) → **A3** Stock de esmaltes y colores → **A4** Descarga (consumo/ajustes) | — |
| **B · Stock de pastas** | **B1** Stock MP para pasta → **B2** Preparación de pasta (según receta) → **B3** Stock de pasta líquida (barbotina) **o** **B4** Stock de pasta extrusada. Además **B5** registra bajas y ajustes (desperdicio, variabilidad) | — |
| **Fase 1 · Formación y bizcocho** | **1.1** Formación por uno de 7 métodos (colado vaciado, colado presión, torno alfarero, torno roller, prensa RAM, impresora 3D, modelado) → **1.2** CC de formación → **1.3** Pulido → **1.4** Piscina pulido (WIP) → **1.5** Quema bizcocho → **1.6** Piscina quemado 1 → **1.7** Clasificación bizcocho. Si es buena va a **1.8** Bodega bizcocho; si es mala, a **1.9** Baja por desecho | **FORMA** |
| **Transición** | Al salir de Bodega bizcocho la pieza pasa de **Forma → Artículo (SKU)** | — |
| **Fase 2 · Decoración y esmaltado** | **2.0** Tipo de salida: las roturas, muestras y pruebas se dan de baja del inventario de bodega; la producción sigue la ruta asignada **R1–R9**, que combina **2.1** Señalado, **2.2** Trazado, **2.3** Decorado, **2.4** Esmaltado y **2.5** Impresión digital, y termina en **2.6** Piscina esmaltado (WIP) | **SKU** |
| **Fase 3 · Quema esmalte, clasificación y calcomanía** | **3.1** Quema esmalte → **3.2** Piscina quemado 2 → **3.3** Clasificación final, con estos destinos: piezas OK pero sin calcomanía pasan por **3.4** Aplicar calcomanía y **3.5** Quema calcomanía; las de Tipo A, B y C van a **3.6** Bodega PT; el desecho va a **3.7** Basura; lo recuperable va a **3.8** Recuperación | **SKU** |

**Rutas de decoración (Fase 2)**

| Ruta | Código | Pasos |
|---|---|---|
| R1 | S+T+D+E | Señalado → Trazado → Decorado → Esmaltado |
| R2 | S+D+E | Señalado → Decorado → Esmaltado |
| R3 | T+D+E | Trazado → Decorado → Esmaltado |
| R4 | D+E | Decorado → Esmaltado |
| R5 | E | Esmaltado |
| R6 | D+E+ID | Decorado → Esmaltado → Impresión digital |
| R7 | D+E+ID+D | Decorado → Esmaltado → Impresión digital → Decorado 2 |
| R8 | E+ID+D | Esmaltado → Impresión digital → Decorado |
| R9 | E+ID | Esmaltado → Impresión digital |

Las nueve rutas terminan en la Piscina esmaltado (2.6) y de ahí pasan a la Quema esmalte (3.1).

## 2. El croquis, zona por zona, cruzado con el flujograma

Ejes: X hacia la derecha de la hoja, Z hacia abajo, origen en la esquina superior izquierda de lo dibujado. Las medidas son ancho × largo, en metros aprox.

- **Etapa** = asignación razonablemente segura.
- **¿?** = asignación probable, por confirmar.

### Bloque norte: materias primas

| Zona | Medidas | Puertas | Etapa | Comentario |
|---|---|---|---|---|
| Materias primas 1 | 15 × 13,5 | — | ¿B1? | Contigua a Molienda 1 |
| Molienda 1 | 15 × 11 | Este | ¿B2? | ¿Preparación de pasta (barbotina)? |
| Materias primas 2 | 15 × 24,5 | **ninguna** | ¿A1 o B1? | ¿MP de pasta o de esmaltes? |
| Bahía este *(sin rótulo)* | 12,5 × 24,5 | **ninguna** | — | Desconocida |

### Bloque central: producción (sin envolvente dibujada)

| Zona | Medidas | Puertas | Etapa | Comentario |
|---|---|---|---|---|
| Filtro prensa *(solo texto)* | ≈12,5 × 8,5 | — | B2 | Deshidrata la barbotina |
| Laboratorio 2 | 10,5 × 9 | Sur | ¿N0? | ¿Recetas de pasta? |
| **Kerajet** | 12 × 25 | — | **2.5** | Se asume que es la "Impresión digital" de R6–R9 |
| Monte Turi *(solo texto)* | ≈15,5 × 25 | — | — | **Sin identificar.** ¿Área de formación? |
| Molienda 2 | 17 × 6,5 | — | ¿A2? | ¿Preparación de colores y esmaltes? |
| Extrusora *(solo texto)* | ≈18 × 9,5 | — | B2 · B4 | Produce la pasta extrusada |
| **Impresión 3D** | 34,5 × 12 | — | **1.1** · ¿1.2? | Método de formación RF6 (antes lo había leído como prototipos) |
| Pulido | 8,5 × 13,5 | — | 1.3 · ¿1.4? | ¿También es la Piscina pulido física? |
| **Hornos** | 7,5 × 19,5 | — | **1.5 · 3.1** · ¿3.5? | La foto 4 muestra **2 hornos**: ¿uno de bizcocho y otro de esmalte? |
| Esmaltado | 18,5 × 10 | — | 2.4 · ¿2.6? | Debajo hay un rótulo "ESMALTADO" borrado |
| **Trazado** *(solo texto)* | ≈36,5 × 23 | Portón sur | **2.2** · ¿2.1? | Confirmado como etapa T. ¿El señalado (S) se hace también aquí? |

### Bloque oriente: laboratorios, decoración y administración

| Zona | Medidas | Puertas | Etapa | Comentario |
|---|---|---|---|---|
| Laboratorio 1 | 15 × 5,5 | Oeste | ¿N0? | ¿Recetas de esmaltes y colores? |
| I+D | 15 × 7,5 | Oeste | ¿N0? | ¿Ingeniería: fichas FORMA y SKU? |
| Bodega de suministros | 30,5 × 19 | **ninguna** | — | Insumos |
| Decorado | 15 × 23,5 | Este, hacia administración | 2.3 | Incluye el "Decorado 2" de R7 (foto 2) |
| Administración (L) | 17 × 36,5 | Este, hacia museo | — | |
| Oficinas de producción | 20 × 13 | Oeste, hacia trazado | — | |
| Museo | 15,5 × 36,5 | Sur, hacia tienda | — | |

### Bloque oeste: Outlet / Bodega

| Zona | Medidas | Puertas | Etapa | Comentario |
|---|---|---|---|---|
| **CF** | 12 × 9 | Este, hacia hornos | **¿3.3?** | La sigla y la posición encajan con **Clasificación final**: está junto a los hornos y a la bodega |
| Bodega | 25,5 × 17 | Este, hacia trazado | ¿3.6? | ¿Bodega PT o Bodega bizcocho (1.8)? |
| Outlet (bloque bodega) | 31,5 × 12 | — | ¿V? | Sin división con Bodega. ¿Vende Tipo B y C? |
| Franjas oeste y sur *(sin rótulo)* | 9,5 × 29 y 35 × 6 | — | — | ¿Pasillos o andenes? |

### Bloque sur: comercial y servicios

| Zona | Medidas | Puertas | Etapa | Comentario |
|---|---|---|---|---|
| Outlet (bloque sur) | 21,5 × 17 | Este | V | La venta no está en el flujograma: viene del croquis |
| Comedor | 21,5 × 11 | Este | — | |
| Cocina | 21,5 × 6,5 | Este | — | |
| Academia | 21,5 × 14 | Este | — | |
| Parqueadero | 41 × 47,5 | — | — | |
| Tienda | 56,5 × 26 | Oeste | V | |

Lo dibujado ocupa **≈125 × 157 m** con la escala supuesta.

### Etapas sin lugar en el croquis

- **13 etapas no tienen zona:**
  - Bloques A y B: A3 y A4, B3 (stock de pasta líquida) y B5.
  - Fase 1: la piscina quemado 1 (1.6), la clasificación de bizcocho (1.7), la bodega de bizcocho (1.8) y la baja por desecho (1.9).
  - Fase 2: el tipo de salida (2.0).
  - Fase 3: la piscina quemado 2 (3.2), aplicar calcomanía (3.4), basura (3.7) y recuperación (3.8).
- **Formación:** 6 de los 7 métodos (todos menos Impresora 3D) tampoco tienen zona. La foto 5 muestra que existe un área de formación y secado.

### Flujo físico resultante

```
B  MP ─▶ Molienda 1 ─▶ Filtro prensa ─▶ Extrusora                   (pasta)
A  ¿Molienda 2? ─▶ Esmaltado / Decorado                              (esmaltes y colores)
F1 Formación* ─▶ Pulido ─▶ HORNOS (bizcocho) ─▶ [clasificación y bodega bizcocho*]
   Impresión 3D ─▶ Pulido
F2 Trazado ─▶ Decorado ─▶ Esmaltado ──────────────────────────┐   (R1–R5)
                 ▲            └─▶ KERAJET ─▶ Decorado ──────┤   (R6–R9)
F3 HORNOS (esmalte) ─▶ CF (¿clasificación final?) ─▶ Bodega ─▶ Outlet / Tienda
   * Sin ubicar en el croquis.
```

### Hallazgo: las rutas con impresión digital recorren mucho más

Kerajet está en el extremo oeste, lejos de Esmaltado, Decorado y Hornos. Midiendo en línea recta entre los centros de las zonas, con la escala supuesta, desde la primera estación hasta los hornos:

| Rutas | Recorrido aprox. |
|---|---|
| R5 | 15 m |
| R4 | 34 m |
| R1, R2, R3 | 62 m |
| R9 | 108 m |
| R6 | 127 m |
| R8 | 172 m |
| **R7** | **191 m** (cruza la planta dos veces) |

Los valores absolutos dependen de la escala, pero la proporción no: las rutas con impresión digital recorren entre 2 y 3 veces más. El plano lo muestra con los flujos 11, 12 y 14, y será un buen indicador para la Fase 2 del visor.

---

## 3. Foto → zona → elementos observados

| Foto | Zona y etapa probables | Elementos observados |
|---|---|---|
| **F1** | Pulido (1.3), Piscina pulido (1.4) o Bodega bizcocho (1.8) (**baja**) | 8 o más pilas de platos sin esmaltar sobre una superficie de baldosa blanca. Estanterías con tazas, bowls, jarras, teteras y bowls con relieve. Piezas planas apiladas y celosías caladas. Una operaria repasa piezas en mesas largas. Al fondo: mezanine con estanterías, una máquina azul con ductos y una posible cámara de seguridad. Letrero "SALIDA", cartel "IMPORTANTE" con íconos de EPP, luminarias colgantes y tragaluces |
| **F2** | Decorado (2.3) (**media**) | Pasillo largo con líneas amarillas. Carros rodantes con bizcocho blanco (WIP). Mesas de decoración con platos y sillas con cojín. Exhibidores de madera en arco y una vitrina con piezas pintadas (muestrario). Muro de ladrillo con ventana, señal de no fumar, cartel ARTESA y personal con mandil beige |
| **F3** | Esmaltado (2.4) (**media**) | Al menos 2 máquinas o cabinas con tablero de control. Una operaria con respirador aplica esmalte. Tazas rosadas con esmalte crudo, mesas rodantes con baldes de esmalte y ductos de extracción. Estanterías vacías y una estantería con cajas (¿moldes?) |
| **F4** | Hornos (1.5 y 3.1) (**alta**) | **Dos hornos continuos en paralelo**, con entradas de rodillos y cadena. Izquierda: tazas moradas y platos esmaltados (¿quema de esmalte?). Derecha: placas con soportes refractarios (¿bizcocho?). Grandes ductos aislados, logotipo parcial "…cnochimica", señal "EXTINTOR" y manguera de aire |
| **F5** | Formación (1.1) y secado (¿1.4?): **no están en el croquis** (**media**) | Racks altos con tablas llenas de platos en crudo. Bowls en crudo sobre un banco, un cilindro de yeso o arcilla sobre un eje y una operaria con mascarilla. Ductos, tragaluces y ventanales altos |

Las fotos se quedan fuera del repositorio porque muestran a personas reconocibles.

---

## 4. `plant-layout.json` preliminar (v0.2) y plano SVG

- **Archivo:** [`plant-layout.preliminar.json`](plant-layout.preliminar.json). Sigue la estructura del documento y agrega lo siguiente:
  - **`proceso`**, con todo lo que sale del flujograma:
    - `etapas`: las 35 etapas con su código, fase, tipo (proceso, inventario, decisión, control de calidad o registro) y unidad de control (`forma` o `sku`). Cada etapa indica en qué zonas está, en cuáles probablemente está, y su estado: `ubicada`, `hipotesis` o `sin_ubicar`.
    - `rutas_formacion` (RF1–RF7). El insumo de cada una (pasta líquida o extrusada) es inferido.
    - `rutas_decoracion` (R1–R9), con sus pasos.
    - `clasificaciones` de bizcocho (1.7) y final (3.3).
    - `unidad_de_control`: FORMA en la Fase 1, SKU en las Fases 2 y 3.
  - **Zonas:** cada una lleva `etapas` y `etapas_hipotesis`, además de los campos de la v0.1 (`rotulo_croquis`, `recinto_cerrado`, `precision`, `confianza`).
  - **Flujos** entre zonas, con `fase`, `etapas` y `rutas`; por ejemplo, "Esmaltado → Kerajet" corresponde a R6–R9.
  - **Equipos** enlazados a una etapa, incluidos los 7 métodos de formación del flujograma. Los que no tienen ubicación apuntan a la zona `z-formacion`, que no tiene polígono.
  - **KPIs** derivados del flujograma: WIP por piscina, % de bizcocho bueno, mix de clasificación final (A/B/C/desecho/recuperable), rechazo en CC por método, bajas de pasta y consumo de esmaltes.
  - **Dato desconocido = `null`.** No hay medidas ni cantidades inventadas.
- **Plano:** [`plano-reinterpretado.svg`](plano-reinterpretado.svg). Cada zona muestra el código de su etapa (en negro si la asignación es razonablemente segura, en gris con "?" si es probable). Los flujos están coloreados por fase y numerados. A la derecha hay una tabla con cada etapa del flujograma y su zona, marcando en rojo las que no tienen ubicación.

---

## 5. Datos faltantes, ilegibles y contradictorios

Ver [`../datos-faltantes.md`](../datos-faltantes.md).

---

## 6. Lo que propongo para la Fase 1 (después de tu validación)

El flujograma cambia el enfoque: la vista de proceso debe ser **el flujograma mismo**, y no un grafo de zonas inventado.

1. **Diagrama de proceso (React Flow):** un nodo por etapa, con las piscinas como nodos de inventario que muestran el WIP. Las rutas R1–R9 se pueden seleccionar para resaltarlas, y la Fase 1 se distingue visualmente (por forma) de las Fases 2 y 3 (por SKU).
2. **Vista de planta 2D:** el plano de este JSON, con cada zona coloreada según el estado de sus etapas y las rutas seleccionadas dibujadas sobre el plano.
3. **Barra de KPIs** con `MockDataSource`: WIP por piscina, % de bizcocho bueno, mix de clasificación final y producción del turno.
4. Esquema zod que valide tanto la parte `proceso` como la parte física del JSON.

**Me detengo aquí hasta que valides la Fase 0.**
