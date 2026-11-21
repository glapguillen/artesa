#!/usr/bin/env bash
# Restaura un respaldo de pg-backup en una base NUEVA y VACÍA, y muestra las filas por tabla.
#
#   DESTINO_URL='postgresql://usuario:clave@host:5432/base?sslmode=require' \
#     scripts/restaurar.sh ARTESA_artesa-db_2026-11-22_0200.dump.age ~/claves/pg-backup.agekey
#
# Seguridades: se niega si la base destino ya tiene tablas (así nunca pisa la de producción) y pide
# escribir el nombre de la base destino para confirmar (o CONFIRMAR=<nombre> sin preguntar).
# Necesita age, pg_restore y psql con major >= al del respaldo. Todo eso ya viene en la imagen
# pg-backup:  docker run --rm -it -v "$PWD:/w" -w /w -e DESTINO_URL --entrypoint bash pg-backup:17 scripts/restaurar.sh ...
set -euo pipefail

ARCHIVO=${1:?uso: DESTINO_URL=... $0 ARCHIVO.dump[.age] [CLAVE_AGE]}
CLAVE=${2:-}
: "${DESTINO_URL:?define DESTINO_URL con la URL de la base nueva (no se imprime)}"
[ -f "$ARCHIVO" ] || { echo "No existe $ARCHIVO" >&2; exit 1; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
DUMP=$ARCHIVO

if [[ $ARCHIVO == *.age ]]; then
  [ -n "$CLAVE" ] && [ -f "$CLAVE" ] || { echo "El archivo está cifrado: indica la clave privada age como segundo argumento" >&2; exit 1; }
  echo "→ Descifrando con age…"
  age -d -i "$CLAVE" -o "$TMP/respaldo.dump" "$ARCHIVO"
  DUMP=$TMP/respaldo.dump
fi

echo "→ Comprobando el respaldo (pg_restore --list)…"
OBJETOS=$(pg_restore --list "$DUMP" | grep -cv '^;' || true)
[ "$OBJETOS" -gt 0 ] || { echo "El respaldo no tiene objetos: no se restaura" >&2; exit 1; }
echo "  $OBJETOS objetos en el índice"

# Identifica el destino sin mostrar la contraseña.
read -r DB HOST VERSION < <(psql "$DESTINO_URL" -X -At -F ' ' -v ON_ERROR_STOP=1 \
  -c "SELECT current_database(), coalesce(inet_server_addr()::text, 'local'), current_setting('server_version')")
TABLAS=$(psql "$DESTINO_URL" -X -At -v ON_ERROR_STOP=1 \
  -c "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%'")
echo "→ Destino: base \"$DB\" en $HOST (PostgreSQL $VERSION)"
if [ "$TABLAS" -ne 0 ]; then
  echo "✗ La base destino ya tiene $TABLAS tabla(s). Este script solo restaura en una base nueva y vacía." >&2
  echo "  Crea una base nueva (README de restauración, paso 2) y vuelve a intentarlo." >&2
  exit 1
fi

if [ "${CONFIRMAR:-}" != "$DB" ]; then
  read -r -p "  Escribe el nombre de la base destino para restaurar en ella: " RESPUESTA
  [ "$RESPUESTA" = "$DB" ] || { echo "No coincide; no se hizo nada." >&2; exit 1; }
fi

echo "→ Restaurando (pg_restore --no-owner --no-privileges --exit-on-error)…"
INICIO=$(date +%s)
pg_restore --dbname="$DESTINO_URL" --no-owner --no-privileges --exit-on-error "$DUMP"
echo "  listo en $(( $(date +%s) - INICIO )) s"

echo "→ Filas por tabla en la base restaurada:"
psql "$DESTINO_URL" -X -q -At -F ' ' -v ON_ERROR_STOP=1 -f "$(dirname "$0")/../sql/conteo-filas.sql" | awk '{printf "  %-30s %12s\n", $1, $2}'
echo "Compara estos números con los de producción (RESTORE.md, paso 5)."
