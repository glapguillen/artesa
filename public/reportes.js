// Pestañas Reportes e Insights. Usa $, esc, api y fechaCorta de la página principal, y los
// cálculos de /metricas.js. Las dos pestañas comparten el período y los filtros.

const hoyISO = () => new Date().toISOString().slice(0, 10);
const haceDias = (n) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const periodo = { desde: haceDias(30), hasta: hoyISO(), seccion: "", cliente: "" };
let datosCache = null; // { clave, datos }

const fmt = {
  n: (x, d = 0) => (x == null || Number.isNaN(x) ? "—" : Number(x).toLocaleString("es", { maximumFractionDigits: d, minimumFractionDigits: d })),
  pct: (x) => (x == null ? "—" : Math.round(x * 100) + " %"),
  fecha: (f) => (f ? fechaCorta(f) : "—"),
};

async function metricas() {
  const clave = periodo.desde + "|" + periodo.hasta;
  if (datosCache?.clave !== clave)
    datosCache = { clave, datos: await api(`/api/reportes?desde=${periodo.desde}&hasta=${periodo.hasta}`) };
  const { calcular } = await import("/metricas.js");
  return { m: calcular(datosCache.datos, { seccion: periodo.seccion, cliente: periodo.cliente }), datos: datosCache.datos };
}

// Barra de filtros común. `alCambiar` repinta la pestaña.
function filtrosHTML(datos, extra = "") {
  const clientes = [...new Set(datos.hojas.map((h) => h.cliente).filter(Boolean))].sort();
  const secciones = [...new Set(datos.hojas.map((h) => h.seccion))];
  const opc = (lista, actual) => lista.map((x) => `<option ${x === actual ? "selected" : ""}>${esc(x)}</option>`).join("");
  return `<div class="panel filtros">
    <label>Desde<input type="date" data-f="desde" value="${periodo.desde}"></label>
    <label>Hasta<input type="date" data-f="hasta" value="${periodo.hasta}"></label>
    <label>Sección<select data-f="seccion"><option value="">Todas</option>${opc(secciones, periodo.seccion)}</select></label>
    <label>Cliente<select data-f="cliente"><option value="">Todos</option>${opc(clientes, periodo.cliente)}</select></label>
    ${extra}
  </div>`;
}

function enlazarFiltros(cont, alCambiar) {
  cont.querySelectorAll("[data-f]").forEach((el) => {
    el.onchange = () => {
      periodo[el.dataset.f] = el.value;
      if (periodo.desde > periodo.hasta) [periodo.desde, periodo.hasta] = [periodo.hasta, periodo.desde];
      alCambiar();
    };
  });
}

// ---------- Gráfico de barras por día (una serie, con tooltip) ----------
function graficoDias(cont, serie) {
  if (!serie.length) { cont.innerHTML = `<p class="tenue">Sin registros en el período.</p>`; return; }
  const W = Math.max(300, cont.clientWidth || 600), H = 190, iz = 36, ab = 22, ar = 8;
  const max = Math.max(...serie.map((d) => d.piezas), 1);
  const paso = 10 ** Math.floor(Math.log10(max)), tope = Math.ceil(max / paso) * paso;
  const marcas = [0, tope / 2, tope];
  const ancho = (W - iz) / serie.length, barra = Math.max(2, Math.min(24, ancho * 0.7));
  const y = (v) => ar + (H - ar - ab) * (1 - v / tope);
  const etiquetas = new Set([0, Math.floor((serie.length - 1) / 2), serie.length - 1]);
  const barras = serie.map((d, i) => {
    const x = iz + i * ancho + (ancho - barra) / 2, top = y(d.piezas), alto = H - ab - top;
    const r = Math.min(4, barra / 2, alto);
    const forma = alto > 0
      ? `<path class="barra" d="M${x},${H - ab} V${top + r} Q${x},${top} ${x + r},${top} H${x + barra - r} Q${x + barra},${top} ${x + barra},${top + r} V${H - ab} Z"/>`
      : "";
    return `<rect class="zona" data-i="${i}" x="${iz + i * ancho}" y="0" width="${ancho}" height="${H - ab}" fill="transparent"/>${forma}` +
      (etiquetas.has(i) ? `<text class="eje" x="${x + barra / 2}" y="${H - 6}" text-anchor="middle">${fmt.fecha(d.fecha).slice(0, 5)}</text>` : "");
  }).join("");
  cont.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Piezas producidas por día">
    ${marcas.map((v) => `<line class="rejilla" x1="${iz}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="eje" x="${iz - 6}" y="${y(v) + 4}" text-anchor="end">${fmt.n(v)}</text>`).join("")}
    ${barras}</svg><div class="tip" hidden></div>`;
  const tip = cont.querySelector(".tip");
  cont.querySelector("svg").addEventListener("pointermove", (e) => {
    const z = e.target.closest(".zona");
    if (!z) { tip.hidden = true; return; }
    const d = serie[+z.dataset.i], caja = cont.getBoundingClientRect();
    tip.innerHTML = `<strong>${fmt.n(d.piezas)}</strong> piezas · ${fmt.fecha(d.fecha)}`;
    tip.style.left = Math.min(Math.max(e.clientX - caja.left, 60), caja.width - 60) + "px";
    tip.style.top = (e.clientY - caja.top) + "px";
    tip.hidden = false;
  });
  cont.querySelector("svg").addEventListener("pointerleave", () => (tip.hidden = true));
}

// ---------- Tablas ordenables ----------
// columnas: [{ t: título, v: fila => valor para ordenar, f: fila => HTML, num: bool }]
const FILAS_VISIBLES = 10;
function tabla(id, columnas, filas, vacia = "Sin datos en el período.") {
  if (!filas.length) return `<p class="tenue">${vacia}</p>`;
  const todas = tablas[id]?.todas, visibles = todas ? filas : filas.slice(0, FILAS_VISIBLES);
  return `<div class="tabla" data-envoltura="${id}"><table class="lectura" data-tabla="${id}">
    <thead><tr>${columnas.map((c, i) => `<th class="ordenable ${c.num ? "num" : ""}" data-col="${i}">${c.t}</th>`).join("")}</tr></thead>
    <tbody>${visibles.map((f) => `<tr>${columnas.map((c) => `<td class="${c.num ? "num" : ""}">${c.f ? c.f(f) : esc(c.v(f))}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>${filas.length > FILAS_VISIBLES
    ? `<button type="button" class="boton mini" data-ver="${id}" style="margin-top:8px">${todas ? "Ver menos" : `Ver todas (${filas.length})`}</button>` : ""}</div>`;
}

const tablas = {};
function ordenable(cont) {
  const repintar = (id) => {
    cont.querySelector(`[data-envoltura="${id}"]`).outerHTML = tabla(id, tablas[id].columnas, tablas[id].filas);
    ordenable(cont);
  };
  cont.querySelectorAll("table[data-tabla]").forEach((t) => {
    t.querySelector("thead").onclick = (e) => {
      const th = e.target.closest("th"); if (!th) return;
      const def = tablas[t.dataset.tabla], col = def.columnas[+th.dataset.col];
      const asc = def.orden === th.dataset.col ? !def.asc : false;
      Object.assign(def, { orden: th.dataset.col, asc });
      def.filas = [...def.filas].sort((a, b) => {
        const x = col.v(a), y = col.v(b);
        if (x == null) return 1; if (y == null) return -1;
        return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * (asc ? 1 : -1);
      });
      repintar(t.dataset.tabla);
    };
  });
  cont.querySelectorAll("[data-ver]").forEach((b) => {
    b.onclick = () => { tablas[b.dataset.ver].todas = !tablas[b.dataset.ver].todas; repintar(b.dataset.ver); };
  });
}
function definirTabla(id, columnas, filas, vacia) {
  tablas[id] = { columnas, filas, todas: tablas[id]?.todas };
  return tabla(id, columnas, filas, vacia);
}

const barraH = (v, max) => `<div class="hbarra"><span style="min-width:2ch">${fmt.n(v)}</span><div class="pista"><div class="lleno" style="width:${max ? (100 * v) / max : 0}%"></div></div></div>`;

// ---------- Exportar a CSV ----------
function exportarCSV(m, nombre = "registros") {
  const cols = ["fecha", "orden", "cliente", "seccion", "equipo", "codigo_bizcocho", "bizcocho", "codigo_decoracion", "decoracion",
    "cantidad", "hora_inicio", "hora_fin", "personas", "horas_persona", "minutos_estandar_pieza"];
  const celda = (v) => { const s = v == null ? "" : String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const filas = m.regs.map((r) => [r.fecha, r.orden, r.cliente, r.seccion, r.equipo, r.codigo_bizcocho, r.bizcocho, r.codigo_decoracion, r.decoracion,
    r.cantidad, r.hora_inicio, r.hora_fin, r.personas, r.hp?.toFixed(2), r.stdMin?.toFixed(2)].map(celda).join(","));
  const blob = new Blob(["﻿" + [cols.join(","), ...filas].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `artesa-${nombre}-${periodo.desde}-a-${periodo.hasta}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- Pestaña Reportes ----------
async function pintarReportes() {
  const cont = $("#reportes");
  cont.innerHTML = `<p class="tenue">Cargando…</p>`;
  let m, datos;
  try { ({ m, datos } = await metricas()); } catch (err) { cont.innerHTML = `<div class="nota error">${esc(err.message)}</div>`; return; }
  const k = m.kpis;
  const maxEsperando = Math.max(...m.porSeccion.map((s) => s.esperando), 0);
  cont.innerHTML = filtrosHTML(datos, `<button class="boton mini" id="csv" type="button">Exportar CSV</button>`) + `
    <div class="kpis">
      <div class="kpi"><div class="valor">${fmt.n(k.piezas)}</div><div class="etq">piezas producidas</div></div>
      <div class="kpi"><div class="valor">${fmt.n(k.piezasHora, 1)}</div><div class="etq">piezas por hora-persona</div></div>
      <div class="kpi"><div class="valor">${fmt.pct(k.tasaMalas)}</div><div class="etq">piezas malas (${fmt.n(k.malas)})</div></div>
      <div class="kpi"><div class="valor">${fmt.n(k.ordenesAbiertas)}</div><div class="etq">órdenes abiertas · ${fmt.n(k.ordenesCompletas)} completas</div></div>
      <div class="kpi"><div class="valor">${fmt.n(k.hojasRegistradas)}</div><div class="etq">hojas registradas en el período</div></div>
    </div>
    <div class="panel"><h2>Piezas producidas por día</h2><div class="grafico" id="g-dias"></div></div>
    <div class="panel" id="detalle-articulo"></div>
    <div class="panel"><h2>Por sección</h2>
      <p class="tenue" style="margin-top:0">"Esperando": órdenes cuya sección anterior ya entregó. "Bloqueadas": les falta una sección anterior.</p>
      ${definirTabla("secciones", [
        { t: "Sección", v: (s) => s.seccion },
        { t: "Esperando", v: (s) => s.esperando, f: (s) => barraH(s.esperando, maxEsperando) },
        { t: "Bloqueadas", v: (s) => s.bloqueadas, num: true, f: (s) => fmt.n(s.bloqueadas) },
        { t: "Piezas", v: (s) => s.piezas, num: true, f: (s) => fmt.n(s.piezas) },
        { t: "Pzs/hora", v: (s) => s.piezasHora, num: true, f: (s) => fmt.n(s.piezasHora, 1) },
        { t: "Malas", v: (s) => s.tasaMalas, num: true, f: (s) => fmt.pct(s.tasaMalas) },
      ], m.porSeccion)}
    </div>
    <div class="panel"><h2>Órdenes abiertas</h2>
      ${definirTabla("abiertas", [
        { t: "Orden", v: (o) => o.orden },
        { t: "Cliente", v: (o) => o.cliente ?? "" },
        { t: "Avance", v: (o) => o.hechas / o.total, f: (o) => `${o.hechas}/${o.total}` },
        { t: "Falta", v: (o) => o.siguiente },
        { t: "Días desde emisión", v: (o) => o.diasDesdeEmision, num: true, f: (o) => fmt.n(o.diasDesdeEmision) },
        { t: "Días sin avanzar", v: (o) => o.diasSinActividad, num: true, f: (o) => fmt.n(o.diasSinActividad) },
      ], m.abiertas, "No hay órdenes abiertas.")}
    </div>
    <div class="panel"><h2>Operarios por sección</h2>
      <p class="tenue" style="margin-top:0">Con pocas hojas o horas mal anotadas las cifras engañan: úsalas para preguntar, no para juzgar.</p>
      ${definirTabla("equipos", [
        { t: "Operario(s)", v: (e) => e.equipo },
        { t: "Sección", v: (e) => e.seccion },
        { t: "Hojas", v: (e) => e.hojas, num: true, f: (e) => fmt.n(e.hojas) },
        { t: "Piezas", v: (e) => e.piezas, num: true, f: (e) => fmt.n(e.piezas) },
        { t: "Pzs/hora", v: (e) => e.piezasHora, num: true, f: (e) => fmt.n(e.piezasHora, 1) },
        { t: "Malas", v: (e) => e.tasaMalas, num: true, f: (e) => fmt.pct(e.tasaMalas) },
      ], m.porEquipo)}
    </div>
    <div class="panel"><h2>Calidad por artículo</h2>
      ${definirTabla("articulos", [
        { t: "Código", v: (a) => a.codigo },
        { t: "Artículo", v: (a) => a.articulo },
        { t: "Producidas", v: (a) => a.producidas, num: true, f: (a) => fmt.n(a.producidas) },
        { t: "Malas", v: (a) => a.malas, num: true, f: (a) => fmt.n(a.malas) },
        { t: "% malas", v: (a) => a.tasaMalas, num: true, f: (a) => fmt.pct(a.tasaMalas) },
      ], m.porArticulo)}
    </div>
    <p class="tenue">Horas-persona = (fin − inicio) × personas. Los registros sin horas válidas (${fmt.n(k.registrosSinHoras)} de ${fmt.n(k.registros)}) no cuentan para productividad. Los operarios se agrupan sin distinguir tildes ni mayúsculas.</p>`;
  enlazarFiltros(cont, pintarReportes);
  ordenable(cont);
  $("#csv").onclick = () => exportarCSV(m);
  graficoDias($("#g-dias"), m.porDia);
  await pintarDetalleArticulo(m, datos);
}

// ---------- Detalle por artículo ----------
async function pintarDetalleArticulo(m, datos) {
  const cont = $("#detalle-articulo");
  const { articulosDelPeriodo, detalleArticulo } = await import("/metricas.js");
  const lista = articulosDelPeriodo(m);
  if (!lista.length) { cont.innerHTML = `<h2>Detalle por artículo</h2><p class="tenue">Sin registros en el período.</p>`; return; }
  if (!lista.some((a) => a.clave === periodo.articulo)) periodo.articulo = lista[0].clave;
  const d = detalleArticulo(m, datos, periodo.articulo);
  const r = d.resumen;
  const min = (x) => (x == null ? "—" : fmt.n(x, 1) + " min");
  cont.innerHTML = `<h2>Detalle por artículo</h2>
    <label>Artículo<select id="sel-articulo">${lista.map((a) =>
      `<option value="${esc(a.clave)}" ${a.clave === periodo.articulo ? "selected" : ""}>${esc(a.codigo)} · ${esc(a.articulo)} (${fmt.n(a.piezas)} pzs)</option>`).join("")}</select></label>
    <div class="kpis" style="margin-top:12px">
      <div class="kpi"><div class="valor">${fmt.n(r.piezas)}</div><div class="etq">piezas en ${fmt.n(d.ordenes.length)} ${d.ordenes.length === 1 ? "orden" : "órdenes"}</div></div>
      <div class="kpi"><div class="valor">${fmt.n(r.horasPersona, 1)}</div><div class="etq">horas-persona</div></div>
      <div class="kpi"><div class="valor">${min(r.minPiezaRuta)}</div><div class="etq">por pieza, sumando ${r.seccionesConMinutos.length === 1 ? "su sección" : `sus ${r.seccionesConMinutos.length} secciones`}</div></div>
      <div class="kpi"><div class="valor">${fmt.n(r.piezasHora, 1)}</div><div class="etq">piezas por hora-persona</div></div>
      <div class="kpi"><div class="valor">${fmt.pct(r.tasaMalas)}</div><div class="etq">piezas malas (${fmt.n(r.malas)})</div></div>
      <div class="kpi"><div class="valor">${fmt.n(r.dias)}</div><div class="etq">días con trabajo · ${fmt.fecha(r.desde)} a ${fmt.fecha(r.hasta)}</div></div>
    </div>
    <p class="tenue" style="margin-top:0">TIEMPO impreso en la hoja: ${d.tiempoImpreso.length ? d.tiempoImpreso.map((t) => fmt.n(t, 2)).join(", ") : "—"}.
      ${r.sinHoras ? `${fmt.n(r.sinHoras)} registro(s) sin horas válidas no cuentan en horas ni minutos por pieza.` : ""}</p>
    <h3>Por sección</h3>
    ${definirTabla("art-secciones", [
      { t: "Sección", v: (s) => s.seccion },
      { t: "Piezas", v: (s) => s.piezas, num: true, f: (s) => fmt.n(s.piezas) },
      { t: "Horas-persona", v: (s) => s.horasPersona, num: true, f: (s) => fmt.n(s.horasPersona, 1) },
      { t: "Min/pieza", v: (s) => s.minPieza, num: true, f: (s) => min(s.minPieza) },
      { t: "Pzs/hora", v: (s) => s.piezasHora, num: true, f: (s) => fmt.n(s.piezasHora, 1) },
      { t: "Días", v: (s) => s.dias, num: true, f: (s) => fmt.n(s.dias) },
      { t: "Malas", v: (s) => s.tasaMalas, num: true, f: (s) => `${fmt.n(s.malas)} (${fmt.pct(s.tasaMalas)})` },
      { t: "Operarios", v: (s) => s.operarios },
    ], d.porSeccion)}
    <h3>Por operario</h3>
    ${definirTabla("art-operarios", [
      { t: "Operario(s)", v: (e) => e.equipo },
      { t: "Sección", v: (e) => e.seccion },
      { t: "Piezas", v: (e) => e.piezas, num: true, f: (e) => fmt.n(e.piezas) },
      { t: "Horas-persona", v: (e) => e.horasPersona, num: true, f: (e) => fmt.n(e.horasPersona, 1) },
      { t: "Min/pieza", v: (e) => e.minPieza, num: true, f: (e) => min(e.minPieza) },
      { t: "Pzs/hora", v: (e) => e.piezasHora, num: true, f: (e) => fmt.n(e.piezasHora, 1) },
      { t: "Días", v: (e) => e.dias, num: true, f: (e) => fmt.n(e.dias) },
    ], d.porOperario)}
    <h3>Por orden</h3>
    ${definirTabla("art-ordenes", [
      { t: "Orden", v: (o) => o.orden },
      { t: "Cliente", v: (o) => o.cliente ?? "" },
      { t: "Producir", v: (o) => o.producir, num: true, f: (o) => fmt.n(o.producir) },
      { t: "Piezas registradas", v: (o) => o.piezas, num: true, f: (o) => fmt.n(o.piezas) },
      { t: "Horas-persona", v: (o) => o.horasPersona, num: true, f: (o) => fmt.n(o.horasPersona, 1) },
      { t: "Min/pieza", v: (o) => o.minPieza, num: true, f: (o) => min(o.minPieza) },
      { t: "Secciones", v: (o) => o.secciones },
    ], d.porOrden)}
    <h3>Todos los registros</h3>
    ${definirTabla("art-registros", [
      { t: "Fecha", v: (x) => x.fecha, f: (x) => fmt.fecha(x.fecha) },
      { t: "Orden", v: (x) => x.orden },
      { t: "Sección", v: (x) => x.seccion },
      { t: "Operario(s)", v: (x) => x.equipo },
      { t: "Cant.", v: (x) => x.cantidad, num: true, f: (x) => fmt.n(x.cantidad) },
      { t: "Inicio", v: (x) => x.hora_inicio ?? "", f: (x) => esc(x.hora_inicio ?? "—") },
      { t: "Fin", v: (x) => x.hora_fin ?? "", f: (x) => esc(x.hora_fin ?? "—") + (x.horasValidas ? "" : ` <span class="tenue" title="Hora de fin vacía o anterior al inicio">⚠</span>`) },
      { t: "Pers.", v: (x) => x.personas, num: true, f: (x) => fmt.n(x.personas ?? 1) },
      { t: "Horas-persona", v: (x) => x.hp, num: true, f: (x) => fmt.n(x.hp, 2) },
      { t: "Min/pieza", v: (x) => x.minPieza, num: true, f: (x) => min(x.minPieza) },
    ], d.registros)}
    <button class="boton mini" id="csv-articulo" type="button" style="margin-top:12px">Exportar este artículo (CSV)</button>`;
  ordenable(cont);
  $("#sel-articulo").onchange = (e) => { periodo.articulo = e.target.value; pintarDetalleArticulo(m, datos); };
  $("#csv-articulo").onclick = () => exportarCSV({ regs: d.registros }, `articulo-${d.codigo || "sin-codigo"}`);
}

// ---------- Pestaña Insights ----------
const ETIQUETA = { alta: "▲ Prioridad alta", media: "● Prioridad media", baja: "▼ Prioridad baja" };
const tarjeta = (i) => `<div class="panel insight ${i.prioridad}">
  <div class="prioridad ${i.prioridad}">${ETIQUETA[i.prioridad]}</div>
  <h2 style="margin:4px 0 6px">${esc(i.titulo)}</h2>
  <div>${esc(i.detalle)}</div>
  <div class="accion"><strong>Acción:</strong> ${esc(i.accion)}</div></div>`;

let analisisIA = null; // { clave, resultado }

async function pintarInsights() {
  const cont = $("#insights");
  cont.innerHTML = `<p class="tenue">Cargando…</p>`;
  let m, datos;
  try { ({ m, datos } = await metricas()); } catch (err) { cont.innerHTML = `<div class="nota error">${esc(err.message)}</div>`; return; }
  const { insights } = await import("/metricas.js");
  const clave = JSON.stringify({ ...periodo, articulo: undefined }); // cambiar de artículo no invalida el análisis
  const ia = analisisIA?.clave === clave ? analisisIA.resultado : null;
  cont.innerHTML = filtrosHTML(datos) + `
    <p class="tenue">Hallazgos calculados con reglas fijas sobre las hojas guardadas del período. No tienen coste.</p>
    ${insights(m).map(tarjeta).join("")}
    <div class="panel">
      <h2>Análisis con Claude</h2>
      <p class="tenue" style="margin-top:0">Claude lee el resumen numérico del período (sin fotos) y propone decisiones. Cuesta en torno a un céntimo de dólar por consulta.</p>
      <div id="ia">${ia ? pintarIA(ia) : `<button class="boton" id="pedir-ia" type="button">Analizar con Claude</button>`}</div>
    </div>`;
  enlazarFiltros(cont, pintarInsights);
  $("#pedir-ia")?.addEventListener("click", async () => {
    const b = $("#pedir-ia");
    b.disabled = true; b.textContent = "Analizando…";
    try {
      const { resumenParaIA } = await import("/metricas.js");
      const r = await api("/api/insights-ia", { resumen: resumenParaIA(m) });
      analisisIA = { clave, resultado: r };
      $("#ia").innerHTML = pintarIA(r);
    } catch (err) {
      $("#ia").innerHTML = `<div class="nota error">${esc(err.message)}</div><button class="boton" id="pedir-ia" type="button">Reintentar</button>`;
      $("#pedir-ia").onclick = () => pintarInsights();
    }
  });
}

function pintarIA(r) {
  return `<p>${esc(r.resumen)}</p>
    ${r.hallazgos.map(tarjeta).join("")}
    ${r.limitaciones?.length ? `<div class="nota aviso"><strong>Limitaciones:</strong><ul>${r.limitaciones.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    <p class="tenue">Generado con ${esc(r.modelo)}. Revisa los números en Reportes antes de decidir.</p>`;
}
