-- Filas exactas por tabla (todas las tablas de usuario). Solo lectura: se puede correr contra
-- producción sin riesgo.   psql "$URL" -X -q -At -F ' ' -f sql/conteo-filas.sql
SET default_transaction_read_only = on;
SELECT format('%I.%I', n.nspname, c.relname) AS tabla,
       (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint AS filas
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relkind IN ('r', 'p')
   AND n.nspname NOT IN ('pg_catalog', 'information_schema')
   AND n.nspname NOT LIKE 'pg_toast%'
 ORDER BY 1;
