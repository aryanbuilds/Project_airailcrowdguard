# Railway Track Anomaly Detection System

A web-first computer vision system for detecting railway track faults using mobile photo/video uploads, a **two-stage YOLOv8 cascade pipeline**, and a real-time operator dashboard.

## Project Overview

Field workers or citizens can upload photos or short video clips (5-10s) of railway tracks via a mobile-friendly web interface. The backend analyzes the media using a **two-stage cascade approach**:

1. **Binary Model (Fast Filter)**: Quickly determines if a track is `defective` or `non-defective`
2. **Detailed Model (Classification)**: If defective, classifies the specific defect type with severity level

## Architecture

```
                    MOBILE UPLOAD FLOW
┌─────────────────┐        HTTPS         ┌─────────────────┐
│  Mobile Browser │ ──────────────────►  │  Next.js        │
│                 │     (via ngrok)      │  Frontend       │
│ • Camera Upload │                      │ • Clerk Auth    │
│ • Geolocation   │                      │ • /upload page  │
└─────────────────┘                      └────────┬────────┘
                                                  │
                                    POST /api/v1/media/upload
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │  FastAPI        │
                                         │  Backend        │
                                         │                 │
                                         │ • Frame Extract │
                                         │ • ffmpeg 1fps   │
                                         └────────┬────────┘
                                                  │
                              TWO-STAGE CASCADE INFERENCE
                                                  │
                    ┌─────────────────────────────┴─────────────────────────────┐
                    │                                                           │
                    ▼                                                           ▼
           ┌─────────────────┐                                         ┌─────────────────┐
           │  BINARY MODEL   │ ──── if defective ────────────────────► │ DETAILED MODEL  │
           │  (Fast Filter)  │                                         │ (9-class)       │
           │                 │                                         │                 │
           │ • defective     │                                         │ • broken_rail   │
           │ • non-defective │                                         │ • corrosion     │
           └────────┬────────┘                                         │ • head_checks   │
                    │                                                  │ • squats        │
             if non-defective                                          │ • join_bar      │
                    │                                                  │ + severity      │
                    ▼                                                  └────────┬────────┘
               ┌─────────┐                                                      │
               │  STOP   │                                                      ▼
               │ (save   │                                              ┌─────────────────┐
               │  CPU)   │                                              │ Create Incident │
               └─────────┘                                              │ • Tampering Score│
                                                                        │ • PDF Report    │
                                                                        └─────────────────┘
                                                  │
                                                  ▼
┌─────────────────┐                      ┌─────────────────┐
│  Laptop Browser │ ◄─── Poll ────────── │  SQLite DB      │
│  (Dashboard)    │   /api/incidents     │  + Reports      │
│                 │                      └─────────────────┘
│ • Map View      │
│ • Incident List │
│ • PDF Download  │
└─────────────────┘
```

## Tech Stack

- **Python 3.10+** (Conda Environment: `railway-detection`)
- **Ultralytics YOLOv8** - Two-stage object detection
- **FastAPI** - Backend REST API
- **Next.js** - Frontend (Mobile Upload + Dashboard)
- **Clerk** - Authentication
- **FFmpeg** - Video frame extraction
- **SQLite + SQLAlchemy** - Database
- **ngrok** - Expose local server for mobile access

## Project Structure

```
railway-track-anomaly-detection/
├── backend/
│   ├── main.py              # FastAPI app & upload endpoint
│   ├── database.py          # SQLAlchemy models (Media, Incident)
│   └── ml_worker.py         # Two-stage cascade inference
├── frontend/                # Next.js app
├── notebooks/
│   └── training_pipeline.ipynb  # End-to-end training notebook
├── scripts/
│   ├── train_model.py       # Train binary/detailed/both models
│   ├── visualize_dataset.py # Test cascade inference
│   └── download_weights.py  # Download base YOLO weights
├── data/
│   ├── Railway Track Fault detection.v4i.yolov8/   # Binary dataset
│   └── Railway Track Defect Detection.v1i.yolov8/  # Detailed dataset
├── models/                  # Trained weights
│   ├── binary_model.pt      # Stage 1: defective/non-defective
│   └── detailed_model.pt    # Stage 2: 9 defect classes
├── uploads/                 # Raw uploaded media
├── frames/                  # Extracted frames per media
├── reports/                 # Generated PDF incident reports
├── runs/                    # Training artifacts
├── STAGES.json              # Development roadmap
└── requirements.txt         # Python dependencies
```

## Datasets

| Dataset | Classes | Images | Purpose |
|---------|---------|--------|---------|
| **v4i (Binary)** | `defective`, `non-defective` | ~1200 | Fast filter |
| **v1i (Detailed)** | 9 defect types with severity | ~700 | Classification |

### Detailed Model Classes:
- `broken_rail_medium`
- `corrosion_low`
- `head_checks_high`, `head_checks_low`, `head_checks_medium`
- `railway_join_bar_defects_low`
- `squats_high`, `squats_low`, `squats_medium`

## Quick Start

### 1. Environment Setup (Conda)
```bash
conda create -n railway-detection python=3.10 -y
conda activate railway-detection
pip install -r requirements.txt
```

### 2. Train Models

**Train both models (recommended):**
```bash
python scripts/train_model.py --dataset both
```

**Or train individually:**
```bash
# Binary model (fast filter)
python scripts/train_model.py --dataset binary --epochs 50

# Detailed model (9-class classification)
python scripts/train_model.py --dataset detailed --epochs 50
```

**After training, copy weights:**
```bash
copy runs\detect\train_binary\weights\best.pt models\binary_model.pt
copy runs\detect\train_detailed\weights\best.pt models\detailed_model.pt
```

### 3. Test Cascade Inference
```bash
python scripts/visualize_dataset.py --mode cascade --samples 10
```

### 4. Start Backend (FastAPI)
```bash
uvicorn backend.main:app --reload --port 8000
```

### 5. Start Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```

### 6. Expose for Mobile (ngrok)
```bash
ngrok http 3000
```

## Two-Stage Cascade Explained

```python
# Stage 1: Quick binary check
binary_result = binary_model(image)

if binary_result == "non-defective":
    return "Track is OK"  # STOP - save CPU time

# Stage 2: Only runs if defective
detailed_result = detailed_model(image)

return {
    "defect_type": detailed_result.class_name,
    "severity": extract_severity(detailed_result.class_name),  # HIGH/MEDIUM/LOW
    "confidence": detailed_result.conf
}
```

**Benefits:**
- Skips detailed classification for ~60-80% of clean tracks
- Average CPU time: ~4 seconds per upload (acceptable for demo)
- Explainable results for operators

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/media/upload` | Upload image/video with optional lat/lng |
| GET | `/api/v1/incidents` | List all incidents |
| GET | `/api/v1/media/{id}` | Get media details and frames |

## Development Roadmap

See `STAGES.json` for full plan:

| Stage | Title | Status |
|-------|-------|--------|
| 1 | Repo Scaffolding & Cleanup | Completed |
| 2 | FastAPI Backend & Uploads | Completed |
| 3 | Two-Stage YOLOv8 Pipeline | In Progress |
| 4 | Next.js Frontend: Uploads | Pending |
| 5 | Operator Dashboard | Pending |
| 6 | Demo & Ngrok Setup | Pending |

## Troubleshooting

### NumPy Version Error
```bash
pip install "numpy<2" --force-reinstall
```

### PyTorch Weights Error
```bash
pip install ultralytics --upgrade
del yolov8n.pt  # Delete old weights
```

---
*Developed for Railway Track Safety Monitoring*
