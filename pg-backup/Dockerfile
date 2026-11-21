# pg-backup: un binario Go estático sobre la imagen oficial de PostgreSQL (que aporta pg_dump,
# pg_restore y psql del mismo major que el servidor).
#
#   docker build --build-arg PG_MAJOR=17 -t pg-backup:17 .
#
# PG_MAJOR debe ser igual al major del servidor (SHOW server_version): pg_dump tiene que ser
# >= servidor. /check lo verifica y /backup se niega si no se cumple.
ARG PG_MAJOR=17

FROM golang:1.24-alpine AS build
WORKDIR /src
# Solo si se construye detrás de un proxy con CA propia: docker build --secret id=ca,src=ca.crt
# (sin el secreto se usan los certificados del sistema).
ARG AGE_VERSION=v1.2.1
RUN --mount=type=secret,id=ca,required=false \
    if [ -s /run/secrets/ca ]; then export SSL_CERT_FILE=/run/secrets/ca; fi; \
    CGO_ENABLED=0 GOBIN=/out go install -trimpath -ldflags="-s -w" filippo.io/age/cmd/age@${AGE_VERSION}
COPY go.mod ./
COPY cmd ./cmd
ARG VERSION=dev
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.version=${VERSION}" -o /out/pg-backup ./cmd/pg-backup

FROM postgres:${PG_MAJOR}-alpine
COPY --from=build /out/age /usr/local/bin/age
COPY --from=build /out/pg-backup /usr/local/bin/pg-backup
RUN mkdir -p /tmp/pg-backup && chown postgres:postgres /tmp/pg-backup

# Sin servidor PostgreSQL: se reemplaza el entrypoint de la imagen base y se corre sin root.
USER postgres
WORKDIR /tmp
ENV PORT=8080 TMP_DIR=/tmp/pg-backup BACKUP_TZ=America/Guayaquil DUMP_TIMEOUT_SEC=1800
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD ["/usr/local/bin/pg-backup", "healthcheck"]
ENTRYPOINT ["/usr/local/bin/pg-backup"]
