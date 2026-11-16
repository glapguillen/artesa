// Preparación de fotos en el navegador, común a la captura y a la comparación de modelos:
// convierte HEIC a JPEG, reduce el lado mayor a 2000 px y prueba varios caminos para abrirla.

function dibujar(fuente, ancho, alto) {
  const escala = Math.min(1, 2000 / Math.max(ancho, alto));
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(ancho * escala);
  lienzo.height = Math.round(alto * escala);
  lienzo.getContext("2d").drawImage(fuente, 0, 0, lienzo.width, lienzo.height);
  const url = lienzo.toDataURL("image/jpeg", 0.85);
  if (url.length < 1000) throw new Error("la imagen quedó vacía");
  return { url, imagen: url.split(",")[1], mime: "image/jpeg" };
}

const comoImg = (url) => new Promise((ok, mal) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => mal(new Error("formato no admitido por el navegador"));
  img.src = url;
});

// Se reduce en el navegador: basta para leer la letra y sube mucho más rápido.
// Hay tres caminos porque no todos los navegadores de celular abren las fotos igual.
// Las fotos HEIC (formato de muchas cámaras de celular) se convierten a JPEG antes de abrirlas.
let conversor;
const esHeic = (a) => /\.(heic|heif)$/i.test(a.name || "") || /hei[cf]/i.test(a.type || "");
async function deHeic(archivo) {
  conversor ??= new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = "/vendor/heic-to.js";
    s.onload = ok;
    s.onerror = () => { conversor = null; mal(new Error("no se pudo descargar el conversor de fotos HEIC")); };
    document.head.append(s);
  });
  await conversor;
  try {
    return await HeicTo({ blob: archivo, type: "image/jpeg", quality: 0.9 });
  } catch {
    throw new Error("no se pudo convertir la foto HEIC");
  }
}

async function preparar(archivo) {
  if (!archivo.size) throw new Error("el archivo llegó vacío (¿foto en la nube sin descargar?)");
  if (esHeic(archivo)) archivo = await deHeic(archivo);
  try {
    const bmp = await createImageBitmap(archivo);
    try { return dibujar(bmp, bmp.width, bmp.height); } finally { bmp.close?.(); }
  } catch {}
  const blobUrl = URL.createObjectURL(archivo);
  try {
    const img = await comoImg(blobUrl);
    return dibujar(img, img.naturalWidth, img.naturalHeight);
  } catch (err) {
    // Último recurso: enviar la foto tal cual, si el servidor admite su formato y tamaño.
    if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type) || archivo.size > 4_500_000) throw err;
    const url = await new Promise((ok, mal) => {
      const lector = new FileReader();
      lector.onload = () => ok(lector.result);
      lector.onerror = () => mal(new Error("no se pudo leer el archivo"));
      lector.readAsDataURL(archivo);
    });
    return { url, imagen: url.split(",")[1], mime: archivo.type };
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

