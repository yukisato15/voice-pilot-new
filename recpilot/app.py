from __future__ import annotations

import base64
import csv
import io
import json
import logging
import os
import re
import shutil
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from zoneinfo import ZoneInfo
from dotenv import load_dotenv
from flask import Flask, Response, jsonify, render_template, request
from flask_socketio import SocketIO, emit

try:
    from watchdog.events import FileSystemEventHandler  # type: ignore
    from watchdog.observers import Observer  # type: ignore
except ImportError:  # pragma: no cover - optional in cloud
    FileSystemEventHandler = None  # type: ignore
    Observer = None  # type: ignore

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
JST = ZoneInfo("Asia/Tokyo")

def require_env(name: str) -> str:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        raise RuntimeError(f"{name} is required but not set.")
    return value

FLASK_SECRET_KEY = require_env("FLASK_SECRET_KEY")
BASIC_AUTH_USER = os.environ.get("BASIC_USER")
BASIC_AUTH_PASS = os.environ.get("BASIC_PASS")

try:  # Prefer eventlet if available (Render/Gunicorn), fallback to threading locally.
    import eventlet  # type: ignore

    eventlet.monkey_patch()
    ASYNC_MODE = "eventlet"
except Exception:  # pragma: no cover - optional dependency
    ASYNC_MODE = "threading"

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

CONFIG_PATH = Path(os.environ.get("RECPILOT_CONFIG", BASE_DIR.parent / "config.json"))


def load_config() -> Dict[str, object]:
    if CONFIG_PATH.exists():
        try:
            return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            logger.warning("Failed to parse config.json: %s", exc)
    return {}


CONFIG: Dict[str, object] = load_config()


TALK_THEMES_CSV = DATA_DIR / "talk_themes.csv"
REPORT_CSV = DATA_DIR / "report.csv"
EXPORTS_DIR = DATA_DIR / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_DURATION_SEC = 60 * 60  # 1 hour

CANNED_PROMPTS = [
    "声が遠いようなので、もう少しマイク（画面）に近づいてください",
    "声が大きすぎるので、もう少しマイク（画面）から離れてください",
    "少しゆっくり目で話してみましょう",
    "声に出してリアクションしてみましょう",
]

CATEGORY_OPTIONS = [
    "現場でのトラブル",
    "通信トラブル",
    "機材トラブル",
    "個人情報注意",
    "沈黙・無音が5秒以上",
    "その他",
]


def is_basic_auth_enabled() -> bool:
    return bool(BASIC_AUTH_USER) and bool(BASIC_AUTH_PASS)


def require_basic_auth() -> Optional[Response]:
    if not is_basic_auth_enabled():
        return None
    auth = request.authorization
    if not auth or auth.username != BASIC_AUTH_USER or auth.password != BASIC_AUTH_PASS:
        resp = Response("Unauthorized", 401)
        resp.headers["WWW-Authenticate"] = 'Basic realm="RecPilot"'
        return resp
    return None


def create_app() -> Flask:
    app = Flask(
        __name__,
        static_folder="static",
        template_folder="templates",
    )
    app.config["SECRET_KEY"] = FLASK_SECRET_KEY
    return app


app = create_app()
socketio = SocketIO(app, cors_allowed_origins="*", async_mode=ASYNC_MODE)


@app.before_request
def _apply_basic_auth():
    auth_response = require_basic_auth()
    if auth_response:
        return auth_response


def load_talk_themes() -> List[Dict[str, str]]:
    if not TALK_THEMES_CSV.exists():
        return []

    themes: List[Dict[str, str]] = []
    with TALK_THEMES_CSV.open("r", encoding="utf-8-sig", newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            themes.append(
                {
                    "no": row.get("No", "").strip(),
                    "category": row.get("カテゴリ", "").strip(),
                    "title": row.get("テーマ内容", "").strip(),
                    "base_hints": parse_hint_field(row.get("基本ヒント", "")),
                    "extra_hint_1": parse_hint_field(row.get("追加ヒント1", "")),
                    "extra_hint_2": parse_hint_field(row.get("追加ヒント2", "")),
                    "marks": parse_marks_field(row.get("対応マーク", "")),
                },
            )
    return themes


def parse_hint_field(raw: str) -> List[str]:
    if not raw:
        return []
    value = raw.strip()
    if not value:
        return []
    normalized = (
        value.replace("\u3000", " ")
        .replace("\u30fb", "|")
        .replace("\uFF0F", "|")
    )
    return [chunk.strip() for chunk in normalized.split("|") if chunk.strip()]


def parse_marks_field(raw: str) -> List[str]:
    if not raw:
        return []
    text = raw.strip()
    if not text:
        return []
    marks: List[str] = []
    if "未成年" in text:
        marks.append("underage")
    if "個人情報" in text:
        marks.append("personal-info")
    return marks


def timecode_to_seconds(value: str) -> Optional[float]:
    value = (value or "").strip()
    if not value:
        return None
    parts = value.split(":")
    if len(parts) != 3:
        return None
    try:
        hours, minutes, seconds = (int(parts[0]), int(parts[1]), float(parts[2]))
    except ValueError:
        return None
    return hours * 3600 + minutes * 60 + seconds


def seconds_to_timecode(total_seconds: float) -> str:
    safe_seconds = round(float(total_seconds), 3)
    sign = "-" if safe_seconds < 0 else ""
    abs_seconds = abs(safe_seconds)
    hours = int(abs_seconds // 3600)
    minutes = int((abs_seconds % 3600) // 60)
    seconds = abs_seconds - hours * 3600 - minutes * 60
    if abs(seconds - round(seconds)) < 1e-3:
        return f"{sign}{hours:02d}:{minutes:02d}:{int(round(seconds)):02d}"
    return f"{sign}{hours:02d}:{minutes:02d}:{seconds:06.3f}"


def apply_offset_to_timecode(timecode: str, offset_seconds: float) -> str:
    base_seconds = timecode_to_seconds(timecode)
    if base_seconds is None:
        return timecode
    adjusted = base_seconds + offset_seconds
    return seconds_to_timecode(adjusted)


def build_summary_comment(summary: str, offset_seconds: float, offset_source: str) -> str:
    text = (summary or "").strip()
    if offset_source == "none" or abs(offset_seconds) < 1e-3:
        return text
    offset_label = f"{offset_seconds:+.3f}s"
    suffix = f"Offset {offset_label} ({offset_source})"
    if text:
        return f"{text} / {suffix}"
    return suffix


def format_timestamp(value: Optional[datetime]) -> str:
    if not isinstance(value, datetime):
        return ""
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(JST).strftime("%Y/%m/%d %H:%M:%S.%f")[:-3]


ZOOM_TIMESTAMP_PATTERN = re.compile(r"(20\d{2})-(\d{2})-(\d{2})[ _](\d{2})\.(\d{2})\.(\d{2})")


def parse_zoom_timestamp(text: str) -> Optional[datetime]:
    if not text:
        return None
    match = ZOOM_TIMESTAMP_PATTERN.search(text)
    if not match:
        return None
    year, month, day, hour, minute, second = map(int, match.groups())
    try:
        return datetime(year, month, day, hour, minute, second)
    except ValueError:
        return None


def sanitize_component(value: str) -> str:
    cleaned = re.sub(r"[^0-9A-Za-z_-]+", "_", (value or "").strip())
    return cleaned or "NA"


def generate_session_csv(
    group_id: str,
    session_label: str,
    take_label: str,
    summary: str,
    director: str,
    participants: List[str],
    offset_seconds: float,
    offset_source: str,
    start_time_str: str,
    recording_time_str: str,
) -> tuple[bytes, int]:
    report_rows = filter_report_rows(group_id, session_label, take_label)

    participants_str = ", ".join([str(p).strip() for p in participants if str(p).strip()])
    offset_str = f"{offset_seconds:+.3f}" if offset_seconds else "0.000"

    headers = [
        "Marker Name",
        "Comment",
        "Start",
        "End",
        "Duration",
        "Category",
        "Created At",
        "Director",
        "Participants",
        "Take",
        "Group",
        "Session",
        "RecPilot Start",
        "Zoom Recording",
        "Applied Offset (s)",
    ]

    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(headers)

    summary_text = build_summary_comment(summary, offset_seconds, offset_source)
    writer.writerow(
        [
            "Session Summary",
            summary_text,
            "00:00:00",
            "00:00:00",
            "0:00:00",
            "SUMMARY",
            datetime.now(JST).strftime("%Y/%m/%d %H:%M:%S"),
            director,
            participants_str,
            take_label,
            group_id,
            session_label,
            start_time_str,
            recording_time_str,
            offset_str,
        ]
    )

    for row in report_rows:
        marker = (row.get("カテゴリ") or "Marker").strip() or "Marker"
        comment = (row.get("内容") or "").strip()
        start_tc = normalize_timecode(row.get("タイムコード", ""))
        adjusted_start = apply_offset_to_timecode(start_tc, offset_seconds)
        # オフセット適用で00:00:00になってしまう場合は、元のタイムコードを優先して残す
        if adjusted_start == "00:00:00" and start_tc not in ("", "00:00:00"):
            adjusted_start = start_tc
        created_at = (row.get("日時") or "").strip()
        writer.writerow(
            [
                marker,
                comment,
                adjusted_start,
                adjusted_start,
                "0:00:00",
                marker,
                created_at,
                director,
                participants_str,
                take_label,
                group_id,
                session_label,
                start_time_str,
                recording_time_str,
                offset_str,
            ]
        )

    csv_content = buffer.getvalue()
    buffer.close()
    return csv_content.encode("utf-8-sig"), len(report_rows)


def infer_zoom_sessions(saved_files: List[Tuple[Path, Path]]) -> List[Dict[str, object]]:
    sessions: Dict[str, Dict[str, object]] = {}
    for rel_path, dest_path in saved_files:
        rel_parts = list(rel_path.parts)
        folder_key = None
        timestamp = None
        for part in rel_parts:
            candidate = parse_zoom_timestamp(part)
            if candidate:
                folder_key = part
                timestamp = candidate
                break
        if folder_key is None:
            folder_key = rel_parts[0] if rel_parts else dest_path.name
            timestamp = datetime.fromtimestamp(dest_path.stat().st_mtime)
        entry = sessions.setdefault(
            folder_key,
            {
                "folder": folder_key,
                "timestamp": timestamp,
                "files": [],
            },
        )
        if timestamp and timestamp < entry["timestamp"]:
            entry["timestamp"] = timestamp
        entry["files"].append((rel_path, dest_path))
    return list(sessions.values())


def copy_zoom_files_to_take_dir(
    session_files: List[Tuple[Path, Path]],
    take_dir: Path,
    zoom_timestamp: Optional[datetime],
    group_id: str,
    session_label: str,
    take_label: str,
) -> List[str]:
    copied_files: List[str] = []
    if zoom_timestamp is None:
        zoom_timestamp = datetime.now()
    base_prefix = f"{zoom_timestamp.strftime('%Y%m%d_%H%M%S')}_{sanitize_component(group_id)}_{sanitize_component(session_label)}_take{take_label}"
    counters: Dict[str, int] = {}
    for rel_path, src_path in session_files:
        ext = src_path.suffix.lower()
        rel_text = rel_path.as_posix().lower()
        if any(keyword in rel_text for keyword in ["audio", "m4a", "wav"]):
            file_type = "audio"
        elif ext in {".wav", ".m4a", ".aac", ".mp3"}:
            file_type = "audio"
        else:
            file_type = "video"
        counters[file_type] = counters.get(file_type, 0) + 1
        new_name = f"{base_prefix}_{file_type}{counters[file_type]:02d}{ext or ''}"
        dest_path = take_dir / new_name
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_path, dest_path)
        copied_files.append(new_name)
    return copied_files


class SessionOffsetManager:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state: Dict[str, Optional[object]] = {
            "group_id": None,
            "session_label": None,
            "start_time": None,
            "auto_offset": None,
            "manual_offset": None,
            "last_recording_time": None,
            "last_recording_file": None,
        }

    def start_session(self, group_id: str, session_label: str, start_time: datetime) -> None:
        with self._lock:
            self._state.update(
                {
                    "group_id": group_id,
                    "session_label": session_label,
                    "start_time": start_time,
                    "auto_offset": None,
                    "manual_offset": None,
                },
            )
            logger.info("Session started for %s/%s at %s", group_id, session_label, start_time.isoformat())
            # If a recording event already arrived, recompute the offset immediately.
            last_recording_time = self._state.get("last_recording_time")
            if isinstance(last_recording_time, datetime):
                self._update_auto_offset_locked(last_recording_time)

    def register_recording(self, file_path: Path, event_time: datetime) -> None:
        with self._lock:
            self._state["last_recording_time"] = event_time
            self._state["last_recording_file"] = str(file_path)
            logger.info("Detected Zoom recording file %s at %s", file_path, event_time.isoformat())
            self._update_auto_offset_locked(event_time)

    def _update_auto_offset_locked(self, event_time: datetime) -> None:
        start_time = self._state.get("start_time")
        if isinstance(start_time, datetime) and self._state.get("auto_offset") is None:
            offset = (event_time - start_time).total_seconds()
            self._state["auto_offset"] = offset
            logger.info("Computed auto offset %.3f seconds", offset)

    def set_manual_offset(self, offset_seconds: Optional[float]) -> None:
        with self._lock:
            self._state["manual_offset"] = offset_seconds
            if offset_seconds is None:
                logger.info("Manual offset cleared")
            else:
                logger.info("Manual offset set to %.3f seconds", offset_seconds)

    def get_effective_offset(self) -> float:
        with self._lock:
            manual_offset = self._state.get("manual_offset")
            if manual_offset is not None:
                return float(manual_offset)
            auto_offset = self._state.get("auto_offset")
            if auto_offset is not None:
                return float(auto_offset)
            return 0.0

    def get_status(self) -> Dict[str, Optional[object]]:
        with self._lock:
            start_time = self._state.get("start_time")
            auto_offset = self._state.get("auto_offset")
            manual_offset = self._state.get("manual_offset")
            last_recording_time = self._state.get("last_recording_time")
            effective_offset = self.get_effective_offset()
            return {
                "groupId": self._state.get("group_id"),
                "session": self._state.get("session_label"),
                "startTime": start_time.isoformat() if isinstance(start_time, datetime) else None,
                "autoOffsetSeconds": auto_offset,
                "manualOffsetSeconds": manual_offset,
                "effectiveOffsetSeconds": effective_offset,
                "lastRecordingTimestamp": last_recording_time.isoformat() if isinstance(last_recording_time, datetime) else None,
                "lastRecordingFile": self._state.get("last_recording_file"),
                "offsetSource": "manual" if manual_offset is not None else ("auto" if auto_offset is not None else "none"),
            }

    def get_last_recording_file(self) -> Optional[str]:
        with self._lock:
            return self._state.get("last_recording_file")

    def get_last_recording_time(self) -> Optional[datetime]:
        with self._lock:
            ts = self._state.get("last_recording_time")
            return ts if isinstance(ts, datetime) else None

    def get_start_time(self) -> Optional[datetime]:
        with self._lock:
            start_time = self._state.get("start_time")
            return start_time if isinstance(start_time, datetime) else None


if FileSystemEventHandler is None:
    class FileSystemEventHandler:  # type: ignore
        """Fallback when watchdog is not installed (cloud deployment)."""

        pass


if Observer is None:
    class Observer:  # type: ignore
        def __init__(self) -> None:
            self._alive = False

        def schedule(self, *args, **kwargs) -> None:
            pass

        def start(self) -> None:
            self._alive = True

        def stop(self) -> None:
            self._alive = False

        def join(self, timeout: Optional[float] = None) -> None:
            self._alive = False

        def is_alive(self) -> bool:
            return self._alive


class ZoomRecordingHandler(FileSystemEventHandler):
    VALID_EXTENSIONS = {".mp4", ".m4a", ".m4v", ".mov", ".wav", ".mp3"}

    def __init__(self, callback) -> None:
        super().__init__()
        self._callback = callback

    def on_created(self, event) -> None:  # type: ignore[override]
        if getattr(event, "is_directory", False):
            return
        path_obj = Path(event.src_path)
        if path_obj.suffix.lower() not in self.VALID_EXTENSIONS:
            return
        self._callback(path_obj, datetime.now())


class ZoomRecordingMonitor:
    def __init__(self, directory: Optional[str], manager: SessionOffsetManager) -> None:
        self._directory = Path(directory) if directory else None
        self._manager = manager
        self._observer: Optional[Observer] = None

    def start(self) -> None:
        if not self._directory:
            logger.info("Zoom recording directory is not configured; monitoring disabled")
            return
        if not self._directory.exists():
            logger.warning("Zoom recording directory %s does not exist", self._directory)
            return
        if self._observer and self._observer.is_alive():
            return

        handler = ZoomRecordingHandler(self._manager.register_recording)
        observer = Observer()
        observer.schedule(handler, str(self._directory), recursive=True)
        observer.daemon = True
        observer.start()
        self._observer = observer
        logger.info("Monitoring Zoom recordings in %s", self._directory)

    def stop(self) -> None:
        if self._observer and self._observer.is_alive():
            self._observer.stop()
            self._observer.join(timeout=5)
        self._observer = None


session_manager = SessionOffsetManager()
zoom_monitor = ZoomRecordingMonitor(CONFIG.get("zoom_recording_dir"), session_manager)
try:
    zoom_monitor.start()
except Exception as exc:  # pragma: no cover - defensive startup guard
    logger.warning("Failed to start Zoom recording monitor: %s", exc)


def ensure_report_headers() -> None:
    headers = ["日時", "組番号", "セッション", "テイク", "タイムコード", "内容", "カテゴリ"]
    if not REPORT_CSV.exists():
        with REPORT_CSV.open("w", encoding="utf-8", newline="") as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(headers)
        return

    # ヘッダーが古い場合（テイク列なし）は追記前にアップグレードする
    with REPORT_CSV.open("r", encoding="utf-8", newline="") as csvfile:
        reader = csv.reader(csvfile)
        existing_headers = next(reader, [])
        if "テイク" in existing_headers:
            return
        rows = list(reader)

    # 既存データを保持したままヘッダーを更新
    upgraded_rows = []
    for row in rows:
        if len(row) >= 6:
            upgraded_rows.append([row[0], row[1], row[2], "", row[3], row[4], row[5]])
        else:
            upgraded_rows.append((row + [""] * (7 - len(row)))[:7])

    with REPORT_CSV.open("w", encoding="utf-8", newline="") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(headers)
        writer.writerows(upgraded_rows)


def load_report_rows() -> List[Dict[str, str]]:
    ensure_report_headers()
    rows: List[Dict[str, str]] = []
    if not REPORT_CSV.exists():
        return rows
    with REPORT_CSV.open("r", encoding="utf-8", newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            rows.append(row)
    return rows


def filter_report_rows(group_id: str, session_label: str, take_label: Optional[str] = None) -> List[Dict[str, str]]:
    """
    収録の絞り込み: グループ/セッションで絞り、テイク列が存在する場合はテイクも一致させる。
    既存データにテイク列がない場合は従来通り全件を返す。
    """
    take_label = (take_label or "").strip()
    rows = [
        row
        for row in load_report_rows()
        if row.get("組番号", "").strip() == group_id and row.get("セッション", "").strip() == session_label
    ]
    has_take_column = any("テイク" in row.keys() for row in rows)
    if has_take_column and take_label:
        rows = [row for row in rows if (row.get("テイク") or "").strip() == take_label]
    return rows


def normalize_timecode(value: str) -> str:
    if not value:
        return "00:00:00"
    value = value.strip()
    parts = value.split(":")
    if len(parts) == 3 and all(part.isdigit() for part in parts):
        return f"{parts[0].zfill(2)}:{parts[1].zfill(2)}:{parts[2].zfill(2)}"
    try:
        total_seconds = int(float(value))
    except (ValueError, TypeError):
        return "00:00:00"
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    seconds = total_seconds % 60
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


@app.route("/")
def index():
    return render_template("landing.html", current_year=datetime.now().year)


@app.route("/control")
def control():
    themes = load_talk_themes()
    return render_template(
        "control.html",
        duration_seconds=DEFAULT_DURATION_SEC,
        canned_prompts=CANNED_PROMPTS,
        total_themes=len(themes),
        categories=CATEGORY_OPTIONS,
    )


@app.route("/prompt")
def prompt():
    return render_template("prompt.html")


@app.route("/api/session/start", methods=["POST"])
def api_session_start():
    data = request.get_json(silent=True) or {}
    start_ts = data.get("startTimestamp")
    group_id = (data.get("groupId") or "").strip()
    session_label = (data.get("session") or "").strip()
    if not group_id or not session_label:
        return jsonify({"error": "groupId and session are required"}), 400
    if start_ts is None:
        return jsonify({"error": "startTimestamp is required"}), 400
    try:
        start_time = datetime.fromtimestamp(float(start_ts) / 1000.0)
    except (TypeError, ValueError):
        return jsonify({"error": "invalid startTimestamp"}), 400
    session_manager.start_session(group_id, session_label, start_time)
    return jsonify({"success": True, "status": session_manager.get_status()})


@app.route("/api/session/status", methods=["GET"])
def api_session_status():
    status = session_manager.get_status()
    status["monitoringPath"] = CONFIG.get("zoom_recording_dir")
    return jsonify(status)


@app.route("/api/session/offset", methods=["POST"])
def api_session_offset():
    data = request.get_json(silent=True) or {}
    if data.get("clear"):
        session_manager.set_manual_offset(None)
        return jsonify({"success": True, "status": session_manager.get_status()})
    if "manualOffsetSeconds" not in data:
        return jsonify({"error": "manualOffsetSeconds is required unless clearing"}), 400
    try:
        value = float(data["manualOffsetSeconds"])
    except (TypeError, ValueError):
        return jsonify({"error": "manualOffsetSeconds must be a number"}), 400
    session_manager.set_manual_offset(value)
    return jsonify({"success": True, "status": session_manager.get_status()})


@app.route("/api/themes", methods=["GET"])
def api_themes():
    themes = load_talk_themes()
    payload = []
    for theme in themes:
        base_hints = theme.get("base_hints") or []
        extra_hint_1 = theme.get("extra_hint_1") or []
        extra_hint_2 = theme.get("extra_hint_2") or []
        marks = theme.get("marks") or []
        payload.append(
            {
                "no": theme["no"],
                "category": theme["category"],
                "title": theme["title"],
                "baseHints": base_hints,
                "extraHint1": extra_hint_1,
                "extraHint2": extra_hint_2,
                "marks": marks,
            },
        )
    return jsonify({"themes": payload})


@app.route("/api/report", methods=["POST"])
def api_report():
    ensure_report_headers()
    data = request.get_json(silent=True) or {}
    content = (data.get("content") or "").strip()

    group_id = (data.get("groupId") or "").strip()
    session_label = (data.get("session") or "").strip()
    take_label = (str(data.get("take") or "").strip())
    category = (data.get("category") or "").strip()
    timecode = (data.get("timecode") or "").strip() or "--:--:--"

    timestamp = datetime.now(JST).strftime("%Y/%m/%d %H:%M:%S")

    row = [timestamp, group_id, session_label, take_label, timecode, content, category]
    with REPORT_CSV.open("a", encoding="utf-8", newline="") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(row)

    return jsonify(
        {
            "success": True,
            "row": {
                "timestamp": timestamp,
                "groupId": group_id,
                "session": session_label,
                "take": take_label,
                "timecode": timecode,
                "content": content,
                "category": category,
            },
        },
    )


@socketio.on("send_prompt")
def handle_send_prompt(data: Optional[Dict[str, str]]) -> None:
    message = (data or {}).get("message", "").strip()
    emit(
        "prompt_update",
        {
            "message": message,
            "sentAt": datetime.now().isoformat(),
        },
        broadcast=True,
    )


@socketio.on("clear_prompt")
def handle_clear_prompt() -> None:
    emit(
        "prompt_update",
        {
            "message": "",
            "sentAt": datetime.now().isoformat(),
        },
        broadcast=True,
    )


@socketio.on("prompt_overlay")
def handle_prompt_overlay(data: Optional[Dict[str, object]]) -> None:
    emit("prompt_overlay", data or {}, broadcast=True)


@socketio.on("theme_update")
def handle_theme_update(data: Optional[Dict[str, object]]) -> None:
    payload = {
        "title": (data or {}).get("title", ""),
        "category": (data or {}).get("category", ""),
        "hints": (data or {}).get("hints", []) or [],
    }
    emit("theme_update", payload, broadcast=True)


@socketio.on("time_update")
def handle_time_update(data: Optional[Dict[str, object]]) -> None:
    payload = {
        "elapsed": max(0, int((data or {}).get("elapsed", 0) or 0)),
        "remaining": max(0, int((data or {}).get("remaining", 0) or 0)),
        "running": bool((data or {}).get("running", False)),
    }
    emit("time_update", payload, broadcast=True)


@socketio.on("send_reaction")
def handle_send_reaction(data: Optional[Dict[str, str]]) -> None:
    """リアクションをPrompt画面にブロードキャスト"""
    if not data:
        return
    emoji = (data.get("emoji") or "").strip()
    label = (data.get("label") or "").strip()
    if not emoji or not label:
        return
    payload = {
        "emoji": emoji,
        "label": label,
    }
    emit("show_reaction", payload, broadcast=True)


@socketio.on("screen_attention")
def handle_screen_attention() -> None:
    """画面注目アラートをPrompt画面にブロードキャスト"""
    emit("screen_attention", broadcast=True)


@app.route("/api/export-session", methods=["POST"])
def api_export_session():
    ensure_report_headers()
    data = request.get_json(silent=True) or {}
    group_id = (data.get("groupId") or "").strip()
    session_label = (data.get("session") or "").strip()
    take_label = str(data.get("take") or "1").strip()
    summary = (data.get("summary") or "").strip()
    director = (data.get("director") or "").strip()
    participants = data.get("participants") or []

    if not group_id or not session_label:
        return jsonify({"error": "組とセッションを指定してください。"}), 400
    if take_label not in {"1", "2", "3"}:
        return jsonify({"error": "収録回数は 1 / 2 / 3 を指定してください。"}), 400

    session_status = session_manager.get_status()
    start_time_dt = session_manager.get_start_time()
    recording_time_dt = session_manager.get_last_recording_time()
    try:
        offset_seconds = float(session_status.get("effectiveOffsetSeconds") or 0.0)
    except (TypeError, ValueError):
        offset_seconds = 0.0
    offset_source = session_status.get("offsetSource") or "none"
    start_time_str = format_timestamp(start_time_dt)
    recording_time_str = format_timestamp(recording_time_dt)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{group_id}_{session_label}_take{take_label}.csv"
    filepath = EXPORTS_DIR / filename

    csv_bytes, rows_count = generate_session_csv(
        group_id,
        session_label,
        take_label,
        summary,
        director,
        participants,
        offset_seconds,
        offset_source,
        start_time_str,
        recording_time_str,
    )

    with filepath.open("wb") as export_file:
        export_file.write(csv_bytes)

    encoded = base64.b64encode(csv_bytes).decode("ascii")

    return jsonify(
        {
            "success": True,
            "filename": filename,
            "content": encoded,
            "savedPath": str(filepath),
            "rows": rows_count,
            "offsetSeconds": offset_seconds,
            "offsetSource": offset_source,
            "recpilotStartTimestamp": start_time_str,
            "zoomRecordingTimestamp": recording_time_str,
        },
    )


@app.route("/api/export-summary", methods=["POST"])
def api_export_summary():
    ensure_report_headers()
    data = request.get_json(silent=True) or {}
    group_id = (data.get("groupId") or "").strip()
    session_label = (data.get("session") or "").strip()
    director = (data.get("director") or "").strip()
    participants = data.get("participants") or []
    finished_takes = data.get("finishedTakes") or []

    if not group_id or not session_label:
        return jsonify({"error": "組とセッションを指定してください。"}), 400

    session_status = session_manager.get_status()
    start_time_dt = session_manager.get_start_time()
    recording_time_dt = session_manager.get_last_recording_time()
    try:
        offset_seconds = float(session_status.get("effectiveOffsetSeconds") or 0.0)
    except (TypeError, ValueError):
        offset_seconds = 0.0
    offset_source = session_status.get("offsetSource") or "none"
    start_time_str = format_timestamp(start_time_dt)
    recording_time_str = format_timestamp(recording_time_dt)
    offset_str = f"{offset_seconds:+.3f}" if offset_seconds else "0.000"

    report_rows = [
        row
        for row in load_report_rows()
        if row.get("組番号", "").strip() == group_id and row.get("セッション", "").strip() == session_label
    ]

    filename = f"{group_id}_{session_label}_summary.csv"
    filepath = EXPORTS_DIR / filename

    headers = [
        "Marker Name",
        "Comment",
        "Start",
        "End",
        "Duration",
        "Category",
        "Created At",
        "Director",
        "Participants",
        "Take",
        "Group",
        "Session",
        "RecPilot Start",
        "Zoom Recording",
        "Applied Offset (s)",
    ]

    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(headers)

    participants_str = ", ".join([p.strip() for p in participants if p and p.strip()])

    for take in finished_takes:
        take_label = str(take.get("take") or "").strip() or "-"
        summary_text = (take.get("summary") or "").strip()
        exported_at = (take.get("exportedAt") or datetime.now().isoformat())[:19].replace("T", " ")
        writer.writerow(
            [
                f"Take {take_label} Summary",
                build_summary_comment(summary_text, offset_seconds, offset_source),
                "00:00:00",
                "00:00:00",
                "0:00:00",
                "SUMMARY",
                exported_at,
                director,
                participants_str,
                take_label,
                group_id,
                session_label,
                start_time_str,
                recording_time_str,
                offset_str,
            ],
        )

    for row in report_rows:
        marker = (row.get("カテゴリ") or "Marker").strip() or "Marker"
        comment = (row.get("内容") or "").strip()
        start_tc = normalize_timecode(row.get("タイムコード", ""))
        adjusted_start = apply_offset_to_timecode(start_tc, offset_seconds)
        created_at = (row.get("日時") or "").strip()
        writer.writerow(
            [
                marker,
                comment,
                adjusted_start,
                adjusted_start,
                "0:00:00",
                marker,
                created_at,
                director,
                participants_str,
                "",
                group_id,
                session_label,
                start_time_str,
                recording_time_str,
                offset_str,
            ],
        )

    csv_content = buffer.getvalue()
    buffer.close()

    csv_bytes = csv_content.encode("utf-8-sig")

    with filepath.open("wb") as export_file:
        export_file.write(csv_bytes)

    encoded = base64.b64encode(csv_bytes).decode("ascii")

    return jsonify(
        {
            "success": True,
            "filename": filename,
            "content": encoded,
            "savedPath": str(filepath),
            "rows": len(report_rows),
            "offsetSeconds": offset_seconds,
            "offsetSource": offset_source,
            "recpilotStartTimestamp": start_time_str,
            "zoomRecordingTimestamp": recording_time_str,
        },
    )


@app.route("/api/final-export", methods=["POST"])
def api_final_export():
    ensure_report_headers()
    metadata_raw = request.form.get("metadata")
    if not metadata_raw:
        return jsonify({"error": "metadata is required"}), 400
    try:
        metadata = json.loads(metadata_raw)
    except json.JSONDecodeError:
        return jsonify({"error": "metadata could not be parsed"}), 400

    group_id = (metadata.get("groupId") or "").strip()
    session_label = (metadata.get("session") or "").strip()
    director = (metadata.get("director") or "").strip()
    participants = metadata.get("participants") or []
    if not group_id or not session_label:
        return jsonify({"error": "組とセッションを入力してください。"}), 400

    uploaded_files = request.files.getlist("files")
    if not uploaded_files:
        return jsonify({"error": "録画ファイルが選択されていません。"}), 400

    timestamp_label = datetime.now().strftime("%Y%m%d_%H%M%S")
    working_dir = EXPORTS_DIR / f"{sanitize_component(group_id)}_{sanitize_component(session_label)}_{timestamp_label}"
    source_dir = working_dir / "source"
    output_dir = working_dir / "output"
    source_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    saved_files: List[Tuple[Path, Path]] = []
    for storage in uploaded_files:
        filename = storage.filename or getattr(storage, "name", None) or f"file_{len(saved_files) + 1}"
        rel_path = Path(filename)
        dest_path = source_dir / rel_path
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        storage.save(dest_path)
        saved_files.append((rel_path, dest_path))

    zoom_sessions = infer_zoom_sessions(saved_files)
    zoom_sessions.sort(key=lambda item: item.get("timestamp") or datetime.min)

    segments_raw = metadata.get("segments") or []
    segments: List[Dict[str, object]] = []
    for segment in segments_raw:
        seg_id = str(segment.get("id") or "")
        order = segment.get("order") or len(segments) + 1
        take_label = str(segment.get("take") or order)
        start_ts = segment.get("startTimestamp")
        note = (segment.get("note") or "").strip()
        summary = (segment.get("summary") or "").strip()
        start_dt = None
        if start_ts not in (None, ""):
            try:
                start_dt = datetime.fromtimestamp(float(start_ts) / 1000.0)
            except (TypeError, ValueError):
                start_dt = None
        segments.append(
            {
                "id": seg_id,
                "order": int(order or len(segments) + 1),
                "take": take_label,
                "start_dt": start_dt,
                "note": note,
                "summary": summary,
            }
        )

    segments.sort(key=lambda item: item["start_dt"] or datetime.min)

    takes_map = {str(item.get("take")): item for item in metadata.get("takes") or []}

    processed_segments = []
    for idx, segment in enumerate(segments):
        take_label = str(segment.get("take") or idx + 1)
        zoom_session = zoom_sessions[idx] if idx < len(zoom_sessions) else (zoom_sessions[-1] if zoom_sessions else None)
        zoom_start_dt = zoom_session.get("timestamp") if zoom_session else None
        rec_start_dt = segment.get("start_dt")
        if rec_start_dt and zoom_start_dt:
            offset_seconds = (zoom_start_dt - rec_start_dt).total_seconds()
            offset_source = "calculated"
        else:
            offset_seconds = 0.0
            offset_source = "default"
        start_time_str = format_timestamp(rec_start_dt)
        recording_time_str = format_timestamp(zoom_start_dt)
        summary_text = segment.get("summary") or takes_map.get(take_label, {}).get("summary", "")
        note_text = segment.get("note", "")

        csv_bytes, rows_count = generate_session_csv(
            group_id,
            session_label,
            take_label,
            summary_text,
            director,
            participants,
            offset_seconds,
            offset_source,
            start_time_str,
            recording_time_str,
        )

        take_dir = output_dir / f"take{take_label}"
        take_dir.mkdir(parents=True, exist_ok=True)
        csv_filename = f"{sanitize_component(group_id)}_{sanitize_component(session_label)}_take{take_label}.csv"
        (take_dir / csv_filename).write_bytes(csv_bytes)

        if note_text:
            note_filename = f"{sanitize_component(group_id)}_{sanitize_component(session_label)}_take{take_label}_note.txt"
            (take_dir / note_filename).write_text(note_text, encoding="utf-8")

        copied_files = []
        if zoom_session:
            copied_files = copy_zoom_files_to_take_dir(
                zoom_session.get("files", []),
                take_dir,
                zoom_start_dt,
                group_id,
                session_label,
                take_label,
            )

        processed_segments.append(
            {
                "take": take_label,
                "offsetSeconds": round(offset_seconds, 3),
                "recpilotStart": start_time_str,
                "zoomStart": recording_time_str,
                "rows": rows_count,
                "files": copied_files,
            }
        )

    archive_base = output_dir.parent / f"{sanitize_component(group_id)}_{sanitize_component(session_label)}_{timestamp_label}"
    archive_path = shutil.make_archive(str(archive_base), "zip", root_dir=output_dir)
    archive_bytes = Path(archive_path).read_bytes()
    encoded_archive = base64.b64encode(archive_bytes).decode("ascii")

    return jsonify(
        {
            "success": True,
            "archiveName": Path(archive_path).name,
            "archiveContent": encoded_archive,
            "savedPath": str(archive_path),
            "segments": processed_segments,
        }
    )


@app.route("/api/status", methods=["GET"])
def api_status():
    themes = load_talk_themes()
    return jsonify(
        {
            "themes": len(themes),
            "reportPath": str(REPORT_CSV),
        },
    )


@app.route("/api/reload-themes", methods=["POST"])
def api_reload_themes():
    data = request.get_json(silent=True) or {}
    reset_history = bool(data.get("resetHistory", False))

    try:
        themes = load_talk_themes()
        return jsonify(
            {
                "success": True,
                "count": len(themes),
                "resetHistory": reset_history,
            }
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True)
