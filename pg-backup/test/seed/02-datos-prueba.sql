-- Datos sintéticos para la prueba local (no son datos reales de ARTESA). Cubren lo que más
-- suele romper una restauración: textos con tildes y ñ, bytea (fotos), jsonb, NULL, fechas,
-- horas, secuencias y claves foráneas.
SET client_encoding = 'UTF8';

INSERT INTO ordenes (numero, fecha_emision, cliente, observaciones)
SELECT lpad((76000 + g)::text, 7, '0'),
       DATE '2026-08-01' + (g % 90),
       (ARRAY['ANDRADE PATRICIO', 'STOCK FABRICA', 'TRAVEL STORES S A', 'COLINEAL CORP.', 'Ñañez & Hijos'])[1 + g % 5],
       CASE WHEN g % 7 = 0 THEN NULL ELSE 'MARCA VEGA · señalado ✓ ' || g END
  FROM generate_series(1, 400) g;

INSERT INTO orden_articulos (orden_id, codigo, codigo_bizcocho, bizcocho, codigo_decoracion, decoracion, cantidad_producir, tiempo_estandar, ruta)
SELECT o.id, lpad((900 + a)::text, 4, '0') || ' ' || lpad((100 + o.id % 50)::text, 3, '0'),
       lpad((900 + a)::text, 4, '0'), 'BANDEJA HOJA #' || a, lpad((100 + o.id % 50)::text, 3, '0'), 'GIRASOL AZUL',
       12 * a, 240.5 * a, (ARRAY['STDE', 'TDE', 'DE', 'E'])[1 + o.id % 4]
  FROM ordenes o CROSS JOIN generate_series(1, 3) a;

INSERT INTO hojas (orden_id, seccion_id, estado, operario1, operario2, notas, foto, foto_mime, extraccion, registrada_en)
SELECT o.id, s.id,
       CASE WHEN (o.id + s.id) % 3 = 0 THEN 'pendiente' ELSE 'registrada' END,
       (ARRAY['Ana Pérez', 'Sonia', 'Thalya Uyaguari', 'Josué'])[1 + (o.id + s.id) % 4],
       CASE WHEN o.id % 2 = 0 THEN 'Tania' END,
       CASE WHEN o.id % 11 = 0 THEN '45 minutos capacitación; 1 hora mucho mejor' END,
       CASE WHEN (o.id + s.id) % 3 <> 0 THEN decode(repeat(md5(o.id::text || s.id::text), 64), 'hex') END,
       'image/jpeg',
       jsonb_build_object('lector', 'Claude Sonnet', 'uso', jsonb_build_object('costo', 0.03), 'dudas', jsonb_build_array('hora dudosa')),
       timestamptz '2026-09-01 08:00-05' + (o.id || ' hours')::interval
  FROM ordenes o CROSS JOIN secciones s;

INSERT INTO hoja_articulos (hoja_id, articulo_id, malas)
SELECT h.id, a.id, CASE WHEN a.id % 5 = 0 THEN a.id % 3 END
  FROM hojas h JOIN orden_articulos a ON a.orden_id = h.orden_id
 WHERE h.estado = 'registrada';

INSERT INTO registros (hoja_id, articulo_id, fecha, cantidad, hora_inicio, hora_fin, personas)
SELECT ha.hoja_id, ha.articulo_id, DATE '2026-09-01' + d, 4 + (ha.articulo_id + d) % 9,
       time '07:00' + ((d * 37) % 300 || ' minutes')::interval,
       time '11:30' + ((d * 53) % 240 || ' minutes')::interval,
       CASE WHEN d % 3 = 0 THEN NULL ELSE 1 + d % 2 END
  FROM hoja_articulos ha CROSS JOIN generate_series(0, 2) d;

-- Rol de solo lectura, como el que se recomienda para respaldar: pg_dump no necesita más.
CREATE ROLE respaldo LOGIN PASSWORD 'clave-de-prueba-respaldo';
GRANT pg_read_all_data TO respaldo;
