# Zoom Duo Recorder

## Overview
Zoom Duo Recorder is a cross-platform desktop assistant built with Electron and Python. The app guides moderators through consent collection, Zoom local recording management, timed conversation prompts, and post-session packaging/upload.

## Features
- Launch-time consent flow with PDF generation (WeasyPrint/Jinja2).
- Zoom recording folder discovery, monitoring, and status tracking.
- Themed conversation sessions with timers, hints, and silence cues.
- Post-session exports following the prescribed directory schema.
- Pluggable upload backends (S3/SFTP/Box) via Python worker.

## Requirements
- macOS 13+ or Windows 11
- Node.js 20+
- Python 3.10+
- ffmpeg 6+

## Getting Started
### Clone & Install
```bash
git clone git@github.com:yukisato15/voice-pilot-2.git
cd voice-pilot-2
npm install --prefix electron
python -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
```

### Development
1. Start the Python worker:
   ```bash
   cd backend
   source .venv/bin/activate
   python worker.py --dev
   ```
2. In a new terminal, launch Electron + Vite:
   ```bash
   cd electron
   npm run dev
   ```

## Directory Structure
```
backend/            # Python worker, services, uploaders
docs/               # Architecture, data specs, process docs
electron/           # Electron main/renderer/preload source
samples/            # Theme CSV sample data
templates/          # Consent PDF template
config.example.json # Sample application settings
```

## Documentation
See the `docs/` directory for architecture, UI flow, data specs, tests, and deployment notes.

## License
TBD – please update once the licensing model is decided.
