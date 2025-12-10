#!/usr/bin/env bash
set -euo pipefail

echo "[1/2] Generate/Update package.json"
python3 - <<'PY'
import json
from pathlib import Path
p = Path('package.json')
try:
    d = json.loads(p.read_text(encoding='utf-8'))
except Exception:
    d = {}
d.update({
  "name": "voice-pilot-root",
  "private": True,
  "description": "Root workspace for Zoom Duo Recorder",
  "scripts": {"bootstrap": "./scripts/bootstrap.sh"}
})
p.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding='utf-8')
print("package.json updated")
PY

echo "[2/2] Done."
