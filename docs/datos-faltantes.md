# Datos faltantes, ilegibles y contradictorios

Esta lista se actualiza en cada fase. Cada punto se cierra con una respuesta o una medida real. Versión **v0.3**, que ya incorpora el Flujograma ARTESA 2025 y la nómina de personal 2026 (solo agregada por sección y cargo).

## A. Encaminadas por el flujograma: solo falta un sí o un no

| # | Supuesto actual | Base |
|---|---|---|
| 1 | **Kerajet = Impresión digital (2.5)**, que se usa en R6–R9, después del esmaltado | KERAjet es una marca de impresoras inkjet para cerámica, y la nómina tiene un "Operador de Kerajet" |
| 2 | **Impresión 3D** es un método de formación (RF6), no un área de prototipos | Flujograma, Fase 1 |
| 3 | **CF = Clasificación final (3.3)** | Está pegada a los hornos y a la bodega; la nómina tiene 2 personas en "Clasificación de esmalte" |
| 4 | **Dos hornos:** el izquierdo de la foto 4 hace la quema de esmalte (3.1) y el derecho la de bizcocho (1.5) | Foto 4: tazas esmaltadas a la izquierda, soportes refractarios a la derecha |
| 5 | **Trazado** = etapa T. ¿El **Señalado (S)** se hace en la misma zona? | Flujograma, R1–R3 |
| 6 | **Moliendas:** una prepara pasta (B2) y la otra colores y esmaltes (A2). ¿Cuál es cuál? | El flujograma tiene dos cadenas de stock separadas |

## B. Preguntas abiertas (bloquean la Fase 1)

1. **Monte Turi:** ¿es un equipo, una línea o una sala? Encima hay una palabra borrada que no se puede leer.
2. **Formación:** ¿dónde están el colado vaciado, el colado a presión, el torno alfarero, el torno roller, la prensa RAM y el modelado? ¿En el área "Monte Turi"?
3. **Piscinas** (pulido, quemado 1, esmaltado, quemado 2): ¿son lugares físicos o solo estados de inventario en el sistema? Si son físicos, ¿dónde están? ¿Los racks de secado de la foto 5 son la Piscina pulido?
4. **Clasificación bizcocho (1.7) y Bodega bizcocho (1.8):** ¿dónde están? ¿La "Bodega" del croquis es la de producto terminado o la de bizcocho?
5. **Calcomanía:** ¿dónde se aplica (3.4) y en qué horno se quema (3.5)?
6. **Recuperable → Recuperación (3.8):** ¿a qué etapa vuelve la pieza? El flujograma no lo dice.
7. **Venta:** ¿las piezas Tipo B y C van al Outlet? ¿Qué vende cada outlet y qué vende la tienda?
8. **Stocks físicos:** ¿dónde están la pasta líquida (B3), la pasta extrusada (B4) y los esmaltes y colores (A3)? ¿Dónde se preparan los colores (A2): en Laboratorio 1 o en Molienda 2?
9. **Sistema:** ¿en qué ERP o sistema se lleva este flujograma? ¿Las piscinas, bodegas y clasificaciones ya existen ahí como ubicaciones o estados de inventario? Eso define el contrato de datos de n8n.
10. **Escala y norte:** necesito 2 medidas reales (o una captura de Google Earth) y confirmar que la parte superior de la hoja es el norte.

## B2. Preguntas que surgen de la nómina

La nómina se usa solo agregada: cuántas personas hay por departamento, sección y cargo (64 en total, 45 en Producción). No se versionan nombres ni datos personales.

1. **Moldero (1 persona):** confirma que existe un taller de moldes. ¿Dónde está? No aparece en el croquis.
2. **Sección "Ensamblaje y clasificación":** el ensamblaje (por ejemplo, pegar asas) no figura en el flujograma. ¿En qué etapa ocurre y dónde?
3. **Cargo "Marca"**, en la sección Clasificación de bizcocho: ¿es el marcado del fondo de la pieza o el "Señalado (S)" de las rutas R1 y R2?
4. **Clasificación de esmalte** aparece en dos secciones distintas (Formación, y Ensamblaje y clasificación). ¿Es la misma función?
5. **Molinero** está en la sección Formación. ¿Opera la Molienda 1, la 2 o ambas? ¿También el filtro prensa y la extrusora?
6. **Puestos sin cargo asignado en la nómina:** filtro prensa, extrusora, prensa RAM, impresión 3D, señalado, trazado y calcomanía. ¿Los cubre personal que rota? Por ejemplo, ¿hacen el trazado las decoradoras, o la impresión 3D el diseñador de objetos?
7. **Embalaje y despachos** está en Bodega PT: confirma que el empaque y el despacho se hacen ahí, aunque el flujograma termina en la Bodega PT.
8. **Turnos:** ¿cuántos hay y en qué horario? La app simula uno de 8 horas desde las 07:00.

## C. Faltantes (no aparecen ni en el croquis ni en el flujograma)

- **Límite del lote**, perímetro, garita, accesos vehiculares y peatonales, y calles colindantes.
- **Envolvente de las naves** y alturas: qué zonas comparten techo.
- **Taller de moldes de yeso.** El colado vaciado y el colado a presión los necesitan.
- **Empaque y despacho.** El flujograma termina en la Bodega PT.
- **Soporte y servicios:** mantenimiento, gas o GLP, compresores, tableros eléctricos, tratamiento de aguas y recuperación de barbotina, reciclaje de rotura, baños y vestidores, y el mezanine que se ve en la foto 1.
- **Puertas que faltan:**
  - Materias primas 2, la bahía este, la bodega de suministros y el parqueadero (sin acceso vehicular dibujado) no tienen ninguna.
  - Kerajet, Impresión 3D, Pulido, Hornos y Esmaltado tampoco. ¿Son áreas abiertas dentro de la nave?
- **Equipos (cantidad, medidas y capacidad):**
  - Molinos, filtro prensa, extrusora.
  - Los 7 métodos de formación, el Kerajet (modelo) y las impresoras 3D.
  - Hornos: largo, temperatura, ciclo, carga y combustible.
  - Cabinas de esmaltado (en la foto 3 se ven al menos 2).
  - Puestos de decoración (en la foto 2 se ven al menos 5 mesas).
  - Racks de secado.
- **Turnos** y rotación habitual del personal. La dotación por sección ya está en el JSON.
- **Ubicación y orientación de cada foto.** Las del plano son estimadas.
- **Cámaras de seguridad:** se ve una posible cámara en la foto 1. Faltan las posiciones y una política de qué no mostrar.
- **Metas de KPIs:** producción por turno, % de bizcocho bueno, mix A/B/C, merma por etapa, OEE e inventario. También faltan el endpoint n8n `plant-state` y los colores corporativos en HEX.

## D. Ilegible o ambiguo en el croquis

- La palabra borrada sobre "MONTE TURI" no se puede leer.
- Hay un rótulo "ESMALTADO" borrado debajo del recuadro de Esmaltado. ¿Esa área es la Piscina esmaltado (2.6)?
- **Áreas sin recuadro:** Filtro prensa, Extrusora, Monte Turi y Trazado son solo texto. Sus límites en el JSON son estimados.
- **Recintos sin rótulo:** la bahía este de materias primas, y las franjas oeste y sur del edificio Outlet/Bodega.
- La marca ancha al sur de Trazado se interpretó como **portón** (≈5 m).
- **Tienda:** ¿es un edificio o un patio comercial?

## E. Contradicciones y diferencias entre fuentes

1. **Secado:** el flujograma no tiene una etapa de secado, pero la foto 5 muestra racks de secado. ¿El secado ocurre mientras la pieza espera en la Piscina pulido (1.4)?
2. **Pulido:** el flujograma tiene un pulido por cada método (7), y el croquis una sola zona "Pulido". ¿Ahí se pulen todas las formas?
3. **Hornos:** el croquis tiene 1 recuadro, y la foto 4 y el flujograma indican 2 quemas (y una 3.ª para calcomanía).
4. **Outlets:** hay 2 outlets y una tienda en el croquis, y ninguno en el flujograma.
5. **Kerajet** está en el extremo opuesto a Esmaltado, Decorado y Hornos. Con la escala supuesta, R7 recorre ≈191 m frente a ≈34 m de R4. Si la ubicación es correcta, es un hallazgo de layout; si no, el croquis está mal.
6. **Proporciones:** el pasillo de la foto 2 parece de más de 40 m, mientras que Decorado mide ≈23,5 m con la escala supuesta. Impresión 3D (≈34,5 × 12 m) también parece grande.
7. **Vocabulario:** el prompt maestro habla de "Conformado" y el flujograma de "**Formación**". Desde la v0.2 se usa el vocabulario del flujograma. Las zonas genéricas del prompt (moldes, empaque, despacho, servicios) no están ni en el croquis ni en el flujograma.
8. **Grupo empresarial:** el documento duda entre "Eljuri" y "Centro Cerámico". Hay que confirmarlo antes de mostrar la app fuera de la empresa.

## F. Seguridad y difusión

- El repositorio `glapguillen/artesa` es **público**. El layout se publicó con tu autorización. Antes de agregar cámaras, accesos detallados o URLs de n8n conviene hacerlo privado.
- Las fotos y el flujograma original no se suben al repositorio. En el repositorio solo queda la transcripción del flujograma.
