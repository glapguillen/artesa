import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { detalleOrden, guardarHoja, hojaExistente, listarOrdenes, migrar, pool } from "../db.js";

const ORDEN = "TEST-0076660";
const articulo = (registros, malas = "") => ({
  codigo: "0944 626", descripcion: "BANDEJA HOJA #2", decoracion: "GIRASOL AZUL",
  cantidad_producir: 12, tiempo_estandar: 240, ruta: "STDE", malas, registros,
});
const hoja = (seccion, operario, registros) => ({
  numero_orden: ORDEN, seccion, fecha_emision: "2026-09-14", cliente: "ANDRADE PATRICIO",
  observaciones: "MARCA VEGA", operario, articulos: [articulo(registros)],
});
const limpiar = () => pool.query("DELETE FROM ordenes WHERE numero = $1", [ORDEN]);

before(async () => { await migrar(); await limpiar(); });
after(async () => { await limpiar(); await pool.end(); });

test("la ruta genera una hoja por sección y la foto registra la suya", async () => {
  await guardarHoja({ datos: hoja("TRAZADO", "Ana Perez", [{ fecha: "2026-09-14", cantidad: "12", hora_inicio: "15:33", hora_fin: "16:55", personas: "" }]) });
  const o = await detalleOrden(ORDEN);
  assert.deepEqual(o.hojas.map((h) => [h.seccion, h.estado]), [
    ["SEÑALADO", "pendiente"], ["TRAZADO", "registrada"], ["DECORADO", "pendiente"], ["ESMALT", "pendiente"],
  ]);
  const r = o.hojas[1].articulos[0].registros;
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].fecha, r[0].cantidad, r[0].hora_inicio, r[0].hora_fin, r[0].personas], ["2026-09-14", 12, "15:33", "16:55", null]);
});

test("varias fechas en una hoja y sección abreviada o sin acento", async () => {
  await guardarHoja({ datos: hoja("Decorado", "Thalya", [
    { fecha: "2026-09-16", cantidad: 1, hora_inicio: "14:45", hora_fin: "15:30" },
    { fecha: "2026-09-17", cantidad: 8, hora_inicio: "7:00", hora_fin: "15:30" },
    { fecha: "2026-09-18", cantidad: 3, hora_inicio: "7:00", hora_fin: "10:50" },
    { fecha: "", cantidad: "", hora_inicio: "", hora_fin: "", personas: "" },
  ]) });
  await guardarHoja({ datos: hoja("SENALADO", "Ana", []) });
  await guardarHoja({ datos: hoja("ESMALTADO", "Sonia", [{ fecha: "2026-10-05", cantidad: 12, personas: 2 }]) });
  const o = await detalleOrden(ORDEN);
  assert.equal(o.hojas.length, 4);
  assert.ok(o.hojas.every((h) => h.estado === "registrada"));
  assert.equal(o.hojas[2].articulos[0].registros.length, 3);
  assert.equal(o.articulos.length, 1);
  const lista = (await listarOrdenes()).find((x) => x.numero === ORDEN);
  assert.deepEqual(lista.secciones.map((s) => s.seccion), ["SEÑALADO", "TRAZADO", "DECORADO", "ESMALT"]);
});

test("volver a guardar la misma sección reemplaza los registros", async () => {
  assert.ok(await hojaExistente(ORDEN, "TRAZADO"));
  assert.equal(await hojaExistente(ORDEN + "X", "TRAZADO"), null);
  await guardarHoja({ datos: hoja("TRAZADO", "Ana Perez", [{ fecha: "2026-09-14", cantidad: 10 }]) });
  const o = await detalleOrden(ORDEN);
  const r = o.hojas.find((h) => h.seccion === "TRAZADO").articulos[0].registros;
  assert.deepEqual(r.map((x) => x.cantidad), [10]);
});

test("rechaza hojas sin orden o sin sección", async () => {
  await assert.rejects(guardarHoja({ datos: { ...hoja("TRAZADO", "", []), numero_orden: " " } }), /orden/);
  await assert.rejects(guardarHoja({ datos: { ...hoja("", "", []) } }), /sección/);
});
