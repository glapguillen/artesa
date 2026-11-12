import fs from "node:fs";
import pg from "pg";

// DATE y TIME como texto: evita desfases de zona horaria al serializar.
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(1083, (v) => v.slice(0, 5));
pg.types.setTypeParser(1700, (v) => Number(v));

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgres://artesa:artesa@localhost:5432/artesa",
});

export async function migrar() {
  await pool.query(fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8"));
}

export const normalizar = (s) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

const texto = (v) => (v == null ? "" : String(v).trim());
const textoONull = (v) => texto(v) || null;
const entero = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Math.round(Number(v)));
const numero = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
const fecha = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(texto(v)) ? texto(v) : null);
const hora = (v) => (/^\d{1,2}:\d{2}$/.test(texto(v)) ? texto(v) : null);

export class ErrorDeDatos extends Error {}

// Busca la sección por nombre tolerando acentos y abreviaturas ("ESMALT" ~ "ESMALTADO").
async function resolverSeccion(db, nombre) {
  const buscado = normalizar(nombre);
  const { rows } = await db.query("SELECT id, nombre FROM secciones");
  const hallada = rows.find((s) => {
    const n = normalizar(s.nombre);
    return n === buscado || n.startsWith(buscado) || buscado.startsWith(n);
  });
  if (hallada) return hallada.id;
  const nueva = await db.query("INSERT INTO secciones (nombre) VALUES ($1) RETURNING id", [buscado]);
  return nueva.rows[0].id;
}

export async function hojaExistente(numeroOrden, seccion) {
  if (!texto(numeroOrden) || !texto(seccion)) return null;
  const seccionNorm = normalizar(seccion);
  const { rows } = await pool.query(
    `SELECT h.id, h.registrada_en, s.nombre FROM hojas h
       JOIN ordenes o ON o.id = h.orden_id JOIN secciones s ON s.id = h.seccion_id
      WHERE o.numero = $1 AND h.estado = 'registrada'`,
    [texto(numeroOrden)],
  );
  return (
    rows.find((r) => {
      const n = normalizar(r.nombre);
      return n === seccionNorm || n.startsWith(seccionNorm) || seccionNorm.startsWith(n);
    }) ?? null
  );
}

// Guarda una hoja ya revisada. Crea la orden y sus artículos si no existen, genera
// una hoja pendiente por cada sección de la ruta y registra la de la foto.
export async function guardarHoja({ datos, extraccion, foto, fotoMime }) {
  const numeroOrden = texto(datos.numero_orden);
  if (!numeroOrden) throw new ErrorDeDatos("Falta el número de orden");
  if (!texto(datos.seccion)) throw new ErrorDeDatos("Falta la sección");
  if (!datos.articulos?.length) throw new ErrorDeDatos("La hoja no tiene artículos");

  const db = await pool.connect();
  try {
    await db.query("BEGIN");

    const orden = await db.query(
      `INSERT INTO ordenes (numero, fecha_emision, cliente, observaciones) VALUES ($1, $2, $3, $4)
       ON CONFLICT (numero) DO UPDATE SET
         fecha_emision = COALESCE(EXCLUDED.fecha_emision, ordenes.fecha_emision),
         cliente       = COALESCE(EXCLUDED.cliente, ordenes.cliente),
         observaciones = COALESCE(EXCLUDED.observaciones, ordenes.observaciones)
       RETURNING id`,
      [numeroOrden, fecha(datos.fecha_emision), textoONull(datos.cliente), textoONull(datos.observaciones)],
    );
    const ordenId = orden.rows[0].id;

    const articulos = [];
    const existentes = (await db.query(
      "SELECT id, codigo_bizcocho, bizcocho, codigo_decoracion, decoracion FROM orden_articulos WHERE orden_id = $1", [ordenId])).rows;
    for (const a of datos.articulos) {
      const ruta = textoONull(normalizar(a.ruta).replace(/[^A-Z]/g, ""));
      const codigoDe = (cb, cd) => [texto(cb), texto(cd)].filter(Boolean).join(" ");
      // Si la foto cortó un código o la decoración, se reconoce el artículo que ya tenía la orden.
      const cola = (x, y) => normalizar(x).endsWith(normalizar(y)) || normalizar(y).endsWith(normalizar(x));
      const previo = existentes.find(
        (e) => normalizar(e.bizcocho) === normalizar(a.bizcocho) && cola(e.codigo_bizcocho, a.codigo_bizcocho) &&
          cola(e.codigo_decoracion, a.codigo_decoracion) && cola(e.decoracion, a.decoracion),
      );
      const masLargo = (x, y) => (texto(y).length > texto(x).length ? texto(y) : texto(x));
      const cb = previo ? masLargo(previo.codigo_bizcocho, a.codigo_bizcocho) : texto(a.codigo_bizcocho);
      const cd = previo ? masLargo(previo.codigo_decoracion, a.codigo_decoracion) : texto(a.codigo_decoracion);
      const r = previo
        ? await db.query(
            `UPDATE orden_articulos SET codigo = $2, codigo_bizcocho = $3, codigo_decoracion = $4, decoracion = $5,
               cantidad_producir = COALESCE($6, cantidad_producir), tiempo_estandar = COALESCE($7, tiempo_estandar), ruta = COALESCE($8, ruta)
             WHERE id = $1 RETURNING id`,
            [previo.id, codigoDe(cb, cd), cb, cd, masLargo(previo.decoracion, a.decoracion), entero(a.cantidad_producir), numero(a.tiempo_estandar), ruta],
          )
        : await db.query(
            `INSERT INTO orden_articulos (orden_id, codigo, codigo_bizcocho, bizcocho, codigo_decoracion, decoracion, cantidad_producir, tiempo_estandar, ruta)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (orden_id, codigo, decoracion) DO UPDATE SET bizcocho = EXCLUDED.bizcocho
             RETURNING id`,
            [ordenId, codigoDe(cb, cd), cb, texto(a.bizcocho), cd, texto(a.decoracion), entero(a.cantidad_producir), numero(a.tiempo_estandar), ruta],
          );
      articulos.push({ id: r.rows[0].id, ...a });
    }

    // La ruta decide qué secciones deben entregar hoja para esta orden.
    await db.query(
      `INSERT INTO hojas (orden_id, seccion_id)
       SELECT DISTINCT $1::int, s.id
         FROM orden_articulos a
         JOIN secciones s ON position(s.letra in a.ruta) > 0
        WHERE a.orden_id = $1
       ON CONFLICT DO NOTHING`,
      [ordenId],
    );

    const seccionId = await resolverSeccion(db, datos.seccion);
    const hoja = await db.query(
      `INSERT INTO hojas (orden_id, seccion_id, estado, operario1, operario2, notas, foto, foto_mime, extraccion, registrada_en)
       VALUES ($1, $2, 'registrada', $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (orden_id, seccion_id) DO UPDATE SET
         estado = 'registrada', operario1 = EXCLUDED.operario1, operario2 = EXCLUDED.operario2, notas = EXCLUDED.notas,
         foto = COALESCE(EXCLUDED.foto, hojas.foto), foto_mime = COALESCE(EXCLUDED.foto_mime, hojas.foto_mime),
         extraccion = EXCLUDED.extraccion, registrada_en = now()
       RETURNING id`,
      [ordenId, seccionId, textoONull(datos.operario1), textoONull(datos.operario2), textoONull(datos.notas), foto ?? null, fotoMime ?? null, extraccion ?? null],
    );
    const hojaId = hoja.rows[0].id;

    // Volver a guardar la misma orden y sección reemplaza lo anterior.
    await db.query("DELETE FROM registros WHERE hoja_id = $1", [hojaId]);
    await db.query("DELETE FROM hoja_articulos WHERE hoja_id = $1", [hojaId]);
    for (const a of articulos) {
      await db.query("INSERT INTO hoja_articulos (hoja_id, articulo_id, malas) VALUES ($1, $2, $3)", [hojaId, a.id, entero(a.malas)]);
      for (const r of a.registros ?? []) {
        const vacio = [r.fecha, r.cantidad, r.hora_inicio, r.hora_fin, r.personas].every((v) => !texto(v));
        if (vacio) continue;
        await db.query(
          `INSERT INTO registros (hoja_id, articulo_id, fecha, cantidad, hora_inicio, hora_fin, personas)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [hojaId, a.id, fecha(r.fecha), entero(r.cantidad), hora(r.hora_inicio), hora(r.hora_fin), entero(r.personas)],
        );
      }
    }

    await db.query("COMMIT");
    return { orden: numeroOrden, hoja_id: hojaId };
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}

export async function listarOrdenes() {
  const { rows } = await pool.query(
    `SELECT o.numero, o.fecha_emision, o.cliente, o.observaciones,
            (SELECT string_agg(DISTINCT a.bizcocho || CASE WHEN a.decoracion <> '' THEN ' · ' || a.decoracion ELSE '' END, ', ')
               FROM orden_articulos a WHERE a.orden_id = o.id) AS articulos,
            COALESCE((SELECT json_agg(json_build_object('seccion', s.nombre, 'estado', h.estado)
                                      ORDER BY position(s.letra in COALESCE(r.ruta, '')), s.id)
               FROM hojas h JOIN secciones s ON s.id = h.seccion_id
               LEFT JOIN LATERAL (SELECT max(ruta) AS ruta FROM orden_articulos WHERE orden_id = o.id) r ON true
              WHERE h.orden_id = o.id), '[]') AS secciones
       FROM ordenes o
      ORDER BY o.creado_en DESC`,
  );
  return rows;
}

export async function detalleOrden(numeroOrden) {
  const orden = (await pool.query("SELECT * FROM ordenes WHERE numero = $1", [numeroOrden])).rows[0];
  if (!orden) return null;
  const articulos = (await pool.query("SELECT * FROM orden_articulos WHERE orden_id = $1 ORDER BY id", [orden.id])).rows;
  const ruta = articulos.map((a) => a.ruta ?? "").join("");
  const hojas = (
    await pool.query(
      `SELECT h.id, h.estado, h.operario1, h.operario2, h.notas, h.registrada_en, h.foto IS NOT NULL AS tiene_foto, s.nombre AS seccion, s.letra
         FROM hojas h JOIN secciones s ON s.id = h.seccion_id WHERE h.orden_id = $1`,
      [orden.id],
    )
  ).rows;
  const pos = (h) => (h.letra && ruta.includes(h.letra) ? ruta.indexOf(h.letra) : 99);
  hojas.sort((a, b) => pos(a) - pos(b) || a.id - b.id);

  const registros = (
    await pool.query(
      `SELECT r.* FROM registros r JOIN hojas h ON h.id = r.hoja_id WHERE h.orden_id = $1 ORDER BY r.fecha NULLS LAST, r.id`,
      [orden.id],
    )
  ).rows;
  const malas = (
    await pool.query(
      `SELECT ha.* FROM hoja_articulos ha JOIN hojas h ON h.id = ha.hoja_id WHERE h.orden_id = $1`,
      [orden.id],
    )
  ).rows;
  for (const h of hojas) {
    h.articulos = articulos.map((a) => ({
      articulo_id: a.id,
      malas: malas.find((m) => m.hoja_id === h.id && m.articulo_id === a.id)?.malas ?? null,
      registros: registros.filter((r) => r.hoja_id === h.id && r.articulo_id === a.id),
    }));
  }
  return { ...orden, articulos, hojas };
}
