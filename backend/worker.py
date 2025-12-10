"""Zoom Duo Recorder Python worker entry point."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any, Callable, Dict

from loguru import logger

from zoom_duo import themes


class Worker:
    def __init__(self) -> None:
        self.handlers: Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]] = {
            "generate_consent_pdf": self.handle_generate_consent_pdf,
            "themes/hash-index": self.handle_themes_hash_index,
            "themes/load-records": self.handle_load_themes,
        }

    def run(self) -> None:
        """Main loop reading JSON lines from stdin."""
        self.emit({"status": "ready"})
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                action = data.get("action")
                payload = data.get("payload") or {}
                request_id = data.get("id")
            except json.JSONDecodeError as exc:
                logger.error("Invalid JSON from Node: {}", exc)
                continue

            if action in self.handlers:
                try:
                    result = self.handlers[action](payload)
                    self.emit(
                        {
                            "id": request_id,
                            "action": action,
                            "status": "ok",
                            "result": result,
                        }
                    )
                except Exception as exc:  # noqa: BLE001 - top-level error boundary
                    logger.exception("Handler failed for action={}", action)
                    self.emit(
                        {
                            "id": request_id,
                            "action": action,
                            "status": "error",
                            "error": {"message": str(exc)},
                        }
                    )
            else:
                logger.warning("Unknown action received: {}", action)
                self.emit(
                    {
                        "id": request_id,
                        "action": action,
                        "status": "error",
                        "error": {"message": f"Unknown action: {action}"},
                    }
                )

    def emit(self, payload: Dict[str, Any]) -> None:
        sys.stdout.write(json.dumps(payload) + "\n")
        sys.stdout.flush()

    def handle_generate_consent_pdf(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Placeholder implementation creating a stub consent PDF."""
        export_root = Path(payload.get("export_root", "."))
        session_dir = Path(payload.get("session_dir", "session"))
        target_dir = export_root / session_dir
        target_dir.mkdir(parents=True, exist_ok=True)
        pdf_path = target_dir / "00_consent.pdf"
        pdf_path.write_text("Consent placeholder", encoding="utf-8")

        logger.info("Generated stub consent PDF at {}", pdf_path)
        return {
            "path": str(pdf_path),
            "session_dir": str(session_dir),
            "submitted_at": payload.get("timestamp")
        }

    def handle_themes_hash_index(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        csv_path = Path(payload.get("csv_path", ""))
        if not csv_path.exists():
            raise FileNotFoundError(f"Theme CSV not found: {csv_path}")

        records, duplicates = themes.load_themes(csv_path)
        duplicate_summary = themes.summarize_duplicates(duplicates)

        logger.info(
            "Loaded %d themes from %s (duplicates=%d)",
            len(records),
            csv_path,
            len(duplicate_summary),
        )

        return {
            "count": len(records),
            "duplicates": duplicate_summary,
        }

    def handle_load_themes(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        csv_path = Path(payload.get("csv_path", ""))
        if not csv_path.exists():
            raise FileNotFoundError(f"Theme CSV not found: {csv_path}")

        records, _ = themes.load_themes(csv_path)
        serialized = [
            {
                "theme_id": record.theme_id,
                "category": record.category,
                "title": record.title,
                "role_A_prompt": record.role_a_prompt,
                "role_B_prompt": record.role_b_prompt,
                "hints": record.hints,
            }
            for record in records
        ]

        return {"items": serialized}


def main() -> None:
    worker = Worker()
    worker.run()


if __name__ == "__main__":
    main()
