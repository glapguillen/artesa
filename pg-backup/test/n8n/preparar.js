// Crea la copia de prueba del workflow: apunta a pg-backup de la red de prueba, asigna credenciales
// de prueba y añade un disparador manual (n8n execute no arranca desde un Schedule Trigger).
// Uso: node preparar.js <workflow.json> <salida.json> '<ajustes de Config en JSON>' [normal|errortrigger|token-malo]
const fs = require('fs');
const [src, dst, ajustesTxt, modo = 'normal'] = process.argv.slice(2);
const ajustes = { servicio_url: 'http://pg-backup:8080', correo_alerta: 'alertas@example.com', carpeta_respaldos_id: 'RESPALDOS', hoja_log_id: 'HOJA1', ...JSON.parse(ajustesTxt || '{}') };
const w = JSON.parse(fs.readFileSync(src, 'utf8'));
w.id = 'pgbtest000000001';

const cred = (tipo, id) => ({ [tipo]: { id, name: tipo + ' prueba' } });
for (const n of w.nodes) {
  if (n.credentials) throw new Error('El workflow publicado no debe traer credenciales (nodo ' + n.name + ')');
  if (n.name === 'Config') for (const a of n.parameters.assignments.assignments) if (a.name in ajustes) a.value = ajustes[a.name];
  if (n.name === 'Pedir respaldo') n.credentials = cred('httpBearerAuth', modo === 'token-malo' ? 'credbearermalo01' : 'credbearer000001');
  else if (n.type === 'n8n-nodes-base.googleDrive' || n.parameters.nodeCredentialType === 'googleDriveOAuth2Api') n.credentials = cred('googleDriveOAuth2Api', 'credgdrive000001');
  else if (n.type === 'n8n-nodes-base.googleSheets') n.credentials = cred('googleSheetsOAuth2Api', 'credgsheet000001');
  else if (n.type === 'n8n-nodes-base.gmail') n.credentials = cred('gmailOAuth2', 'credgmail0000001');
}

w.nodes.push({ id: 'manual-prueba', name: 'Manual', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 200], parameters: {} });
w.connections.Manual = { main: [[{ node: 'Config', type: 'main', index: 0 }]] };

if (modo === 'errortrigger') {
  // Sustituye el Error Trigger por un nodo con el mismo nombre que emite el payload real de n8n.
  const et = w.nodes.find((n) => n.name === 'Error Trigger');
  const payload = {
    execution: { id: '231', url: 'https://n8n.example/workflow/x/executions/231', error: { message: 'Workflow timed out after 3600 seconds' }, lastNodeExecuted: 'Subir a Drive', mode: 'trigger' },
    workflow: { id: w.id, name: w.name },
  };
  Object.assign(et, { type: 'n8n-nodes-base.code', typeVersion: 2, parameters: { jsCode: 'return [{ json: ' + JSON.stringify(payload) + ' }];' } });
  w.connections.Manual = { main: [[{ node: 'Error Trigger', type: 'main', index: 0 }]] };
}
fs.writeFileSync(dst, JSON.stringify(w));
