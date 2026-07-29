# ARTESA Aforo Inteligente

MVP para contar **entradas, salidas y ocupación estimada** en tiendas ARTESA usando una cámara instalada sobre el acceso.

## Qué resuelve

- Detecta únicamente personas.
- Asigna un identificador temporal mediante tracking para no contar cada cuadro de video como una persona nueva.
- Cuenta cuando una trayectoria cruza una línea virtual.
- Diferencia entrada y salida según la dirección del cruce.
- Genera un `event_uuid` único e idempotente para el tablero.
- No almacena video, fotografías, rostros ni plantillas biométricas.

> El sistema evita duplicados durante una trayectoria visible. No pretende reconocer a una persona que regresa horas después ni identificarla entre cámaras. Para hacerlo se requeriría biometría o reidentificación persistente, lo cual no se incluye por privacidad.

## Arquitectura

```text
Cámara cenital / RTSP
        │
        ▼
Servicio local Python
YOLO + BoT-SORT + cruce de línea
        │ eventos JSON
        ▼
Endpoint seguro del tablero Lovable/Supabase
        │
        ▼
Dashboard, reportes y estado de cámaras
```

## Instalación rápida

Requiere Python 3.11 o superior.

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
cp config.example.yaml config.yaml
python counter_service.py --config config.yaml --display
```

En Windows, cambie `source: 0` por el índice correcto de la cámara. Para cámaras IP use una URL RTSP, por ejemplo:

```yaml
camera:
  source: rtsp://usuario:clave@192.168.1.50:554/stream1
```

## Calibración

1. Instalar la cámara mirando hacia abajo, centrada sobre la puerta.
2. Evitar contraluz fuerte y reflejos directos.
3. Ajustar `line_start` y `line_end` en `config.yaml` usando valores relativos entre 0 y 1.
4. Caminar varias veces entrando y saliendo.
5. Si las direcciones están invertidas, cambiar `entry_sign` de `1` a `-1`.
6. Validar al menos 200 cruces manuales antes de usar las métricas comercialmente.

## Evento enviado al dashboard

```json
{
  "event_uuid": "uuid-v4",
  "camera_id": "fabrica-cuenca-puerta-principal",
  "store_id": "fabrica-cuenca",
  "direction": "entry",
  "anonymous_track_uid": "hash-temporal",
  "occurred_at": "2026-07-29T20:00:00+00:00",
  "confidence": 0.91,
  "metadata": {
    "track_id_local": 17,
    "crossing_point": [640.2, 380.1],
    "privacy_mode": "no_face_recognition_no_media_storage"
  }
}
```

La integración usa el encabezado `x-api-key`. Cuando internet falla, los eventos se guardan en `data/pending_events.jsonl` y se reintentan después.

## Cómo evita conteos repetidos

- El tracker mantiene un ID temporal mientras la persona permanece visible.
- Solo se registra un evento al cambiar de lado respecto de la línea.
- `minimum_track_frames` elimina detecciones fugaces.
- `crossing_cooldown_seconds` evita rebotes cerca de la línea.
- El backend debe imponer unicidad sobre `event_uuid`.

## Limitaciones del MVP

- Una sola cámara debe cubrir completamente la puerta.
- Oclusiones fuertes, grupos muy juntos o personas detenidas sobre la línea pueden reducir precisión.
- Si alguien sale del campo visual y vuelve a entrar, puede recibir un nuevo ID; el conteo correcto sigue dependiendo del cruce de línea.
- Para varias puertas se necesita una cámara y un proceso por acceso.
- La ocupación se calcula como `entradas - salidas`; debe existir una función de ajuste manual al abrir/cerrar la tienda.

## Hardware recomendado para piloto

- Cámara IP 1080p con RTSP, lente amplio y alimentación estable.
- Mini PC Intel N100/N305, 16 GB RAM, SSD de 256 GB para una cámara y modelo liviano; validar FPS en sitio.
- Red cableada cuando sea posible.
- UPS pequeño para cámara y mini PC.

## Seguridad y privacidad

- Procesamiento local.
- No se deben almacenar imágenes ni video por defecto.
- No usar reconocimiento facial.
- Rotar la API key y restringir el endpoint.
- Mostrar señalización informativa en la tienda.
- Definir una política interna de acceso, retención y auditoría de métricas.

## Licencias

El repositorio de referencia `Ruby-Chu/top-down-people-counter` está bajo MIT. Este MVP usa el paquete Ultralytics, cuyo repositorio y modelos se distribuyen bajo AGPL-3.0 salvo licencia empresarial aplicable. Antes de un despliegue comercial cerrado, ARTESA debe revisar las obligaciones de licencia o sustituir el detector por una alternativa con licencia compatible.

## Siguiente fase

- Conectar el endpoint generado en Lovable/Supabase.
- Agregar heartbeat de cámara cada 30 segundos.
- Incorporar ajuste manual de ocupación.
- Ejecutar piloto de 7 a 14 días en una tienda.
- Comparar conteo automático versus conteo manual y medir precisión por hora.
