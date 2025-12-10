from __future__ import annotations

import csv
import hashlib
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Tuple


@dataclass(slots=True)
class ThemeRecord:
    theme_id: str
    category: str
    title: str
    role_a_prompt: str
    role_b_prompt: str
    hints: List[str]
    normalized_hash: str


def normalize_title(title: str) -> str:
    """Normalize a title for duplicate detection."""
    normalized = title.replace("　", " ")
    normalized = re.sub(r"\s+", " ", normalized).strip().lower()
    normalized = re.sub(r"[^\w\s]", "", normalized)
    return normalized


def hash_title(title: str) -> str:
    """Generate a deterministic hash from a normalized title."""
    return hashlib.sha1(normalize_title(title).encode("utf-8")).hexdigest()


def load_themes(csv_path: Path) -> Tuple[List[ThemeRecord], Dict[str, List[str]]]:
    """Load themes from CSV and return records plus duplicate mapping."""
    records: List[ThemeRecord] = []
    duplicates: Dict[str, List[str]] = {}

    with csv_path.open("r", encoding="utf-8-sig", newline="") as fp:
        reader = csv.DictReader(fp)
        if reader.fieldnames is None:
            raise ValueError("CSV header is missing")

        for row in reader:
            hints = [
                (row.get(f"hint_{i:02d}") or "").strip()
                for i in range(1, 16)
                if row.get(f"hint_{i:02d}")
            ]

            theme_id = (row.get("theme_id") or "").strip()
            if not theme_id:
                raise ValueError("theme_id is required")

            title = (row.get("title") or "").strip()
            if not title:
                raise ValueError(f"title is required for theme_id={theme_id}")

            record = ThemeRecord(
                theme_id=theme_id,
                category=(row.get("category") or "").strip(),
                title=title,
                role_a_prompt=(row.get("role_A_prompt") or "").strip(),
                role_b_prompt=(row.get("role_B_prompt") or "").strip(),
                hints=hints,
                normalized_hash=hash_title(title),
            )
            records.append(record)
            duplicates.setdefault(record.normalized_hash, []).append(theme_id)

    duplicates = {h: ids for h, ids in duplicates.items() if len(ids) > 1}
    return records, duplicates


def summarize_duplicates(duplicate_map: Dict[str, Iterable[str]]) -> List[Dict[str, Iterable[str]]]:
    """Transform duplicate mapping into serializable summary."""
    return [{"hash": h, "theme_ids": list(ids)} for h, ids in duplicate_map.items()]
