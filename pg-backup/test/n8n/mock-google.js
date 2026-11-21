// Simulador mínimo de Drive v3, Sheets v4 y Gmail v1 para probar el workflow de n8n sin cuentas
// reales (lo usa test/n8n-e2e.sh). Guarda todo en memoria; /_estado y /_sembrar son para la prueba.
const https = require('https');
const fs = require('fs');
const crypto = require('crypto');

const files = new Map(); // id -> {id,name,mimeType,parents,trashed,size,sha}
const FOLDER = 'application/vnd.google-apps.folder';
files.set('RESPALDOS', { id: 'RESPALDOS', name: 'Respaldos', mimeType: FOLDER, parents: ['root'], trashed: false });
const filas = [['fecha', 'cliente', 'base', 'archivo', 'tamaño_bytes', 'sha256', 'duración_ms', 'estado', 'detalle']];
const correos = [];
const uploads = new Map();
let seq = 0;
const nuevoId = () => 'F' + (++seq).toString().padStart(4, '0');

function filtrar(q) {
  let r = [...files.values()];
  for (const parte of q.split(/\s+and\s+/i)) {
    let m;
    if ((m = parte.match(/^\(?\s*name\s*=\s*'([^']*)'\s*\)?$/))) r = r.filter((f) => f.name === m[1]);
    else if ((m = parte.match(/^\(?\s*name contains '([^']*)'\s*\)?$/))) r = r.filter((f) => f.name.includes(m[1]));
    else if ((m = parte.match(/^\(?\s*'([^']*)' in parents\s*\)?$/))) r = r.filter((f) => (f.parents || []).includes(m[1]));
    else if ((m = parte.match(/^\(?\s*mimeType\s*(!?=)\s*'([^']*)'\s*\)?$/))) r = r.filter((f) => (m[1] === '=') === (f.mimeType === m[2]));
    else if (/^\(?\s*trashed\s*=\s*false\s*\)?$/.test(parte)) r = r.filter((f) => !f.trashed);
    else if (parte.trim()) throw new Error('consulta no soportada: ' + parte);
  }
  return r;
}

function responder(res, code, obj, headers = {}) {
  res.writeHead(code, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify(obj));
}

const srv = https.createServer({ key: fs.readFileSync('/certs/mock.key'), cert: fs.readFileSync('/certs/mock.crt') }, (req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    const u = new URL(req.url, 'https://' + req.headers.host);
    const host = req.headers.host.split(':')[0];
    const p = u.pathname;
    const log = (extra) => console.log(JSON.stringify({ m: req.method, host, p, q: Object.fromEntries(u.searchParams), auth: (req.headers.authorization || '').slice(0, 12), len: body.length, ...extra }));
    try {
      // ── administración de la prueba ──
      if (p === '/_estado') return responder(res, 200, { files: [...files.values()], filas, correos });
      if (p === '/_sembrar' && req.method === 'POST') {
        const { padre, nombres } = JSON.parse(body);
        for (const name of nombres) { const id = nuevoId(); files.set(id, { id, name, mimeType: 'application/octet-stream', parents: [padre], trashed: false }); }
        return responder(res, 200, { ok: true });
      }
      if (!u.searchParams.get('upload_id') && req.headers.authorization !== 'Bearer token-falso-de-prueba') { log({ error: 'auth' }); return responder(res, 401, { error: { code: 401, message: 'auth' } }); }

      // ── Drive ──
      if (p === '/drive/v3/files' && req.method === 'GET') {
        const r = filtrar(u.searchParams.get('q') || '');
        log({ resultados: r.length });
        return responder(res, 200, { files: r.map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType })) });
      }
      if (p === '/drive/v3/files' && req.method === 'POST') {
        const b = JSON.parse(body); const id = nuevoId();
        files.set(id, { id, name: b.name, mimeType: b.mimeType || 'application/octet-stream', parents: b.parents || ['root'], trashed: false });
        log({ creado: b }); return responder(res, 200, { kind: 'drive#file', id, name: b.name, mimeType: b.mimeType });
      }
      if (p === '/upload/drive/v3/files' && req.method === 'POST' && u.searchParams.get('uploadType') === 'resumable') {
        const id = nuevoId(); uploads.set(id, []);
        log({ subida: 'inicio' });
        res.writeHead(200, { location: `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=${id}` }); return res.end();
      }
      if (p === '/upload/drive/v3/files' && req.method === 'PUT') {
        const id = u.searchParams.get('upload_id'); uploads.get(id).push(body);
        const range = req.headers['content-range'] || '';
        const m = range.match(/bytes (\d+)-(\d+)\/(\d+|\*)/);
        const completo = !m || (m[3] !== '*' && Number(m[2]) + 1 >= Number(m[3]));
        log({ subida: 'parte', range });
        if (!completo) { res.writeHead(308, { range: `bytes=0-${m[2]}` }); return res.end(); }
        const datos = Buffer.concat(uploads.get(id));
        files.set(id, { id, name: 'Untitled', mimeType: 'application/octet-stream', parents: ['root'], trashed: false, size: datos.length, sha: crypto.createHash('sha256').update(datos).digest('hex') });
        return responder(res, 200, { kind: 'drive#file', id, name: 'Untitled' });
      }
      if (p === '/upload/drive/v3/files' && req.method === 'POST') {
        // multipart (archivos pequeños)
        const id = nuevoId();
        const txt = body.toString('latin1');
        const meta = JSON.parse((txt.match(/\{[^]*?\}\r?\n/) || ['{}'])[0]);
        files.set(id, { id, name: meta.name || 'Untitled', mimeType: 'application/octet-stream', parents: meta.parents || ['root'], trashed: false, size: body.length });
        log({ subida: 'multipart', meta }); return responder(res, 200, { kind: 'drive#file', id, name: meta.name });
      }
      let m;
      if ((m = p.match(/^\/drive\/v3\/files\/([^/]+)$/))) {
        const f = files.get(m[1]);
        if (!f) { log({ error: 'no existe' }); return responder(res, 404, { error: { code: 404, message: 'File not found' } }); }
        if (req.method === 'PATCH') {
          const b = body.length ? JSON.parse(body) : {};
          Object.assign(f, b);
          const add = u.searchParams.get('addParents'); const rem = u.searchParams.get('removeParents');
          if (add) f.parents = [...(f.parents || []).filter((x) => !(rem || '').split(',').includes(x)), ...add.split(',')];
          log({ patch: b }); return responder(res, 200, f);
        }
        if (req.method === 'DELETE') { files.delete(m[1]); log({ borrado_definitivo: f.name }); res.writeHead(204); return res.end(); }
        if (req.method === 'GET') { log({}); return responder(res, 200, f); }
      }

      // ── Sheets ──
      if ((m = p.match(/^\/v4\/spreadsheets\/([^/]+)$/)) && req.method === 'GET') {
        log({}); return responder(res, 200, { spreadsheetId: m[1], properties: { title: 'log' }, sheets: [{ properties: { sheetId: 0, title: 'log', index: 0, gridProperties: { rowCount: 1000, columnCount: 26 } } }] });
      }
      if ((m = p.match(/^\/v4\/spreadsheets\/([^/]+)\/values\/(.+):append$/))) {
        const b = JSON.parse(body); for (const fila of b.values) filas.push(fila);
        log({ append: b.values }); return responder(res, 200, { updates: { updatedRows: b.values.length } });
      }
      if ((m = p.match(/^\/v4\/spreadsheets\/([^/]+)\/values\/(.+)$/)) && req.method === 'PUT') {
        const b = JSON.parse(body); for (const fila of b.values) filas.push(fila);
        log({ put: b.values }); return responder(res, 200, { updatedRows: b.values.length });
      }
      if ((m = p.match(/^\/v4\/spreadsheets\/([^/]+)\/values\/(.+)$/)) && req.method === 'GET') {
        log({}); return responder(res, 200, { range: decodeURIComponent(m[2]), majorDimension: 'ROWS', values: filas });
      }
      if ((m = p.match(/^\/v4\/spreadsheets\/([^/]+)\/values:batchGet$/))) {
        log({}); return responder(res, 200, { valueRanges: [{ values: filas }] });
      }
      if ((m = p.match(/^\/v4\/spreadsheets\/([^/]+):batchUpdate$/))) { log({ batch: JSON.parse(body) }); return responder(res, 200, { replies: [] }); }
      if ((m = p.match(/^\/v4\/spreadsheets\/([^/]+)\/values:batchUpdate$/))) {
        const b = JSON.parse(body); log({ vbatch: b }); return responder(res, 200, {});
      }

      // ── Gmail ──
      if (p === '/gmail/v1/users/me/messages/send') {
        const raw = Buffer.from(JSON.parse(body).raw, 'base64url').toString('utf8');
        correos.push(raw); log({ correo: raw.slice(0, 200) });
        return responder(res, 200, { id: 'M' + correos.length, labelIds: ['SENT'] });
      }
      if (p === '/gmail/v1/users/me/labels') { log({}); return responder(res, 200, { labels: [] }); }
      if (p === '/gmail/v1/users/me/profile') { log({}); return responder(res, 200, { emailAddress: 'prueba@example.com' }); }

      log({ error: 'sin ruta' });
      responder(res, 404, { error: { code: 404, message: 'mock: ruta no simulada ' + req.method + ' ' + p } });
    } catch (e) {
      log({ excepcion: e.message });
      responder(res, 400, { error: { code: 400, message: e.message } });
    }
  });
});
srv.listen(443, () => console.log('mock listo'));
