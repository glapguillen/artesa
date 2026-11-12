import "dotenv/config";
import express from "express";
import { extraerHoja } from "./extraer.js";
import { ErrorDeDatos, detalleOrden, guardarHoja, hojaExistente, listarOrdenes, migrar, pool } from "./db.js";

const MIMES = ["image/jpeg", "image/png", "image/webp"];

export const app = express();
app.use(express.json({ limit: "20mb" }));
app.use(express.static(new URL("./public", import.meta.url).pathname));

function imagenDe(cuerpo) {
  const { imagen, mime } = cuerpo ?? {};
  if (typeof imagen !== "string" || !imagen) throw new ErrorDeDatos("Falta la imagen");
  if (!MIMES.includes(mime)) throw new ErrorDeDatos("Formato de imagen no admitido");
  return { imagen, mime };
}

// Lee la foto y devuelve los datos para que el usuario los revise. No guarda nada.
app.post("/api/extraer", async (req, res) => {
  const { imagen, mime } = imagenDe(req.body);
  const datos = await extraerHoja(imagen, mime);
  const existente = await hojaExistente(datos.numero_orden, datos.seccion);
  res.json({ datos, ya_registrada: existente?.registrada_en ?? null });
});

// Guarda la hoja revisada (con la foto, si se envía).
app.post("/api/hojas", async (req, res) => {
  const { datos, extraccion, imagen, mime } = req.body ?? {};
  if (!datos) throw new ErrorDeDatos("Faltan los datos de la hoja");
  const foto = imagen ? Buffer.from(imagenDe(req.body).imagen, "base64") : null;
  res.json(await guardarHoja({ datos, extraccion, foto, fotoMime: foto ? mime : null }));
});

app.get("/api/ordenes", async (_req, res) => res.json(await listarOrdenes()));

app.get("/api/ordenes/:numero", async (req, res) => {
  const orden = await detalleOrden(req.params.numero);
  if (!orden) return res.status(404).json({ error: "Orden no encontrada" });
  res.json(orden);
});

app.get("/api/hojas/:id/foto", async (req, res) => {
  const { rows } = await pool.query("SELECT foto, foto_mime FROM hojas WHERE id = $1", [Number(req.params.id) || 0]);
  if (!rows[0]?.foto) return res.status(404).end();
  res.type(rows[0].foto_mime).send(rows[0].foto);
});

app.use((err, _req, res, _next) => {
  if (err instanceof ErrorDeDatos) return res.status(400).json({ error: err.message });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "La imagen es demasiado grande" });
  console.error(err);
  const sinCredenciales = /apiKey|authToken|authentication/i.test(err.message ?? "");
  res.status(500).json({
    error: sinCredenciales
      ? "El servidor no tiene configurada la clave de la API de Anthropic (ANTHROPIC_API_KEY)"
      : "Error del servidor: " + (err.message ?? "desconocido"),
  });
});

if (import.meta.url === `file://${process.argv[1]}`) {
  await migrar();
  const puerto = Number(process.env.PORT) || 3000;
  app.listen(puerto, () => console.log(`Artesa · hojas de producción en http://localhost:${puerto}`));
}
