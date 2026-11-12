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
  operario: z.string().nullable().describe("Nombre o nombres manuscritos sobre la tabla, p. ej. 'Sonia-Tania'"),
  notas: z.string().nullable().describe("Otras anotaciones a mano fuera de las casillas (nombres junto a observaciones, horas sueltas bajo la tabla); null si no hay"),
  articulos: z.array(Articulo),
  dudas: z.array(z.string()).describe("Campos que no se leen con seguridad, cada uno en una frase corta en español"),
});

const INSTRUCCIONES = `Vas a transcribir una "Hoja de Producción Diaria" de un taller de cerámica a partir de una foto tomada con el celular. La foto puede venir girada, inclinada, algo movida o con la hoja encima de un montón de otras hojas; transcribe solo la hoja de arriba, en su orientación correcta.

La hoja tiene datos impresos (orden, sección, fecha de emisión, cliente, observaciones y uno o varios artículos, cada uno con código, nombre, decoración en la línea de abajo, cantidad a producir, tiempo y ruta) y datos escritos a mano por el operario:
- Su nombre sobre la tabla (a veces dos nombres, o solo una firma).
- A la derecha, hasta tres bloques de columnas. Cada bloque tiene arriba una fecha, que vale para todos los artículos de la hoja, y debajo las casillas CANT (piezas hechas), TMPO (dos horas apiladas: inicio arriba, fin abajo) y PER (personas). Un artículo solo tiene registro en un bloque si en su fila hay algo escrito; es normal que un artículo tenga datos en el segundo bloque y no en el primero.
- Bajo "malas", a veces, un número de piezas defectuosas.
- A veces anotaciones sueltas fuera de las casillas; van en "notas", no en los registros.

La impresión puede estar desplazada respecto a las líneas de la tabla; guíate por el orden de los artículos, no por las líneas.

Estos datos se guardan en la base de datos de producción y antes los revisa una persona, así que importa más ser fiel que completar. Si una casilla está vacía devuelve null. Si el borde de la foto corta un texto (un código o una decoración a los que les falta el principio), devuelve solo lo que se ve y dilo en "dudas"; no lo completes. Si un valor manuscrito admite más de una lectura, elige la más probable y menciónalo en "dudas" diciendo qué campo es y qué alternativas ves. Reserva "dudas" para lo que el revisor deba comprobar contra el papel: no anotes ahí casillas vacías, círculos o subrayados sobre texto impreso, ni valores que lees con claridad.

Las fechas manuscritas van en día-mes-año, con guiones, puntos o barras; las barras suelen parecer unos ("2610812026" es 26/08/2026). Usa la fecha de emisión impresa para resolver dígitos dudosos: el trabajo se hace ese día o en las semanas siguientes. Las horas pueden venir con punto, guion o dos puntos ("7.00", "15-33") y la jornada va aproximadamente de 7:00 a 17:30; devuélvelas como HH:MM tal como están escritas, aunque parezcan un error.`;

// Comprobaciones que no dependen del modelo: se añaden a las dudas para que el revisor las vea.
export function verificar(d) {
  const avisos = [];
  const minutos = (h) => (/^\d{1,2}:\d{2}$/.test(h ?? "") ? Number(h.split(":")[0]) * 60 + Number(h.split(":")[1]) : null);
  for (const a of d.articulos ?? []) {
    const nombre = [a.descripcion, a.decoracion].filter(Boolean).join(" ") || a.codigo || "Artículo";
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
  const datos = respuesta.parsed_output;
  datos.dudas = [...datos.dudas, ...verificar(datos)];
  return datos;
}
