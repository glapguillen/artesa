// Pestaña Base de datos: cuántas filas tiene cada tabla, vista previa con búsqueda y descarga
// de la base completa en Excel. Usa $, esc, api y fechaCorta de la página principal.

const base = { tabla: "Registros", q: "", resumen: null };

const celdaBase = (v, tipo) => {
  if (v == null || v === "") return `<span class="tenue">—</span>`;
  if (tipo === "fecha") return esc(fechaCorta(typeof v === "string" ? v : new Date(v).toISOString()));
  if (tipo === "numero") return esc(Number(v).toLocaleString("es", { maximumFractionDigits: 2 }));
  return esc(v);
};

async function pintarBase() {
  const cont = $("#base");
  cont.innerHTML = `<p class="tenue">Cargando…</p>`;
  try {
    base.resumen = await api("/api/base");
  } catch (err) {
    cont.innerHTML = `<div class="nota error">${esc(err.message)}</div>`;
    return;
  }
  const total = base.resumen.reduce((s, t) => s + t.filas, 0);
  cont.innerHTML = `
    <div class="panel">
      <h2>Base de datos completa</h2>
      <p class="tenue" style="margin-top:0">Descarga todo en un Excel con una hoja por tabla, con filtros y fechas listas para usar. ${total.toLocaleString("es")} filas en total.</p>
      <a class="boton primario" id="descargar-base" href="/api/base.xlsx" download>Descargar Excel (.xlsx)</a>
    </div>
    <div class="panel">
      <h2>Ver una tabla</h2>
      <div class="chips" id="base-tablas">${base.resumen.map((t) =>
        `<button type="button" class="chip-boton ${t.hoja === base.tabla ? "activo" : ""}" data-tabla="${esc(t.hoja)}">${esc(t.hoja)} <span class="tenue">${t.filas.toLocaleString("es")}</span></button>`).join("")}</div>
      <label style="margin-top:12px">Buscar<input type="search" id="base-q" value="${esc(base.q)}" placeholder="Orden, cliente, operario, artículo…"></label>
      <div id="base-filas" style="margin-top:12px"></div>
    </div>`;
  $("#base-tablas").onclick = (e) => {
    const b = e.target.closest("[data-tabla]"); if (!b) return;
    base.tabla = b.dataset.tabla;
    document.querySelectorAll("#base-tablas .chip-boton").forEach((x) => x.classList.toggle("activo", x === b));
    pintarFilasBase();
  };
  let espera;
  $("#base-q").oninput = (e) => { clearTimeout(espera); espera = setTimeout(() => { base.q = e.target.value; pintarFilasBase(); }, 300); };
  pintarFilasBase();
}

async function pintarFilasBase() {
  const cont = $("#base-filas");
  const t = base.resumen.find((x) => x.hoja === base.tabla);
  cont.innerHTML = `<p class="tenue">Cargando…</p>`;
  try {
    const filas = await api(`/api/base/tabla?nombre=${encodeURIComponent(base.tabla)}&q=${encodeURIComponent(base.q)}`);
    if (!filas.length) { cont.innerHTML = `<p class="tenue">${base.q ? "Nada coincide con la búsqueda." : "La tabla está vacía."}</p>`; return; }
    cont.innerHTML = `<p class="tenue" style="margin-top:0">${filas.length === 100 ? "Las primeras 100 filas" : `${filas.length} ${filas.length === 1 ? "fila" : "filas"}`}${base.q ? " que coinciden" : ""}. El Excel trae todas.</p>
      <div class="tabla"><table class="lectura">
        <thead><tr>${t.columnas.map((c) => `<th class="${c.tipo === "numero" || c.tipo === "entero" ? "num" : ""}">${esc(c.titulo)}</th>`).join("")}</tr></thead>
        <tbody>${filas.map((f) => `<tr>${t.columnas.map((c) =>
          `<td class="${c.tipo === "numero" || c.tipo === "entero" ? "num" : ""}" style="white-space:nowrap">${celdaBase(f[c.clave], c.tipo)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></div>`;
  } catch (err) {
    cont.innerHTML = `<div class="nota error">${esc(err.message)}</div>`;
  }
}
