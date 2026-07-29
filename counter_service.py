from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np
import requests
import yaml
from ultralytics import YOLO

LOG = logging.getLogger("artesa-counter")


@dataclass
class TrackState:
    previous_point: tuple[float, float] | None = None
    previous_side: int = 0
    first_seen_monotonic: float = field(default_factory=time.monotonic)
    last_seen_monotonic: float = field(default_factory=time.monotonic)
    observed_frames: int = 0
    last_crossing_monotonic: float = -1e9
    visit_number: int = 0


class EventPublisher:
    def __init__(self, endpoint: str, api_key: str, timeout: float, spool_file: str) -> None:
        self.endpoint = endpoint.strip()
        self.api_key = api_key.strip()
        self.timeout = timeout
        self.spool_path = Path(spool_file)
        self.spool_path.parent.mkdir(parents=True, exist_ok=True)

    def publish(self, event: dict[str, Any]) -> None:
        if not self.endpoint:
            LOG.info("Evento local: %s", json.dumps(event, ensure_ascii=False))
            return

        try:
            response = requests.post(
                self.endpoint,
                json=event,
                headers={"x-api-key": self.api_key, "content-type": "application/json"},
                timeout=self.timeout,
            )
            response.raise_for_status()
            LOG.info("Evento enviado: %s %s", event["direction"], event["event_uuid"])
            self.flush_pending()
        except requests.RequestException as exc:
            LOG.warning("No se pudo enviar el evento; se guarda localmente: %s", exc)
            with self.spool_path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(event, ensure_ascii=False) + "\n")

    def flush_pending(self) -> None:
        if not self.spool_path.exists() or not self.endpoint:
            return
        lines = self.spool_path.read_text(encoding="utf-8").splitlines()
        if not lines:
            return

        remaining: list[str] = []
        for line in lines:
            try:
                event = json.loads(line)
                response = requests.post(
                    self.endpoint,
                    json=event,
                    headers={"x-api-key": self.api_key, "content-type": "application/json"},
                    timeout=self.timeout,
                )
                response.raise_for_status()
            except (json.JSONDecodeError, requests.RequestException):
                remaining.append(line)
        self.spool_path.write_text("\n".join(remaining) + ("\n" if remaining else ""), encoding="utf-8")


def side_of_line(point: tuple[float, float], start: tuple[float, float], end: tuple[float, float]) -> int:
    value = (end[0] - start[0]) * (point[1] - start[1]) - (end[1] - start[1]) * (point[0] - start[0])
    if abs(value) < 1e-6:
        return 0
    return 1 if value > 0 else -1


def anonymous_uid(camera_id: str, track_id: int, visit_number: int, boot_id: str) -> str:
    raw = f"{camera_id}:{boot_id}:{track_id}:{visit_number}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()[:24]


def load_config(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as handle:
        config = yaml.safe_load(handle)
    if not isinstance(config, dict):
        raise ValueError("La configuración YAML no es válida")
    return config


def parse_source(value: Any) -> Any:
    if isinstance(value, int):
        return value
    text = str(value)
    return int(text) if text.isdigit() else text


def build_event(
    *,
    camera_id: str,
    store_id: str,
    track_id: int,
    visit_number: int,
    boot_id: str,
    direction: str,
    confidence: float,
    point: tuple[float, float],
) -> dict[str, Any]:
    event_uuid = str(uuid.uuid4())
    return {
        "event_uuid": event_uuid,
        "camera_id": camera_id,
        "store_id": store_id,
        "direction": direction,
        "anonymous_track_uid": anonymous_uid(camera_id, track_id, visit_number, boot_id),
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "confidence": round(confidence, 4),
        "metadata": {
            "track_id_local": track_id,
            "crossing_point": [round(point[0], 2), round(point[1], 2)],
            "privacy_mode": "no_face_recognition_no_media_storage",
        },
    }


def open_capture(source: Any, width: int, height: int) -> cv2.VideoCapture:
    cap = cv2.VideoCapture(source)
    if width:
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    if height:
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    return cap


def run(config: dict[str, Any], display: bool) -> None:
    camera_cfg = config["camera"]
    model_cfg = config["model"]
    count_cfg = config["counting"]
    integration_cfg = config.get("integration", {})

    camera_id = str(camera_cfg["id"])
    store_id = str(camera_cfg["store_id"])
    source = parse_source(camera_cfg.get("source", 0))
    reconnect_seconds = float(camera_cfg.get("reconnect_seconds", 5))

    model = YOLO(str(model_cfg.get("weights", "yolo11n.pt")))
    confidence_threshold = float(model_cfg.get("confidence", 0.45))
    class_id = int(model_cfg.get("person_class_id", 0))
    tracker = str(model_cfg.get("tracker", "botsort.yaml"))
    device = str(model_cfg.get("device", "cpu"))

    minimum_frames = int(count_cfg.get("minimum_track_frames", 4))
    cooldown = float(count_cfg.get("crossing_cooldown_seconds", 8))
    stale_seconds = float(count_cfg.get("stale_track_seconds", 3))
    entry_sign = int(count_cfg.get("entry_sign", 1))

    publisher = EventPublisher(
        endpoint=str(integration_cfg.get("endpoint", "")),
        api_key=str(integration_cfg.get("api_key", "")),
        timeout=float(integration_cfg.get("timeout_seconds", 5)),
        spool_file=str(integration_cfg.get("spool_file", "data/pending_events.jsonl")),
    )

    states: dict[int, TrackState] = {}
    boot_id = uuid.uuid4().hex[:12]
    entries = exits = 0

    while True:
        cap = open_capture(source, int(camera_cfg.get("width", 0)), int(camera_cfg.get("height", 0)))
        if not cap.isOpened():
            LOG.error("No se pudo abrir la cámara/fuente %r", source)
            time.sleep(reconnect_seconds)
            continue

        LOG.info("Contador iniciado para %s (%s)", camera_id, store_id)
        while cap.isOpened():
            ok, frame = cap.read()
            if not ok or frame is None:
                LOG.warning("Se perdió la señal de video; se intentará reconectar")
                break

            height, width = frame.shape[:2]
            line_start = tuple(np.multiply(count_cfg["line_start"], [width, height]).tolist())
            line_end = tuple(np.multiply(count_cfg["line_end"], [width, height]).tolist())

            results = model.track(
                frame,
                persist=True,
                tracker=tracker,
                classes=[class_id],
                conf=confidence_threshold,
                device=device,
                verbose=False,
            )
            result = results[0]
            now = time.monotonic()

            if result.boxes is not None and result.boxes.id is not None:
                ids = result.boxes.id.int().cpu().tolist()
                boxes = result.boxes.xyxy.cpu().numpy()
                confidences = result.boxes.conf.cpu().numpy()

                for track_id, box, detection_confidence in zip(ids, boxes, confidences):
                    x1, y1, x2, y2 = map(float, box)
                    point = ((x1 + x2) / 2.0, y2)
                    current_side = side_of_line(point, line_start, line_end)
                    state = states.setdefault(track_id, TrackState())
                    state.observed_frames += 1
                    state.last_seen_monotonic = now

                    crossed = (
                        state.previous_side != 0
                        and current_side != 0
                        and state.previous_side != current_side
                        and state.observed_frames >= minimum_frames
                        and now - state.last_crossing_monotonic >= cooldown
                    )
                    if crossed:
                        movement_sign = current_side
                        direction = "entry" if movement_sign == entry_sign else "exit"
                        state.visit_number += 1
                        event = build_event(
                            camera_id=camera_id,
                            store_id=store_id,
                            track_id=track_id,
                            visit_number=state.visit_number,
                            boot_id=boot_id,
                            direction=direction,
                            confidence=float(detection_confidence),
                            point=point,
                        )
                        publisher.publish(event)
                        state.last_crossing_monotonic = now
                        if direction == "entry":
                            entries += 1
                        else:
                            exits += 1

                    state.previous_point = point
                    if current_side != 0:
                        state.previous_side = current_side

                    if display:
                        cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (255, 255, 255), 2)
                        cv2.putText(
                            frame,
                            f"ID {track_id}",
                            (int(x1), max(20, int(y1) - 8)),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.55,
                            (255, 255, 255),
                            2,
                        )

            stale_ids = [track_id for track_id, state in states.items() if now - state.last_seen_monotonic > stale_seconds]
            for track_id in stale_ids:
                del states[track_id]

            if display:
                cv2.line(frame, tuple(map(int, line_start)), tuple(map(int, line_end)), (255, 255, 255), 2)
                cv2.putText(frame, f"Entradas: {entries}  Salidas: {exits}", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
                cv2.putText(frame, "Sin reconocimiento facial", (20, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
                cv2.imshow("ARTESA Aforo Inteligente", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    cap.release()
                    cv2.destroyAllWindows()
                    return

        cap.release()
        time.sleep(reconnect_seconds)


def main() -> None:
    parser = argparse.ArgumentParser(description="Contador anónimo de entradas y salidas para ARTESA")
    parser.add_argument("--config", default="config.yaml", help="Ruta al archivo YAML")
    parser.add_argument("--display", action="store_true", help="Mostrar ventana de diagnóstico")
    args = parser.parse_args()

    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO"),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    run(load_config(args.config), display=args.display)


if __name__ == "__main__":
    main()
