// pg-backup: servicio HTTP mínimo que respalda una base PostgreSQL con pg_dump y devuelve el
// archivo, validado con pg_restore --list y, si hay AGE_RECIPIENT, cifrado con age.
//
// Pensado para correr como contenedor interno (sin dominio público) junto a n8n: un contenedor
// por base de datos, todo configurado por variables de entorno.
package main

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
	_ "time/tzdata" // zonas horarias embebidas: la imagen no depende de tzdata
)

var version = "dev" // se fija al compilar con -ldflags "-X main.version=..."

type config struct {
	cliente       string
	dbName        string
	conn          conexion
	token         []byte
	ageRecipients []string
	dumpTimeout   time.Duration
	port          string
	tmpDir        string
	zona          *time.Location
	secretos      []string // valores que nunca deben aparecer en logs ni respuestas
	pgDumpVersion string
	pgDumpMajor   int
}

// conexion son los parámetros de libpq sacados de DATABASE_URL. Se pasan a pg_dump como
// variables PG* (no en argv), así no aparecen en la lista de procesos.
type conexion struct {
	host, port, user, password, database, sslmode string
	extra                                         map[string]string
}

func (c conexion) env() []string {
	e := []string{
		"PGHOST=" + c.host, "PGPORT=" + c.port, "PGUSER=" + c.user,
		"PGPASSWORD=" + c.password, "PGDATABASE=" + c.database, "PGSSLMODE=" + c.sslmode,
		"PGCONNECT_TIMEOUT=15", "PGAPPNAME=pg-backup",
	}
	for k, v := range c.extra {
		e = append(e, k+"="+v)
	}
	return e
}

// parseDatabaseURL acepta postgres:// o postgresql://. sslmode es "require" salvo que la URL
// pida algo más estricto (verify-ca, verify-full); nunca se baja de require.
func parseDatabaseURL(raw string) (conexion, error) {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") || u.Host == "" {
		return conexion{}, errors.New("DATABASE_URL debe tener la forma postgresql://usuario:clave@host:puerto/base")
	}
	c := conexion{host: u.Hostname(), port: u.Port(), database: strings.TrimPrefix(u.Path, "/"), extra: map[string]string{}}
	if c.port == "" {
		c.port = "5432"
	}
	if u.User != nil {
		c.user = u.User.Username()
		c.password, _ = u.User.Password()
	}
	if c.database == "" || c.user == "" {
		return conexion{}, errors.New("DATABASE_URL debe incluir usuario y nombre de base")
	}
	c.sslmode = "require"
	q := u.Query()
	if m := q.Get("sslmode"); m == "verify-ca" || m == "verify-full" {
		c.sslmode = m
	}
	if v := q.Get("sslrootcert"); v != "" {
		c.extra["PGSSLROOTCERT"] = v
	}
	return c, nil
}

func leerConfig() (*config, error) {
	falta := []string{}
	get := func(k string) string {
		v := strings.TrimSpace(os.Getenv(k))
		if v == "" {
			falta = append(falta, k)
		}
		return v
	}
	c := &config{cliente: get("CLIENTE"), dbName: get("DB_NAME")}
	rawURL := get("DATABASE_URL")
	tok := get("BACKUP_TOKEN")
	if len(falta) > 0 {
		return nil, fmt.Errorf("faltan variables de entorno: %s", strings.Join(falta, ", "))
	}
	if len(tok) < 32 {
		return nil, errors.New("BACKUP_TOKEN debe tener al menos 32 caracteres (genera uno con: openssl rand -hex 32)")
	}
	nombreValido := regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`)
	if !nombreValido.MatchString(c.cliente) || !nombreValido.MatchString(c.dbName) {
		return nil, errors.New("CLIENTE y DB_NAME solo admiten letras, números, punto, guion y guion bajo (forman el nombre del archivo)")
	}
	conn, err := parseDatabaseURL(rawURL)
	if err != nil {
		return nil, err
	}
	c.conn = conn
	c.token = []byte(tok)
	c.secretos = []string{rawURL, tok}
	if conn.password != "" {
		c.secretos = append(c.secretos, conn.password, url.QueryEscape(conn.password), url.PathEscape(conn.password))
	}

	for _, r := range strings.FieldsFunc(os.Getenv("AGE_RECIPIENT"), func(r rune) bool { return r == ',' || r == ' ' || r == '\n' }) {
		if !strings.HasPrefix(r, "age1") && !strings.HasPrefix(r, "ssh-") {
			return nil, errors.New("AGE_RECIPIENT debe ser una o más claves públicas age (age1...) separadas por coma")
		}
		c.ageRecipients = append(c.ageRecipients, r)
	}

	segs := 1800
	if v := os.Getenv("DUMP_TIMEOUT_SEC"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 10 || n > 6*3600 {
			return nil, errors.New("DUMP_TIMEOUT_SEC debe ser un número de segundos entre 10 y 21600")
		}
		segs = n
	}
	c.dumpTimeout = time.Duration(segs) * time.Second
	c.port = envOr("PORT", "8080")
	c.tmpDir = envOr("TMP_DIR", filepath.Join(os.TempDir(), "pg-backup"))
	c.zona, err = time.LoadLocation(envOr("BACKUP_TZ", "America/Guayaquil"))
	if err != nil {
		return nil, fmt.Errorf("BACKUP_TZ no es una zona horaria válida: %w", err)
	}

	out, err := exec.Command("pg_dump", "--version").Output()
	if err != nil {
		return nil, errors.New("no se encontró pg_dump en la imagen")
	}
	c.pgDumpVersion = strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(string(out)), "pg_dump (PostgreSQL)"))
	c.pgDumpMajor = major(c.pgDumpVersion)
	if len(c.ageRecipients) > 0 {
		if _, err := exec.LookPath("age"); err != nil {
			return nil, errors.New("AGE_RECIPIENT está definido pero age no está instalado en la imagen")
		}
	}
	return c, nil
}

func envOr(k, def string) string {
	if v := strings.TrimSpace(os.Getenv(k)); v != "" {
		return v
	}
	return def
}

// major("17.4 (Debian ...)") = 17; major("9.6.24") = 9.
func major(v string) int {
	m := regexp.MustCompile(`^\s*(\d+)`).FindStringSubmatch(v)
	if m == nil {
		return 0
	}
	n, _ := strconv.Atoi(m[1])
	return n
}

// limpiar quita cualquier secreto de un texto antes de registrarlo o devolverlo.
func (c *config) limpiar(s string) string {
	for _, x := range c.secretos {
		if len(x) >= 4 {
			s = strings.ReplaceAll(s, x, "[oculto]")
		}
	}
	return s
}

// ---------------- Servidor ----------------

type servicio struct {
	cfg     *config
	log     *slog.Logger
	ocupado sync.Mutex
	raiz    context.Context // se cancela al apagar el contenedor: corta un pg_dump en curso
}

type errorHTTP struct {
	status int
	msg    string
	etapa  string
}

func (e *errorHTTP) Error() string { return e.msg }

func (s *servicio) json(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func (s *servicio) autorizado(r *http.Request) bool {
	h := r.Header.Get("Authorization")
	const pre = "Bearer "
	if len(h) <= len(pre) || !strings.EqualFold(h[:len(pre)], pre) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(strings.TrimSpace(h[len(pre):])), s.cfg.token) == 1
}

func (s *servicio) health(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		s.json(w, http.StatusMethodNotAllowed, map[string]string{"error": "usa GET"})
		return
	}
	ocupado := !s.ocupado.TryLock()
	if !ocupado {
		s.ocupado.Unlock()
	}
	s.json(w, http.StatusOK, map[string]any{
		"status": "ok", "servicio": "pg-backup", "version": version,
		"cliente": s.cfg.cliente, "db": s.cfg.dbName,
		"pg_dump": s.cfg.pgDumpVersion, "cifrado": len(s.cfg.ageRecipients) > 0, "respaldo_en_curso": ocupado,
	})
}

// check se conecta a la base (solo lectura: SHOW server_version) y compara el major con pg_dump.
func (s *servicio) check(w http.ResponseWriter, r *http.Request) {
	if !s.autorizado(r) {
		s.noAutorizado(w, r)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	sv, err := s.versionServidor(ctx)
	if err != nil {
		s.json(w, http.StatusBadGateway, map[string]any{"ok": false, "error": s.cfg.limpiar(err.Error())})
		return
	}
	compatible := major(sv) <= s.cfg.pgDumpMajor
	res := map[string]any{"ok": compatible, "server_version": sv, "pg_dump": s.cfg.pgDumpVersion, "compatible": compatible, "mismo_major": major(sv) == s.cfg.pgDumpMajor}
	if !compatible {
		res["error"] = fmt.Sprintf("el servidor es PostgreSQL %d y pg_dump es %d: reconstruye la imagen con PG_MAJOR=%d", major(sv), s.cfg.pgDumpMajor, major(sv))
	}
	s.json(w, http.StatusOK, res)
}

func (s *servicio) versionServidor(ctx context.Context) (string, error) {
	cmd := exec.CommandContext(ctx, "psql", "--no-psqlrc", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1",
		"-c", "SET default_transaction_read_only = on; SHOW server_version;")
	cmd.Env = append(baseEnv(), s.cfg.conn.env()...)
	var errb bytes.Buffer
	cmd.Stderr = &errb
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("no se pudo conectar a la base: %s", ultimaLinea(errb.String(), err))
	}
	v := strings.TrimSpace(string(out))
	if i := strings.LastIndex(v, "\n"); i >= 0 {
		v = strings.TrimSpace(v[i+1:])
	}
	return v, nil
}

func (s *servicio) noAutorizado(w http.ResponseWriter, r *http.Request) {
	s.log.Warn("acceso no autorizado", "ruta", r.URL.Path, "remoto", r.RemoteAddr)
	w.Header().Set("WWW-Authenticate", `Bearer realm="pg-backup"`)
	s.json(w, http.StatusUnauthorized, map[string]string{"error": "no autorizado"})
}

func (s *servicio) backup(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", "POST")
		s.json(w, http.StatusMethodNotAllowed, map[string]string{"error": "usa POST"})
		return
	}
	if !s.autorizado(r) {
		s.noAutorizado(w, r)
		return
	}
	if !s.ocupado.TryLock() {
		s.json(w, http.StatusConflict, map[string]string{"error": "ya hay un respaldo en curso; intenta cuando termine"})
		return
	}
	defer s.ocupado.Unlock()

	inicio := time.Now()
	res, err := s.respaldar(r.Context())
	if res != nil && res.dir != "" {
		defer os.RemoveAll(res.dir) // temporales siempre borrados, haya ido bien o mal
	}
	if err != nil {
		e := &errorHTTP{status: http.StatusInternalServerError, msg: err.Error(), etapa: "desconocida"}
		errors.As(err, &e)
		msg := s.cfg.limpiar(e.msg)
		s.log.Error("respaldo fallido", "etapa", e.etapa, "error", msg, "duracion_ms", time.Since(inicio).Milliseconds())
		s.json(w, e.status, map[string]any{"error": msg, "etapa": e.etapa, "cliente": s.cfg.cliente, "db": s.cfg.dbName,
			"duracion_ms": time.Since(inicio).Milliseconds()})
		return
	}

	f, err := os.Open(res.ruta)
	if err != nil {
		s.json(w, http.StatusInternalServerError, map[string]string{"error": "no se pudo leer el respaldo generado", "etapa": "entrega"})
		return
	}
	defer f.Close()
	duracion := time.Since(inicio)
	h := w.Header()
	h.Set("Content-Type", "application/octet-stream")
	h.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, res.nombre))
	h.Set("Content-Length", strconv.FormatInt(res.tamano, 10))
	h.Set("Cache-Control", "no-store")
	h.Set("X-Backup-Filename", res.nombre)
	h.Set("X-Backup-Size", strconv.FormatInt(res.tamano, 10))
	h.Set("X-Backup-Sha256", res.sha256)
	h.Set("X-Backup-Duration-Ms", strconv.FormatInt(duracion.Milliseconds(), 10))
	h.Set("X-Backup-Encrypted", strconv.FormatBool(res.cifrado))
	h.Set("X-Backup-Client", s.cfg.cliente)
	h.Set("X-Backup-Database", s.cfg.dbName)
	h.Set("X-Backup-Server-Version", res.serverVersion)
	h.Set("X-Backup-Pg-Dump-Version", s.cfg.pgDumpVersion)
	h.Set("X-Backup-Toc-Entries", strconv.Itoa(res.entradas))
	h.Set("X-Backup-Started-At", inicio.In(s.cfg.zona).Format(time.RFC3339))
	h.Set("Access-Control-Expose-Headers", "X-Backup-Filename, X-Backup-Size, X-Backup-Sha256, X-Backup-Duration-Ms")
	w.WriteHeader(http.StatusOK)
	n, err := io.Copy(w, f)
	if err != nil || n != res.tamano {
		s.log.Error("entrega incompleta", "enviados", n, "tamano", res.tamano)
		return
	}
	s.log.Info("respaldo entregado", "archivo", res.nombre, "tamano", res.tamano, "sha256", res.sha256,
		"duracion_ms", duracion.Milliseconds(), "cifrado", res.cifrado, "entradas_toc", res.entradas, "servidor", res.serverVersion)
}

type resultado struct {
	dir, ruta, nombre, sha256, serverVersion string
	tamano                                   int64
	cifrado                                  bool
	entradas                                 int
}

func falla(etapa string, status int, format string, a ...any) error {
	return &errorHTTP{status: status, etapa: etapa, msg: fmt.Sprintf(format, a...)}
}

func (s *servicio) respaldar(reqCtx context.Context) (*resultado, error) {
	// El respaldo sigue aunque el cliente HTTP se impaciente (n8n con timeout corto), pero se
	// corta al llegar a DUMP_TIMEOUT_SEC o al apagar el contenedor.
	ctx, cancel := context.WithTimeout(s.raiz, s.cfg.dumpTimeout)
	defer cancel()
	go func() {
		select {
		case <-reqCtx.Done():
			// el cliente se fue: no tiene sentido seguir
			cancel()
		case <-ctx.Done():
		}
	}()

	if err := os.MkdirAll(s.cfg.tmpDir, 0o700); err != nil {
		return nil, falla("preparacion", 500, "no se pudo crear el directorio temporal")
	}
	dir, err := os.MkdirTemp(s.cfg.tmpDir, "job-")
	if err != nil {
		return nil, falla("preparacion", 500, "no se pudo crear el directorio temporal")
	}
	res := &resultado{dir: dir}

	sv, err := s.versionServidor(ctx)
	if err != nil {
		return res, s.siTimeout(ctx, "conexion", falla("conexion", 502, "%s", err.Error()))
	}
	res.serverVersion = sv
	if major(sv) > s.cfg.pgDumpMajor {
		return res, falla("version", 500, "el servidor es PostgreSQL %s y pg_dump es %s: reconstruye la imagen con PG_MAJOR=%d",
			sv, s.cfg.pgDumpVersion, major(sv))
	}

	ahora := time.Now().In(s.cfg.zona)
	base := fmt.Sprintf("%s_%s_%s", s.cfg.cliente, s.cfg.dbName, ahora.Format("2006-01-02_1504"))
	dump := filepath.Join(dir, base+".dump")

	// 1. pg_dump (solo lectura sobre la base)
	cmd := exec.CommandContext(ctx, "pg_dump", "--format=custom", "--no-owner", "--no-privileges", "--no-password", "--file="+dump)
	cmd.Env = append(baseEnv(), s.cfg.conn.env()...)
	cmd.WaitDelay = 10 * time.Second
	var errb bytes.Buffer
	cmd.Stderr = &errb
	if err := cmd.Run(); err != nil {
		return res, s.siTimeout(ctx, "pg_dump", falla("pg_dump", 500, "pg_dump falló: %s", ultimaLinea(errb.String(), err)))
	}

	// 2. Validación: pg_restore --list debe leer el archivo completo y tener entradas.
	lista := exec.CommandContext(ctx, "pg_restore", "--list", dump)
	var outl, errl bytes.Buffer
	lista.Stdout, lista.Stderr = &outl, &errl
	if err := lista.Run(); err != nil {
		return res, s.siTimeout(ctx, "validacion", falla("validacion", 500, "el respaldo no pasó pg_restore --list: %s", ultimaLinea(errl.String(), err)))
	}
	sc := bufio.NewScanner(&outl)
	for sc.Scan() {
		if l := sc.Text(); l != "" && !strings.HasPrefix(l, ";") {
			res.entradas++
		}
	}
	if res.entradas == 0 {
		return res, falla("validacion", 500, "el respaldo no contiene objetos (pg_restore --list vacío)")
	}

	// 3. Cifrado opcional con age; el dump en claro se borra en cuanto existe la versión cifrada.
	final, nombre := dump, base+".dump"
	if len(s.cfg.ageRecipients) > 0 {
		cifrado := dump + ".age"
		args := []string{}
		for _, rcp := range s.cfg.ageRecipients {
			args = append(args, "-r", rcp)
		}
		args = append(args, "-o", cifrado, dump)
		ac := exec.CommandContext(ctx, "age", args...)
		var erra bytes.Buffer
		ac.Stderr = &erra
		if err := ac.Run(); err != nil {
			return res, s.siTimeout(ctx, "cifrado", falla("cifrado", 500, "age falló: %s", ultimaLinea(erra.String(), err)))
		}
		_ = os.Remove(dump)
		final, nombre, res.cifrado = cifrado, base+".dump.age", true
	}

	// 4. Tamaño y SHA-256 del archivo que se entrega.
	f, err := os.Open(final)
	if err != nil {
		return res, falla("hash", 500, "no se pudo abrir el respaldo")
	}
	hs := sha256.New()
	n, err := io.Copy(hs, f)
	f.Close()
	if err != nil {
		return res, falla("hash", 500, "no se pudo leer el respaldo")
	}
	res.ruta, res.nombre, res.tamano, res.sha256 = final, nombre, n, hex.EncodeToString(hs.Sum(nil))
	return res, nil
}

func (s *servicio) siTimeout(ctx context.Context, etapa string, err error) error {
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return falla(etapa, http.StatusGatewayTimeout, "se superó DUMP_TIMEOUT_SEC (%d s) en la etapa %s", int(s.cfg.dumpTimeout.Seconds()), etapa)
	}
	if errors.Is(ctx.Err(), context.Canceled) {
		return falla(etapa, 503, "respaldo cancelado (el cliente cerró la conexión o el servicio se está apagando)")
	}
	return err
}

// baseEnv: solo lo imprescindible del entorno del proceso (sin DATABASE_URL ni BACKUP_TOKEN).
func baseEnv() []string {
	e := []string{"PATH=" + envOr("PATH", "/usr/local/bin:/usr/bin:/bin"), "HOME=" + envOr("HOME", "/tmp"), "LC_ALL=C.UTF-8"}
	return e
}

func ultimaLinea(stderr string, err error) string {
	lineas := []string{}
	for _, l := range strings.Split(strings.TrimSpace(stderr), "\n") {
		if l = strings.TrimSpace(l); l != "" {
			lineas = append(lineas, l)
		}
	}
	if len(lineas) == 0 {
		return err.Error()
	}
	if len(lineas) > 3 {
		lineas = lineas[len(lineas)-3:]
	}
	return strings.Join(lineas, " | ")
}

// ---------------- Arranque ----------------

func main() {
	log := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" { // para HEALTHCHECK de Docker, sin curl ni wget
		resp, err := http.Get("http://127.0.0.1:" + envOr("PORT", "8080") + "/health")
		if err != nil || resp.StatusCode != 200 {
			os.Exit(1)
		}
		os.Exit(0)
	}
	cfg, err := leerConfig()
	if err != nil {
		log.Error("configuración inválida", "error", err.Error()) // los mensajes de leerConfig no incluyen valores
		os.Exit(2)
	}
	// Restos de un respaldo interrumpido por un reinicio.
	_ = os.RemoveAll(cfg.tmpDir)

	raiz, parar := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer parar()
	s := &servicio{cfg: cfg, log: log, raiz: raiz}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.health)
	mux.HandleFunc("/check", s.check)
	mux.HandleFunc("/backup", s.backup)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		s.json(w, http.StatusNotFound, map[string]string{"error": "no existe"})
	})

	srv := &http.Server{
		Addr:              ":" + cfg.port,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      cfg.dumpTimeout + 15*time.Minute, // dump + transferencia del archivo
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    16 << 10,
	}
	go func() {
		<-raiz.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		_ = srv.Shutdown(ctx)
	}()
	log.Info("pg-backup iniciado", "version", version, "puerto", cfg.port, "cliente", cfg.cliente, "db", cfg.dbName,
		"pg_dump", cfg.pgDumpVersion, "cifrado", len(cfg.ageRecipients) > 0, "timeout_s", int(cfg.dumpTimeout.Seconds()),
		"host_db", cfg.conn.host, "sslmode", cfg.conn.sslmode)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Error("servidor detenido", "error", err.Error())
		os.Exit(1)
	}
	_ = os.RemoveAll(cfg.tmpDir)
}
