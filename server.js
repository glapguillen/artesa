import "dotenv/config";
import express from "express";
import { accesoActivo, entrar, estado, exigirSesion, salir } from "./acceso.js";
import { ErrorDeLectura, extraerHoja, proveedor } from "./extraer.js";
import { ErrorDeDatos, catalogo, detalleOrden, guardarEnCatalogo, guardarHoja, hojaExistente, listarOrdenes, migrar, pool } from "./db.js";

const MIMES = ["image/jpeg", "image/png", "image/webp"];

export const app = express();
app.set("trust proxy", 1); // detrás del proxy HTTPS del servicio en la nube
app.use(express.json({ limit: "20mb" }));
app.use(express.static(new URL("./public", import.meta.url).pathname));

// Conversor de fotos HEIC para el navegador; solo se descarga cuando hace falta.
app.get("/vendor/heic-to.js", (_req, res) =>
  res.sendFile(new URL("./node_modules/heic-to/dist/iife/heic-to.js", import.meta.url).pathname, { maxAge: "7d" }));

// Lector gratuito (OCR) que corre en el navegador, servido desde aquí para no depender de otros sitios.
const desde = (ruta) => new URL(ruta, import.meta.url).pathname;
app.use("/vendor/tesseract", express.static(desde("./node_modules/tesseract.js/dist"), { maxAge: "7d" }));
app.use("/vendor/tesseract-core", express.static(desde("./node_modules/tesseract.js-core"), { maxAge: "7d" }));
app.use("/vendor/tesseract-lang", express.static(desde("./node_modules/@tesseract.js-data/spa/4.0.0_best_int"), { maxAge: "7d" }));

// Sin clave de la API de Anthropic (o con LECTURA=local) la foto se lee en el propio celular.
let iaApagada = null; // motivo, si la IA falló por clave o saldo; se reintenta al reiniciar el servidor
let iaPausada = null; // { motivo, hasta }: cuota agotada; se vuelve a intentar pasado un rato
const motivoSinIA = () => iaApagada ?? (iaPausada && iaPausada.hasta > Date.now() ? iaPausada.motivo : null);
const modoLectura = () => (!proveedor() || motivoSinIA() ? "local" : "ia");
app.get("/api/config", (_req, res) => res.json({ lectura: modoLectura() }));

app.get("/salud", (_req, res) => res.send("ok"));
app.get("/api/sesion", estado);
app.post("/api/entrar", entrar);
app.post("/api/salir", salir);
app.use("/api", exigirSesion);

function imagenDe(cuerpo) {
  const { imagen, mime } = cuerpo ?? {};
  if (typeof imagen !== "string" || !imagen) throw new ErrorDeDatos("Falta la imagen");
  if (!MIMES.includes(mime)) throw new ErrorDeDatos("Formato de imagen no admitido");
  return { imagen, mime };
}

// Lee la foto y devuelve los datos para que el usuario los revise. No guarda nada.
app.post("/api/extraer", async (req, res) => {
  if (modoLectura() === "local") return res.status(409).json({ error: motivoSinIA() ?? "La lectura con IA está desactivada en este servidor", sin_ia: true });
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

app.get("/api/catalogo", async (_req, res) => res.json(await catalogo()));
app.put("/api/catalogo/:tipo/:codigo", async (req, res) =>
  res.json(await guardarEnCatalogo(req.params.tipo, req.params.codigo, req.body?.nombre)));

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
  if (err instanceof ErrorDeLectura) {
    if (err.apagar) iaApagada = err.message;
    if (err.pausar) iaPausada = { motivo: err.message, hasta: Date.now() + err.minutos * 60 * 1000 };
    return res.status(500).json({ error: err.message, sin_ia: err.apagar || err.pausar });
  }
  // Errores de la API de Anthropic, explicados para quien usa la aplicación.
  const mensaje =
    err.status === 401 ? "La clave de la API de Anthropic no es válida o fue revocada (ANTHROPIC_API_KEY)"
    : err.status === 429 ? "La API de Anthropic está saturada o sin cupo. Intenta de nuevo en un momento."
    : err.status === 400 && /credit|billing/i.test(err.message ?? "") ? "La cuenta de Anthropic no tiene saldo"
    : /apiKey|authToken/i.test(err.message ?? "") ? "El servidor no tiene configurada la clave de la API de Anthropic (ANTHROPIC_API_KEY)"
    : "Error del servidor: " + (err.message ?? "desconocido");
  // Sin saldo o sin clave válida, la IA no volverá a funcionar hasta que alguien lo arregle:
  // se apaga para todo el servidor y el celular pasa a la lectura gratuita.
  const sinIA = err.status === 401 || err.status === 403 || /saldo|clave/.test(mensaje);
  if (sinIA) iaApagada = mensaje;
  res.status(500).json({ error: mensaje, sin_ia: sinIA });
});

// Un error suelto en segundo plano no debe tumbar el servidor (Render respondería 502).
process.on("unhandledRejection", (err) => console.error("Error no atendido:", err));

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!accesoActivo()) {
    if (process.env.NODE_ENV === "production") {
      console.error("Falta APP_PASSWORD: en producción la aplicación no arranca sin contraseña de acceso.");
      process.exit(1);
    }
    console.warn("Aviso: sin APP_PASSWORD cualquiera que abra la página puede usarla.");
  }
  await migrar();
  const puerto = Number(process.env.PORT) || 3000;
  app.listen(puerto, () => console.log(`Artesa · hojas de producción en http://localhost:${puerto}`));
}
