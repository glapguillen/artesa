#!/usr/bin/env bash
# Prueba de punta a punta de pg-backup con docker-compose.test.yml:
#   autenticación (401) · /check · respaldo cifrado · cabeceras y SHA-256 · un respaldo a la vez
#   (409) · timeout (504) · error de conexión sin secretos · temporales borrados · descifrado ·
#   restauración en otra base · conteo de filas y huella de datos por tabla · logs sin secretos.
#
# Uso: test/e2e.sh            (necesita docker, openssl, age, curl y sha256sum en el equipo)
set -euo pipefail
cd "$(dirname "$0")/.."

TMP=test/.tmp
COMPOSE="docker compose -f docker-compose.test.yml"
URL=http://127.0.0.1:18080
URL_MAL=http://127.0.0.1:18081
FALLOS=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
mal()  { printf '  \033[31m✗\033[0m %s\n' "$1"; FALLOS=$((FALLOS + 1)); }
paso() { printf '\n\033[1m%s\033[0m\n' "$1"; }
comprobar() { if eval "$2"; then ok "$1"; else mal "$1"; fi; }
# Al recrear pg-backup se pierden sus logs: se van acumulando aquí para revisarlos al final.
guardar_logs() { $COMPOSE logs --no-color pg-backup >>"$TMP/logs.txt" 2>&1 || true; }

limpiar() {
  [ "${CONSERVAR:-0}" = 1 ] && return
  $COMPOSE down -v --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap limpiar EXIT

paso "Preparación (certificados, clave age y token solo para esta prueba)"
rm -rf "$TMP" && mkdir -p "$TMP/certs"
openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=origen" \
  -keyout "$TMP/certs/server.key" -out "$TMP/certs/server.crt" 2>/dev/null
# El servidor de Postgres de la imagen corre como uid 70 y exige 0600 en la clave.
chmod 600 "$TMP/certs/server.key"
docker run --rm -v "$PWD/$TMP/certs:/c" --entrypoint sh postgres:${PG_MAJOR:-17}-alpine -c 'chown 70:70 /c/server.key' >/dev/null
age-keygen -o "$TMP/clave.age" 2>/dev/null
export AGE_RECIPIENT; AGE_RECIPIENT=$(age-keygen -y "$TMP/clave.age")
export BACKUP_TOKEN; BACKUP_TOKEN=$(openssl rand -hex 32)
ok "listo"

paso "Construir la imagen y levantar origen (SSL), destino y pg-backup"
# DOCKER_BUILD_ARGS: solo si construyes detrás de un proxy (p. ej. --network=host --secret id=ca,src=ca.crt).
# shellcheck disable=SC2086
docker build -q ${DOCKER_BUILD_ARGS:-} --build-arg PG_MAJOR="${PG_MAJOR:-17}" -t "pg-backup:${PG_MAJOR:-17}" . >"$TMP/build.log" 2>&1 || { cat "$TMP/build.log"; exit 1; }
ok "imagen pg-backup:${PG_MAJOR:-17}"
$COMPOSE up -d --no-build --wait origen destino pg-backup pg-backup-mal >"$TMP/compose.log" 2>&1 || { cat "$TMP/compose.log"; exit 1; }
for i in $(seq 1 30); do curl -fs "$URL/health" >/dev/null && break; sleep 1; done
SALUD=$(curl -fs "$URL/health")
comprobar "/health responde sin token y no expone secretos" "grep -q '\"status\":\"ok\"' <<<'$SALUD' && ! grep -q '$BACKUP_TOKEN' <<<'$SALUD'"
comprobar "/health indica cifrado activo" "grep -q '\"cifrado\":true' <<<'$SALUD'"

paso "Autenticación"
codigo() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
comprobar "POST /backup sin token → 401" "[ \"\$(codigo -X POST $URL/backup)\" = 401 ]"
comprobar "POST /backup con token incorrecto → 401" "[ \"\$(codigo -X POST -H 'Authorization: Bearer token-equivocado' $URL/backup)\" = 401 ]"
comprobar "POST /backup con otro esquema (Basic) → 401" "[ \"\$(codigo -X POST -H \"Authorization: Basic $BACKUP_TOKEN\" $URL/backup)\" = 401 ]"
comprobar "GET /backup con token → 405" "[ \"\$(codigo -H \"Authorization: Bearer $BACKUP_TOKEN\" $URL/backup)\" = 405 ]"
comprobar "/check sin token → 401" "[ \"\$(codigo $URL/check)\" = 401 ]"

paso "/check: versión del servidor frente a pg_dump"
CHECK=$(curl -fs -H "Authorization: Bearer $BACKUP_TOKEN" "$URL/check")
echo "    $CHECK"
comprobar "compatible y mismo major" "grep -q '\"compatible\":true' <<<'$CHECK' && grep -q '\"mismo_major\":true' <<<'$CHECK'"

paso "Respaldo cifrado"
curl -fs -X POST -H "Authorization: Bearer $BACKUP_TOKEN" -D "$TMP/cabeceras.txt" -o "$TMP/respaldo.bin" "$URL/backup"
cab() { grep -i "^$1:" "$TMP/cabeceras.txt" | head -1 | cut -d' ' -f2- | tr -d '\r'; }
ARCHIVO=$(cab X-Backup-Filename); TAMANO=$(cab X-Backup-Size); SHA=$(cab X-Backup-Sha256)
echo "    archivo=$ARCHIVO tamaño=$TAMANO duración=$(cab X-Backup-Duration-Ms) ms entradas=$(cab X-Backup-Toc-Entries) servidor=$(cab X-Backup-Server-Version)"
comprobar "nombre {cliente}_{db}_{YYYY-MM-DD_HHmm}.dump.age" "[[ '$ARCHIVO' =~ ^ARTESA_artesa-db_[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{4}\.dump\.age$ ]]"
comprobar "Content-Disposition trae el nombre" "grep -qi 'content-disposition: attachment; filename=\"$ARCHIVO\"' '$TMP/cabeceras.txt'"
comprobar "tamaño recibido = X-Backup-Size" "[ \"\$(stat -c %s '$TMP/respaldo.bin')\" = '$TAMANO' ]"
comprobar "SHA-256 recibido = X-Backup-Sha256" "[ \"\$(sha256sum '$TMP/respaldo.bin' | cut -d' ' -f1)\" = '$SHA' ]"
comprobar "el archivo está cifrado con age" "head -c 40 '$TMP/respaldo.bin' | grep -q 'age-encryption.org/v1'"
comprobar "temporales borrados tras el respaldo" "[ -z \"\$($COMPOSE exec -T pg-backup ls -A /tmp/pg-backup)\" ]"

paso "Un respaldo a la vez (409) y timeout (504)"
# Un bloqueo exclusivo en el origen hace esperar a pg_dump (pg_dump solo pide ACCESS SHARE).
bloquear() { $COMPOSE exec -T origen psql -U postgres -d artesa -q -c "BEGIN; LOCK TABLE registros IN ACCESS EXCLUSIVE MODE; SELECT pg_sleep($1); COMMIT;" >/dev/null 2>&1 & }
bloquear 8; sleep 1
curl -s -X POST -H "Authorization: Bearer $BACKUP_TOKEN" -o /dev/null -w '%{http_code}' "$URL/backup" >"$TMP/primero.txt" &
PRIMERO=$!; sleep 2
comprobar "un segundo respaldo simultáneo → 409" "[ \"\$(codigo -X POST -H \"Authorization: Bearer $BACKUP_TOKEN\" $URL/backup)\" = 409 ]"
comprobar "/health marca respaldo_en_curso" "curl -fs $URL/health | grep -q '\"respaldo_en_curso\":true'"
wait $PRIMERO
comprobar "el primero termina bien al soltar el bloqueo → 200" "[ \"\$(cat '$TMP/primero.txt')\" = 200 ]"

guardar_logs
DUMP_TIMEOUT_SEC=10 $COMPOSE up -d --wait pg-backup >/dev/null 2>&1
for i in $(seq 1 20); do curl -fs "$URL/health" >/dev/null && break; sleep 1; done
bloquear 25; sleep 1
RES=$(curl -s -X POST -H "Authorization: Bearer $BACKUP_TOKEN" -w '\n%{http_code}' "$URL/backup")
echo "    $(head -1 <<<"$RES") → $(tail -1 <<<"$RES")"
comprobar "timeout de 10 s → 504 con JSON" "[ \"\$(tail -1 <<<'$RES')\" = 504 ] && grep -q '\"error\"' <<<'$RES'"
comprobar "temporales borrados tras el timeout" "[ -z \"\$($COMPOSE exec -T pg-backup ls -A /tmp/pg-backup)\" ]"
wait
guardar_logs
$COMPOSE up -d --wait pg-backup >/dev/null 2>&1
for i in $(seq 1 20); do curl -fs "$URL/health" >/dev/null && break; sleep 1; done

paso "Sin AGE_RECIPIENT: respaldo en claro (.dump)"
guardar_logs
AGE_RECIPIENT= $COMPOSE up -d --wait pg-backup >/dev/null 2>&1
for i in $(seq 1 20); do curl -fs "$URL/health" >/dev/null && break; sleep 1; done
curl -fs -X POST -H "Authorization: Bearer $BACKUP_TOKEN" -D "$TMP/cab-claro.txt" -o "$TMP/claro.dump" "$URL/backup"
comprobar "nombre termina en .dump y X-Backup-Encrypted: false" "grep -qiE 'x-backup-filename: .*[0-9]\.dump' '$TMP/cab-claro.txt' && grep -qi 'x-backup-encrypted: false' '$TMP/cab-claro.txt'"
comprobar "el archivo es un dump custom de PostgreSQL" "head -c 5 '$TMP/claro.dump' | grep -q PGDMP"
guardar_logs
$COMPOSE up -d --wait pg-backup >/dev/null 2>&1
for i in $(seq 1 20); do curl -fs "$URL/health" >/dev/null && break; sleep 1; done

paso "Error de conexión: JSON claro y sin secretos"
RES=$(curl -s -X POST -H "Authorization: Bearer $BACKUP_TOKEN" -w '\n%{http_code}' "$URL_MAL/backup")
echo "    $(head -1 <<<"$RES") → $(tail -1 <<<"$RES")"
comprobar "contraseña errónea → 502 con etapa 'conexion'" "[ \"\$(tail -1 <<<'$RES')\" = 502 ] && grep -q '\"etapa\":\"conexion\"' <<<'$RES'"
comprobar "la respuesta no contiene la contraseña" "! grep -q 'clave-equivocada-123' <<<'$RES'"

paso "Restauración en otra base y comparación"
age -d -i "$TMP/clave.age" -o "$TMP/respaldo.dump" "$TMP/respaldo.bin"
comprobar "se descifra con la clave privada" "pg_restore --list '$TMP/respaldo.dump' >/dev/null 2>&1 || docker run --rm -v \"\$PWD/$TMP:/t\" --entrypoint pg_restore postgres:${PG_MAJOR:-17}-alpine --list /t/respaldo.dump >/dev/null"
$COMPOSE cp "$TMP/respaldo.dump" destino:/tmp/respaldo.dump >/dev/null
$COMPOSE exec -T destino pg_restore -U postgres -d artesa --no-owner --no-privileges --exit-on-error /tmp/respaldo.dump
ok "pg_restore en la base destino sin errores"

# Por cada tabla: número de filas y una huella del contenido completo (md5 de las filas ordenadas).
HUELLA="SELECT string_agg(format('%s|%s|%s', t, n, h), E'\n' ORDER BY t) FROM (
  SELECT c.relname AS t,
         (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I.%I', n.nspname, c.relname), false, true, '')))[1]::text AS n,
         (xpath('/row/h/text()', query_to_xml(format('SELECT md5(coalesce(string_agg(x::text, %L ORDER BY x::text), %L)) AS h FROM %I.%I x', ',', '', n.nspname, c.relname), false, true, '')))[1]::text AS h
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE c.relkind = 'r' AND n.nspname = 'public') s;"
$COMPOSE exec -T origen  psql -U postgres -d artesa -At -c "$HUELLA" >"$TMP/origen.txt"
$COMPOSE exec -T destino psql -U postgres -d artesa -At -c "$HUELLA" >"$TMP/destino.txt"
echo "    tabla | filas (origen):"; awk -F'|' '{printf "      %-16s %s\n", $1, $2}' "$TMP/origen.txt"
comprobar "mismo número de filas en cada tabla" "diff <(cut -d'|' -f1,2 '$TMP/origen.txt') <(cut -d'|' -f1,2 '$TMP/destino.txt')"
comprobar "mismo contenido en cada tabla (md5 de todas las filas)" "diff '$TMP/origen.txt' '$TMP/destino.txt'"
SEQ="SELECT string_agg(sequencename || '=' || coalesce(last_value::text, 'null'), ',' ORDER BY sequencename) FROM pg_sequences"
comprobar "secuencias con el mismo valor" "[ \"\$($COMPOSE exec -T origen psql -U postgres -d artesa -At -c \"$SEQ\")\" = \"\$($COMPOSE exec -T destino psql -U postgres -d artesa -At -c \"$SEQ\")\" ]"

paso "Logs sin secretos"
guardar_logs
$COMPOSE logs --no-color pg-backup-mal >>"$TMP/logs.txt" 2>&1
for s in "$BACKUP_TOKEN" clave-de-prueba-respaldo clave-equivocada-123 "postgresql://"; do
  comprobar "los logs no contienen '${s:0:12}…'" "! grep -qF -- '$s' '$TMP/logs.txt'"
done
comprobar "los logs registran el respaldo entregado" "grep -q 'respaldo entregado' '$TMP/logs.txt'"

printf '\n'
if [ "$FALLOS" -eq 0 ]; then printf '\033[32mTodas las comprobaciones pasaron.\033[0m\n'; else printf '\033[31m%d comprobación(es) fallaron.\033[0m\n' "$FALLOS"; exit 1; fi
