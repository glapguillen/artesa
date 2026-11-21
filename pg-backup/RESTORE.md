# Restaurar un respaldo de pg-backup

Esta guía sirve para recuperar datos tras un desastre y para la **prueba mensual de
restauración**: un respaldo que nunca se ha restaurado no es un respaldo.

> **Regla de oro:** se restaura siempre en una base **nueva y vacía**. Nunca sobre `artesa-db` ni
> sobre otra base en uso. `scripts/restaurar.sh` se niega a restaurar en una base que ya tiene tablas.

## Qué necesitas

| Qué | Dónde |
|---|---|
| El archivo `ARTESA_artesa-db_AAAA-MM-DD_HHmm.dump.age` | Drive → `Respaldos/ARTESA/artesa-db/` |
| Su SHA-256 | Hoja de log, columna `sha256` |
| La **clave privada age** (`artesa-pg-backup.agekey`) | Gestor de contraseñas o copia offline |
| `age`, `pg_restore` y `psql` del mismo major que el respaldo | Ya vienen en la imagen `pg-backup` (abajo). No hace falta instalarlos |

Con Docker en tu equipo, construye una vez la imagen del mismo major que el servidor de origen:

```bash
cd pg-backup && docker build -t pg-backup:17 .
```

---

## Paso 1. Descargar y verificar el archivo

1. Descarga el respaldo desde Drive. Si es reciente, también puede estar en la papelera, donde se conserva 30 días.
2. Compara su huella con la que se registró en la hoja:
   ```bash
   sha256sum ARTESA_artesa-db_2026-11-22_0200.dump.age      # macOS: shasum -a 256 …
   ```
   Si no coincide con la columna `sha256` del log, el archivo está dañado: usa el respaldo anterior.

## Paso 2. Crear la base nueva

Usa el **mismo major** de PostgreSQL que el origen (lo ves en la hoja de log, en *detalle*, o en `X-Backup-Server-Version`).

**Opción A — Render**

1. *New → PostgreSQL*: nombre `artesa-restore-AAAAMMDD`, misma región que la app y versión igual al origen.
   - Para la prueba mensual basta el plan más pequeño; bórrala al terminar.
2. Espera a que esté *Available*.
3. Ve a *Connect → External Database URL* y cópiala. Es tu `DESTINO_URL`: no la pegues en chats ni en archivos.
4. *Networking → Access Control*: tu IP debe estar permitida.

**Opción B — Neon**

1. *New project*: misma versión de PostgreSQL y una región cercana (us-east para Render Ohio/Virginia, us-west para Oregon).
2. *Connection details*:
   - elige la conexión **directa**, sin `-pooler` en el host (pg_restore no funciona bien a través del pooler);
   - copia la URL con `?sslmode=require`.
3. Neon crea por defecto la base `neondb`. Puedes restaurar ahí, porque está vacía, o crear otra desde el panel.

## Paso 3. Restaurar

Con el script (comprueba el archivo, se niega si el destino tiene tablas y pide confirmar escribiendo el nombre de la base):

```bash
cd pg-backup
read -rs DESTINO_URL && export DESTINO_URL        # pega la URL (no se ve ni queda en el historial)
docker run --rm -it -e DESTINO_URL -v "$PWD:/w" -v "$HOME/Descargas:/datos" -v "$HOME/claves:/claves:ro" \
  -w /w --entrypoint bash pg-backup:17 \
  scripts/restaurar.sh /datos/ARTESA_artesa-db_2026-11-22_0200.dump.age /claves/artesa-pg-backup.agekey
```

Salida esperada:

```
→ Descifrando con age…
→ Comprobando el respaldo (pg_restore --list)…
  57 objetos en el índice
→ Destino: base "artesa_restore" en … (PostgreSQL 17.x)
  Escribe el nombre de la base destino para restaurar en ella: artesa_restore
→ Restaurando (pg_restore --no-owner --no-privileges --exit-on-error)…
→ Filas por tabla en la base restaurada:
  public.bizcochos                         23
  …
```

<details><summary>Sin el script (a mano)</summary>

```bash
age -d -i artesa-pg-backup.agekey -o respaldo.dump ARTESA_artesa-db_2026-11-22_0200.dump.age
pg_restore --list respaldo.dump | head          # debe listar tablas, índices, secuencias…
psql "$DESTINO_URL" -c '\dt'                    # debe decir "Did not find any relations"
pg_restore --dbname="$DESTINO_URL" --no-owner --no-privileges --exit-on-error respaldo.dump
psql "$DESTINO_URL" -X -q -At -F ' ' -f sql/conteo-filas.sql
shred -u respaldo.dump 2>/dev/null || rm -P respaldo.dump 2>/dev/null || rm respaldo.dump  # el dump descifrado
```
</details>

- `--no-owner --no-privileges` hace que los objetos queden a nombre del usuario de la base nueva, que es lo que conviene en Render y en Neon.
- `--exit-on-error` detiene la restauración ante el primer error, en lugar de dejarla a medias sin avisar.

## Paso 4. Verificar

1. **Filas por tabla.**
   - El script ya las muestra al terminar.
   - Compáralas con producción usando la misma consulta, que es **solo lectura**:
     ```bash
     psql "$PRODUCCION_URL" -X -q -At -F ' ' -f sql/conteo-filas.sql
     ```
   - Producción sigue recibiendo datos después del respaldo, así que puede tener **más** filas, nunca menos.
   - Para una comparación exacta, ejecuta el workflow a mano (*Execute workflow*) en un momento sin uso de la app y restaura ese respaldo enseguida.
2. **Datos recientes**: la fecha más nueva debe ser la del día del respaldo.
   ```sql
   SELECT max(registrada_en) FROM hojas;  SELECT max(fecha) FROM registros;  SELECT count(*) FROM hojas WHERE foto IS NOT NULL;
   ```
3. **Secuencias**: un `INSERT` de prueba en la base restaurada (¡no en producción!) no debe chocar con claves existentes.
   ```sql
   BEGIN; INSERT INTO secciones (letra, nombre) VALUES ('Z', 'prueba-restauracion') RETURNING id; ROLLBACK;
   ```
4. **Opcional — la app sobre la copia.**
   - Ejecuta la app localmente con `DATABASE_URL` apuntando a la base restaurada.
   - Abre Reportes y Base de datos: deben mostrar la información hasta la fecha del respaldo.

## Paso 5. Si es un desastre real (poner la copia en producción)

1. Restaura en una base de Render **de plan pago**, en la misma región que `artesa-hojas` (pasos 2 a 4).
2. Apunta la app a la base nueva:
   - `render.yaml` toma `DATABASE_URL` de `artesa-db` (`fromDatabase`);
   - cambia ese bloque para que apunte a la base nueva y sincroniza el Blueprint;
   - o, temporalmente, define `DATABASE_URL` a mano en `artesa-hojas` con la **Internal URL** de la base nueva.
3. Actualiza `DATABASE_URL` del servicio `pg-backup-artesa` en EasyPanel con la External URL nueva y ajusta las reglas de IP.
4. Ejecuta el workflow a mano y confirma la fila `ok` en el log.

## Paso 6. Limpiar (prueba mensual)

- Borra la base de prueba en Render o Neon, para que no genere costos.
- Borra el `.dump.age` descargado. El script ya borra el dump descifrado; si restauraste a mano, bórralo tú (`shred -u`).
- Anota el resultado en la hoja de log, por ejemplo con una fila `estado = restore-ok` y el detalle de los conteos.

---

## Checklist mensual de restauración

Primer lunes de cada mes, unos 20 minutos.

- [ ] La hoja de log tiene una fila `ok` por cada domingo del último mes y ninguna `error` sin resolver.
- [ ] En Drive, `Respaldos/ARTESA/artesa-db/` tiene como máximo `retener` (8) respaldos y el más reciente es de este domingo.
- [ ] El tamaño de los respaldos es coherente: crece poco a poco y no cae de golpe.
- [ ] Descargué el último respaldo y su `sha256sum` coincide con el log.
- [ ] Lo descifré con la clave privada guardada fuera del servidor. Esto prueba que la clave sigue disponible y es la correcta.
- [ ] Restauré en una base **nueva** (Render o Neon) con `scripts/restaurar.sh`, sin errores.
- [ ] Las filas por tabla son ≤ a las de producción y razonables. Las tablas principales (`ordenes`, `hojas`, `registros`, `hoja_articulos`) no tienen 0 filas.
- [ ] Los datos más recientes son del día del respaldo.
- [ ] Borré la base de prueba y los archivos descargados.
- [ ] Revisé el plan de `artesa-db` en Render: no es `free` o, si lo es, sé cuándo caduca.
- [ ] Anoté en el log `restore-ok` (o el problema encontrado) con la fecha.
