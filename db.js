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
    // Si dos artículos de la hoja son el mismo de la orden (p. ej. el día anotado fuera de la tabla
    // llegó como un artículo aparte con el mismo código), sus registros y malas se juntan en uno.
    const porId = new Map();
    for (const a of articulos) {
      const previo = porId.get(a.id);
      if (!previo) { porId.set(a.id, { ...a, registros: [...(a.registros ?? [])] }); continue; }
      previo.registros.push(...(a.registros ?? []));
      if (entero(a.malas) != null) previo.malas = (entero(previo.malas) ?? 0) + entero(a.malas);
    }
    for (const a of porId.values()) {
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

    // Lo revisado alimenta el catálogo de códigos. Un nombre que es parte del que ya hay (foto
    // cortada: "SOL AZUL" frente a "GIRASOL AZUL") no lo reemplaza; para eso está la pestaña Catálogo.
    for (const a of datos.articulos) {
      if (/^\d{4}$/.test(texto(a.codigo_bizcocho)) && texto(a.bizcocho))
        await db.query(
          `INSERT INTO bizcochos (codigo, nombre) VALUES ($1, $2)
           ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, actualizado = now()
           WHERE bizcochos.nombre <> EXCLUDED.nombre AND strpos(bizcochos.nombre, EXCLUDED.nombre) = 0`,
          [texto(a.codigo_bizcocho), texto(a.bizcocho)]);
      if (/^\d{3}$/.test(texto(a.codigo_decoracion)) && texto(a.decoracion))
        await db.query(
          `INSERT INTO decoraciones (codigo, nombre) VALUES ($1, $2)
           ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, actualizado = now()
           WHERE decoraciones.nombre <> EXCLUDED.nombre AND strpos(decoraciones.nombre, EXCLUDED.nombre) = 0`,
          [texto(a.codigo_decoracion), texto(a.decoracion)]);
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

const TABLAS_CATALOGO = { bizcochos: /^\d{4}$/, decoraciones: /^\d{3}$/ };

export async function catalogo() {
  const [b, d] = await Promise.all([
    pool.query("SELECT codigo, nombre FROM bizcochos ORDER BY codigo"),
    pool.query("SELECT codigo, nombre FROM decoraciones ORDER BY codigo"),
  ]);
  return { bizcochos: b.rows, decoraciones: d.rows };
}

export async function guardarEnCatalogo(tipo, codigo, nombre) {
  const formato = TABLAS_CATALOGO[tipo];
  if (!formato) throw new ErrorDeDatos("Catálogo desconocido");
  if (!formato.test(texto(codigo))) throw new ErrorDeDatos(tipo === "bizcochos" ? "El código de bizcocho tiene 4 dígitos" : "El código de decoración tiene 3 dígitos");
  const n = normalizar(nombre).replace(/\s+/g, " ");
  if (!n) {
    await pool.query(`DELETE FROM ${tipo} WHERE codigo = $1`, [texto(codigo)]);
    return { borrado: true };
  }
  await pool.query(
    `INSERT INTO ${tipo} (codigo, nombre) VALUES ($1, $2) ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, actualizado = now()`,
    [texto(codigo), texto(nombre).toUpperCase()]);
  return { ok: true };
}

// Datos para Reportes e Insights, en filas planas: el navegador agrupa y filtra sin volver a pedir.
// Fechas de registro entre `desde` y `hasta` (incluidas); las hojas y órdenes van todas, para ver
// lo pendiente aunque no tenga registros en el rango.
export async function datosReportes(desde, hasta) {
  const d = fecha(desde) ?? "1900-01-01", h = fecha(hasta) ?? "2999-12-31";
  const [registros, hojas, malas] = await Promise.all([
    pool.query(
      `SELECT r.fecha, s.nombre AS seccion, o.numero AS orden, o.cliente, o.fecha_emision,
              a.id AS articulo_id, a.codigo_bizcocho, a.bizcocho, a.codigo_decoracion, a.decoracion,
              a.cantidad_producir, a.tiempo_estandar,
              h.operario1, h.operario2, r.cantidad, r.hora_inicio, r.hora_fin, r.personas
         FROM registros r
         JOIN hojas h ON h.id = r.hoja_id
         JOIN secciones s ON s.id = h.seccion_id
         JOIN ordenes o ON o.id = h.orden_id
         JOIN orden_articulos a ON a.id = r.articulo_id
        WHERE r.fecha BETWEEN $1 AND $2
        ORDER BY r.fecha`,
      [d, h],
    ),
    pool.query(
      `SELECT o.numero AS orden, o.cliente, o.fecha_emision, s.nombre AS seccion, s.letra, h.estado,
              h.registrada_en::date AS registrada_en, h.operario1, h.operario2,
              (SELECT max(r.fecha) FROM registros r WHERE r.hoja_id = h.id) AS ultimo_registro,
              (SELECT max(a.ruta) FROM orden_articulos a WHERE a.orden_id = o.id) AS ruta
         FROM hojas h JOIN ordenes o ON o.id = h.orden_id JOIN secciones s ON s.id = h.seccion_id`,
    ),
    pool.query(
      `SELECT s.nombre AS seccion, o.numero AS orden, o.cliente, a.codigo_bizcocho, a.bizcocho, a.codigo_decoracion, a.decoracion,
              h.operario1, h.operario2, ha.malas,
              (SELECT coalesce(sum(r.cantidad), 0) FROM registros r WHERE r.hoja_id = h.id AND r.articulo_id = a.id)::int AS producidas,
              (SELECT max(r.fecha) FROM registros r WHERE r.hoja_id = h.id AND r.articulo_id = a.id) AS fecha
         FROM hoja_articulos ha
         JOIN hojas h ON h.id = ha.hoja_id JOIN secciones s ON s.id = h.seccion_id
         JOIN ordenes o ON o.id = h.orden_id JOIN orden_articulos a ON a.id = ha.articulo_id
        WHERE h.estado = 'registrada'`,
    ),
  ]);
  return { desde: d, hasta: h, registros: registros.rows, hojas: hojas.rows, malas: malas.rows };
}

// ---- Base completa: una tabla por hoja de Excel ----
// Cada entrada: nombre de la hoja, columnas [clave, título, tipo] y la consulta. Tipos: fecha,
// numero, entero o texto (por defecto); sirven para que Excel reciba fechas y números de verdad.
const MINUTOS = (c) => `(extract(hour from ${c}) * 60 + extract(minute from ${c}))`;
export const TABLAS_BASE = [
  {
    hoja: "Registros", busca: ["o.numero", "o.cliente", "s.nombre", "h.operario1", "h.operario2", "a.bizcocho", "a.decoracion", "a.codigo"],
    columnas: [
      ["fecha", "Fecha", "fecha"], ["orden", "Orden"], ["cliente", "Cliente"], ["seccion", "Sección"],
      ["operario1", "Operario 1"], ["operario2", "Operario 2"],
      ["codigo_bizcocho", "Cód. bizcocho"], ["bizcocho", "Bizcocho"], ["codigo_decoracion", "Cód. decoración"], ["decoracion", "Decoración"],
      ["cantidad", "Cantidad", "entero"], ["hora_inicio", "Hora inicio"], ["hora_fin", "Hora fin"], ["personas", "Personas", "entero"],
      ["horas_persona", "Horas-persona", "numero"], ["min_pieza", "Min/pieza", "numero"],
      ["cantidad_producir", "Producir (orden)", "entero"], ["tiempo_estandar", "Tiempo impreso", "numero"], ["ruta", "Ruta"], ["fecha_emision", "Emisión orden", "fecha"],
    ],
    sql: `SELECT r.fecha, o.numero AS orden, o.cliente, s.nombre AS seccion, h.operario1, h.operario2,
            a.codigo_bizcocho, a.bizcocho, a.codigo_decoracion, a.decoracion, r.cantidad,
            to_char(r.hora_inicio, 'HH24:MI') AS hora_inicio, to_char(r.hora_fin, 'HH24:MI') AS hora_fin, r.personas,
            CASE WHEN r.hora_fin > r.hora_inicio THEN round(((${MINUTOS("r.hora_fin")} - ${MINUTOS("r.hora_inicio")}) / 60.0 * coalesce(nullif(r.personas, 0), 1))::numeric, 2) END AS horas_persona,
            CASE WHEN r.hora_fin > r.hora_inicio AND r.cantidad > 0 THEN round(((${MINUTOS("r.hora_fin")} - ${MINUTOS("r.hora_inicio")}) * coalesce(nullif(r.personas, 0), 1) / r.cantidad::numeric), 2) END AS min_pieza,
            a.cantidad_producir, a.tiempo_estandar, a.ruta, o.fecha_emision
       FROM registros r JOIN hojas h ON h.id = r.hoja_id JOIN secciones s ON s.id = h.seccion_id
       JOIN ordenes o ON o.id = h.orden_id JOIN orden_articulos a ON a.id = r.articulo_id
      WHERE $BUSCA ORDER BY r.fecha DESC NULLS LAST, o.numero, s.id`,
  },
  {
    hoja: "Hojas", busca: ["o.numero", "o.cliente", "s.nombre", "h.operario1", "h.operario2", "h.notas"],
    columnas: [
      ["orden", "Orden"], ["cliente", "Cliente"], ["seccion", "Sección"], ["estado", "Estado"], ["operario1", "Operario 1"], ["operario2", "Operario 2"],
      ["piezas", "Piezas registradas", "entero"], ["malas", "Malas", "entero"], ["notas", "Notas"],
      ["registrada_en", "Guardada el", "fecha"], ["lector", "Leída con"], ["costo_lectura", "Coste lectura (USD)", "numero"],
    ],
    sql: `SELECT o.numero AS orden, o.cliente, s.nombre AS seccion, h.estado, h.operario1, h.operario2,
            (SELECT sum(r.cantidad) FROM registros r WHERE r.hoja_id = h.id) AS piezas,
            (SELECT sum(ha.malas) FROM hoja_articulos ha WHERE ha.hoja_id = h.id) AS malas,
            h.notas, h.registrada_en, h.extraccion->>'lector' AS lector, (h.extraccion->'uso'->>'costo')::numeric AS costo_lectura
       FROM hojas h JOIN ordenes o ON o.id = h.orden_id JOIN secciones s ON s.id = h.seccion_id
      WHERE $BUSCA ORDER BY o.numero DESC, s.id`,
  },
  {
    hoja: "Órdenes", busca: ["o.numero", "o.cliente", "o.observaciones"],
    columnas: [
      ["orden", "Orden"], ["fecha_emision", "Emisión", "fecha"], ["cliente", "Cliente"], ["observaciones", "Observaciones"],
      ["estado", "Estado"], ["secciones_registradas", "Secciones registradas", "entero"], ["secciones", "Secciones de la ruta", "entero"],
      ["piezas_producir", "Piezas a producir", "entero"], ["creada", "Creada en la app", "fecha"],
    ],
    sql: `SELECT o.numero AS orden, o.fecha_emision, o.cliente, o.observaciones,
            CASE WHEN bool_and(h.estado = 'registrada') THEN 'completa' ELSE 'abierta' END AS estado,
            count(*) FILTER (WHERE h.estado = 'registrada') AS secciones_registradas, count(h.id) AS secciones,
            (SELECT sum(a.cantidad_producir) FROM orden_articulos a WHERE a.orden_id = o.id) AS piezas_producir, o.creado_en AS creada
       FROM ordenes o LEFT JOIN hojas h ON h.orden_id = o.id
      WHERE $BUSCA GROUP BY o.id ORDER BY o.numero DESC`,
  },
  {
    hoja: "Artículos", busca: ["o.numero", "a.codigo", "a.bizcocho", "a.decoracion"],
    columnas: [
      ["orden", "Orden"], ["codigo_bizcocho", "Cód. bizcocho"], ["bizcocho", "Bizcocho"], ["codigo_decoracion", "Cód. decoración"], ["decoracion", "Decoración"],
      ["cantidad_producir", "Producir", "entero"], ["tiempo_estandar", "Tiempo impreso", "numero"], ["ruta", "Ruta"],
    ],
    sql: `SELECT o.numero AS orden, a.codigo_bizcocho, a.bizcocho, a.codigo_decoracion, a.decoracion, a.cantidad_producir, a.tiempo_estandar, a.ruta
       FROM orden_articulos a JOIN ordenes o ON o.id = a.orden_id WHERE $BUSCA ORDER BY o.numero DESC, a.id`,
  },
  {
    hoja: "Malas", busca: ["o.numero", "s.nombre", "a.bizcocho", "a.decoracion", "h.operario1", "h.operario2"],
    columnas: [
      ["orden", "Orden"], ["seccion", "Sección"], ["codigo_bizcocho", "Cód. bizcocho"], ["bizcocho", "Bizcocho"], ["codigo_decoracion", "Cód. decoración"], ["decoracion", "Decoración"],
      ["operario1", "Operario 1"], ["operario2", "Operario 2"], ["producidas", "Producidas", "entero"], ["malas", "Malas", "entero"],
    ],
    sql: `SELECT o.numero AS orden, s.nombre AS seccion, a.codigo_bizcocho, a.bizcocho, a.codigo_decoracion, a.decoracion, h.operario1, h.operario2,
            (SELECT sum(r.cantidad) FROM registros r WHERE r.hoja_id = h.id AND r.articulo_id = a.id) AS producidas, ha.malas
       FROM hoja_articulos ha JOIN hojas h ON h.id = ha.hoja_id JOIN secciones s ON s.id = h.seccion_id
       JOIN ordenes o ON o.id = h.orden_id JOIN orden_articulos a ON a.id = ha.articulo_id
      WHERE ha.malas IS NOT NULL AND $BUSCA ORDER BY o.numero DESC, s.id`,
  },
  {
    hoja: "Bizcochos", busca: ["codigo", "nombre"],
    columnas: [["codigo", "Código"], ["nombre", "Nombre"], ["actualizado", "Actualizado", "fecha"]],
    sql: `SELECT codigo, nombre, actualizado FROM bizcochos WHERE $BUSCA ORDER BY codigo`,
  },
  {
    hoja: "Decoraciones", busca: ["codigo", "nombre"],
    columnas: [["codigo", "Código"], ["nombre", "Nombre"], ["actualizado", "Actualizado", "fecha"]],
    sql: `SELECT codigo, nombre, actualizado FROM decoraciones WHERE $BUSCA ORDER BY codigo`,
  },
];

// Filas de una tabla, opcionalmente filtradas por texto (sin tildes ni mayúsculas) y limitadas.
export async function filasBase(tabla, { buscar = "", limite = null } = {}) {
  const t = TABLAS_BASE.find((x) => x.hoja === tabla);
  if (!t) throw new ErrorDeDatos("Tabla desconocida");
  const q = normalizar(buscar);
  const filtro = q
    ? "(" + t.busca.map((c) => `translate(upper(coalesce(${c}::text, '')), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE $1`).join(" OR ") + ")"
    : "TRUE";
  const sql = t.sql.replace("$BUSCA", filtro) + (limite ? ` LIMIT ${Number(limite) | 0}` : "");
  const { rows } = await pool.query(sql, q ? [`%${q.replace(/[%_]/g, "")}%`] : []);
  return rows;
}

export async function resumenBase() {
  const cuentas = await Promise.all(TABLAS_BASE.map(async (t) => {
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM (${t.sql.replace("$BUSCA", "TRUE")}) x`);
    return { hoja: t.hoja, filas: rows[0].n, columnas: t.columnas.map(([clave, titulo, tipo]) => ({ clave, titulo, tipo: tipo ?? "texto" })) };
  }));
  return cuentas;
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
