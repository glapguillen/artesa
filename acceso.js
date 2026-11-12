import crypto from "node:crypto";

// Acceso con una contraseña compartida (APP_PASSWORD). La sesión es una cookie firmada.
const DURACION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FALLOS = 8;
const VENTANA_MS = 15 * 60 * 1000;
const fallos = new Map(); // ip -> { n, hasta }

const clave = () => process.env.APP_PASSWORD || "";
const llave = () => crypto.createHash("sha256").update("artesa-sesion:" + clave()).digest();
const firmar = (texto) => crypto.createHmac("sha256", llave()).update(texto).digest("base64url");
const iguales = (a, b) => {
  const x = crypto.createHash("sha256").update(String(a)).digest();
  const y = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

export const accesoActivo = () => clave() !== "";

function sesionValida(req) {
  const cookie = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith("sesion="));
  if (!cookie) return false;
  const [expira, firma] = cookie.slice(7).split(".");
  return Boolean(firma) && Number(expira) > Date.now() && iguales(firma, firmar(expira));
}

export function exigirSesion(req, res, next) {
  if (!accesoActivo() || sesionValida(req)) return next();
  res.status(401).json({ error: "Ingresa la contraseña" });
}

export function estado(req, res) {
  res.json({ requiere_clave: accesoActivo(), dentro: !accesoActivo() || sesionValida(req) });
}

export function entrar(req, res) {
  const ahora = Date.now();
  const f = fallos.get(req.ip);
  if (f && f.hasta > ahora && f.n >= MAX_FALLOS)
    return res.status(429).json({ error: "Demasiados intentos. Espera unos minutos." });
  if (!accesoActivo() || !iguales(req.body?.clave ?? "", clave())) {
    fallos.set(req.ip, { n: f && f.hasta > ahora ? f.n + 1 : 1, hasta: ahora + VENTANA_MS });
    return res.status(401).json({ error: "Contraseña incorrecta" });
  }
  fallos.delete(req.ip);
  const expira = String(ahora + DURACION_MS);
  res.cookie("sesion", `${expira}.${firmar(expira)}`, {
    httpOnly: true, sameSite: "lax", secure: req.secure, maxAge: DURACION_MS, path: "/",
  });
  res.json({ ok: true });
}

export function salir(_req, res) {
  res.clearCookie("sesion", { path: "/" });
  res.json({ ok: true });
}
