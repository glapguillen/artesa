-- Esquema de la base de datos (PostgreSQL). Se aplica al arrancar el servidor; es idempotente.

-- Catálogo de secciones. La "letra" es la que aparece en la ruta del artículo
-- (p. ej. ruta STDE = Señalado, Trazado, Decorado, Esmalt).
CREATE TABLE IF NOT EXISTS secciones (
  id      SERIAL PRIMARY KEY,
  letra   CHAR(1) UNIQUE,
  nombre  TEXT NOT NULL UNIQUE
);

INSERT INTO secciones (letra, nombre) VALUES
  ('S', 'SEÑALADO'),
  ('T', 'TRAZADO'),
  ('D', 'DECORADO'),
  ('E', 'ESMALT')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS ordenes (
  id             SERIAL PRIMARY KEY,
  numero         TEXT NOT NULL UNIQUE,
  fecha_emision  DATE,
  cliente        TEXT,
  observaciones  TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orden_articulos (
  id                 SERIAL PRIMARY KEY,
  orden_id           INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  codigo             TEXT NOT NULL DEFAULT '',   -- código completo impreso, p. ej. '0944 626'
  codigo_bizcocho    TEXT NOT NULL DEFAULT '',   -- 4 primeros dígitos: la pieza
  bizcocho           TEXT NOT NULL DEFAULT '',   -- nombre de la pieza, p. ej. 'BANDEJA HOJA #2'
  codigo_decoracion  TEXT NOT NULL DEFAULT '',   -- 3 dígitos siguientes: la decoración
  decoracion         TEXT NOT NULL DEFAULT '',   -- nombre de la decoración, p. ej. 'GIRASOL AZUL'
  cantidad_producir  INTEGER,
  tiempo_estandar    NUMERIC(10,2),
  ruta               TEXT,
  UNIQUE (orden_id, codigo, decoracion)
);

-- Una hoja por orden y sección. Se crean como 'pendiente' a partir de la ruta
-- y pasan a 'registrada' cuando se guarda la foto de esa sección.
CREATE TABLE IF NOT EXISTS hojas (
  id            SERIAL PRIMARY KEY,
  orden_id      INTEGER NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  seccion_id    INTEGER NOT NULL REFERENCES secciones(id),
  estado        TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'registrada')),
  operario1     TEXT,
  operario2     TEXT,
  notas         TEXT,
  foto          BYTEA,
  foto_mime     TEXT,
  extraccion    JSONB,           -- lo que leyó el modelo, antes de las correcciones
  registrada_en TIMESTAMPTZ,
  UNIQUE (orden_id, seccion_id)
);

-- Piezas malas por artículo en una hoja.
CREATE TABLE IF NOT EXISTS hoja_articulos (
  hoja_id      INTEGER NOT NULL REFERENCES hojas(id) ON DELETE CASCADE,
  articulo_id  INTEGER NOT NULL REFERENCES orden_articulos(id) ON DELETE CASCADE,
  malas        INTEGER,
  PRIMARY KEY (hoja_id, articulo_id)
);

-- Cada bloque manuscrito CANT / TMPO / PER de una fecha.
CREATE TABLE IF NOT EXISTS registros (
  id           SERIAL PRIMARY KEY,
  hoja_id      INTEGER NOT NULL REFERENCES hojas(id) ON DELETE CASCADE,
  articulo_id  INTEGER NOT NULL REFERENCES orden_articulos(id) ON DELETE CASCADE,
  fecha        DATE,
  cantidad     INTEGER,
  hora_inicio  TIME,
  hora_fin     TIME,
  personas     INTEGER
);

CREATE INDEX IF NOT EXISTS registros_hoja_idx ON registros (hoja_id);

-- Cambios sobre bases creadas con versiones anteriores.
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'hojas' AND column_name = 'operario') THEN
    ALTER TABLE hojas RENAME COLUMN operario TO operario1;
    ALTER TABLE hojas ADD COLUMN IF NOT EXISTS operario2 TEXT;
    -- Solo en este paso, una vez: hojas antiguas con dos nombres en un campo ("Sonia-Tania").
    UPDATE hojas
       SET operario1 = btrim(split_part(operario1, '-', 1)), operario2 = btrim(split_part(operario1, '-', 2))
     WHERE operario1 ~ '^[^-]+-[^-]+$';
  END IF;
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'orden_articulos' AND column_name = 'descripcion') THEN
    ALTER TABLE orden_articulos RENAME COLUMN descripcion TO bizcocho;
  END IF;
END $$;
ALTER TABLE hojas ADD COLUMN IF NOT EXISTS operario2 TEXT;
ALTER TABLE orden_articulos ADD COLUMN IF NOT EXISTS codigo_bizcocho TEXT NOT NULL DEFAULT '';
ALTER TABLE orden_articulos ADD COLUMN IF NOT EXISTS codigo_decoracion TEXT NOT NULL DEFAULT '';
UPDATE orden_articulos
   SET codigo_bizcocho = split_part(codigo, ' ', 1), codigo_decoracion = split_part(codigo, ' ', 2)
 WHERE codigo_bizcocho = '' AND codigo_decoracion = '' AND codigo ~ '^[0-9]{4} [0-9]{3}$';

-- Catálogo de códigos: los 4 primeros dígitos del artículo son el bizcocho y los 3 siguientes la
-- decoración. Se alimenta solo con cada hoja guardada (gana el último nombre revisado) y se puede
-- corregir desde la pestaña Catálogo.
CREATE TABLE IF NOT EXISTS bizcochos (
  codigo       TEXT PRIMARY KEY CHECK (codigo ~ '^[0-9]{4}$'),
  nombre       TEXT NOT NULL,
  actualizado  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS decoraciones (
  codigo       TEXT PRIMARY KEY CHECK (codigo ~ '^[0-9]{3}$'),
  nombre       TEXT NOT NULL,
  actualizado  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lo que ya estaba guardado en las órdenes.
INSERT INTO bizcochos (codigo, nombre)
SELECT DISTINCT ON (codigo_bizcocho) codigo_bizcocho, bizcocho FROM orden_articulos
 WHERE codigo_bizcocho ~ '^[0-9]{4}$' AND bizcocho <> '' ORDER BY codigo_bizcocho, id DESC
ON CONFLICT DO NOTHING;
INSERT INTO decoraciones (codigo, nombre)
SELECT DISTINCT ON (codigo_decoracion) codigo_decoracion, decoracion FROM orden_articulos
 WHERE codigo_decoracion ~ '^[0-9]{3}$' AND decoracion <> '' ORDER BY codigo_decoracion, id DESC
ON CONFLICT DO NOTHING;

-- Punto de partida: los códigos de las hojas de ejemplo de octubre-noviembre de 2026.
INSERT INTO bizcochos (codigo, nombre) VALUES
  ('0944', 'BANDEJA HOJA #2'), ('0559', 'ENSALADERA 22.5 CM'), ('1142', 'JARRO ORGANICO'),
  ('1217', 'PLATO TENDIDO PIEDRA'), ('1143', 'PLATO HONDO ORGANICO'), ('0208', 'FRASCO CON CUCHARA'),
  ('0699', 'FUENTE OVALADA 40.5 CM'), ('0248', 'JARRO PACIFICO'), ('0709', 'JARRO CLUB JUMBO'),
  ('0196', 'FLORERO PERA'), ('0646', 'JARRO NORUEGO'), ('1012', 'BANDEJA ORIENTAL C #1'),
  ('0233', 'JARRA AMERICANA'), ('0495', 'TAZA TE'), ('0707', 'JARRO ALFARERO JUMBO'),
  ('0884', 'CREMERA GUALACEO'), ('0876', 'FUENTE REDONDA CHORDELEG'), ('0907', 'MANTEQUILLERO CHORDELEG'),
  ('0883', 'TAPA TETERA GUALACEO'), ('0899', 'DULCERO / CEVICHERO CHORDELEG'), ('0246', 'JARRO CLUB'),
  ('0890', 'PLATO HONDO CHORDELEG'), ('0887', 'PLATO POSTRE CHORDELEG')
ON CONFLICT DO NOTHING;
INSERT INTO decoraciones (codigo, nombre) VALUES
  ('626', 'GIRASOL AZUL'), ('477', 'PERSONALIZADO'), ('796', 'TRANSPARENTE MATE'), ('028', 'CARRARA GRIS'),
  ('031', 'CARRARA BEIGE'), ('149', 'MARGARITAS'), ('924', 'BLUE FISH'), ('625', 'JUNCOS'),
  ('943', 'WINDFLOWER'), ('462', 'FLORES DEL CAMPO'), ('105', 'PRIMAVERA ROJA'), ('108', 'FLORAL AZUL'),
  ('459', 'PAJARO AZUL MT')
ON CONFLICT DO NOTHING;
