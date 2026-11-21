# pg-backup

Servicio estándar de Illakunan para respaldar bases PostgreSQL de clientes en Google Drive,
orquestado desde n8n. Un contenedor por base de datos, configurado solo con variables de entorno.
Primer cliente: **ARTESA** (`artesa-db` en Render).

```
 n8n (EasyPanel)                         pg-backup-artesa (EasyPanel, SIN dominio ni puertos)          Render
 ┌──────────────────────────┐  red interna  ┌────────────────────────────────────┐  TLS (sslmode=require) ┌───────────┐
 │ Programado (dom 02:00)   │ ────────────▶ │ POST /backup  (Bearer BACKUP_TOKEN)│ ─────────────────────▶ │ artesa-db │
 │ → valida SHA-256         │  http :8080   │ pg_dump --format=custom (solo lee) │   pg_dump = lectura    └───────────┘
 │ → Drive Respaldos/…      │ ◀──────────── │ pg_restore --list · age · SHA-256  │
 │ → retención · log · mail │  .dump.age    └────────────────────────────────────┘
 └──────────────────────────┘
```

- `GET /health` — sin autenticación: estado, versión de pg_dump, si cifra, si hay un respaldo en curso.
- `GET /check` — con token: se conecta en modo solo lectura y compara la versión del servidor con pg_dump.
- `POST /backup` — con token: `pg_dump --format=custom --no-owner --no-privileges` → validación con
  `pg_restore --list` → cifrado age (si hay `AGE_RECIPIENT`) → devuelve el archivo.

| Archivo | Qué es |
|---|---|
| `Dockerfile`, `cmd/pg-backup/main.go` | El servicio (Go, solo biblioteca estándar) |
| `.env.example` | Variables del contenedor (sin valores reales) |
| `n8n/pg-backup-workflow.json` | Workflow importable en n8n 2.x, **sin credenciales** |
| `n8n/generar-workflow.mjs` | Fuente legible del workflow (regenera el JSON) |
| `docker-compose.test.yml`, `test/e2e.sh` | Prueba de punta a punta del servicio con un Postgres de prueba |
| `test/n8n-e2e.sh`, `test/n8n/` | Prueba del workflow en un n8n real con un simulador de Google |
| `scripts/restaurar.sh`, `sql/conteo-filas.sql` | Restauración segura y conteo de filas |
| [`RESTORE.md`](RESTORE.md) | Cómo restaurar y la prueba mensual de restauración |

---

## 1. Decisiones técnicas

**Go, un binario estático sobre `postgres:<MAJOR>-alpine`.** La imagen oficial aporta `pg_dump`,
`pg_restore` y `psql` del major correcto; encima solo va un binario de ~7 MB y `age` (compilado
desde su código fuente oficial). Frente a las alternativas:

- *Node/Python + framework*: añaden un runtime, dependencias que actualizar y más superficie de ataque
  para un servicio que hace una sola cosa.
- *Shell + CGI / `nc`*: frágil con timeouts, códigos de salida, procesos colgados y limpieza de temporales.
- *Go (stdlib)*: `net/http` con timeouts por fase, `exec.CommandContext` para matar pg_dump al
  vencer el plazo, `sync.Mutex.TryLock` para el "uno a la vez", comparación del token en tiempo
  constante, logs JSON. Cero dependencias externas (`go.mod` está vacío).

**Seguridad**

- El token nunca se compara con `==`: se usa `subtle.ConstantTimeCompare`. Si falta o es incorrecto, la respuesta es 401.
- `DATABASE_URL` y el token **nunca** salen en logs ni en respuestas:
  - la conexión se pasa a pg_dump por variables `PG*` (no en la línea de comandos);
  - cualquier mensaje de error se filtra para borrar URL, usuario:clave y token;
  - la prueba lo verifica.
- `sslmode=require` siempre. Solo se respeta `verify-ca` o `verify-full` si los pones en la URL.
- pg_dump solo lee: trabaja en una transacción `READ ONLY` y `/check` fuerza `default_transaction_read_only`.
- Un respaldo a la vez. Si llega otra petición mientras hay uno en curso, responde 409.
- `DUMP_TIMEOUT_SEC` limita todo el trabajo; al vencer responde 504.
- Los temporales se borran siempre: al terminar, al fallar, por timeout, y también al arrancar.
- El contenedor corre sin root (usuario `postgres`) y solo escucha en la red interna de EasyPanel.

**Cifrado age (recomendado activo).** El respaldo trae datos personales y fotos.

- Con `AGE_RECIPIENT` el archivo sale ya cifrado (`.dump.age`) y así llega a n8n y a Drive.
- La clave privada vive fuera de todo: gestor de contraseñas más una copia offline.
- El workflow trae `exigir_cifrado = true`: si llega un respaldo sin cifrar, lo rechaza y avisa.

### Cabeceras de la respuesta de `/backup`

| Cabecera | Ejemplo |
|---|---|
| `X-Backup-Filename` / `Content-Disposition` | `ARTESA_artesa-db_2026-11-22_0200.dump.age` |
| `X-Backup-Size` / `Content-Length` | `141917` (bytes) |
| `X-Backup-Sha256` | SHA-256 hex del archivo entregado |
| `X-Backup-Duration-Ms` | duración de dump + validación + cifrado |
| `X-Backup-Encrypted` | `true` / `false` |
| `X-Backup-Toc-Entries` | objetos en el índice (`pg_restore --list`) |
| `X-Backup-Server-Version`, `X-Backup-Pg-Dump-Version` | `17.12`, `17.12` |
| `X-Backup-Started-At` | `2026-11-22T02:00:01-05:00` |

Errores: siempre JSON `{"error": "...", "etapa": "..."}`.

| HTTP | Etapa | Significa |
|---|---|---|
| 401 | — | Falta el token o es incorrecto |
| 405 | — | Método equivocado (`/backup` es POST) |
| 409 | — | Ya hay un respaldo en curso |
| 502 | `conexion` | No llega a la base: IP no permitida, URL o clave erróneas, base suspendida |
| 500 | `version` | El servidor es más nuevo que pg_dump: reconstruir con `PG_MAJOR` |
| 500 | `pg_dump`, `validacion`, `cifrado`, `hash` | Falló ese paso (el mensaje trae la última línea del error) |
| 504 | la que corría | Se superó `DUMP_TIMEOUT_SEC` |
| 503 | — | El servicio se estaba deteniendo (redeploy) |

---

## 2. Variables de entorno

Ver [`.env.example`](.env.example).

| Variable | Obligatoria | Uso |
|---|---|---|
| `CLIENTE` | sí | `ARTESA`. Forma parte del nombre del archivo (letras, números, `.`, `-`, `_`) |
| `DB_NAME` | sí | `artesa-db` |
| `DATABASE_URL` | sí | External Database URL de Render |
| `BACKUP_TOKEN` | sí | ≥ 32 caracteres. Generar con `openssl rand -hex 32` |
| `AGE_RECIPIENT` | recomendada | Clave pública `age1…` (puede haber varias, separadas por comas) |
| `DUMP_TIMEOUT_SEC` | no | Por defecto 1800 (rango 10 a 21600) |
| `PORT`, `BACKUP_TZ` | no | 8080 y `America/Guayaquil` |

---

## 3. Despliegue en EasyPanel (paso a paso)

### 3.1 Antes de empezar

1. **Versión del servidor.**
   - Dónde verla: en Render → `artesa-db` → *Info* (o, ya desplegado, con `/check`).
   - La imagen trae por defecto pg_dump 17, que sirve para servidores 17 o anteriores.
   - Si el servidor es 18, construye con `PG_MAJOR=18` (paso 3.2).
   - Lo ideal es usar el mismo major que el servidor.
2. **Token**: genera uno con `openssl rand -hex 32` y guárdalo en tu gestor de contraseñas.
   Va en dos sitios: la variable del contenedor y la credencial de n8n. No va en ningún otro.
3. **Clave age**, en tu equipo (no en el servidor):
   ```bash
   age-keygen -o artesa-pg-backup.agekey     # imprime "Public key: age1..."
   ```
   - La línea `age1…` va en `AGE_RECIPIENT`.
   - El archivo `.agekey` es la clave privada:
     - guárdalo en el gestor de contraseñas y en una copia offline;
     - nunca en EasyPanel, n8n, Drive ni git;
     - sin él los respaldos no se pueden abrir.
   - Una clave por cliente.

### 3.2 Crear el servicio

En el **mismo proyecto de EasyPanel donde está n8n** (por ejemplo `illakunan`):

1. **+ Service → App**, nombre `pg-backup-artesa` (patrón `pg-backup-<cliente>`; uno por base).
2. **Source → GitHub**: repositorio, rama y **Build Path `/pg-backup`**.
3. **Build → Dockerfile**, archivo `Dockerfile`.
   - Para otro major, agrega la variable `PG_MAJOR=18` en *Environment*.
   - EasyPanel la pasa como build-arg; confírmalo luego con `/health`, que muestra la versión de pg_dump.
4. **Environment**: `CLIENTE`, `DB_NAME`, `DATABASE_URL`, `BACKUP_TOKEN`, `AGE_RECIPIENT` y
   `DUMP_TIMEOUT_SEC` (ver `.env.example`).
5. **Domains**: **borra cualquier dominio**, incluido el que EasyPanel crea por defecto
   (`…easypanel.host`). Este servicio no debe tener dominio.
6. **Ports / Mounts**: ninguno. No publiques el 8080.
7. **Resources** (opcional): 256 MB de RAM bastan.
   - El disco temporal necesita unas 2 veces el tamaño del respaldo, porque durante un momento conviven el dump y su versión cifrada.
8. **Deploy**. En *Logs* debe aparecer:
   `{"level":"INFO","msg":"pg-backup iniciado", ... "cifrado":true}`.
   En *Logs* nunca aparecen la URL ni el token.

### 3.3 Nombre interno que usa n8n

Los servicios de un mismo proyecto se ven por `<proyecto>_<servicio>`:

```
http://illakunan_pg-backup-artesa:8080        ← va en el nodo Config del workflow (servicio_url)
```

Cámbialo por el nombre real del proyecto y del servicio. Para comprobarlo, abre la **consola del servicio n8n** en EasyPanel:

```sh
wget -qO- http://illakunan_pg-backup-artesa:8080/health
# {"cifrado":true,"cliente":"ARTESA","db":"artesa-db","pg_dump":"17.12","status":"ok",...}
wget -qO- --header "Authorization: Bearer $TOKEN" http://illakunan_pg-backup-artesa:8080/check
# {"ok":true,"server_version":"17.x","pg_dump":"17.12","compatible":true,"mismo_major":true}
```

(Para `/check`, escribe el token a mano en esa consola, sin guardarlo, y luego cierra la consola.)

### 3.4 Verificar que NO está expuesto

- [ ] *Domains* del servicio vacío y *Ports* vacío.
- [ ] Desde tu equipo, fuera del servidor:
  - `curl -m 5 http://IP_DEL_SERVIDOR:8080/health` debe dar timeout o "connection refused";
  - si había un dominio por defecto, `curl -m 5 https://<ese-dominio>/health` ya no responde con el JSON de pg-backup.
- [ ] En el servidor, `docker ps --format '{{.Names}} {{.Ports}}' | grep pg-backup` solo muestra
  `8080/tcp`, sin `0.0.0.0:…->8080`.
- [ ] Desde la consola de n8n, `wget …/backup` sin token devuelve `401`.

### 3.5 Acceso a Render (reglas de IP)

1. IP pública de salida de EasyPanel: en la consola del **servidor**, ejecuta `curl -s https://ifconfig.me`.
2. Render → `artesa-db` → **Networking → Access Control**:
   - deja **solo** esa IP (`x.x.x.x/32`) y, si hace falta, la tuya de administración;
   - las conexiones internas de `artesa-hojas` no se ven afectadas.
3. **Importante (Blueprint).**
   - Hoy `render.yaml` no declara `ipAllowList` para `artesa-db`, así que Render permite cualquier IP que tenga la clave.
   - Si cambias las reglas en el panel, una sincronización del Blueprint puede reponer el valor del archivo.
   - Lo recomendable es declararlas en `render.yaml` (cambio de configuración, no de datos; aplicarlo es decisión tuya):
   ```yaml
   databases:
     - name: artesa-db
       plan: free
       databaseName: artesa
       user: artesa
       ipAllowList:
         - source: x.x.x.x/32        # EasyPanel (pg-backup)
           description: pg-backup EasyPanel
   ```
4. Comprueba con `/check` (paso 3.3). Si responde 502 con etapa `conexion`, la IP o la URL no son las correctas.

**Rol de solo lectura (opcional, recomendado).** pg_dump solo necesita leer.

- Si Render permite crear roles con tu usuario, puedes crear uno y usar su URL en `DATABASE_URL`:
  ```sql
  CREATE ROLE respaldo LOGIN PASSWORD '…';
  GRANT pg_read_all_data TO respaldo;
  ```
- Es un cambio en la base, así que no se ha hecho: decídelo tú.
- Con el usuario principal también funciona, porque pg-backup no escribe.

> ⚠️ **Plan de la base**: `render.yaml` declara `artesa-db` con `plan: free`. En Render, las bases
> gratuitas **caducan unos 30 días después de crearse** y luego se borran. Antes de esa fecha pasa la
> base a un plan pago (o restaura un respaldo en una nueva, ver `RESTORE.md`). Este servicio
> respalda, pero no evita la caducidad.

---

## 4. n8n

### 4.1 Configuración de la instancia (EasyPanel → servicio n8n → Environment)

| Variable | Valor | Por qué |
|---|---|---|
| `N8N_DEFAULT_BINARY_DATA_MODE` | `filesystem` | **Sí, recomendado.** Ver la explicación debajo. |
| `EXECUTIONS_DATA_PRUNE` / `EXECUTIONS_DATA_MAX_AGE` | `true` / `336` | Limpia las ejecuciones viejas (y sus binarios) a las 2 semanas. |
| `GENERIC_TIMEZONE` | `America/Guayaquil` | El workflow ya trae esa zona, pero así queda coherente. |

Por qué `N8N_DEFAULT_BINARY_DATA_MODE=filesystem`:

- En modo `default` cada respaldo vive entero en la RAM de n8n. Ese modo además desaparece en la siguiente versión mayor.
- En modo `database` el dump terminaría dentro de la base de n8n.
- `filesystem` lo guarda en el volumen de n8n. Necesita espacio libre para el respaldo más grande, y algo más.

La ejecución del nodo Execute Command no se usa ni se necesita.

### 4.2 Preparar Google

1. En Drive, crea la carpeta **`Respaldos`** y copia su ID (de la URL `…/folders/<ID>`).
   - Las subcarpetas `ARTESA/artesa-db` las crea el workflow.
2. Crea una hoja de cálculo para el log con una pestaña **`log`**.
   - La fila 1 lleva exactamente estos encabezados:
     `fecha | cliente | base | archivo | tamaño_bytes | sha256 | duración_ms | estado | detalle`
   - Copia su ID (de la URL `…/d/<ID>/edit`).

### 4.3 Importar el workflow

1. n8n → *Workflows* → *Import from file* → `n8n/pg-backup-workflow.json`.
2. Nodo **Config**: ajusta los valores.

   | Campo | Valor para ARTESA |
   |---|---|
   | `cliente`, `db` | `ARTESA`, `artesa-db` (iguales que en el contenedor) |
   | `servicio_url` | `http://illakunan_pg-backup-artesa:8080` |
   | `carpeta_respaldos_id` | ID de la carpeta `Respaldos` |
   | `retener` | `8` (respaldos que se conservan) |
   | `hoja_log_id`, `hoja_log_pestana` | ID de la hoja y `log` |
   | `correo_alerta` | destinatario de las alertas |
   | `exigir_cifrado` | `true` (pon `false` solo si decides no cifrar) |
   | `tamano_minimo_bytes` | `1024` |
   | `timeout_ms` | `2400000` (debe ser mayor que `DUMP_TIMEOUT_SEC`) |

3. Credenciales (el JSON no trae ninguna):
   - **Pedir respaldo** → nueva credencial **Bearer Auth** con el `BACKUP_TOKEN`.
   - Los nodos de Drive **y** los dos HTTP "Buscar carpeta …" → tu credencial **Google Drive OAuth2**.
     En los HTTP: *Authentication → Predefined Credential Type → Google Drive OAuth2 API*.
   - **Registrar OK / Registrar error** → Google Sheets.
   - **Enviar alerta (Gmail)** → Gmail.
4. *Settings* del workflow → **Error workflow → este mismo workflow**. Así también avisa de los
   fallos que no pasan por la salida de error de un nodo, como el timeout del workflow.
   La zona horaria ya viene como `America/Guayaquil`.
5. Prueba con **Execute workflow**: debe subir un `.dump.age`, escribir la fila `ok` y no enviar correo.
6. **Activa** el workflow. Por defecto corre el domingo a las 02:00; para cambiarlo, edita el cron del nodo *Programado*.

### 4.4 Qué hace

1. Pide el respaldo y revisa la respuesta. Si no es 200, extrae el `error` y la `etapa`.
2. Recalcula el **SHA-256** en n8n y lo compara con `X-Backup-Sha256`. También verifica:
   - el nombre esperado;
   - que venga cifrado;
   - el tamaño mínimo;
   - que `Content-Length` coincida;
   - que el índice tenga objetos.
3. Busca o crea `Respaldos/{CLIENTE}/{DB_NAME}/` y sube `{CLIENTE}_{DB}_{YYYY-MM-DD_HHmm}.dump.age`.
4. Escribe en la hoja: fecha, cliente, base, archivo, tamaño, SHA-256, duración, `ok` e ID de Drive.
5. **Retención**: conserva los `retener` más recientes de esa carpeta y envía los demás a la **papelera** de Drive, que los guarda 30 días más. Reglas de seguridad:
   - Solo considera archivos con el nombre exacto `{CLIENTE}_{DB}_AAAA-MM-DD_HHmm.dump[.age]`.
   - Nunca toca el recién subido.
   - Si no lo ve en la carpeta, no borra nada.
   - La retención solo ocurre después de una subida correcta.
6. **Cualquier fallo** envía un correo y escribe una fila `error`. El correo indica:
   - el paso que falló;
   - el error;
   - el ID de ejecución;
   - y, si llegó a generarse, el archivo con su tamaño y SHA-256.

   Al fallar no se borra nada.

Las ejecuciones correctas no se guardan en n8n (`saveDataSuccessExecution: none`), para no acumular
binarios: el registro es la hoja. Las fallidas sí se guardan.

---

## 5. Diagnóstico

| Alerta dice | Revisa |
|---|---|
| `getaddrinfo ENOTFOUND …` / `ECONNREFUSED` | `servicio_url` (nombre `<proyecto>_<servicio>`) y que el servicio esté corriendo |
| `HTTP 401` | La credencial Bearer de n8n y el `BACKUP_TOKEN` del contenedor deben ser iguales |
| `HTTP 409` | Hay otro respaldo en curso (¿ejecución manual al mismo tiempo?) |
| `HTTP 502 … (etapa: conexion)` | Reglas de IP de Render, `DATABASE_URL`, clave rotada, base suspendida o caducada |
| `HTTP 500 … (etapa: version)` | Reconstruir la imagen con `PG_MAJOR` = major del servidor |
| `HTTP 504` | Subir `DUMP_TIMEOUT_SEC` (y `timeout_ms` en n8n) |
| `SIN cifrar y exigir_cifrado` | Falta `AGE_RECIPIENT` en el contenedor |
| `SHA-256 no coincide` | Transferencia corrupta: reintentar; si se repite, revisar la red o el disco de n8n |
| Fallo en *Subir a Drive* / *Registrar* | Credencial de Google vencida o cuota de Drive llena |

Logs del servicio en EasyPanel: JSON, con la etapa, la duración y el error, siempre sin secretos.

---

## 6. Replicar para un cliente nuevo

1. Genera un token nuevo y una clave age nueva para ese cliente (paso 3.1).
2. EasyPanel, mismo proyecto que n8n: crea el servicio `pg-backup-<cliente>` con el mismo repositorio, Build Path y Dockerfile.
   - Ajusta `PG_MAJOR` si su servidor es de otra versión.
   - Pon las variables de ese cliente.
   - Sin dominio y sin puertos.
3. Permite la IP de EasyPanel en el proveedor de la base y comprueba con `/check`.
4. n8n: duplica el workflow (o vuelve a importar el JSON). En **Config** cambia:
   - `cliente`, `db` y `servicio_url`;
   - el correo y, si quieres, la hoja.

   Además:
   - crea una credencial Bearer nueva para ese token;
   - configura *Error workflow* apuntando a sí mismo;
   - activa el workflow.
5. Ejecuta una vez a mano y haz la primera prueba de restauración (`RESTORE.md`).

Usa un servicio y un workflow por base. Así cada una tiene su propio token, clave, horario y alertas.

---

## 7. Pruebas

```bash
test/e2e.sh                                    # servicio: 401/405/409/504/502, cifrado, cabeceras,
                                               # restauración en otra base y conteo/huella por tabla
CONSERVAR=1 test/e2e.sh && test/n8n-e2e.sh     # workflow en n8n 2.x real + simulador de Google
```

- Necesitan Docker, openssl, age y curl.
- Detrás de un proxy con CA propia:
  `DOCKER_BUILD_ARGS="--network=host --secret id=ca,src=ca.crt" test/e2e.sh`.
- Nada de lo que generan (certificados, claves, tokens) se guarda en el repositorio: todo vive en `test/.tmp/`, que está ignorado.

**Qué cubre `test/e2e.sh`**

- Token ausente o incorrecto → 401.
- Respaldo cifrado, con su nombre, tamaño y SHA-256.
- Un respaldo a la vez → 409.
- Timeout → 504, con los temporales borrados.
- Contraseña errónea → 502, sin la clave en la respuesta.
- Descifrado y `pg_restore` en otra base:
  - mismo número de filas;
  - mismo md5 del contenido en cada tabla;
  - mismas secuencias.
- Logs sin secretos.

**Qué cubre `test/n8n-e2e.sh`**

- Primera ejecución: crea las carpetas, y el SHA-256 de lo subido coincide con el del servicio.
- Retención: 8 de 11 se conservan, 3 van a la papelera y los archivos ajenos no se tocan.
- Alertas de base caída, token incorrecto y Error Trigger: cada una envía exactamente un correo, sin secretos.
