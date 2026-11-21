// Genera n8n/pg-backup-workflow.json (n8n 2.x, sin credenciales):  node n8n/generar-workflow.mjs n8n/pg-backup-workflow.json
// Si editas el workflow en n8n y lo exportas, puedes reemplazar el JSON directamente; este script es la fuente "legible".
import { writeFileSync } from 'node:fs';

const out = process.argv[2];
let n = 0;
const uid = () => `a${(++n).toString().padStart(3, '0')}-pgb`;
const rl = (mode, value) => ({ __rl: true, mode, value });
const cfg = (k) => `$('Config').first(0).json.${k}`;

const nodes = [];
const conns = {};
function node(name, type, typeVersion, position, parameters, extra = {}) {
  nodes.push({ id: uid(), name, type, typeVersion, position, parameters, ...extra });
  return name;
}
function link(from, to, output = 0) {
  conns[from] ??= { main: [] };
  while (conns[from].main.length <= output) conns[from].main.push([]);
  conns[from].main[output].push({ node: to, type: 'main', index: 0 });
}
const onErr = { onError: 'continueErrorOutput' };

// ── Disparadores y configuración ─────────────────────────────────────────────
node('Programado (domingo 02:00)', 'n8n-nodes-base.scheduleTrigger', 1.2, [0, 0], {
  rule: { interval: [{ field: 'cronExpression', expression: '0 2 * * 0' }] },
});
node('Error Trigger', 'n8n-nodes-base.errorTrigger', 1, [0, 400], {});

const asign = (name, value, type) => ({ id: uid(), name, value, type });
node('Config', 'n8n-nodes-base.set', 3.4, [240, 160], {
  assignments: {
    assignments: [
      asign('cliente', 'ARTESA', 'string'),
      asign('db', 'artesa-db', 'string'),
      asign('servicio_url', 'http://PROYECTO_pg-backup-artesa:8080', 'string'),
      asign('carpeta_respaldos_id', 'CAMBIAR_ID_CARPETA_RESPALDOS', 'string'),
      asign('retener', 8, 'number'),
      asign('hoja_log_id', 'CAMBIAR_ID_HOJA_DE_CALCULO', 'string'),
      asign('hoja_log_pestana', 'log', 'string'),
      asign('correo_alerta', 'CAMBIAR@ejemplo.com', 'string'),
      asign('exigir_cifrado', true, 'boolean'),
      asign('tamano_minimo_bytes', 1024, 'number'),
      asign('timeout_ms', 2400000, 'number'),
    ],
  },
  options: {},
});
link('Programado (domingo 02:00)', 'Config');
link('Error Trigger', 'Config');

node('¿Viene de un error?', 'n8n-nodes-base.if', 2.2, [460, 160], {
  conditions: {
    options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
    conditions: [{
      id: uid(),
      leftValue: "={{ $('Error Trigger').isExecuted }}",
      rightValue: '',
      operator: { type: 'boolean', operation: 'true', singleValue: true },
    }],
    combinator: 'and',
  },
  options: {},
});
link('Config', '¿Viene de un error?');

// ── Respaldo ────────────────────────────────────────────────────────────────
node('Pedir respaldo', 'n8n-nodes-base.httpRequest', 4.2, [700, 0], {
  method: 'POST',
  url: '={{ $json.servicio_url }}/backup',
  authentication: 'genericCredentialType',
  genericAuthType: 'httpBearerAuth',
  options: {
    timeout: '={{ $json.timeout_ms }}',
    response: { response: { fullResponse: true, neverError: true, responseFormat: 'file', outputPropertyName: 'data' } },
  },
}, { ...onErr, retryOnFail: false });
link('¿Viene de un error?', 'Pedir respaldo', 1);

const revisar = String.raw`// 1.ª revisión: ¿respondió bien pg-backup? Si no, saca el detalle del JSON de error.
const r = $input.first();
const status = Number(r.json.statusCode);
if (status !== 200) {
  let detalle = r.json.statusMessage || 'respuesta sin detalle';
  try {
    const buf = await this.helpers.getBinaryDataBuffer(0, 'data');
    const j = JSON.parse(buf.toString('utf8').slice(0, 4000));
    if (j.error) detalle = j.error + (j.etapa ? ' (etapa: ' + j.etapa + ')' : '');
  } catch (e) {}
  throw new Error('pg-backup respondió HTTP ' + status + ': ' + detalle);
}
if (!r.binary || !r.binary.data) throw new Error('pg-backup respondió 200 pero sin archivo');
return $input.all();`;
node('Revisar respuesta', 'n8n-nodes-base.code', 2, [920, 0], { jsCode: revisar }, onErr);
link('Pedir respaldo', 'Revisar respuesta');

node('Calcular SHA-256', 'n8n-nodes-base.crypto', 1, [1140, 0], {
  action: 'hash',
  type: 'SHA256',
  binaryData: true,
  binaryPropertyName: 'data',
  dataPropertyName: 'sha256_n8n',
  encoding: 'hex',
}, onErr);
link('Revisar respuesta', 'Calcular SHA-256');

const validar = String.raw`// 2.ª revisión: nombre, cifrado, tamaño, SHA-256 e índice. Cualquier problema → rama de alerta.
const cfg = $('Config').first(0).json;
const resp = $('Pedir respaldo').first(0);
const h = resp.json.headers || {};
const sha256_n8n = $input.first().json.sha256_n8n;

const esc = (s) => String(s).replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
const archivo = h['x-backup-filename'] || '';
const patron = new RegExp('^' + esc(cfg.cliente) + '_' + esc(cfg.db) + '_\\d{4}-\\d{2}-\\d{2}_\\d{4}\\.dump(\\.age)?$');
if (!patron.test(archivo)) throw new Error('Nombre de archivo inesperado: "' + archivo + '"');

const cifrado = archivo.endsWith('.age') && h['x-backup-encrypted'] === 'true';
if (cfg.exigir_cifrado && !cifrado) {
  throw new Error('El respaldo llegó SIN cifrar y exigir_cifrado está activo: configura AGE_RECIPIENT en pg-backup.');
}

const tamano = Number(h['x-backup-size']);
if (!Number.isFinite(tamano) || tamano < Number(cfg.tamano_minimo_bytes || 1)) {
  throw new Error('Tamaño sospechoso: ' + h['x-backup-size'] + ' bytes');
}
if (h['content-length'] && Number(h['content-length']) !== tamano) {
  throw new Error('Content-Length (' + h['content-length'] + ') no coincide con X-Backup-Size (' + tamano + ')');
}

const sha = String(h['x-backup-sha256'] || '').toLowerCase();
if (!/^[0-9a-f]{64}$/.test(sha)) throw new Error('Falta o es inválido X-Backup-Sha256');
if (sha256_n8n !== sha) {
  throw new Error('SHA-256 no coincide: el servicio dice ' + sha + ' y n8n recibió ' + sha256_n8n + ' (transferencia corrupta)');
}

const toc = Number(h['x-backup-toc-entries'] || 0);
if (!(toc > 0)) throw new Error('El respaldo no tiene entradas en el índice (pg_restore --list)');

return [{
  json: {
    archivo,
    tamano_bytes: tamano,
    sha256: sha,
    duracion_ms: Number(h['x-backup-duration-ms'] || 0),
    cifrado,
    toc_entradas: toc,
    servidor: h['x-backup-server-version'] || '',
    pg_dump: h['x-backup-pg-dump-version'] || '',
    inicio: h['x-backup-started-at'] || '',
  },
  // El nodo Crypto no conserva el binario: se toma el archivo de la respuesta original.
  binary: resp.binary,
}];`;
node('Validar respaldo', 'n8n-nodes-base.code', 2, [1360, 0], { jsCode: validar }, onErr);
link('Calcular SHA-256', 'Validar respaldo');

// ── Carpetas Respaldos/{CLIENTE}/{DB_NAME} (buscar o crear) ──────────────────
function carpeta(prefijo, x, nombreExpr, padreExpr, desde) {
  const buscar = `Buscar carpeta ${prefijo}`;
  const existe = `¿Existe carpeta ${prefijo}?`;
  const crear = `Crear carpeta ${prefijo}`;
  const fija = `Carpeta ${prefijo}`;
  // HTTP Request contra la API de Drive (con la misma credencial de Google Drive): siempre devuelve
  // un ítem { files: [...] }, haya o no resultados. El nodo Drive no devuelve nada si no encuentra, y con
  // alwaysOutputData emitiría un ítem vacío también cuando falla (crearía carpetas duplicadas).
  node(buscar, 'n8n-nodes-base.httpRequest', 4.2, [x, 0], {
    url: 'https://www.googleapis.com/drive/v3/files',
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'googleDriveOAuth2Api',
    sendQuery: true,
    queryParameters: { parameters: [
      { name: 'q', value: `=name = '{{ ${nombreExpr} }}' and mimeType = 'application/vnd.google-apps.folder' and '{{ ${padreExpr} }}' in parents and trashed = false` },
      { name: 'fields', value: 'files(id,name)' },
      { name: 'pageSize', value: '10' },
      { name: 'supportsAllDrives', value: 'true' },
      { name: 'includeItemsFromAllDrives', value: 'true' },
      { name: 'corpora', value: 'allDrives' },
    ] },
    options: {},
  }, onErr);
  link(desde, buscar);
  node(existe, 'n8n-nodes-base.if', 2.2, [x + 220, 0], {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: uid(), leftValue: '={{ ($json.files || []).length }}', rightValue: 0, operator: { type: 'number', operation: 'gt' } }],
      combinator: 'and',
    },
    options: {},
  });
  link(buscar, existe);
  node(crear, 'n8n-nodes-base.googleDrive', 3, [x + 440, 120], {
    resource: 'folder',
    name: `={{ ${nombreExpr} }}`,
    driveId: rl('list', 'My Drive'),
    folderId: rl('id', `={{ ${padreExpr} }}`),
    options: {},
  }, onErr);
  link(existe, crear, 1);
  node(fija, 'n8n-nodes-base.set', 3.4, [x + 660, 0], {
    assignments: { assignments: [{ id: uid(), name: 'carpeta_id', value: '={{ $json.files ? $json.files[0].id : $json.id }}', type: 'string' }] },
    options: {},
  }, { executeOnce: true });
  link(existe, fija, 0);
  link(crear, fija);
  return { buscar, crear, fija };
}
const cCli = carpeta('cliente', 1580, cfg('cliente'), cfg('carpeta_respaldos_id'), 'Validar respaldo');
const cDb = carpeta('base', 2460, cfg('db'), "$('Carpeta cliente').first(0).json.carpeta_id", cCli.fija);

// ── Subida ──────────────────────────────────────────────────────────────────
node('Preparar subida', 'n8n-nodes-base.code', 2, [3340, 0], {
  jsCode: String.raw`// Recupera el archivo validado (los nodos de Drive no conservan el binario).
const v = $('Validar respaldo').first(0);
return [{ json: { ...v.json, carpeta_db_id: $input.first().json.carpeta_id }, binary: v.binary }];`,
}, onErr);
link(cDb.fija, 'Preparar subida');

node('Subir a Drive', 'n8n-nodes-base.googleDrive', 3, [3560, 0], {
  name: '={{ $json.archivo }}',
  driveId: rl('list', 'My Drive'),
  folderId: rl('id', '={{ $json.carpeta_db_id }}'),
  inputDataFieldName: 'data',
  options: {},
}, onErr);
link('Preparar subida', 'Subir a Drive');

// ── Registro en Google Sheets ───────────────────────────────────────────────
const columnas = ['fecha', 'cliente', 'base', 'archivo', 'tamaño_bytes', 'sha256', 'duración_ms', 'estado', 'detalle'];
const hoja = (valores) => ({
  resource: 'sheet',
  operation: 'append',
  documentId: rl('id', `={{ ${cfg('hoja_log_id')} }}`),
  sheetName: rl('name', `={{ ${cfg('hoja_log_pestana')} }}`),
  columns: {
    mappingMode: 'defineBelow',
    value: valores,
    matchingColumns: [],
    schema: columnas.map((c) => ({ id: c, displayName: c, required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true })),
    attemptToConvertTypes: false,
    convertFieldsToString: true,
  },
  options: {},
});
const v = (k) => `={{ $('Validar respaldo').first(0).json.${k} }}`;
node('Registrar OK', 'n8n-nodes-base.googleSheets', 4.7, [3560, -120], hoja({
  fecha: "={{ $now.setZone('America/Guayaquil').toFormat('yyyy-MM-dd HH:mm:ss') }}",
  cliente: `={{ ${cfg('cliente')} }}`,
  base: `={{ ${cfg('db')} }}`,
  archivo: v('archivo'),
  'tamaño_bytes': v('tamano_bytes'),
  sha256: v('sha256'),
  'duración_ms': v('duracion_ms'),
  estado: 'ok',
  detalle: "={{ 'Drive id ' + $('Subir a Drive').first(0).json.id + ' · ' + ($('Validar respaldo').first(0).json.cifrado ? 'cifrado age' : 'SIN cifrar') + ' · ' + $('Validar respaldo').first(0).json.toc_entradas + ' objetos · PostgreSQL ' + $('Validar respaldo').first(0).json.servidor }}",
}), onErr);
link('Subir a Drive', 'Registrar OK');

// ── Retención ───────────────────────────────────────────────────────────────
node('Listar respaldos', 'n8n-nodes-base.googleDrive', 3, [3560, 120], {
  resource: 'fileFolder',
  searchMethod: 'query',
  queryString: 'trashed = false',
  returnAll: true,
  filter: { folderId: rl('id', "={{ $('Preparar subida').first(0).json.carpeta_db_id }}"), whatToSearch: 'files' },
  options: { fields: ['id', 'name'] },
}, onErr);
link('Subir a Drive', 'Listar respaldos');

node('Elegir los que sobran', 'n8n-nodes-base.code', 2, [3780, 120], {
  jsCode: String.raw`// Conserva los últimos N respaldos de ESTA base y manda el resto a la papelera de Drive.
// Solo toca archivos con el nombre exacto que genera pg-backup; nunca el recién subido.
const cfg = $('Config').first(0).json;
const nuevo = $('Validar respaldo').first(0).json.archivo;
const retener = Number(cfg.retener);
if (!Number.isInteger(retener) || retener < 1) throw new Error('retener debe ser un entero >= 1 (vale ' + cfg.retener + ')');

const esc = (s) => String(s).replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
const patron = new RegExp('^' + esc(cfg.cliente) + '_' + esc(cfg.db) + '_\\d{4}-\\d{2}-\\d{2}_\\d{4}\\.dump(\\.age)?$');
const respaldos = $input.all().map((i) => i.json).filter((f) => f && f.id && patron.test(f.name || ''));

if (!respaldos.some((f) => f.name === nuevo)) {
  throw new Error('El respaldo recién subido (' + nuevo + ') no aparece en la carpeta; por seguridad no se borra nada.');
}
// El nombre lleva la fecha (YYYY-MM-DD_HHmm): el orden alfabético es el cronológico.
respaldos.sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
return respaldos.slice(retener).filter((f) => f.name !== nuevo).map((f) => ({ json: { id: f.id, name: f.name } }));`,
}, onErr);
link('Listar respaldos', 'Elegir los que sobran');

node('Enviar a papelera', 'n8n-nodes-base.googleDrive', 3, [4000, 120], {
  operation: 'deleteFile',
  fileId: rl('id', '={{ $json.id }}'),
  options: { deletePermanently: false },
}, onErr);
link('Elegir los que sobran', 'Enviar a papelera');

// ── Alertas ─────────────────────────────────────────────────────────────────
node('Preparar alerta', 'n8n-nodes-base.code', 2, [2240, 520], {
  jsCode: String.raw`// Junta el detalle del fallo, venga de la salida de error de un nodo o del Error Trigger.
const cfg = $('Config').first(0).json;
const ahora = $now.setZone('America/Guayaquil').toFormat('yyyy-MM-dd HH:mm:ss');
let nodo = '', mensaje = '', ejecucion = $execution.id, enlace = '';

if ($('Error Trigger').isExecuted) {
  const t = $('Error Trigger').first(0).json;
  nodo = (t.execution && t.execution.lastNodeExecuted) || (t.trigger && 'disparador') || '?';
  mensaje = (t.execution && t.execution.error && t.execution.error.message) || (t.trigger && t.trigger.error && t.trigger.error.message) || 'sin mensaje';
  ejecucion = (t.execution && t.execution.id) || '';
  enlace = (t.execution && t.execution.url) || '';
} else {
  const e = $input.first().json || {};
  nodo = (typeof $prevNode !== 'undefined' && $prevNode.name) || '?';
  const err = e.error;
  mensaje = typeof err === 'string' ? err : (err && (err.message || err.description)) || e.message || JSON.stringify(e).slice(0, 1500);
  if (err && err.description && err.message && err.description !== err.message) mensaje += ' — ' + err.description;
}

let previo = {};

try { previo = $('Validar respaldo').first(0).json; } catch (e) { }

const lineas = [
  'Falló el respaldo programado de ' + cfg.cliente + ' / ' + cfg.db + '.',
  '',
  'Fecha (Guayaquil): ' + ahora,
  'Paso que falló:    ' + nodo,
  'Error:             ' + mensaje,
  'Ejecución n8n:     ' + ejecucion + (enlace ? ' (' + enlace + ')' : ''),
];
if (previo.archivo) lineas.push('Archivo generado:  ' + previo.archivo + ' (' + previo.tamano_bytes + ' bytes, sha256 ' + previo.sha256 + ')');
lineas.push('', 'Qué revisar: el README de pg-backup, sección "Diagnóstico". Mientras no se corrija,', 'el último respaldo bueno sigue en Drive (no se borra nada cuando falla).');

return [{ json: {
  fecha: ahora, nodo, mensaje, ejecucion,
  archivo: previo.archivo || '', tamano_bytes: previo.tamano_bytes || '', sha256: previo.sha256 || '', duracion_ms: previo.duracion_ms || '',
  asunto: '[pg-backup] FALLÓ respaldo ' + cfg.cliente + '/' + cfg.db + ' — ' + nodo,
  cuerpo: lineas.join('\n'),
} }];`,
});
link('¿Viene de un error?', 'Preparar alerta', 0);
for (const origen of ['Pedir respaldo', 'Revisar respuesta', 'Calcular SHA-256', 'Validar respaldo', cCli.buscar, cCli.crear, cDb.buscar, cDb.crear,
  'Preparar subida', 'Subir a Drive', 'Registrar OK', 'Listar respaldos', 'Elegir los que sobran', 'Enviar a papelera']) {
  link(origen, 'Preparar alerta', 1);
}

node('Enviar alerta (Gmail)', 'n8n-nodes-base.gmail', 2.1, [2460, 440], {
  sendTo: `={{ ${cfg('correo_alerta')} }}`,
  subject: '={{ $json.asunto }}',
  emailType: 'text',
  message: '={{ $json.cuerpo }}',
  options: { appendAttribution: false },
}, { onError: 'continueRegularOutput' });
link('Preparar alerta', 'Enviar alerta (Gmail)');

node('Registrar error', 'n8n-nodes-base.googleSheets', 4.7, [2460, 640], hoja({
  fecha: "={{ $('Preparar alerta').first(0).json.fecha }}",
  cliente: `={{ ${cfg('cliente')} }}`,
  base: `={{ ${cfg('db')} }}`,
  archivo: "={{ $('Preparar alerta').first(0).json.archivo }}",
  'tamaño_bytes': "={{ $('Preparar alerta').first(0).json.tamano_bytes }}",
  sha256: "={{ $('Preparar alerta').first(0).json.sha256 }}",
  'duración_ms': "={{ $('Preparar alerta').first(0).json.duracion_ms }}",
  estado: 'error',
  detalle: "={{ $('Preparar alerta').first(0).json.nodo + ': ' + $('Preparar alerta').first(0).json.mensaje }}",
}), { onError: 'continueRegularOutput' });
link('Preparar alerta', 'Registrar error');

// ── Notas en el lienzo ──────────────────────────────────────────────────────
node('Nota', 'n8n-nodes-base.stickyNote', 1, [-40, -420], {
  width: 700, height: 360, color: 5,
  content: [
    '## pg-backup → Google Drive',
    'Antes de activar (README, sección n8n):',
    '1. **Config**: cliente, db, servicio_url (nombre interno de EasyPanel), IDs de carpeta y hoja, correo.',
    '2. **Pedir respaldo**: credencial *Bearer Auth* con el BACKUP_TOKEN (no va en este JSON).',
    '3. Nodos de Drive, Sheets y Gmail: elige tus credenciales.',
    '4. Settings → Error workflow → **este mismo workflow** (cubre fallos sin salida de error).',
    '5. Horario: nodo *Programado* (cron) — zona horaria del workflow: America/Guayaquil.',
    '',
    'Si algo falla no se borra ningún respaldo y llega un correo con el detalle.',
  ].join('\n'),
});

const wf = {
  name: 'pg-backup · ARTESA / artesa-db → Google Drive',
  nodes,
  connections: conns,
  settings: {
    executionOrder: 'v1',
    timezone: 'America/Guayaquil',
    saveDataErrorExecution: 'all',
    saveDataSuccessExecution: 'none',
    saveManualExecutions: true,
    executionTimeout: 3600,
    callerPolicy: 'workflowsFromSameOwner',
  },
  pinData: {},
  active: false,
  tags: [],
};
writeFileSync(out, JSON.stringify(wf, null, 2) + '\n');
console.log('nodos:', nodes.length);
