// Interpreta el texto que el lector gratuito (OCR) saca de una foto de la hoja.
// Solo busca lo impreso: lo escrito a mano no se lee con fiabilidad y se completa a mano.
// Funciona igual en el navegador y en Node, para poder probarlo.

export const SECCIONES = ["SEÑALADO", "TRAZADO", "DECORADO", "ESMALT"];

const sinAcentos = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const soloLetras = (s) => sinAcentos(s).toUpperCase().replace(/[^A-Z]/g, "");

function distancia(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// Busca el nombre de sección más parecido en el texto que sigue a "Seccion".
function seccion(texto, secciones) {
  const m = texto.match(/s[eo]cc?i[oó]n[^\n]*/i);
  if (!m) return null;
  const tras = soloLetras(m[0].replace(/^s[eo]cc?i[oó]n/i, ""));
  let mejor = null;
  for (const nombre of secciones) {
    const n = soloLetras(nombre);
    for (let i = 0; i + n.length - 2 <= tras.length && i < 12; i++) {
      for (const largo of [n.length - 1, n.length, n.length + 1]) {
        const d = distancia(n, tras.slice(i, i + largo));
        if (!mejor || d < mejor.d) mejor = { d, nombre };
      }
    }
  }
  return mejor && mejor.d <= 2 ? mejor.nombre : null;
}

function numeroOrden(texto) {
  const tras = texto.match(/ORDEN[^\n\d]{0,6}(\d{6,7})/i) || texto.match(/\b(00\d{5})\b/);
  if (!tras) return null;
  return tras[1].padStart(7, "0");
}

function fechaEmision(texto) {
  for (const m of texto.matchAll(/(\d{2})-(\d{2})-(20\d{2})/g)) {
    const [, d, mes, a] = m;
    // Un año fuera de rango es un dígito mal leído ("2006"): mejor dejarlo en blanco que guardarlo mal.
    const anio = +a, actual = new Date().getFullYear();
    if (+mes >= 1 && +mes <= 12 && +d >= 1 && +d <= 31 && anio >= actual - 2 && anio <= actual + 1) return `${a}-${mes}-${d}`;
  }
  return null;
}

// Palabras impresas en mayúsculas; descarta los restos de ruido del OCR.
function palabrasImpresas(s) {
  const fuera = /^(MES|SEMANA|GRUPO|SECCION|SECCI[OÓ]N|ORDEN|SEPTEMBER|AUGUST|OCTOBER|NOVEMBER|DECEMBER|JANUARY)$/;
  const palabras = [];
  for (const p of s.split(/\s+/)) {
    if (/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ.,&\/-]*$/.test(p) && !fuera.test(sinAcentos(p).replace(/[.,:]/g, "")) && p.replace(/[^A-ZÑ]/g, "").length >= 1) palabras.push(p);
    else if (palabras.length) break;
  }
  // Sin al menos una palabra de cuatro letras suele ser ruido ("E EE", "ST ICA").
  while (palabras.length && palabras.at(-1).replace(/[^A-ZÑ]/g, "").length < 2) palabras.pop();
  const texto = palabras.join(" ").replace(/[,\s]+$/, "");
  return palabras.some((p) => p.replace(/[^A-ZÁÉÍÓÚÑ]/g, "").length >= 4) ? texto : null;
}

function campoTras(texto, etiqueta) {
  const m = texto.match(new RegExp(etiqueta + "[^\\n]{0,2}?[:;.,]?\\s+([^\\n]*)", "i"));
  if (!m) return null;
  return palabrasImpresas(m[1].split(/\s+s[eo]cc?i[oó]n\b/i)[0]);
}

// Líneas de artículo: "0699 626 FUENTE OVALADA 40.5 CM 7 168,00 ..." y debajo la decoración y la ruta.
function articulos(lineas) {
  const lista = [];
  lineas.forEach((linea, i) => {
    const m = linea.match(/\b(\d{4})\s+(\d{3})\s+(.*)$/);
    if (!m || /total/i.test(linea)) return;
    const resto = m[3].split(/\s+/);
    const nombre = [];
    let producir = null, tiempo = null;
    for (let k = 0; k < resto.length; k++) {
      const t = resto[k];
      if (/^\d{1,3}(\.\d{3})*,\d{2}\|?$/.test(t)) { tiempo = Number(t.replace(/[.|]/g, "").replace(",", ".")); break; }
      if (/^[A-ZÁÉÍÓÚÑ#.\/]+$/.test(t) || /^#?\d+([.,]\d+)?$/.test(t) || t === "CM") nombre.push(t);
      else if (t === "|") continue;
      else break;
    }
    if (tiempo != null && /^\d{1,4}$/.test(nombre.at(-1) ?? "")) producir = Number(nombre.pop());
    // Restos de las columnas de cantidades pegados al nombre ("JARRO NORUEGO 10", "4 0,0").
    while (nombre.length > 1 && /^[\d,]+$/.test(nombre.at(-1))) nombre.pop();
    const bizcocho = nombre.join(" ").trim();
    if (bizcocho.replace(/[^A-ZÑ]/g, "").length < 3) return;
    let decoracion = "", ruta = null;
    for (const sig of lineas.slice(i + 1, i + 3)) {
      if (/\b\d{4}\s+\d{3}\b/.test(sig)) break;
      const r = sig.match(/\b[rmn]?uta\s+([STDE]{1,4})\b/i);
      if (r && !ruta) ruta = r[1].toUpperCase();
      if (!decoracion) {
        const antes = sig.split(/\b[rmn]?uta\b/i)[0].replace(/^[^A-ZÁÉÍÓÚÑ]*/, "");
        decoracion = palabrasImpresas(antes) ?? "";
      }
    }
    lista.push({ codigo_bizcocho: m[1], bizcocho, codigo_decoracion: m[2], decoracion, cantidad_producir: producir, tiempo_estandar: tiempo, ruta, malas: null, registros: [] });
  });
  return lista;
}

export function interpretar(texto, secciones = SECCIONES) {
  const lineas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const datos = {
    es_hoja_produccion: /PRODUC|ORDEN|SECCI|ARTICULO/i.test(texto),
    numero_orden: numeroOrden(texto),
    seccion: seccion(texto, secciones),
    fecha_emision: fechaEmision(texto),
    cliente: campoTras(texto, "CLIENTE"),
    observaciones: campoTras(texto, "OBSERVACIONES"),
    operario1: null,
    operario2: null,
    notas: null,
    articulos: articulos(lineas),
  };
  return conDudas(datos);
}

function conDudas(datos) {
  const faltan = [
    !datos.numero_orden && "el número de orden",
    !datos.seccion && "la sección",
    !datos.fecha_emision && "la fecha de emisión",
    !datos.cliente && "el cliente",
    !datos.articulos.length && "los artículos",
  ].filter(Boolean);
  datos.dudas = [
    ...(faltan.length ? [`No se pudo leer ${faltan.join(", ")}: complétalo mirando la foto.`] : []),
    ...(datos.articulos.length ? ["Los nombres y cantidades de los artículos leídos de la foto son aproximados: compáralos con la hoja."] : []),
  ];
  return datos;
}

// Une la lectura de la foto entera con la de su zona de texto ampliada: cada campo sale de la
// pasada que lo leyó. El cliente se lee mejor ampliado; fecha y artículos, en la foto entera.
export function combinar(entera, ampliada) {
  const d = { ...entera };
  for (const k of ["numero_orden", "seccion", "fecha_emision", "observaciones"]) d[k] = entera[k] ?? ampliada[k];
  d.cliente = ampliada.cliente ?? entera.cliente;
  d.articulos = ampliada.articulos.length > entera.articulos.length ? ampliada.articulos : entera.articulos;
  d.es_hoja_produccion = entera.es_hoja_produccion || ampliada.es_hoja_produccion;
  return conDudas(d);
}

const parecido = (a, b) => {
  const x = soloLetras(a), y = soloLetras(b);
  if (!x || !y) return 0;
  return 1 - distancia(x, y) / Math.max(x.length, y.length);
};

// Completa y corrige los artículos con el catálogo de códigos. Por código: pone el nombre del
// catálogo. Si el código no existe pero el nombre leído se parece a uno del catálogo, corrige el
// código (un dígito mal leído es más probable que un artículo nuevo con casi el mismo nombre).
export function aplicarCatalogo(datos, cat) {
  const avisos = [];
  const repasar = (a, lista, campoCodigo, campoNombre, etiqueta) => {
    const codigo = (a[campoCodigo] ?? "").trim(), nombre = (a[campoNombre] ?? "").trim();
    const porCodigo = lista.find((x) => x.codigo === codigo);
    if (porCodigo) {
      if (nombre && parecido(nombre, porCodigo.nombre) < 0.5)
        avisos.push(`${etiqueta} ${codigo}: en la foto se leyó "${nombre}" y en el catálogo es "${porCodigo.nombre}". Se puso el del catálogo; revísalo.`);
      a[campoNombre] = porCodigo.nombre;
      return true;
    }
    if (nombre.replace(/[^A-ZÑ]/gi, "").length < 4) return false;
    let mejor = null;
    for (const x of lista) { const p = parecido(nombre, x.nombre); if (!mejor || p > mejor.p) mejor = { p, x }; }
    if (mejor && mejor.p >= 0.75) {
      if (codigo && codigo !== mejor.x.codigo)
        avisos.push(`${etiqueta} "${mejor.x.nombre}": el código se leyó ${codigo} y en el catálogo es ${mejor.x.codigo}. Se puso el del catálogo; revísalo.`);
      a[campoCodigo] = mejor.x.codigo;
      a[campoNombre] = mejor.x.nombre;
      return true;
    }
    return false;
  };
  let completados = 0;
  for (const a of datos.articulos) {
    completados += repasar(a, cat.bizcochos, "codigo_bizcocho", "bizcocho", "Bizcocho");
    completados += repasar(a, cat.decoraciones, "codigo_decoracion", "decoracion", "Decoración");
  }
  if (completados) {
    datos.dudas = datos.dudas.map((x) => x.replace("Los nombres y cantidades de los artículos leídos de la foto son aproximados", "Las cantidades y tiempos de los artículos leídos de la foto son aproximados"));
    datos.dudas.unshift("Nombres de bizcocho y decoración completados con el catálogo de códigos.");
  }
  datos.dudas.push(...avisos);
  return datos;
}
