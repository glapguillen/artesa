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

test("reconoce el artículo aunque la foto corte el código o la decoración", async () => {
  const cortada = hoja("DECORADO", "Thalya", [{ fecha: "2026-09-16", cantidad: 1 }]);
  cortada.articulos[0].codigo = "626";
  cortada.articulos[0].decoracion = "SOL AZUL";
  await guardarHoja({ datos: cortada });
  const o = await detalleOrden(ORDEN);
  assert.deepEqual(o.articulos.map((a) => [a.codigo, a.decoracion]), [["0944 626", "GIRASOL AZUL"]]);
});

test("varios artículos con registros en bloques distintos y rutas cortas", async () => {
  const { verificar } = await import("../extraer.js");
  const datos = {
    numero_orden: ORDEN, seccion: "DECORADO", fecha_emision: "2026-08-20", cliente: "STOCK FABRICA", articulos: [
      { codigo: "0907 462", descripcion: "MANTEQUILLERO CHORDELEG", decoracion: "FLORES DEL CAMPO", cantidad_producir: 12, ruta: "DE",
        registros: [{ fecha: "2026-08-25", cantidad: 2, hora_inicio: "16:40", hora_fin: "17:30" }, { fecha: "2026-08-26", cantidad: 10, hora_inicio: "2:00", hora_fin: "8:21" }] },
      { codigo: "0883 462", descripcion: "TAPA TETERA GUALACEO", decoracion: "FLORES DEL CAMPO", cantidad_producir: 5, ruta: "DE",
        registros: [{ fecha: "2026-08-26", cantidad: 6, hora_inicio: "14:35", hora_fin: "7:00" }] },
    ],
  };
  const avisos = verificar(datos);
  assert.equal(avisos.length, 2);
  assert.match(avisos[0], /TAPA TETERA.*fin \(7:00\)/);
  assert.match(avisos[1], /6 piezas y la orden pide 5/);

  await limpiar();
  await guardarHoja({ datos });
  const o = await detalleOrden(ORDEN);
  assert.deepEqual(o.hojas.map((h) => [h.seccion, h.estado]), [["DECORADO", "registrada"], ["ESMALT", "pendiente"]]);
  assert.deepEqual(o.hojas[0].articulos.map((a) => a.registros.length), [2, 1]);
});
