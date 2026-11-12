# Artesa · Hojas de producción diaria

Aplicación web para registrar las Hojas de Producción Diaria a partir de una foto:

1. Se toma la foto de la hoja desde el celular o la computadora.
2. El servidor lee la foto (datos impresos y manuscritos) con la API de Claude.
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
cp .env.example .env           # completar DATABASE_URL y ANTHROPIC_API_KEY
npm install
npm start                      # http://localhost:3000
```

Las tablas se crean solas al arrancar (`schema.sql`).

La cámara del celular solo se abre si la página se sirve por HTTPS (o en `localhost`).
La aplicación no tiene inicio de sesión: debe publicarse dentro de la red interna o detrás
de un acceso con contraseña.

## Tablas

| Tabla | Contenido |
|---|---|
| `secciones` | Catálogo de secciones y su letra en la ruta |
| `ordenes` | Número de orden, fecha de emisión, cliente, observaciones |
| `orden_articulos` | Artículos de la orden: código, descripción, decoración, cantidad, tiempo, ruta |
| `hojas` | Una por orden y sección: estado, operario, foto, lectura original |
| `hoja_articulos` | Piezas malas por artículo en cada hoja |
| `registros` | Cada bloque manuscrito: fecha, cantidad, hora de inicio y fin, personas |

## Pruebas

```bash
npm test    # usa la base de DATABASE_URL
```
