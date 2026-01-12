# Railway Track Anomaly Detection System

A web-first computer vision system for detecting railway track faults using mobile photo/video uploads, a **two-stage YOLOv8 cascade pipeline**, and a real-time operator dashboard.

## Project Overview

Field workers or citizens can upload photos or short video clips (5-10s) of railway tracks via a mobile-friendly web interface. The backend analyzes the media using a **two-stage cascade approach**:

1. **Binary Model (Fast Filter)**: Quickly determines if a track is `defective` or `non-defective`
2. **Detailed Model (Classification)**: If defective, classifies the specific defect type with severity level

## Key Features

*   **Real-Time Video Analysis**: Extracts frames at 16 FPS, runs YOLO inference, and re-encodes annotated results for web playback.
*   **Mobile-First Uploads**: Geolocation-tagged captures via phone camera.
*   **Operator Dashboard**: Leaflet-based map view with live incident tracking and moving train simulation.
*   **System Console**: Real-time server log monitoring interface (`/console`).
*   **Privacy-First**: No external authentication required (Bypass Mode active for demo).

## Architecture

```
                    MOBILE UPLOAD FLOW                                  Backend Pipeline
┌─────────────────┐        HTTPS         ┌─────────────────┐       ┌──────────────────────┐
│  Mobile Browser │ ──────────────────►  │  Next.js        │       │  FastAPI (Python)    │
│                 │     (via ngrok)      │  Frontend       │       │                      │
│ • Camera Upload │                      │ • /upload       │       │ • ffmpeg re-encode   │
│ • Geolocation   │                      │ • /dashboard    │       │ • opencv annotation  │
└─────────────────┘                      │ • /console      │       │ • YOLOv8 Inference   │
                                         └────────┬────────┘       └──────────┬───────────┘
                                                  │                           │
                                     POST /api/v1/media/upload                │
                                                  │                           │
                                                  ▼                           ▼
                                         ┌─────────────────┐        ┌───────────────────┐
                                         │  SQLite DB      │        │  Two-Stage Model  │
                                         │  (Incidents)    │◄───────│  (Binary+Detailed)│
                                         └─────────────────┘        └───────────────────┘
```

## Tech Stack

- **Python 3.10+** (Conda Environment: `railway-detection`)
- **Ultralytics YOLOv8** - Two-stage object detection
- **FastAPI** - Backend REST API
- **Next.js 16 (Turbopack)** - Frontend (Mobile Upload + Dashboard)
- **OpenCV & FFmpeg** - Video processing pipeline
- **Leaflet** - Mapping engine
- **SQLite** - Database

## Project Structure

```
railway-track-anomaly-detection/
├── backend/
│   ├── main.py              # FastAPI app & logging logic
│   ├── database.py          # SQLAlchemy models
│   └── ml_worker.py         # Video annotation & inference
├── frontend/                # Next.js app
│   ├── src/app/dashboard    # Map & Incident List
│   ├── src/app/console      # Live Log Viewer
│   └── src/app/upload       # Mobile Upload Form
├── models/                  # Trained weights
├── uploads/                 # Raw uploaded media
├── frames/                  # Extracted/Annotated frames & videos
├── logs/                    # Application logs
└── STAGES.json              # Development roadmap
```

## Quick Start

### 1. Environment Setup (Conda)
```bash
conda create -n railway-detection python=3.10 -y
conda activate railway-detection
pip install -r requirements.txt
```
*Note: Ensure FFmpeg is installed and added to your system PATH.*

### 2. Start Backend (FastAPI)
```bash
# Runs on localhost:8000
uvicorn backend.main:app --reload --port 8000 --reload-exclude "frontend/*"
```

### 3. Start Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
# Runs on localhost:3000
```

### 4. Usage
1.  **Open Dashboard**: Go to `http://localhost:3000/dashboard` to view the map.
2.  **Open Console**: Go to `http://localhost:3000/console` to watch logs.
3.  **Upload Media**: Go to `http://localhost:3000/upload` to submit a test video/image.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/media/upload` | Upload image/video with optional lat/lng |
| GET | `/api/v1/incidents` | List all incidents |
| GET | `/api/v1/logs` | Fetch real-time server logs |

## Troubleshooting

### Video Not Playing?
Ensure `ffmpeg` is installed. The backend uses it to convert OpenCV output to H.264 format compatible with browsers.

### Authentication?
Authentication has been disabled for demonstration purposes. The system currently runs in "Admin Bypass" mode.

---
*Developed for Railway Track Safety Monitoring*
# test
