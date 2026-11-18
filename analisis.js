import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { configClaude } from "./extraer.js";

// Análisis con Claude para la pestaña Insights. Recibe solo el resumen numérico que arma el
// navegador (nunca fotos), así que cada consulta cuesta poco: unos pocos miles de tokens.
const Insights = z.object({
  resumen: z.string().describe("Dos o tres frases con lo más importante del período"),
  hallazgos: z.array(z.object({
    titulo: z.string().describe("Una línea, con el dato que lo sostiene"),
    detalle: z.string().describe("Qué muestran los números y por qué importa, en 1-3 frases"),
    accion: z.string().describe("Una acción concreta para el jefe de planta"),
    prioridad: z.enum(["alta", "media", "baja"]),
  })).describe("Entre 3 y 6 hallazgos, de mayor a menor prioridad"),
  limitaciones: z.array(z.string()).describe("Qué no se puede concluir con estos datos (pocos registros, horas dudosas...)"),
});

const INSTRUCCIONES = `Eres analista de producción en un taller de cerámica artesanal. Cada orden pasa por varias secciones (Señalado, Trazado, Decorado, Esmalt) según su ruta; cada sección anota a mano en una hoja diaria las piezas hechas, las horas y las personas, y las piezas malas.

Recibirás un resumen numérico de un período, ya calculado. Tu trabajo es decir qué decisiones debería considerar el jefe de planta: dónde se atasca la producción, qué órdenes requieren atención, dónde se pierde calidad y qué diferencias de productividad merecen revisarse.

Reglas:
- Usa solo los números del resumen; no inventes datos ni causas. Si una causa es una hipótesis, dilo como hipótesis.
- Las comparaciones entre operarios se basan en pocas hojas y en horas anotadas a mano: preséntalas como algo a revisar, nunca como un juicio sobre la persona.
- No hay datos de eficiencia frente a un tiempo estándar: no la menciones ni la estimes.
- Si hay pocos datos, dilo en limitaciones y no fuerces conclusiones.
- Escribe en español, claro y breve.`;

let cliente;

export async function analizarConClaude(resumen) {
  cliente ??= new Anthropic();
  const cfg = configClaude(process.env.INSIGHTS_MODELO || "sonnet:medium");
  const respaldo = cfg.modelo === "claude-haiku-5-5" ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };
  const respuesta = await cliente.beta.messages.parse({
    model: cfg.modelo,
    max_tokens: 16000,
    output_config: { effort: cfg.esfuerzo, format: zodOutputFormat(Insights) },
    ...respaldo,
    system: INSTRUCCIONES,
    messages: [{ role: "user", content: "Resumen del período (JSON):\n" + JSON.stringify(resumen) }],
  });
  if (respuesta.stop_reason === "refusal" || !respuesta.parsed_output) {
    throw new Error("Claude no pudo analizar los datos (" + respuesta.stop_reason + ")");
  }
  return { ...respuesta.parsed_output, modelo: cfg.etiqueta, tokens: respuesta.usage };
}
