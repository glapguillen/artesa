#!/usr/bin/env bash
# Prueba el workflow de n8n (n8n/pg-backup-workflow.json) en un n8n 2.x real, contra el pg-backup del
# entorno de prueba y un simulador local de Google Drive / Sheets / Gmail (sin cuentas reales):
#   primera ejecución (crea carpetas, sube, verifica SHA-256, registra) · retención (8 últimos,
#   papelera, no toca otros archivos) · base caída · token incorrecto · Error Trigger.
#
# Uso:  CONSERVAR=1 test/e2e.sh && test/n8n-e2e.sh        (deja levantado el entorno de prueba)
#       N8N_IMAGE=n8nio/n8n:2.48.7 test/n8n-e2e.sh         (versión de n8n; por defecto la de abajo)
set -euo pipefail
cd "$(dirname "$0")/.."

N8N_IMAGE=${N8N_IMAGE:-n8nio/n8n:latest}
RED=pgbackup-test_default
T=test/.tmp/n8n
MOCK=pgbackup-test-gmock
VOL=pgbackup-test-n8n
FALLOS=0
paso() { printf '\n\033[1m%s\033[0m\n' "$1"; }

docker network inspect "$RED" >/dev/null 2>&1 || { echo "Primero levanta el entorno: CONSERVAR=1 test/e2e.sh"; exit 1; }
limpiar() {
  docker rm -f "$MOCK" >/dev/null 2>&1 || true
  docker volume rm -f "$VOL" >/dev/null 2>&1 || true
  [ "${CONSERVAR:-0}" = 1 ] || rm -rf "$T"
}
trap limpiar EXIT
limpiar
mkdir -p "$T" && chmod 777 "$T"

paso "Preparación (certificado del simulador y credenciales de prueba)"
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj "/CN=simulador-ca" -keyout "$T/ca.key" -out "$T/mock-ca.crt" 2>/dev/null
openssl req -newkey rsa:2048 -nodes -subj "/CN=googleapis" -keyout "$T/mock.key" -out "$T/mock.csr" 2>/dev/null
printf 'subjectAltName=DNS:www.googleapis.com,DNS:sheets.googleapis.com,DNS:gmail.googleapis.com,DNS:oauth2.googleapis.com\n' >"$T/san.ext"
openssl x509 -req -in "$T/mock.csr" -CA "$T/mock-ca.crt" -CAkey "$T/ca.key" -CAcreateserial -days 1 -extfile "$T/san.ext" -out "$T/mock.crt" 2>/dev/null
chmod 644 "$T"/*

# El token real de la prueba se lee del contenedor (no se imprime).
TOKEN=$(docker inspect pgbackup-test-pg-backup-1 --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^BACKUP_TOKEN=//p')
[ ${#TOKEN} -ge 32 ] || { echo "No encuentro el BACKUP_TOKEN del contenedor de prueba"; exit 1; }
docker run --rm -e TOKEN="$TOKEN" -v "$PWD/$T:/t" --entrypoint node "$N8N_IMAGE" -e '
const tok = { access_token: "token-falso-de-prueba", token_type: "Bearer", expires_in: 3599, refresh_token: "r", scope: "x" };
const g = (id, type) => ({ id, name: type + " prueba", type, data: { clientId: "x", clientSecret: "y", oauthTokenData: tok } });
require("fs").writeFileSync("/t/credenciales.json", JSON.stringify([
  { id: "credbearer000001", name: "httpBearerAuth prueba", type: "httpBearerAuth", data: { token: process.env.TOKEN } },
  { id: "credbearermalo01", name: "httpBearerAuth malo", type: "httpBearerAuth", data: { token: "token-equivocado-0000000000000000000000" } },
  g("credgdrive000001", "googleDriveOAuth2Api"), g("credgsheet000001", "googleSheetsOAuth2Api"), g("credgmail0000001", "gmailOAuth2"),
]));'
chmod 644 "$T/credenciales.json"

docker run -d --name "$MOCK" --network "$RED" --user root -v "$PWD/test/n8n:/mock:ro" -v "$PWD/$T:/certs:ro" \
  --entrypoint node "$N8N_IMAGE" /mock/mock-google.js >/dev/null
sleep 2
IP=$(docker inspect "$MOCK" --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')
HOSTS=(--add-host "www.googleapis.com:$IP" --add-host "sheets.googleapis.com:$IP" --add-host "gmail.googleapis.com:$IP" --add-host "oauth2.googleapis.com:$IP")

simulador() { # simulador GET /_estado  |  simulador POST /_sembrar '{...}'
  docker exec "$MOCK" node -e '
const [m, p, b] = process.argv.slice(1);
const r = require("https").request({ host: "127.0.0.1", port: 443, path: p, method: m, rejectUnauthorized: false, headers: { "content-type": "application/json" } },
  (s) => { let d = ""; s.on("data", (c) => (d += c)); s.on("end", () => process.stdout.write(d)); });
if (b) r.write(b); r.end();' "$@"
}

ejecutar() { # ejecutar <escenario> '<ajustes Config>' <modo>
  local esc=$1
  simulador GET /_estado >"$T/antes.json"
  docker run --rm -v "$PWD:/repo:ro" -v "$PWD/$T:/t" --entrypoint node "$N8N_IMAGE" /repo/test/n8n/preparar.js \
    /repo/n8n/pg-backup-workflow.json /t/wf.json "$2" "$3"
  docker run --rm --network "$RED" "${HOSTS[@]}" -v "$VOL:/home/node/.n8n" -v "$PWD/$T:/t" \
    -e NODE_EXTRA_CA_CERTS=/t/mock-ca.crt -e N8N_DEFAULT_BINARY_DATA_MODE=filesystem -e N8N_ENCRYPTION_KEY=clave-de-prueba-n8n \
    -e N8N_DIAGNOSTICS_ENABLED=false -e GENERIC_TIMEZONE=America/Guayaquil --entrypoint sh "$N8N_IMAGE" -c '
      [ -f ~/.n8n/.credenciales ] || { n8n import:credentials --input=/t/credenciales.json >/dev/null 2>&1 && touch ~/.n8n/.credenciales; }
      n8n import:workflow --input=/t/wf.json >/dev/null 2>&1
      n8n execute --id=pgbtest000000001 --rawOutput >/t/salida.json 2>/t/n8n-error.log' || { echo "n8n execute falló:"; tail -20 "$T/n8n-error.log"; }
  simulador GET /_estado >"$T/despues.json"
  docker run --rm -v "$PWD:/repo:ro" -v "$PWD/$T:/t" --entrypoint node "$N8N_IMAGE" /repo/test/n8n/comprobar.js \
    "$esc" /t/salida.json /t/despues.json /t/antes.json || FALLOS=$((FALLOS + 1))
}

paso "1. Primera ejecución: crea Respaldos/ARTESA/artesa-db, sube, verifica y registra"
ejecutar primera '{}' normal

paso "2. Retención: 9 respaldos viejos + 3 archivos ajenos en la carpeta → quedan los 8 últimos"
DB_ID=$(simulador GET /_estado | docker run --rm -i --entrypoint node "$N8N_IMAGE" -e '
const e = JSON.parse(require("fs").readFileSync(0)); const c = e.files.find((f) => f.name === "ARTESA");
process.stdout.write(e.files.find((f) => f.name === "artesa-db" && f.parents.includes(c.id)).id);')
NOMBRES=""
for f in 2026-08-02 2026-08-09 2026-08-16 2026-08-23 2026-08-30 2026-09-06 2026-09-13 2026-09-20 2026-09-27; do NOMBRES+="\"ARTESA_artesa-db_${f}_0200.dump.age\","; done
simulador POST /_sembrar "{\"padre\":\"$DB_ID\",\"nombres\":[${NOMBRES}\"LEEME.txt\",\"ARTESA_artesa-db_2026-08-01_0200.dump.age.bak\",\"ARTESA_otra-db_2026-01-01_0200.dump.age\"]}" >/dev/null
sleep 60 # otro minuto: el nombre del respaldo cambia
ejecutar retencion '{}' normal

paso "3. Base inaccesible (contraseña errónea en pg-backup) → alerta con la causa"
ejecutar base-caida '{"servicio_url":"http://pg-backup-mal:8080"}' normal

paso "4. Token incorrecto en la credencial de n8n → alerta HTTP 401"
ejecutar token-malo '{}' token-malo

paso "5. Error Trigger (fallo fuera de los nodos, p. ej. timeout del workflow) → alerta, sin respaldo"
ejecutar errortrigger '{}' errortrigger

echo
if [ "$FALLOS" -eq 0 ]; then printf '\033[32mTodas las comprobaciones del workflow pasaron.\033[0m\n'; else printf '\033[31m%s escenario(s) con fallos.\033[0m\n' "$FALLOS"; exit 1; fi
