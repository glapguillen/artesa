// Comprueba el resultado de una ejecución del workflow y el estado del simulador de Google.
// Uso: node comprobar.js <escenario> <salida-de-n8n-execute> <estado-del-simulador.json> <estado-anterior.json>
const fs = require('fs');
const [escenario, salidaPath, estadoPath, antesPath] = process.argv.slice(2);

const txt = fs.readFileSync(salidaPath, 'utf8');
const inicio = txt.indexOf('\n{');
const ejec = JSON.parse(inicio >= 0 ? txt.slice(inicio + 1) : txt);
const run = ejec.data.resultData.runData;
const estado = JSON.parse(fs.readFileSync(estadoPath, 'utf8'));
const antes = antesPath && fs.existsSync(antesPath) ? JSON.parse(fs.readFileSync(antesPath, 'utf8')) : { files: [], filas: [[]], correos: [] };

let fallos = 0;
const chk = (desc, cond) => { console.log((cond ? '  \x1b[32m✓\x1b[0m ' : '  \x1b[31m✗\x1b[0m ') + desc); if (!cond) fallos++; };
const salida = (nodo, i = 0) => ((run[nodo] || [])[0]?.data?.main?.[i] || []).map((x) => x.json);
const corrio = (nodo) => !!run[nodo];
const ok = (nodo) => corrio(nodo) && salida(nodo, 1).length === 0 && salida(nodo, 0).length > 0;

const FOLDER = 'application/vnd.google-apps.folder';
const carpetas = estado.files.filter((f) => f.mimeType === FOLDER);
const cli = carpetas.find((f) => f.name === 'ARTESA' && f.parents.includes('RESPALDOS'));
const db = cli && carpetas.find((f) => f.name === 'artesa-db' && f.parents.includes(cli.id));
const enDb = db ? estado.files.filter((f) => f.parents.includes(db.id)) : [];
const nuevasFilas = estado.filas.slice(antes.filas.length);
const nuevosCorreos = estado.correos.slice(antes.correos.length);
const papelera = (lista) => lista.filter((f) => f.trashed).map((f) => f.name).sort();
const v = salida('Validar respaldo')[0] || {};

chk('la ejecución terminó sin error no controlado', ejec.status === 'success' && !ejec.data.resultData.error);

if (escenario === 'primera' || escenario === 'retencion') {
  chk('Pedir respaldo → Validar respaldo sin errores', ok('Pedir respaldo') && ok('Revisar respuesta') && ok('Calcular SHA-256') && ok('Validar respaldo'));
  chk('respaldo cifrado con nombre {CLIENTE}_{DB}_{fecha}.dump.age', /^ARTESA_artesa-db_\d{4}-\d\d-\d\d_\d{4}\.dump\.age$/.test(v.archivo || ''));
  chk('existe Respaldos/ARTESA/artesa-db (una sola vez cada carpeta)', !!db && carpetas.filter((f) => f.name === 'ARTESA').length === 1 && carpetas.filter((f) => f.name === 'artesa-db').length === 1);
  const subido = salida('Subir a Drive')[0] || {};
  const enDrive = estado.files.find((f) => f.id === subido.id) || {};
  chk('el archivo está en la carpeta de la base con su nombre', enDrive.name === v.archivo && db && enDrive.parents.includes(db.id));
  chk('lo que llegó a Drive tiene el mismo SHA-256 y tamaño que generó pg-backup', enDrive.sha === v.sha256 && enDrive.size === v.tamano_bytes);
  const fila = nuevasFilas[0] || [];
  chk('fila "ok" en la hoja de log (fecha, archivo, tamaño, sha256, duración, estado)', nuevasFilas.length === 1 && fila[3] === v.archivo && Number(fila[4]) === v.tamano_bytes && fila[5] === v.sha256 && fila[7] === 'ok');
  chk('sin correo de alerta', nuevosCorreos.length === 0);
}
if (escenario === 'primera') {
  chk('la retención no manda nada a la papelera', salida('Elegir los que sobran').length === 0 && papelera(estado.files).length === 0);
}
if (escenario === 'retencion') {
  const esperados = ['ARTESA_artesa-db_2026-08-02_0200.dump.age', 'ARTESA_artesa-db_2026-08-09_0200.dump.age', 'ARTESA_artesa-db_2026-08-16_0200.dump.age'];
  chk('se conservan los 8 más recientes y van a la papelera los 3 más antiguos', JSON.stringify(papelera(enDb)) === JSON.stringify(esperados));
  chk('a la papelera, no borrado definitivo', enDb.filter((f) => f.trashed).length === 3);
  const intactos = ['LEEME.txt', 'ARTESA_artesa-db_2026-08-01_0200.dump.age.bak', 'ARTESA_otra-db_2026-01-01_0200.dump.age'];
  chk('no toca archivos que no son respaldos de esta base', intactos.every((n) => enDb.some((f) => f.name === n && !f.trashed)));
  chk('el respaldo recién subido se conserva', enDb.some((f) => f.name === v.archivo && !f.trashed));
}
if (['base-caida', 'token-malo', 'errortrigger'].includes(escenario)) {
  const alerta = salida('Preparar alerta')[0] || {};
  chk('se envió exactamente un correo de alerta', nuevosCorreos.length === 1 && corrio('Enviar alerta (Gmail)'));
  const correo = nuevosCorreos[0] || '';
  const cuerpo = Buffer.from(correo.split('\r\n\r\n').slice(1).join('\r\n\r\n').replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g, '%$1'), 'binary').toString();
  let texto = cuerpo; try { texto = decodeURIComponent(cuerpo); } catch (e) {}
  chk('el asunto dice qué falló', /FALL/.test(correo) && /ARTESA/.test(correo));
  chk('fila "error" en la hoja de log', nuevasFilas.length === 1 && nuevasFilas[0][7] === 'error');
  chk('no se subió ni se borró nada en Drive', estado.files.length === antes.files.length && papelera(estado.files).length === papelera(antes.files).length);
  chk('el correo no contiene contraseñas ni el token', !/clave-|postgresql:\/\/|Bearer/.test(texto));
  if (escenario === 'base-caida') chk('el correo explica la causa (autenticación, etapa conexión)', /password authentication failed/.test(alerta.mensaje) && /etapa: conexion/.test(texto));
  if (escenario === 'token-malo') chk('el correo indica HTTP 401 de pg-backup', /HTTP 401/.test(alerta.mensaje));
  if (escenario === 'errortrigger') {
    chk('con Error Trigger no se llama a pg-backup', !corrio('Pedir respaldo'));
    chk('el correo trae el nodo y el error de la ejecución fallida', alerta.nodo === 'Subir a Drive' && /timed out/.test(alerta.mensaje) && /231/.test(texto));
  }
}
process.exit(fallos ? 1 : 0);
