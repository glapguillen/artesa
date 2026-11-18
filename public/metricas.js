// Cálculos de Reportes e Insights a partir de las filas de /api/reportes. Sin DOM, para usarlo
// igual en el navegador y en las pruebas.
//
// Supuestos, a la vista en la pantalla:
// - Horas-persona de un registro = (fin - inicio) × personas (personas vacío = 1). Un registro con
//   la hora de fin igual o anterior a la de inicio no cuenta para horas ni productividad.
// - Eficiencia = minutos estándar de lo producido / minutos reales, con TIEMPO / PRODUCIR como
//   minutos estándar por pieza. NO se muestra: el TIEMPO impreso es el mismo en las hojas de todas
//   las secciones, así que no es el estándar de cada una (daba 1.700 % en Señalado). Se calcula
//   para cuando se sepa qué mide TIEMPO.

export const ORDEN_SECCIONES = ["SEÑALADO", "TRAZADO", "DECORADO", "ESMALT"];
const LETRA = { S: "SEÑALADO", T: "TRAZADO", D: "DECORADO", E: "ESMALT" };

const minutos = (h) => { const m = /^(\d{1,2}):(\d{2})/.exec(h ?? ""); return m ? +m[1] * 60 + +m[2] : null; };
const dia = (f) => (f ? String(f).slice(0, 10) : null);
const sumar = (xs, f) => xs.reduce((s, x) => s + (f(x) || 0), 0);
const div = (a, b) => (b > 0 ? a / b : null);
export const equipo = (o1, o2) => [o1, o2].map((x) => (x ?? "").trim()).filter(Boolean).join(" y ") || "Sin operario";
// "Ana Pérez" y "ana perez" son la misma persona: se agrupa sin tildes ni mayúsculas.
export const claveNombre = (s) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
const nombreArticulo = (x) => [x.bizcocho, x.decoracion].filter(Boolean).join(" · ") || [x.codigo_bizcocho, x.codigo_decoracion].filter(Boolean).join(" ") || "Artículo";
const ordenSeccion = (s) => { const i = ORDEN_SECCIONES.indexOf(s); return i < 0 ? 99 : i; };

export function diasEntre(a, b) {
  return Math.round((Date.parse(dia(b) + "T00:00:00Z") - Date.parse(dia(a) + "T00:00:00Z")) / 86_400_000);
}

function conHoras(r) {
  const ini = minutos(r.hora_inicio), fin = minutos(r.hora_fin);
  const valida = ini != null && fin != null && fin > ini;
  const personas = Number(r.personas) > 0 ? Number(r.personas) : 1;
  const hp = valida ? ((fin - ini) / 60) * personas : null;
  const std = Number(r.tiempo_estandar) > 0 && Number(r.cantidad_producir) > 0 ? Number(r.tiempo_estandar) / Number(r.cantidad_producir) : null;
  return { ...r, fecha: dia(r.fecha), cantidad: Number(r.cantidad) || 0, horasValidas: valida, hp, stdMin: std, equipo: equipo(r.operario1, r.operario2) };
}

// Productividad de un grupo de registros: solo cuenta los que tienen horas válidas.
function productividad(regs) {
  const conH = regs.filter((r) => r.horasValidas);
  const piezasH = sumar(conH, (r) => r.cantidad), hp = sumar(conH, (r) => r.hp);
  const conStd = conH.filter((r) => r.stdMin != null);
  return {
    piezas: sumar(regs, (r) => r.cantidad),
    horasPersona: hp,
    piezasHora: div(piezasH, hp),
    eficiencia: div(sumar(conStd, (r) => r.cantidad * r.stdMin), sumar(conStd, (r) => r.hp * 60)),
    registros: regs.length,
  };
}

export function calcular(datos, filtros = {}, hoy = new Date().toISOString().slice(0, 10)) {
  const pasa = (x) => (!filtros.seccion || x.seccion === filtros.seccion) && (!filtros.cliente || x.cliente === filtros.cliente);
  const regs = datos.registros.filter(pasa).map(conHoras);
  const hojas = datos.hojas.filter((h) => !filtros.cliente || h.cliente === filtros.cliente);
  const enRango = (f) => f && dia(f) >= datos.desde && dia(f) <= datos.hasta;
  const malas = datos.malas.filter((m) => pasa(m) && enRango(m.fecha));

  // ---- Producción por día (días sin registros = 0, dentro del rango con datos) ----
  const porDiaMapa = new Map();
  for (const r of regs) porDiaMapa.set(r.fecha, (porDiaMapa.get(r.fecha) ?? 0) + r.cantidad);
  const porDia = [];
  if (porDiaMapa.size) {
    const fechas = [...porDiaMapa.keys()].sort();
    for (let f = fechas[0]; f <= fechas.at(-1); f = new Date(Date.parse(f + "T00:00:00Z") + 86_400_000).toISOString().slice(0, 10))
      porDia.push({ fecha: f, piezas: porDiaMapa.get(f) ?? 0 });
  }

  // ---- Estado de cada orden y cola por sección ----
  const ordenes = new Map();
  for (const h of hojas) {
    if (!ordenes.has(h.orden)) ordenes.set(h.orden, { orden: h.orden, cliente: h.cliente, emision: dia(h.fecha_emision), ruta: h.ruta ?? "", hojas: [] });
    ordenes.get(h.orden).hojas.push(h);
  }
  const cola = Object.fromEntries(ORDEN_SECCIONES.map((s) => [s, { esperando: 0, bloqueadas: 0 }]));
  const abiertas = [];
  for (const o of ordenes.values()) {
    // Las secciones en el orden de la ruta (S, T, D, E); las que no están en la ruta, al final.
    const pos = (s) => { const i = [...o.ruta].map((l) => LETRA[l]).indexOf(s); return i < 0 ? 50 + ordenSeccion(s) : i; };
    o.hojas.sort((a, b) => pos(a.seccion) - pos(b.seccion));
    const pendientes = o.hojas.filter((h) => h.estado !== "registrada");
    if (!pendientes.length) continue;
    // "Esperando": su sección anterior en la ruta ya entregó. "Bloqueada": aún falta una anterior.
    const primera = o.hojas.findIndex((h) => h.estado !== "registrada");
    o.hojas.forEach((h, i) => {
      if (h.estado === "registrada" || !cola[h.seccion]) return;
      cola[h.seccion][i === primera ? "esperando" : "bloqueadas"]++;
    });
    const actividad = o.hojas.map((h) => dia(h.ultimo_registro) ?? dia(h.registrada_en)).filter(Boolean).sort().at(-1) ?? null;
    abiertas.push({
      orden: o.orden, cliente: o.cliente, emision: o.emision,
      hechas: o.hojas.length - pendientes.length, total: o.hojas.length,
      siguiente: o.hojas[primera].seccion,
      diasDesdeEmision: o.emision ? diasEntre(o.emision, hoy) : null,
      ultimaActividad: actividad,
      diasSinActividad: actividad ? diasEntre(actividad, hoy) : null,
    });
  }
  abiertas.sort((a, b) => (b.diasSinActividad ?? b.diasDesdeEmision ?? 0) - (a.diasSinActividad ?? a.diasDesdeEmision ?? 0));
  const completas = [...ordenes.values()].filter((o) => o.hojas.every((h) => h.estado === "registrada"));

  // ---- Por sección ----
  const secciones = [...new Set([...ORDEN_SECCIONES, ...regs.map((r) => r.seccion)])]
    .filter((s) => !filtros.seccion || s === filtros.seccion);
  const porSeccion = secciones.map((s) => {
    const rs = regs.filter((r) => r.seccion === s), ms = malas.filter((m) => m.seccion === s);
    const prod = sumar(ms, (m) => m.producidas), mal = sumar(ms, (m) => m.malas);
    return { seccion: s, ...productividad(rs), malas: mal, tasaMalas: div(mal, prod), esperando: cola[s]?.esperando ?? 0, bloqueadas: cola[s]?.bloqueadas ?? 0 };
  }).filter((x) => x.registros || x.esperando || x.bloqueadas);

  // ---- Por equipo de operarios (y sección) ----
  const grupos = new Map();
  for (const r of regs) {
    const k = claveNombre(r.equipo) + "|" + r.seccion;
    if (!grupos.has(k)) grupos.set(k, { equipo: r.equipo, seccion: r.seccion, regs: [], hojas: new Set() });
    grupos.get(k).regs.push(r); grupos.get(k).hojas.add(r.orden);
  }
  const porEquipo = [...grupos.values()].map((g) => {
    const ms = malas.filter((m) => claveNombre(equipo(m.operario1, m.operario2)) === claveNombre(g.equipo) && m.seccion === g.seccion);
    return { equipo: g.equipo, seccion: g.seccion, hojas: g.hojas.size, ...productividad(g.regs), tasaMalas: div(sumar(ms, (m) => m.malas), sumar(ms, (m) => m.producidas)) };
  }).sort((a, b) => ordenSeccion(a.seccion) - ordenSeccion(b.seccion) || b.piezas - a.piezas);

  // ---- Calidad y eficiencia por artículo ----
  const arts = new Map();
  for (const m of malas) {
    const k = m.codigo_bizcocho + " " + m.codigo_decoracion + "|" + nombreArticulo(m);
    if (!arts.has(k)) arts.set(k, { codigo: [m.codigo_bizcocho, m.codigo_decoracion].filter(Boolean).join(" "), articulo: nombreArticulo(m), producidas: 0, malas: 0 });
    const a = arts.get(k); a.producidas += m.producidas || 0; a.malas += m.malas || 0;
  }
  for (const a of arts.values()) {
    const rs = regs.filter((r) => [r.codigo_bizcocho, r.codigo_decoracion].filter(Boolean).join(" ") === a.codigo);
    Object.assign(a, { tasaMalas: div(a.malas, a.producidas), eficiencia: productividad(rs).eficiencia, registros: rs.length });
  }
  const porArticulo = [...arts.values()].sort((a, b) => (b.tasaMalas ?? 0) - (a.tasaMalas ?? 0) || b.producidas - a.producidas);

  // ---- Totales ----
  const total = productividad(regs);
  const prodMalas = sumar(malas, (m) => m.producidas), totalMalas = sumar(malas, (m) => m.malas);
  const kpis = {
    piezas: total.piezas, horasPersona: total.horasPersona, piezasHora: total.piezasHora, eficiencia: total.eficiencia,
    malas: totalMalas, tasaMalas: div(totalMalas, prodMalas),
    hojasRegistradas: hojas.filter((h) => h.estado === "registrada" && enRango(h.registrada_en) && (!filtros.seccion || h.seccion === filtros.seccion)).length,
    ordenesAbiertas: abiertas.length, ordenesCompletas: completas.length,
    registros: regs.length, registrosSinHoras: regs.filter((r) => !r.horasValidas).length,
  };
  return { filtros, desde: datos.desde, hasta: datos.hasta, hoy, kpis, porDia, porSeccion, porEquipo, porArticulo, abiertas, regs };
}

// ---- Detalle por artículo ----
// Un artículo es su código de bizcocho + decoración ("0944 626"); sin códigos, su nombre.
export const claveArticulo = (x) => [x.codigo_bizcocho, x.codigo_decoracion].filter(Boolean).join(" ") || claveNombre(nombreArticulo(x));

// Lista de artículos del período (para el selector), de más a menos piezas.
export function articulosDelPeriodo(m) {
  const mapa = new Map();
  for (const r of m.regs) {
    const k = claveArticulo(r);
    if (!mapa.has(k)) mapa.set(k, { clave: k, codigo: [r.codigo_bizcocho, r.codigo_decoracion].filter(Boolean).join(" "), articulo: nombreArticulo(r), piezas: 0 });
    mapa.get(k).piezas += r.cantidad;
  }
  return [...mapa.values()].sort((a, b) => b.piezas - a.piezas);
}

// Minutos reales por pieza = minutos-persona / piezas, solo con registros de horas válidas.
const minPieza = (regs) => { const v = regs.filter((r) => r.horasValidas); return div(sumar(v, (r) => r.hp * 60), sumar(v, (r) => r.cantidad)); };

export function detalleArticulo(m, datos, clave) {
  const regs = m.regs.filter((r) => claveArticulo(r) === clave)
    .map((r) => ({ ...r, minPieza: r.horasValidas && r.cantidad > 0 ? (r.hp * 60) / r.cantidad : null }))
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || ordenSeccion(a.seccion) - ordenSeccion(b.seccion));
  if (!regs.length) return null;
  const malas = datos.malas.filter((x) => claveArticulo(x) === clave && (!m.filtros.seccion || x.seccion === m.filtros.seccion)
    && (!m.filtros.cliente || x.cliente === m.filtros.cliente) && x.fecha && dia(x.fecha) >= m.desde && dia(x.fecha) <= m.hasta);
  const ordenes = [...new Set(regs.map((r) => r.orden))];
  const agrupar = (clave, extra) => {
    const g = new Map();
    for (const r of regs) { const k = clave(r); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
    return [...g.entries()].map(([k, rs]) => ({ ...extra(k, rs), ...productividad(rs), minPieza: minPieza(rs), dias: new Set(rs.map((r) => r.fecha)).size }));
  };
  const malasDe = (filtro) => { const ms = malas.filter(filtro); return { malas: sumar(ms, (x) => x.malas), tasaMalas: div(sumar(ms, (x) => x.malas), sumar(ms, (x) => x.producidas)) }; };
  const primero = regs[0];
  const porSeccion = agrupar((r) => r.seccion, (s, rs) => ({ seccion: s, operarios: [...new Set(rs.map((r) => r.equipo))].join(", "), ...malasDe((x) => x.seccion === s) }))
    .sort((a, b) => ordenSeccion(a.seccion) - ordenSeccion(b.seccion));
  // Lo que cuesta una pieza en todo su recorrido: los minutos por pieza de cada sección, sumados.
  const conMin = porSeccion.filter((s) => s.minPieza != null);
  const minPiezaRuta = conMin.length ? sumar(conMin, (s) => s.minPieza) : null;
  return {
    clave, codigo: [primero.codigo_bizcocho, primero.codigo_decoracion].filter(Boolean).join(" "), articulo: nombreArticulo(primero),
    ordenes, tiempoImpreso: [...new Set(regs.map((r) => r.tiempo_estandar).filter((x) => x != null))],
    resumen: { ...productividad(regs), minPiezaRuta, seccionesConMinutos: conMin.map((s) => s.seccion), ...malasDe(() => true), dias: new Set(regs.map((r) => r.fecha)).size,
      desde: primero.fecha, hasta: regs.at(-1).fecha, sinHoras: regs.filter((r) => !r.horasValidas).length },
    porSeccion,
    porOperario: agrupar((r) => claveNombre(r.equipo) + "|" + r.seccion, (_k, rs) => ({ equipo: rs[0].equipo, seccion: rs[0].seccion }))
      .sort((a, b) => ordenSeccion(a.seccion) - ordenSeccion(b.seccion) || b.piezas - a.piezas),
    porOrden: agrupar((r) => r.orden, (o, rs) => ({ orden: o, cliente: rs[0].cliente, producir: rs[0].cantidad_producir, secciones: [...new Set(rs.map((r) => r.seccion))].join(", ") })),
    registros: regs,
  };
}

const pct = (x) => Math.round(x * 100) + " %";

// Hallazgos calculados con reglas fijas: gratis, reproducibles y con el dato que los sostiene.
export function insights(m) {
  const lista = [];
  const add = (prioridad, titulo, detalle, accion) => lista.push({ prioridad, titulo, detalle, accion });

  // 1. Cuello de botella: dónde esperan más órdenes que ya pueden avanzar.
  const cola = [...m.porSeccion].sort((a, b) => b.esperando - a.esperando);
  if (cola[0]?.esperando > 0) {
    const s = cola[0], totalEsperando = sumar(cola, (x) => x.esperando);
    add(s.esperando >= Math.max(3, totalEsperando * 0.5) ? "alta" : "media",
      `Cuello de botella en ${s.seccion}: ${s.esperando} ${s.esperando === 1 ? "orden espera" : "órdenes esperan"}`,
      `${s.esperando} de las ${totalEsperando} órdenes listas para avanzar están detenidas en ${s.seccion}, con su sección anterior ya entregada.` +
        (s.piezasHora ? ` En el período produjo ${s.piezasHora.toFixed(1)} piezas por hora-persona.` : ""),
      `Revisa la carga de ${s.seccion}: reasignar personas o priorizar las órdenes más antiguas.`);
  }

  // 2. Órdenes detenidas.
  const detenidas = m.abiertas.filter((o) => (o.diasSinActividad ?? o.diasDesdeEmision ?? 0) >= 7);
  if (detenidas.length) {
    const top = detenidas.slice(0, 3).map((o) => `${o.orden} (${o.diasSinActividad ?? o.diasDesdeEmision} días, falta ${o.siguiente})`).join(", ");
    add(detenidas.length >= 3 ? "alta" : "media",
      `${detenidas.length} ${detenidas.length === 1 ? "orden lleva" : "órdenes llevan"} una semana o más sin avanzar`,
      `Las más antiguas: ${top}.`,
      "Confirma si están en espera de material, de horno o si falta registrar la hoja.");
  }

  // 3. Tendencia: últimos 7 días con datos frente a los 7 anteriores.
  if (m.porDia.length >= 10) {
    const ult = sumar(m.porDia.slice(-7), (d) => d.piezas), ant = sumar(m.porDia.slice(-14, -7), (d) => d.piezas);
    if (ant > 0) {
      const cambio = (ult - ant) / ant;
      if (Math.abs(cambio) >= 0.15)
        add(cambio < 0 ? "media" : "baja", `La producción ${cambio < 0 ? "bajó" : "subió"} un ${pct(Math.abs(cambio))} en la última semana`,
          `${ult} piezas en los últimos 7 días frente a ${ant} en los 7 anteriores.`,
          cambio < 0 ? "Mira qué secciones bajaron en la tabla por sección y si hubo ausencias o paradas." : "Identifica qué cambió para mantenerlo.");
    }
  }

  // 4. Calidad: sección y artículo con más piezas malas.
  const conVolumen = m.porSeccion.filter((s) => s.tasaMalas != null && s.piezas >= 50);
  const peorSec = [...conVolumen].sort((a, b) => b.tasaMalas - a.tasaMalas)[0];
  if (peorSec && peorSec.tasaMalas >= 0.02 && m.kpis.tasaMalas != null && peorSec.tasaMalas > m.kpis.tasaMalas * 1.3)
    add(peorSec.tasaMalas >= 0.05 ? "alta" : "media", `${peorSec.seccion} concentra las piezas malas: ${pct(peorSec.tasaMalas)}`,
      `Frente a un ${pct(m.kpis.tasaMalas)} del total (${peorSec.malas} malas en el período).`,
      `Revisa el proceso de ${peorSec.seccion} con los artículos de la tabla de calidad.`);
  const peorArt = m.porArticulo.find((a) => a.producidas >= 20 && a.tasaMalas >= 0.05);
  if (peorArt)
    add(peorArt.tasaMalas >= 0.1 ? "alta" : "media", `${peorArt.articulo} tiene ${pct(peorArt.tasaMalas)} de piezas malas`,
      `${peorArt.malas} malas de ${peorArt.producidas} producidas (${peorArt.codigo}).`,
      "Revisa si el problema es del bizcocho, de la decoración o del horno para ese artículo.");

  // 5. Diferencias de productividad entre equipos de una misma sección (solo con datos suficientes).
  for (const s of ORDEN_SECCIONES) {
    const eqs = m.porEquipo.filter((e) => e.seccion === s && e.piezasHora != null && e.registros >= 3);
    if (eqs.length < 2) continue;
    const orden = [...eqs].sort((a, b) => b.piezasHora - a.piezasHora);
    const mejor = orden[0], peor = orden.at(-1);
    if (mejor.piezasHora >= peor.piezasHora * 1.5)
      add("baja", `En ${s}, ${mejor.equipo} produce ${(mejor.piezasHora / peor.piezasHora).toFixed(1)} veces más por hora que ${peor.equipo}`,
        `${mejor.piezasHora.toFixed(1)} frente a ${peor.piezasHora.toFixed(1)} piezas por hora-persona. Puede deberse a artículos distintos o a horas mal anotadas.`,
        "Compara qué artículos hizo cada uno antes de sacar conclusiones; si son similares, comparte el método.");
  }

  // 6. Calidad de los datos: registros que no sirven para medir.
  if (m.kpis.registros >= 10 && m.kpis.registrosSinHoras / m.kpis.registros >= 0.05)
    add("media", `${m.kpis.registrosSinHoras} de ${m.kpis.registros} registros no tienen horas válidas`,
      "Les falta una hora o la de fin es anterior a la de inicio, así que no entran en productividad ni eficiencia.",
      "Pide en planta que anoten inicio y fin en cada bloque, y corrígelas al revisar la foto.");

  if (!lista.length)
    add("baja", "Sin alertas en el período", "No hay cuellos de botella, órdenes detenidas ni problemas de calidad que superen los umbrales.", "Amplía el período o revisa los reportes para más detalle.");
  const peso = { alta: 0, media: 1, baja: 2 };
  return lista.sort((a, b) => peso[a.prioridad] - peso[b.prioridad]);
}

// Resumen compacto para el análisis con Claude: solo agregados, nada de fotos.
export function resumenParaIA(m) {
  const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
  return {
    periodo: { desde: m.desde, hasta: m.hasta, hoy: m.hoy, filtros: m.filtros },
    totales: Object.fromEntries(Object.entries(m.kpis).filter(([k]) => k !== "eficiencia").map(([k, v]) => [k, r2(v)])),
    porSeccion: m.porSeccion.map((s) => ({ seccion: s.seccion, piezas: s.piezas, piezasHora: r2(s.piezasHora), tasaMalas: r2(s.tasaMalas), esperando: s.esperando, bloqueadas: s.bloqueadas })),
    produccionPorDia: m.porDia.slice(-31),
    equipos: m.porEquipo.slice(0, 20).map((e) => ({ equipo: e.equipo, seccion: e.seccion, hojas: e.hojas, registros: e.registros, piezas: e.piezas, piezasHora: r2(e.piezasHora), tasaMalas: r2(e.tasaMalas) })),
    ordenesAbiertas: m.abiertas.slice(0, 15),
    calidadPorArticulo: m.porArticulo.slice(0, 15).map(({ eficiencia, ...a }) => ({ ...a, tasaMalas: r2(a.tasaMalas) })),
    hallazgosPorReglas: insights(m).map((i) => i.titulo),
  };
}
