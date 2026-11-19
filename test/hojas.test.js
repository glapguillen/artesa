import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { detalleOrden, guardarHoja, hojaExistente, listarOrdenes, migrar, pool } from "../db.js";

const ORDEN = "TEST-0076660";
const articulo = (registros, malas = "") => ({
  codigo_bizcocho: "0944", bizcocho: "BANDEJA HOJA #2", codigo_decoracion: "626", decoracion: "GIRASOL AZUL",
  cantidad_producir: 12, tiempo_estandar: 240, ruta: "STDE", malas, registros,
});
const hoja = (seccion, operario, registros) => ({
  numero_orden: ORDEN, seccion, fecha_emision: "2026-09-14", cliente: "ANDRADE PATRICIO",
  observaciones: "MARCA VEGA", operario1: operario, operario2: operario === "Sonia" ? "Tania" : null, articulos: [articulo(registros)],
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

test("junta los registros cuando la hoja trae dos veces el mismo artículo", async () => {
  const datos = hoja("TRAZADO", "Ana Perez", [{ fecha: "2026-09-14", cantidad: 8, hora_inicio: "15:00", hora_fin: "16:00" }]);
  // el cuarto día, fuera de la tabla, leído como otro artículo con el mismo código
  datos.articulos.push(articulo([{ fecha: "2026-09-15", cantidad: 4, hora_inicio: "07:00", hora_fin: "08:00" }], "1"));
  await guardarHoja({ datos });
  const o = await detalleOrden(ORDEN);
  assert.equal(o.articulos.length, 1);
  const h = o.hojas.find((x) => x.seccion === "TRAZADO").articulos[0];
  assert.deepEqual(h.registros.map((r) => [r.fecha, r.cantidad]), [["2026-09-14", 8], ["2026-09-15", 4]]);
  assert.equal(h.malas, 1);
});

test("rechaza hojas sin orden o sin sección", async () => {
  await assert.rejects(guardarHoja({ datos: { ...hoja("TRAZADO", "", []), numero_orden: " " } }), /orden/);
  await assert.rejects(guardarHoja({ datos: { ...hoja("", "", []) } }), /sección/);
});

test("reconoce el artículo aunque la foto corte el código o la decoración", async () => {
  const cortada = hoja("DECORADO", "Thalya", [{ fecha: "2026-09-16", cantidad: 1 }]);
  cortada.articulos[0].codigo_bizcocho = "";
  cortada.articulos[0].decoracion = "SOL AZUL";
  await guardarHoja({ datos: cortada });
  const o = await detalleOrden(ORDEN);
  assert.deepEqual(o.articulos.map((a) => [a.codigo, a.codigo_bizcocho, a.bizcocho, a.codigo_decoracion, a.decoracion]),
    [["0944 626", "0944", "BANDEJA HOJA #2", "626", "GIRASOL AZUL"]]);
  const esmalt = o.hojas.find((h) => h.seccion === "ESMALT");
  assert.deepEqual([esmalt.operario1, esmalt.operario2], ["Sonia", "Tania"]);
  const { catalogo } = await import("../db.js");
  assert.equal((await catalogo()).decoraciones.find((x) => x.codigo === "626").nombre, "GIRASOL AZUL", "un nombre cortado no reemplaza al completo");
});

test("varios artículos con registros en bloques distintos y rutas cortas", async () => {
  const { verificar } = await import("../extraer.js");
  const datos = {
    numero_orden: ORDEN, seccion: "DECORADO", fecha_emision: "2026-08-20", cliente: "STOCK FABRICA", articulos: [
      { codigo_bizcocho: "0907", codigo_decoracion: "462", bizcocho: "MANTEQUILLERO CHORDELEG", decoracion: "FLORES DEL CAMPO", cantidad_producir: 12, ruta: "DE",
        registros: [{ fecha: "2026-08-25", cantidad: 2, hora_inicio: "16:40", hora_fin: "17:30" }, { fecha: "2026-08-26", cantidad: 10, hora_inicio: "2:00", hora_fin: "8:21" }] },
      { codigo_bizcocho: "0883", codigo_decoracion: "462", bizcocho: "TAPA TETERA GUALACEO", decoracion: "FLORES DEL CAMPO", cantidad_producir: 5, ruta: "DE",
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

test("lectura gratuita: extrae lo impreso del texto del lector", async () => {
  const { interpretar } = await import("../public/lectura-local.js");
  const texto = `Te y GRUPO: 14-09-2026
, RN CLIENTE: ANDRADE PATRICIO MES: September 2026 o
ARTES OESERVACIONES: MARCA VEGA wi dba Seccion DECORADO -
Vhalue - Dsceuai? ORDEN 4 0076660 —
0699 626 PUENTE OVALADA 40.5 CM 7 168,00 | Y e '
GIRASOL AZUL ruta STDE malas`;
  const d = interpretar(texto);
  assert.deepEqual([d.numero_orden, d.seccion, d.fecha_emision, d.cliente], ["0076660", "DECORADO", "2026-09-14", "ANDRADE PATRICIO"]);
  assert.deepEqual(d.articulos.map((a) => [a.codigo_bizcocho, a.bizcocho, a.codigo_decoracion, a.decoracion, a.cantidad_producir, a.tiempo_estandar, a.ruta]),
    [["0699", "PUENTE OVALADA 40.5 CM", "626", "GIRASOL AZUL", 7, 168, "STDE"]]);
  assert.equal(interpretar("Seccion EsMaA LT\nORDEN % 0076582\n24-08-2006").seccion, "ESMALT");
  assert.equal(interpretar("Seccion EsMaA LT\nORDEN % 0076582\n24-08-2006").fecha_emision, null);
});

test("lectura gratuita: combina la foto entera con la zona ampliada", async () => {
  const { interpretar, combinar } = await import("../public/lectura-local.js");
  const entera = interpretar("GRUPO: 14-09-2026\nCLIENTE: ST ICA\nSeccion DECORADO\nORDEN 4 0076662\n0944 108 BANDEJA HOJA #2 12 156,00\nFLORAL AZUL ruta TDE");
  const ampliada = interpretar("CLIENTE: ANDRADE PATRICIO\nSeccion DECORAD0\nORDEN 0076668");
  const d = combinar(entera, ampliada);
  assert.deepEqual([d.numero_orden, d.seccion, d.fecha_emision, d.cliente, d.articulos.length], ["0076662", "DECORADO", "2026-09-14", "ANDRADE PATRICIO", 1]);
  assert.ok(!d.dudas.some((x) => /No se pudo leer/.test(x)));
});

test("catálogo: aprende al guardar y corrige la lectura", async () => {
  const { aplicarCatalogo } = await import("../public/lectura-local.js");
  const { catalogo, guardarEnCatalogo } = await import("../db.js");
  // la hoja guardada en las pruebas anteriores dejó 0907 y 0883 en el catálogo
  let cat = await catalogo();
  assert.equal(cat.bizcochos.find((b) => b.codigo === "0907")?.nombre, "MANTEQUILLERO CHORDELEG");
  await guardarEnCatalogo("bizcochos", "9999", "pieza de prueba");
  cat = await catalogo();
  assert.equal(cat.bizcochos.find((b) => b.codigo === "9999")?.nombre, "PIEZA DE PRUEBA");
  await assert.rejects(guardarEnCatalogo("decoraciones", "12", "X"), /3 dígitos/);
  await guardarEnCatalogo("bizcochos", "9999", "");
  assert.ok(!(await catalogo()).bizcochos.some((b) => b.codigo === "9999"));

  const datos = { dudas: [], articulos: [
    { codigo_bizcocho: "0944", bizcocho: "BANDEJA 42", codigo_decoracion: "108", decoracion: "" },          // por código
    { codigo_bizcocho: "0242", bizcocho: "JARRO PACIFICO", codigo_decoracion: "924", decoracion: "BLUE FISH" }, // código mal leído
    { codigo_bizcocho: "5555", bizcocho: "PIEZA NUEVA", codigo_decoracion: "", decoracion: "" },              // desconocido
  ] };
  aplicarCatalogo(datos, { bizcochos: [{ codigo: "0944", nombre: "BANDEJA HOJA #2" }, { codigo: "0248", nombre: "JARRO PACIFICO" }],
    decoraciones: [{ codigo: "108", nombre: "FLORAL AZUL" }, { codigo: "924", nombre: "BLUE FISH" }] });
  assert.deepEqual(datos.articulos.map((a) => [a.codigo_bizcocho, a.bizcocho, a.codigo_decoracion, a.decoracion]), [
    ["0944", "BANDEJA HOJA #2", "108", "FLORAL AZUL"], ["0248", "JARRO PACIFICO", "924", "BLUE FISH"], ["5555", "PIEZA NUEVA", "", ""]]);
  assert.ok(datos.dudas.some((x) => /se leyó 0242 y en el catálogo es 0248/.test(x)));
});

test("lectura con IA: elige el proveedor según las claves", async () => {
  const { proveedor, ESQUEMA_JSON } = await import("../extraer.js");
  const antes = { ...process.env };
  try {
    for (const k of ["LECTURA", "GEMINI_API_KEY", "ANTHROPIC_API_KEY"]) delete process.env[k];
    assert.equal(proveedor(), null);
    process.env.GEMINI_API_KEY = "y"; assert.equal(proveedor(), "gemini");
    process.env.ANTHROPIC_API_KEY = "x"; assert.equal(proveedor(), "claude", "con las dos claves, Claude primero");
    process.env.LECTURA = "gemini"; assert.equal(proveedor(), "gemini");
    process.env.LECTURA = "local"; assert.equal(proveedor(), null);
  } finally {
    for (const k of ["LECTURA", "GEMINI_API_KEY", "ANTHROPIC_API_KEY"]) antes[k] === undefined ? delete process.env[k] : (process.env[k] = antes[k]);
  }
  assert.ok(!JSON.stringify(ESQUEMA_JSON).includes("anyOf"));
  assert.deepEqual(ESQUEMA_JSON.properties.numero_orden.type, ["string", "null"]);
});

test("reportes: cola por sección, productividad, calidad e insights", async () => {
  const { datosReportes } = await import("../db.js");
  const { calcular, insights, resumenParaIA } = await import("../public/metricas.js");
  await limpiar();
  // Señalado y Trazado entregados; Decorado pendiente (espera) y Esmalt pendiente (bloqueada).
  const s = hoja("SEÑALADO", "Ana Perez", [{ fecha: "2026-09-14", cantidad: 12, hora_inicio: "15:38", hora_fin: "15:52" }]);
  s.articulos[0].malas = "1";
  await guardarHoja({ datos: s });
  await guardarHoja({ datos: hoja("TRAZADO", "Ana Perez", [
    { fecha: "2026-09-14", cantidad: 6, hora_inicio: "15:00", hora_fin: "16:00", personas: 2 },
    { fecha: "2026-09-16", cantidad: 6, hora_inicio: "10:00", hora_fin: "09:00" }, // hora imposible: no cuenta para horas
  ]) });
  const datos = await datosReportes("2026-09-01", "2026-09-30");
  const solo = (xs) => xs.filter((x) => x.orden === ORDEN); // la base puede tener otras órdenes
  const m = calcular({ ...datos, registros: solo(datos.registros), hojas: solo(datos.hojas), malas: solo(datos.malas) }, {}, "2026-09-30");

  assert.equal(m.kpis.piezas, 24);
  assert.equal(m.kpis.registrosSinHoras, 1);
  assert.deepEqual(m.porDia.map((d) => [d.fecha, d.piezas]), [["2026-09-14", 18], ["2026-09-15", 0], ["2026-09-16", 6]]);
  const tr = m.porSeccion.find((x) => x.seccion === "TRAZADO");
  assert.equal(tr.horasPersona, 2);          // 1 h × 2 personas; el registro imposible no suma
  assert.equal(tr.piezasHora, 3);            // 6 piezas / 2 horas-persona
  assert.equal(Math.round(tr.eficiencia * 100), 100); // 6 piezas × 20 min estándar = 120 min reales
  const sen = m.porSeccion.find((x) => x.seccion === "SEÑALADO");
  assert.equal(Math.round(sen.tasaMalas * 1000), 83); // 1 mala de 12
  assert.equal(m.porSeccion.find((x) => x.seccion === "DECORADO").esperando, 1);
  assert.equal(m.porSeccion.find((x) => x.seccion === "ESMALT").bloqueadas, 1);
  assert.deepEqual(m.abiertas.map((o) => [o.orden, o.siguiente, o.hechas, o.total, o.diasSinActividad]), [[ORDEN, "DECORADO", 2, 4, 14]]);

  const ins = insights(m);
  assert.ok(ins.some((i) => /Cuello de botella en DECORADO/.test(i.titulo)));
  assert.ok(ins.some((i) => /sin avanzar/.test(i.titulo)));
  assert.ok(JSON.stringify(resumenParaIA(m)).length < 20_000);
  assert.equal(calcular(datos, { cliente: "OTRO CLIENTE" }).kpis.piezas, 0);
  const { articulosDelPeriodo, detalleArticulo } = await import("../public/metricas.js");
  const arts = articulosDelPeriodo(m);
  assert.deepEqual(arts.map((a) => [a.clave, a.piezas]), [["0944 626", 24]]);
  const d = detalleArticulo(m, { ...datos, malas: solo(datos.malas) }, "0944 626");
  assert.equal(d.registros.length, 3);
  assert.deepEqual(d.porSeccion.map((s) => s.seccion), ["SEÑALADO", "TRAZADO"]);
  // Señalado: 12 piezas en 14 min con 1 persona → 1,17 min/pieza; Trazado: 6 piezas en 120 min-persona → 20.
  assert.equal(d.porSeccion[0].minPieza.toFixed(2), "1.17");
  assert.equal(d.porSeccion[1].minPieza, 20);
  assert.equal(d.resumen.minPiezaRuta.toFixed(2), "21.17"); // 1,17 + 20 minutos por pieza
  assert.equal(d.resumen.sinHoras, 1);
  assert.equal(d.resumen.malas, 1);
  assert.deepEqual(d.tiempoImpreso, [240]);
  const { claveNombre } = await import("../public/metricas.js");
  assert.equal(claveNombre("Ana Pérez"), claveNombre(" ana  perez "));
});

test("base completa: tablas, búsqueda y Excel", async () => {
  const { filasBase, resumenBase, TABLAS_BASE } = await import("../db.js");
  const resumen = await resumenBase();
  assert.deepEqual(resumen.map((t) => t.hoja), TABLAS_BASE.map((t) => t.hoja));
  const regs = await filasBase("Registros", { buscar: "ana pérez" });
  assert.ok(regs.length >= 1 && regs.every((r) => /ANA PEREZ/i.test(r.operario1.normalize("NFD").replace(/[̀-ͯ]/g, ""))));
  const trazado = regs.find((r) => r.seccion === "TRAZADO" && r.hora_inicio === "15:00");
  assert.equal(Number(trazado.horas_persona), 2);   // 1 h × 2 personas
  assert.equal(Number(trazado.min_pieza), 20);      // 120 min-persona / 6 piezas
  await assert.rejects(filasBase("NoExiste"), /desconocida/);

  const { app } = await import("../server.js");
  const srv = app.listen(0);
  try {
    const r = await fetch(`http://localhost:${srv.address().port}/api/base.xlsx`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-disposition"), /artesa-base-.*\.xlsx/);
    const { default: ExcelJS } = await import("exceljs");
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(Buffer.from(await r.arrayBuffer()));
    assert.deepEqual(libro.worksheets.map((h) => h.name), ["Información", ...TABLAS_BASE.map((t) => t.hoja)]);
    assert.ok(libro.getWorksheet("Registros").getCell("A2").value instanceof Date);
  } finally {
    srv.close();
  }
});
