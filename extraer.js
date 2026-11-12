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
  codigo: z.string().describe("Código impreso, p. ej. '0944 626'"),
  descripcion: z.string().describe("Nombre de la pieza, p. ej. 'BANDEJA HOJA #2'"),
  decoracion: z.string().describe("Segunda línea del artículo (decoración), p. ej. 'GIRASOL AZUL'; vacío si no hay"),
  cantidad_producir: z.number().nullable(),
  tiempo_estandar: z.number().nullable().describe("Columna TIEMPO, p. ej. 240,00 -> 240"),
  ruta: z.string().nullable().describe("Letras tras la palabra 'ruta', p. ej. 'STDE'"),
  malas: z.number().nullable().describe("Piezas malas anotadas a mano; null si la casilla está vacía"),
  registros: z.array(Registro).describe("Un elemento por cada bloque de fecha con datos manuscritos"),
});

export const HojaSchema = z.object({
  es_hoja_produccion: z.boolean().describe("false si la foto no es una Hoja de Producción Diaria"),
  numero_orden: z.string().nullable().describe("ORDEN #, con sus ceros a la izquierda"),
  seccion: z.string().nullable().describe("Texto impreso tras 'Seccion', tal cual"),
  fecha_emision: z.string().nullable().describe("Fecha impresa arriba a la derecha, AAAA-MM-DD"),
  cliente: z.string().nullable(),
  observaciones: z.string().nullable(),
  operario: z.string().nullable().describe("Nombre manuscrito sobre la tabla"),
  articulos: z.array(Articulo),
  dudas: z.array(z.string()).describe("Campos que no se leen con seguridad, cada uno en una frase corta en español"),
});

const INSTRUCCIONES = `Vas a transcribir una "Hoja de Producción Diaria" de un taller de cerámica a partir de una foto. La foto suele venir girada 90°; léela en la orientación correcta.

La hoja tiene datos impresos (orden, sección, fecha de emisión, cliente, observaciones, artículos con cantidad a producir, tiempo y ruta) y datos escritos a mano por el operario: su nombre, y a la derecha de cada artículo hasta tres bloques, cada uno encabezado por una fecha y con las casillas CANT (piezas hechas), TMPO (dos horas apiladas: inicio arriba, fin abajo) y PER (personas). Debajo de "malas" puede haber un número de piezas defectuosas.

Estos datos se guardan en la base de datos de producción y después los revisa una persona, así que importa más ser fiel que completar: si una casilla está vacía devuelve null, y si un valor manuscrito admite más de una lectura elige la más probable y menciónalo en "dudas" diciendo qué campo es y qué alternativas ves. Las fechas manuscritas van en día-mes-año (p. ej. "16/09/2026" o "14-09-26"); usa la fecha de emisión impresa como referencia para resolver el año y dígitos dudosos. Las horas pueden venir con punto, guion o dos puntos ("7.00", "15-33"); devuélvelas como HH:MM.`;

let cliente;

export async function extraerHoja(imagenBase64, mime) {
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
