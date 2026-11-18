# Artesa · Hojas de producción diaria

Aplicación web para registrar las Hojas de Producción Diaria a partir de una foto:

1. Se toma la foto de la hoja desde el celular o la computadora.
2. La foto se lee de una de dos formas:
   - **Sin API (gratis)**: el propio celular lee lo impreso (orden, sección, fecha, cliente,
     artículos) con un lector de texto gratuito. Si la orden ya está en la base por otra
     sección, cliente y artículos se toman de ahí. Lo manuscrito (operarios, fechas,
     cantidades, horas) se escribe a mano.
   - **Con IA**: el servidor lee también lo manuscrito, con la API de Claude
     (`ANTHROPIC_API_KEY`) y, de respaldo, con Gemini (`GEMINI_API_KEY`, tiene nivel gratuito).
     Si Claude falla por clave, saldo o límite de uso, la foto pasa a Gemini; si fallan los dos,
     a la lectura gratuita, y la aplicación vuelve a la IA sola cuando pasa la pausa.
     `LECTURA=gemini` pone Gemini primero y `LECTURA=local` desactiva la IA.

### Coste de la lectura con Claude

Cada foto la lee primero **Claude Sonnet 5.5** con esfuerzo medio (unos $0,03 por hoja) y solo
se relee con **Claude Opus 5.5** (unos $0,07) cuando la primera lectura tiene fallos que no dependen de
la opinión del modelo: falta la orden o la sección, no hay artículos ni registros, una hora
de fin anterior a la de inicio, una fecha anterior a la emisión o más piezas que las pedidas.
También pasa a Opus si Sonnet declina la foto. En la comparación con hojas reales, Sonnet medio
acertó lo mismo que Opus medio por menos de la mitad; Haiku medio, el 96 % por una décima parte.

| Variable | Valor por defecto | Para qué |
|---|---|---|
| `CLAUDE_LECTURA` | `sonnet:medium` | Modelo y esfuerzo de la primera lectura (`haiku`, `sonnet` u `opus`; `low`, `medium` o `high`) |
| `CLAUDE_RELEER` | `opus:medium` | Modelo de la relectura; `no` la desactiva |

La página `/comparar.html` (enlace al final de la pestaña Catálogo) lee la foto de una hoja ya
guardada y revisada con varios modelos y compara cada lectura con lo guardado, campo por campo,
con su coste y tiempo. Sirve para elegir estas variables con tus propias hojas. También muestra
el gasto estimado por mes; el coste de cada lectura se guarda con la hoja.
3. El usuario revisa y corrige lo leído.
4. Se guarda en PostgreSQL, junto con la foto.

La **ruta** del artículo (p. ej. `STDE`) genera una hoja pendiente por sección con el mismo
número de orden. Cada foto guardada marca su sección como registrada, así se ve qué
secciones faltan en cada orden. Las letras de la ruta se definen en la tabla `secciones`
(`S` Señalado, `T` Trazado, `D` Decorado, `E` Esmalt).

## Puesta en marcha

Requiere Node 20+ y PostgreSQL.

```bash
createdb artesa                # o la base que se indique en DATABASE_URL
cp .env.example .env           # completar DATABASE_URL y APP_PASSWORD (ANTHROPIC_API_KEY es opcional)
npm install
npm start                      # http://localhost:3000
```

Las tablas se crean solas al arrancar (`schema.sql`).

La cámara del celular solo se abre si la página se sirve por HTTPS (o en `localhost`).

El acceso se protege con una contraseña compartida, `APP_PASSWORD`. Con `NODE_ENV=production`
la aplicación no arranca si no está definida.

## Despliegue en Render

El archivo `render.yaml` describe el servicio web y la base PostgreSQL:

1. En Render: **New → Blueprint** y elegir este repositorio y rama.
2. Render pide dos valores, que se escriben ahí mismo y no se guardan en el repositorio:
   `APP_PASSWORD` (contraseña de acceso) y `ANTHROPIC_API_KEY` (opcional: déjala vacía para
   el modo gratuito).
3. Aplicar. `DATABASE_URL` se conecta sola a la base creada.

## Tablas

| Tabla | Contenido |
|---|---|
| `secciones` | Catálogo de secciones y su letra en la ruta |
| `ordenes` | Número de orden, fecha de emisión, cliente, observaciones |
| `orden_articulos` | Artículos de la orden: código y nombre del bizcocho, código y nombre de la decoración, cantidad, tiempo, ruta |
| `hojas` | Una por orden y sección: estado, operario 1 y 2, foto, lectura original |
| `hoja_articulos` | Piezas malas por artículo en cada hoja |
| `registros` | Cada bloque manuscrito: fecha, cantidad, hora de inicio y fin, personas |
| `bizcochos`, `decoraciones` | Catálogo de códigos (4 y 3 dígitos) con su nombre |

## Catálogo de códigos

En el código de artículo "0944 626", los cuatro primeros dígitos son el bizcocho y los tres
siguientes la decoración. El catálogo guarda el nombre de cada código: se alimenta solo al
guardar cada hoja revisada y se corrige en la pestaña **Catálogo** (un nombre vacío borra el
código). Viene precargado con los códigos de las hojas de ejemplo.

La lectura gratuita lo usa para completar los nombres a partir del código y para corregir
un código mal leído cuando el nombre coincide con uno del catálogo; en ambos casos lo avisa
en la revisión. Un nombre que es parte del que ya hay (foto cortada) no lo reemplaza.

## Pruebas

```bash
npm test    # usa la base de DATABASE_URL
```

## Reportes e Insights

Las dos pestañas comparten el período y los filtros (sección, cliente). Los cálculos están en
`public/metricas.js` y se hacen en el navegador con las filas de `/api/reportes`.

- **Reportes**: piezas producidas, piezas por hora-persona, % de piezas malas, órdenes
  abiertas y completas; piezas por día; por sección, las órdenes **esperando** (su sección
  anterior en la ruta ya entregó) y **bloqueadas** (falta una anterior); órdenes abiertas por
  antigüedad; operarios por sección; calidad por artículo. Exporta los registros a CSV.
- **Detalle por artículo** (dentro de Reportes): eliges un artículo y ves sus piezas,
  horas-persona, minutos por pieza sumando todas sus secciones, piezas malas y días de trabajo;
  el desglose por sección, por operario y por orden; y todos sus registros con fecha, horas,
  personas, horas-persona y minutos por pieza. Se exporta a CSV.
- **Insights**: hallazgos con reglas fijas y sin coste (cuello de botella, órdenes detenidas una
  semana o más, cambio de producción semanal, secciones y artículos con más piezas malas,
  diferencias grandes entre operarios de una sección, registros sin horas válidas). El botón
  **Analizar con Claude** envía solo el resumen numérico, sin fotos, y cuesta en torno a un
  céntimo; el modelo se elige con `INSIGHTS_MODELO` (por defecto `sonnet:medium`).

Horas-persona = (fin − inicio) × personas; un registro con la hora de fin igual o anterior a
la de inicio no cuenta para productividad. Los operarios se agrupan sin distinguir tildes ni
mayúsculas. La eficiencia frente al TIEMPO impreso no se muestra: ese número es el mismo en
las hojas de todas las secciones, así que no es el tiempo estándar de cada una.
