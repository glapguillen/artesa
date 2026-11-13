import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const Registro = z.object({
  fecha: z.string().nullable().describe("Fecha manuscrita del bloque, en formato AAAA-MM-DD"),
  cantidad: z.number().nullable().describe("CANT: piezas hechas"),
  hora_inicio: z.string().nullable().describe("Primera hora de la casilla TMPO, HH:MM en 24 h"),
  hora_fin: z.string().nullable().describe("Segunda hora de la casilla TMPO, HH:MM en 24 h"),
  personas: z.number().nullable().describe("PER: número de personas"),
});

const Articulo = z.object({
  codigo_bizcocho: z.string().describe("Primer grupo del código impreso (4 dígitos), p. ej. '0944'; vacío si la foto lo corta por completo"),
  bizcocho: z.string().describe("Nombre de la pieza, impreso junto al código, p. ej. 'BANDEJA HOJA #2'"),
  codigo_decoracion: z.string().describe("Segundo grupo del código impreso (3 dígitos), p. ej. '626'"),
  decoracion: z.string().describe("Segunda línea del artículo (decoración), p. ej. 'GIRASOL AZUL'; vacío si no hay"),
  cantidad_producir: z.number().nullable(),
  tiempo_estandar: z.number().nullable().describe("Columna TIEMPO, p. ej. 240,00 -> 240"),
  ruta: z.string().nullable().describe("Letras tras la palabra 'ruta', p. ej. 'STDE'"),
  malas: z.number().nullable().describe("Piezas malas anotadas a mano; null si la casilla está vacía"),
  registros: z.array(Registro).describe("Un elemento por cada bloque de fecha con datos manuscritos en la fila del artículo, más los registros de este artículo anotados fuera de la tabla"),
});

export const HojaSchema = z.object({
  es_hoja_produccion: z.boolean().describe("false si la foto no es una Hoja de Producción Diaria"),
  numero_orden: z.string().nullable().describe("ORDEN #, con sus ceros a la izquierda"),
  seccion: z.string().nullable().describe("Texto impreso tras 'Seccion', tal cual"),
  fecha_emision: z.string().nullable().describe("Fecha impresa arriba a la derecha, AAAA-MM-DD"),
  cliente: z.string().nullable(),
  observaciones: z.string().nullable(),
  operario1: z.string().nullable().describe("Nombre manuscrito sobre la tabla; si hay dos personas ('Sonia-Tania'), la primera"),
  operario2: z.string().nullable().describe("Segunda persona cuando sobre la tabla hay dos nombres; null si solo hay uno"),
  notas: z.string().nullable().describe("Anotaciones a mano fuera de las casillas que no son un registro de producción (comentarios, nombres junto a observaciones, horas sueltas); null si no hay"),
  articulos: z.array(Articulo),
  dudas: z.array(z.string()).describe("Campos que no se leen con seguridad, cada uno en una frase corta en español"),
});

// El mismo esquema en JSON Schema, para Gemini. Los campos que pueden faltar van como
// ["tipo", "null"], la forma más admitida.
export const ESQUEMA_JSON = (() => {
  const limpiar = (n) => {
    if (Array.isArray(n)) return n.map(limpiar);
    if (!n || typeof n !== "object") return n;
    if (n.anyOf && n.anyOf.length === 2 && n.anyOf.some((x) => x.type === "null")) {
      const otro = n.anyOf.find((x) => x.type !== "null");
      return limpiar({ ...otro, type: [otro.type, "null"], ...(n.description ? { description: n.description } : {}) });
    }
    const r = {};
    for (const [k, v] of Object.entries(n)) if (k !== "$schema" && k !== "additionalProperties") r[k] = limpiar(v);
    return r;
  };
  return limpiar(z.toJSONSchema(HojaSchema));
})();

const INSTRUCCIONES = `Vas a transcribir una "Hoja de Producción Diaria" de un taller de cerámica a partir de una foto tomada con el celular. La foto puede venir girada, inclinada, algo movida o con la hoja encima de un montón de otras hojas; transcribe solo la hoja de arriba, en su orientación correcta.

La hoja tiene datos impresos (orden, sección, fecha de emisión, cliente, observaciones y uno o varios artículos, cada uno con un código de dos grupos de dígitos ("0944 626": el primero identifica el bizcocho, que es la pieza, y el segundo la decoración), el nombre del bizcocho a continuación, el nombre de la decoración en la línea de abajo, cantidad a producir, tiempo y ruta) y datos escritos a mano por el operario:
- Su nombre sobre la tabla. A veces son dos personas, escritas juntas con un guion ("Sonia-Tania"): van separadas en operario1 y operario2. Nombre y apellido de una sola persona ("Ana Pérez") van juntos en operario1. A veces es solo una firma.
- A la derecha, hasta tres bloques de columnas. Cada bloque tiene arriba una fecha, que vale para todos los artículos de la hoja, y debajo las casillas CANT (piezas hechas), TMPO (dos horas apiladas: inicio arriba, fin abajo) y PER (personas). Un artículo solo tiene registro en un bloque si en su fila hay algo escrito; es normal que un artículo tenga datos en el segundo bloque y no en el primero.
- Bajo "malas", a veces, un número de piezas defectuosas.
- A veces un registro más fuera de la tabla. La hoja solo tiene sitio para tres fechas, así que cuando el trabajo sigue un cuarto día el operario lo anota debajo o al lado de la tabla, con la misma forma que un bloque: una fecha y, junto a ella, cantidad, dos horas y a veces personas. Eso es un registro de producción, no una nota: añádelo a los registros del artículo al que corresponde. Suele ser el último artículo de la hoja; compruébalo con las cantidades, porque lo normal es que esa cantidad complete lo que le faltaba a un artículo para llegar a su cantidad a producir. Di en "dudas" que ese registro estaba fuera de la tabla y a qué artículo lo asignaste, para que el revisor lo confirme.
- A veces otras anotaciones sueltas (comentarios, tiempos de capacitación, nombres, horas sin fecha ni cantidad). Solo eso va en "notas", transcrito tal cual.

La impresión puede estar desplazada respecto a las líneas de la tabla; guíate por el orden de los artículos, no por las líneas.

Estos datos se guardan en la base de datos de producción y antes los revisa una persona, así que importa más ser fiel que completar. Si una casilla está vacía devuelve null. Si el borde de la foto corta un texto (un código o una decoración a los que les falta el principio), devuelve solo lo que se ve (el grupo de tres dígitos pegado al nombre de la pieza es siempre el de la decoración) y dilo en "dudas"; no lo completes. Si un valor manuscrito admite más de una lectura, elige la más probable y menciónalo en "dudas" diciendo qué campo es y qué alternativas ves. Reserva "dudas" para lo que el revisor deba comprobar contra el papel: no anotes ahí casillas vacías, círculos o subrayados sobre texto impreso, ni valores que lees con claridad.

Las fechas manuscritas van en día-mes-año, con guiones, puntos o barras; las barras suelen parecer unos ("2610812026" es 26/08/2026). Usa la fecha de emisión impresa para resolver dígitos dudosos: el trabajo se hace ese día o en las semanas siguientes. Las horas pueden venir con punto, guion o dos puntos ("7.00", "15-33") y la jornada va aproximadamente de 7:00 a 17:30; devuélvelas como HH:MM tal como están escritas, aunque parezcan un error.`;

// Comprobaciones que no dependen del modelo: se añaden a las dudas para que el revisor las vea.
export function verificar(d) {
  const avisos = [];
  const minutos = (h) => (/^\d{1,2}:\d{2}$/.test(h ?? "") ? Number(h.split(":")[0]) * 60 + Number(h.split(":")[1]) : null);
  for (const a of d.articulos ?? []) {
    const nombre = [a.bizcocho, a.decoracion].filter(Boolean).join(" ") || "Artículo";
    let hechas = 0;
    for (const r of a.registros ?? []) {
      hechas += Number(r.cantidad) || 0;
      const ini = minutos(r.hora_inicio), fin = minutos(r.hora_fin);
      if (ini != null && fin != null && fin <= ini)
        avisos.push(`${nombre}: la hora de fin (${r.hora_fin}) no es posterior a la de inicio (${r.hora_inicio}).`);
      if (r.fecha && d.fecha_emision && r.fecha < d.fecha_emision)
        avisos.push(`${nombre}: la fecha ${r.fecha} es anterior a la emisión de la orden.`);
      if (!r.fecha) avisos.push(`${nombre}: hay un registro sin fecha.`);
    }
    if (a.cantidad_producir != null && hechas > a.cantidad_producir)
      avisos.push(`${nombre}: se anotaron ${hechas} piezas y la orden pide ${a.cantidad_producir}.`);
  }
  return avisos;
}

// Proveedor de lectura con IA: LECTURA=gemini|claude|local lo fija; si no, se usa el que tenga
// clave, con Gemini primero (tiene nivel gratuito). Sin ninguna, la lectura es la local del celular.
export function proveedor() {
  const elegido = (process.env.LECTURA || "").toLowerCase();
  if (elegido === "local") return null;
  if (elegido === "gemini") return process.env.GEMINI_API_KEY ? "gemini" : null;
  if (elegido === "claude") return process.env.ANTHROPIC_API_KEY ? "claude" : null;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  return null;
}

// Error de la API traducido para quien usa la aplicación. `apagar`: la IA no volverá a funcionar
// sola (clave o saldo); `pausar`: cuota agotada, vuelve a intentarse más tarde.
export class ErrorDeLectura extends Error {
  constructor(mensaje, { apagar = false, pausar = false } = {}) {
    super(mensaje);
    this.apagar = apagar;
    this.pausar = pausar;
  }
}

export async function extraerHoja(imagenBase64, mime) {
  const p = proveedor();
  const datos = p === "gemini" ? await conGemini(imagenBase64, mime) : await conClaude(imagenBase64, mime);
  datos.dudas = [...(datos.dudas ?? []), ...verificar(datos)];
  return datos;
}

let gemini;
const PEDIDO = "Transcribe esta hoja. Responde solo con el JSON pedido.";

async function conGemini(imagenBase64, mime) {
  const { GoogleGenAI, ApiError } = await import("@google/genai");
  gemini ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const pedir = (conEsquema) =>
    gemini.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: mime, data: imagenBase64 } }, { text: PEDIDO }] }],
      config: {
        systemInstruction: conEsquema ? INSTRUCCIONES : INSTRUCCIONES + "\n\nEl JSON sigue este esquema:\n" + JSON.stringify(ESQUEMA_JSON),
        responseMimeType: "application/json",
        ...(conEsquema ? { responseJsonSchema: ESQUEMA_JSON } : {}),
        temperature: 0,
      },
    });
  let respuesta;
  try {
    try {
      respuesta = await pedir(true);
    } catch (err) {
      // Si el modelo no admite alguna parte del esquema, se pide el JSON sin él y se valida aquí.
      if (!(err instanceof ApiError) || err.status !== 400 || !/schema/i.test(err.message)) throw err;
      respuesta = await pedir(false);
    }
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    if (err.status === 429)
      throw new ErrorDeLectura("Se agotó la cuota gratuita de Gemini por ahora", { pausar: true });
    if (err.status === 400 && /api.?key/i.test(err.message) || err.status === 401 || err.status === 403)
      throw new ErrorDeLectura("La clave de Gemini no es válida o no tiene permiso (GEMINI_API_KEY)", { apagar: true });
    if (err.status >= 500) throw new ErrorDeLectura("Gemini no responde en este momento. Intenta de nuevo en un momento.");
    throw new ErrorDeLectura("Gemini rechazó la foto: " + err.message.slice(0, 200));
  }
  let datos;
  try {
    datos = HojaSchema.parse(JSON.parse(respuesta.text ?? ""));
  } catch {
    throw new ErrorDeLectura("Gemini no pudo leer la imagen (respuesta incompleta). Prueba con otra foto.");
  }
  return datos;
}

let cliente;

async function conClaude(imagenBase64, mime) {
  cliente ??= new Anthropic();
  const respuesta = await cliente.beta.messages.parse({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "high", format: zodOutputFormat(HojaSchema) },
    // Si el modelo principal declina la petición, la API la reintenta en el modelo de respaldo.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: INSTRUCCIONES,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mime, data: imagenBase64 } },
          { type: "text", text: "Transcribe esta hoja." },
        ],
      },
    ],
  });

  if (respuesta.stop_reason === "refusal" || !respuesta.parsed_output) {
    throw new Error("El modelo no pudo leer la imagen (" + respuesta.stop_reason + ")");
  }
  return respuesta.parsed_output;
}
