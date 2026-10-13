# Datos faltantes, ilegibles y contradictorios

Esta lista se actualiza en cada fase. Cada punto se cierra con una respuesta o una medida real.

## A. Preguntas para validar la Fase 0 (bloquean la Fase 1)

1. **Monte Turi:** ¿es un equipo, una línea de producto o el nombre de una sala? ¿Qué palabra estaba escrita encima y se borró?
2. **CF:** ¿qué significa la sigla? ¿Control final, clasificación, consumidor final u otra cosa?
3. **Conformado y secado** (foto 5): ¿en qué parte de la planta están? ¿Dentro del área "Monte Turi", junto a la extrusora o en otro lugar?
4. **Hornos:** ¿cuántos son? El croquis tiene un recuadro y la foto 4 muestra dos bocas en paralelo. ¿Uno es de bizcocho y el otro de esmalte? ¿Qué tipo son (rodillos o túnel) y de qué marca? El logotipo de la campana se lee "…cnochimica".
5. **Dos outlets:** hay "OUTLET" dentro del edificio de bodega y otro en el bloque sur, además de "TIENDA". ¿Qué es cada uno?
6. **Dos moliendas:** ¿la del norte es de pasta y la del centro de esmaltes, o las dos son de pasta?
7. **Kerajet:** ¿en qué punto del flujo entra? (Antes o después del esmaltado, sobre qué piezas.) Está en el extremo oeste, lejos de esmaltado y horno.
8. **Escala:** necesito 2 medidas reales, por ejemplo el largo de la nave de decorado, el largo del horno o el frente del lote. También sirve una captura de Google Earth con el contorno de la planta.
9. **Norte:** ¿la parte superior de la hoja es el norte? ¿Por dónde se entra desde la calle?

## B. Faltantes (no aparecen en el croquis)

- **Límite del lote**, perímetro, garita, accesos vehiculares y peatonales, y calles colindantes.
- **Envolvente de las naves:** qué zonas comparten techo. Las fotos sugieren una nave continua, pero el croquis no la dibuja. También faltan las alturas.
- **Zonas de proceso o soporte que no están:**
  - Taller de moldes de yeso.
  - Control de calidad y clasificación, salvo que sea CF.
  - Empaque y despacho o andén.
  - Mantenimiento.
  - Servicios: gas o GLP, compresores, tableros eléctricos.
  - Tratamiento de aguas y recuperación de barbotina.
  - Reciclaje de rotura.
  - Baños y vestidores.
  - Mezanine (se ve al fondo de la foto 1).
- **Puertas que faltan:**
  - Materias primas 2, la bahía este, la bodega de suministros y el parqueadero (sin acceso vehicular dibujado) no tienen ninguna.
  - Kerajet, impresión 3D, pulido, horno y esmaltado tampoco. ¿Son áreas abiertas dentro de la nave?
- **Equipos (cantidad, medidas y capacidad):**
  - Molinos, filtro prensa, extrusora, Kerajet (modelo), impresoras 3D.
  - Hornos: largo, ancho, temperatura, ciclo, carga y combustible.
  - Cabinas de esmaltado (en la foto 3 se ven al menos 2).
  - Puestos de decoración (en la foto 2 se ven al menos 5 mesas).
  - Racks de secado.
- **Personal por zona y turnos.**
- **Ubicación y orientación de cada foto.** Las del plano son estimadas.
- **Cámaras de seguridad:** se ve una posible cámara en la foto 1. Faltan las posiciones y una política de qué no mostrar.
- **KPIs, metas y fuentes de datos:**
  - Metas de producción por turno, merma, OEE e inventario.
  - Endpoint n8n `plant-state`.
  - Nombre del ERP.
  - Colores corporativos en HEX.

## C. Ilegible o ambiguo en el croquis

- La palabra borrada sobre "MONTE TURI" no se puede leer.
- Hay un rótulo "ESMALTADO" borrado debajo del recuadro de Esmaltado. ¿El esmaltado ocupa también esa área?
- **Áreas sin recuadro:** Filtro prensa, Extrusora, Monte Turi y Trazado son solo texto. Sus límites en el JSON son estimados.
- **Recintos sin rótulo:** la bahía este del bloque de materias primas, y las franjas oeste (≈9,5 m) y sur (≈6 m) del edificio Outlet/Bodega. ¿Son pasillos, andenes o bodegas?
- La marca ancha en el borde sur de Trazado se interpretó como **portón** (≈5 m). ¿Es el acceso principal a producción?
- La forma de **Tienda** es irregular y su lado oeste queda abierto hacia el pasillo. ¿Es un edificio o un patio o plaza comercial?
- "LABOR. 1" y "LAB 2": ¿qué hace cada laboratorio?

## D. Contradicciones

1. **Horno:** el croquis muestra 1 recuadro y la foto 4 muestra 2 hornos. Además, el mismo bloque hace la 1.ª y la 2.ª quema, así que el flujo pasa dos veces por él.
2. **Outlet y Bodega** comparten recinto sin división. En el JSON el límite está en Z = 84 m, y es un supuesto.
3. **Proporciones:** la foto 2 muestra un pasillo de decoración muy largo (estimo que más de 40 m). En el croquis, Decorado mide ≈15 × 23,5 m con la escala supuesta. O el croquis no está a escala, o la foto 2 es de otra nave.
4. **Impresión 3D** ocupa ≈34,5 × 12 m, mucho más que zonas de proceso como Pulido o Esmaltado. Es una posible desproporción del dibujo.
5. **Decorado**, una etapa productiva, está en el bloque administrativo, entre Laboratorio 1/I+D y Oficinas de producción, y tiene puerta directa a Administración.
6. **Croquis vs. prompt maestro:**
   - El prompt usa zonas genéricas que el croquis no tiene: barbotina, moldes, calidad, empaque, despacho, servicios, aguas y perímetro.
   - El croquis tiene zonas que el prompt no prevé: Kerajet, Impresión 3D, Monte Turi, Trazado, Pulido, Laboratorios, I+D, Museo, Academia, Comedor, Cocina, Outlet, Tienda y Parqueadero.
   - El JSON preliminar usa **solo** las zonas del croquis, más conformado y secado por la foto 5.
7. **Grupo empresarial:** el documento duda entre "Eljuri" y "Centro Cerámico". No afecta al layout, pero hay que confirmarlo antes de mostrar la app fuera de la empresa.

## E. Seguridad y difusión

- El repositorio `glapguillen/artesa` es **público**. El layout con accesos, y más adelante con cámaras, es información operativa sensible (punto 12 del checklist: permiso de gerencia). Antes de versionarlo, conviene hacer el repositorio privado o confirmar que se puede publicar.
- Las fotos muestran a personas reconocibles: no se suben al repositorio.
