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
