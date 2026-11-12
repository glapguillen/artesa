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
  codigo             TEXT NOT NULL DEFAULT '',
  descripcion        TEXT NOT NULL DEFAULT '',
  decoracion         TEXT NOT NULL DEFAULT '',
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
  operario      TEXT,
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
