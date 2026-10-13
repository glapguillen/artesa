# Fase 0 – Lectura de insumos y plan (sin código)

**Estado:** preliminar, pendiente de validación. No se ha escrito código de la aplicación.

**Insumos recibidos**

- Croquis a lápiz de la planta, en una foto sin escala ni norte.
- 5 fotos del interior de la planta (F1–F5).
- El documento de contexto con el stack recomendado y el prompt maestro.
- El repositorio estaba vacío: `main` solo tiene `.gitkeep`, y las otras ramas son de proyectos ajenos a este (aforo inteligente y dashboard de inversión).

**Entregables de esta fase**

| Archivo | Contenido |
|---|---|
| `docs/fase-0/README.md` | Este informe (puntos 1 a 3) |
| `docs/fase-0/plant-layout.preliminar.json` | Layout preliminar con 35 zonas, 6 edificios, 16 accesos, 11 equipos y 19 flujos |
| `docs/fase-0/plano-reinterpretado.svg` | Plano limpio generado desde ese JSON |
| `docs/datos-faltantes.md` | Punto 4: datos faltantes, ilegibles y contradictorios |

> **Convención de medidas.** El croquis no tiene cotas. Se supuso **10 px de la foto del croquis = 1 m** y que la parte superior de la hoja es el norte. Todas las medidas de abajo son "aprox." y sirven para el layout, no para obra. Con 2 medidas reales se recalibra todo de una vez.

---

## 1. El croquis, zona por zona

Los ejes van así: **X** hacia la derecha de la hoja y **Z** hacia abajo, con el origen en la esquina superior izquierda de lo dibujado. Las medidas son ancho × largo, en metros aprox.

### Bloque norte: materias primas (dos edificios separados)

| Zona | Rótulo | Trazo | Medidas aprox. | Puertas | Interpretación |
|---|---|---|---|---|---|
| Materias primas 1 | MATERIAS PRIMAS | Recinto | 15 × 13,5 | — | Almacén de arcillas e insumos |
| Molienda 1 | MOLIENDA | Recinto | 15 × 11 | Este | Molinos para preparar barbotina, contiguos a materias primas 1 |
| Materias primas 2 | MATERIAS PRIMAS | Recinto | 15 × 24,5 | **ninguna** | Segundo almacén |
| Bahía este | *(sin rótulo)* | Recinto | 12,5 × 24,5 | **ninguna** | Desconocida |

### Bloque central: producción (sin envolvente dibujada)

| Zona | Rótulo | Trazo | Medidas aprox. | Puertas | Interpretación |
|---|---|---|---|---|---|
| Filtro prensa | FILTRO PRENSA | Solo texto | ≈12,5 × 8,5 | — | Deshidrata la barbotina y la convierte en tortas de pasta |
| Laboratorio 2 | LAB 2 | Recinto | 10,5 × 9 | Sur | ¿Laboratorio de pastas? Está junto al filtro prensa |
| Kerajet | KERAJET | Recinto | 12 × 25 | — | Impresora inkjet digital para cerámica (KERAjet es una marca) |
| Monte Turi | MONTE TURI | Solo texto | ≈15,5 × 25 | — | **No identificado.** Arriba hay además una palabra borrada |
| Molienda 2 | MOLIENDA | Recinto | 17 × 6,5 | — | ¿Molienda de esmaltes o segunda de pasta? |
| Extrusora | EXTRUSORA | Solo texto | ≈18 × 9,5 | — | Extrusión o amasado de la pasta plástica |
| Impresión 3D | IMPRESIÓN 3D | Recinto | 34,5 × 12 | — | ¿Prototipos o matrices de moldes? Parece desproporcionado |
| Pulido | PULIDO | Recinto | 8,5 × 13,5 | — | Repasado de la pieza seca antes de la 1.ª quema |
| Horno | HORNO | Recinto | 7,5 × 19,5 | — | Hornos. La foto 4 muestra **dos** bocas en paralelo |
| Esmaltado | ESMALTADO | Recinto | 18,5 × 10 | — | Esmaltado. Debajo hay un rótulo "ESMALTADO" **borrado** |
| Trazado | TRAZADO | Solo texto | ≈36,5 × 23 | Portón sur (~5 m) | Área abierta para trazar el diseño sobre el bizcocho. El portón parece el acceso a producción |

### Bloque oriente: laboratorios, decoración y administración (contiguo al central)

| Zona | Rótulo | Trazo | Medidas aprox. | Puertas | Interpretación |
|---|---|---|---|---|---|
| Laboratorio 1 | LABOR. 1 | Recinto | 15 × 5,5 | Oeste | ¿Laboratorio de esmaltes y colores? |
| I+D | I+D | Recinto | 15 × 7,5 | Oeste | Desarrollo |
| Bodega de suministros | BODEGA DE SUMINISTROS | Recinto | 30,5 × 19 | **ninguna** | Insumos |
| Decorado | DECORADO | Recinto | 15 × 23,5 | Este, hacia administración | Decoración a mano (foto 2) |
| Administración | ADMINISTRACIÓN | Recinto en L | 17 × 36,5 | Este, hacia museo | Oficinas generales |
| Oficinas de producción | OFICINAS PRODUCCIÓN | Recinto | 20 × 13 | Oeste, hacia trazado | Jefatura de planta |
| Museo | MUSEO | Recinto | 15,5 × 36,5 | Sur, hacia tienda | Visitas |

### Bloque oeste: Outlet / Bodega (un solo edificio)

| Zona | Rótulo | Trazo | Medidas aprox. | Puertas | Interpretación |
|---|---|---|---|---|---|
| Outlet (bloque bodega) | OUTLET | Recinto **sin división** con Bodega | 31,5 × 12 | — | ¿Outlet o bodega de saldos? |
| CF | CF | Recinto | 12 × 9 | Este, hacia horno | **Sigla sin identificar.** ¿Control final? |
| Bodega | BODEGA | Recinto | 25,5 × 17 | Este, hacia trazado | Se asume bodega de producto terminado |
| Franja oeste | *(sin rótulo)* | Recinto | 9,5 × 29 | — | ¿Pasillo o andén? |
| Franja sur | *(sin rótulo)* | Recinto | 35 × 6 | — | ¿Pasillo o andén? |

### Bloque sur: comercial y servicios

| Zona | Rótulo | Trazo | Medidas aprox. | Puertas | Interpretación |
|---|---|---|---|---|---|
| Outlet (bloque sur) | OUTLET | Recinto | 21,5 × 17 | Este | Segundo outlet |
| Comedor | COMEDOR | Recinto | 21,5 × 11 | Este | Comedor del personal |
| Cocina | COCINA | Recinto | 21,5 × 6,5 | Este | Cocina |
| Academia ARTESA | ACADEMIA ARTESA | Recinto | 21,5 × 14 | Este | Formación |
| Parqueadero | PARQUEADERO | Recinto | 41 × 47,5 | — | Exterior. Las puertas del bloque de servicios dan al pasillo de ~5 m entre ese bloque y el parqueadero |
| Tienda | TIENDA | Polígono irregular | 56,5 × 26 | Oeste, hacia el parqueadero | Su lado norte es la fachada de oficinas y museo |

Lo dibujado ocupa **≈125 × 157 m** con la escala supuesta. Es la envolvente del croquis, no el lote real.

### Secuencia de flujo que interpreto

```
 1 Materias primas (MP1, MP2)
 2 Molienda 1 ──────────── barbotina
 3 Filtro prensa ───────── tortas de pasta          [Lab 2 controla]
 4 Extrusora ───────────── pasta plástica
 5 Conformado*  (colado / calibrado)
 6 Secado*
 7 Pulido ──────────────── pieza seca repasada
 8 HORNO (1.ª quema, bizcochado)
 9 Trazado ─────────────── trazo del diseño sobre el bizcocho
10 Decorado (a mano)       [¿Kerajet = decoración digital?]
11 Esmaltado               [h1: ¿Molienda 2 = molienda de esmaltes?]
12 HORNO (2.ª quema, esmalte)
13 CF (¿control final / clasificación?)
14 Bodega PT
15 Outlet (bloque bodega) · Tienda · Outlet (bloque sur)
   * Conformado y secado no aparecen en el croquis. La foto 5 confirma que existen.
```

El recorrido real forma una **U** que pasa dos veces por el mismo horno:

1. Baja de norte a sur por la columna central (MP → molienda → filtro → extrusora → pulido → horno).
2. Va hacia el este (trazado → decorado) y vuelve al oeste (esmaltado → horno).
3. Sale al oeste (CF → bodega) y termina en el sur, en la zona comercial.

---

## 2. Foto → zona → elementos observados

| Foto | Zona probable (confianza) | Elementos observados |
|---|---|---|
| **F1** | Pulido, o acopio de piezas en crudo/bizcocho antes del horno (**baja**) | 8 o más pilas de platos sin esmaltar sobre una superficie de baldosa blanca. Estanterías metálicas con tazas, bowls, jarras, teteras y bowls con relieve. Piezas planas rectangulares apiladas (¿placas o azulejos?) y celosías caladas blancas. Una operaria sentada repasa piezas en mesas largas. Al fondo: mezanine con estanterías, una máquina azul con ductos (¿extracción o molino?), ladrillo visto y una posible cámara de seguridad. Letrero "SALIDA" con flecha a la izquierda, cartel "IMPORTANTE" con íconos de EPP, luminarias fluorescentes colgantes y tragaluces |
| **F2** | Decorado, mirando a lo largo del muro de ladrillo (**media**) | Pasillo largo con dos líneas amarillas de circulación. A la izquierda, carros o estanterías rodantes con piezas blancas (WIP de bizcocho). A la derecha, mesas de decoración (una redonda) con platos y pilas de platos, y sillas con cojín. Exhibidores de madera en arco y una vitrina con piezas pintadas (muestrario). Muro de ladrillo con ventana (¿hacia oficinas?), señal de no fumar y cartel con el logo ARTESA. Personal con mandil beige, tragaluces y cerchas metálicas |
| **F3** | Esmaltado (**media**) | Al menos 2 máquinas o cabinas con tablero de control. Una operaria con respirador y pañoleta aplica esmalte. Tazas rosadas (esmalte crudo) sobre la mesa. Mesas rodantes con baldes de esmalte de varios colores (uno rotulado a mano) y una bandeja roja. Ductos blancos de extracción colgados del techo. Estanterías metálicas vacías a la izquierda. Al fondo, una estantería con cajas (¿moldes?) y un tablero eléctrico. Piso de hormigón con polvo |
| **F4** | Horno (**alta**) | **Dos hornos continuos en paralelo** con un pasillo central. Entradas con transportador de rodillos y cadena. Izquierda: placas refractarias con tazas moradas y platos (¿quema de esmalte?). Derecha: placas con soportes refractarios. Cuerpo del horno rojo y naranja con tuberías y quemadores a lo largo. Grandes ductos aislados de extracción o chimenea. Logotipo parcial "…cnochimica" en la campana. Señal "EXTINTOR", triángulo de advertencia, manguera de aire comprimido y plataforma metálica elevada |
| **F5** | Conformado y secado, que **no están en el croquis** (**media**) | Pasillo entre estanterías metálicas altas con tablas de madera llenas de platos en crudo (racks de secado). Bowls en crudo sobre un banco de trabajo. Cilindro de yeso o arcilla montado en un eje (función por confirmar). Balde con herramientas y una operaria con mascarilla al fondo. Ductos de extracción, tragaluces y ventanales altos laterales |

Las cinco fotos coinciden en la construcción de la nave: cerchas metálicas, techo de fibrocemento con tragaluces, muros de ladrillo visto y altura libre de ≈7–10 m (estimación visual). Dos fotos muestran a personas reconocibles, así que **no las versioné en el repositorio**.

---

## 3. `plant-layout.json` preliminar y plano SVG

- **Archivo:** [`plant-layout.preliminar.json`](plant-layout.preliminar.json). Sigue la estructura del documento (`planta`, `edificios`, `zonas`, `equipos`, `flujos`, `kpis`, `fuentes_de_datos`), con estos cambios que propongo mantener en el esquema zod de la Fase 1:
  - Se agregan **`accesos`**, con las 16 marcas de puerta del croquis y el portón, y **`fotos`**, que enlaza cada foto con su zona.
  - Cada zona lleva `rotulo_croquis` (el texto literal), `grupo` (define el color), `recinto_cerrado` (falso cuando el rótulo no tiene recuadro), `precision` (`aprox`, `estimacion_visual_fotos` o `por_definir`), `confianza` (`alta`, `media` o `baja`) y `notas`.
  - Los **edificios usan `poligono`** en lugar de `x, z, largo, ancho`, porque hay edificios en L y un polígono irregular.
  - `etapa_proceso` puede ser una lista, porque el horno es la etapa 8 y la 12.
  - **Dato desconocido = `null`.** No inventé medidas ni cantidades; el visor mostrará "[POR DEFINIR]".
  - Conformado y secado van como zonas con `poligono: null`: se sabe que existen, pero no dónde están.
- **Plano:** [`plano-reinterpretado.svg`](plano-reinterpretado.svg), generado desde el JSON. Incluye colores por grupo, línea discontinua para las áreas abiertas, rayado para las zonas sin rótulo, puertas, número de etapa, flechas de flujo numeradas, hipótesis en violeta, ubicación probable de cada foto (F1–F5), norte y escala marcados como supuestos.

---

## 4. Datos faltantes, ilegibles y contradictorios

Ver [`../datos-faltantes.md`](../datos-faltantes.md).

---

## 5. Lo que propongo para la Fase 1 (después de tu validación)

1. Ajustar el JSON con tus respuestas y recalibrar la escala con medidas reales.
2. Crear el proyecto Vite + React + TypeScript con el esquema zod del JSON, que valide y muestre errores legibles.
3. Construir la vista cenital 2D desde el JSON, el diagrama React Flow con las etapas 1 a 15 y la barra de KPIs con `MockDataSource`.

**Me detengo aquí hasta que valides la Fase 0.**
