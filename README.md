# Artesa · Hojas de producción diaria

Aplicación web para registrar las Hojas de Producción Diaria a partir de una foto:

1. Se toma la foto de la hoja desde el celular o la computadora.
2. La foto se lee de una de dos formas:
   - **Sin API (gratis)**: el propio celular lee lo impreso (orden, sección, fecha, cliente,
     artículos) con un lector de texto gratuito. Si la orden ya está en la base por otra
     sección, cliente y artículos se toman de ahí. Lo manuscrito (operarios, fechas,
     cantidades, horas) se escribe a mano.
   - **Con IA**: el servidor lee también lo manuscrito, con Gemini (`GEMINI_API_KEY`, tiene
     nivel gratuito) o con la API de Claude (`ANTHROPIC_API_KEY`). Si hay las dos se usa
     Gemini; `LECTURA=gemini|claude|local` lo fija. Sin clave se usa el modo gratuito, y si la
     cuota gratuita de Gemini se agota, la aplicación pasa sola al modo gratuito durante media
     hora y luego vuelve a intentarlo.
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
