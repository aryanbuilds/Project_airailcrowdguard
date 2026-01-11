# Railway Track Anomaly Detection System

A web-first computer vision system for detecting railway track faults using mobile photo/video uploads, YOLOv8, and a real-time operator dashboard.

## 🚀 Project Overview

This system enables field workers or citizens to upload photos or short video clips (5-10s) of railway tracks via a mobile-friendly web interface. The backend analyzes the media using a **YOLOv8** model trained on railway fault data, computes a **Tampering Score**, and displays incidents on a live operator dashboard with map visualization.

## 🏗️ Architecture

```
┌─────────────────┐        HTTPS (ngrok)       ┌─────────────────┐
│  Mobile Browser │ ─────────────────────────► │  Next.js        │
│                 │                            │  Frontend       │
│ • Camera Upload │                            │ • Clerk Auth    │
│ • Geolocation   │                            │ • /upload page  │
└─────────────────┘                            └────────┬────────┘
                                                        │ POST /api/v1/media/upload
                                                        ▼
┌─────────────────┐                            ┌─────────────────┐
│  Laptop Browser │ ◄───────────────────────── │  FastAPI        │
│  (Dashboard)    │      Poll /api/incidents   │  Backend        │
│                 │                            │                 │
│ • MapCN / Leaflet│                           │ • Frame Extract │
│ • Incident List │                            │ • YOLOv8 Infer  │
│ • PDF Download  │                            │ • SQLite DB     │
└─────────────────┘                            └─────────────────┘
```

## 🛠️ Tech Stack

- **Python 3.10+** (Conda Environment: `railway-detection`)
- **FastAPI** - Backend REST API
- **Next.js** - Frontend (Mobile Upload + Dashboard)
- **Clerk** - Authentication
- **Ultralytics YOLOv8** - Object detection
- **FFmpeg** - Video frame extraction
- **SQLite + SQLAlchemy** - Database
- **ngrok** - Expose local server for mobile access

## 📁 Project Structure

```
railway-track-anomaly-detection/
├── backend/
│   ├── main.py              # FastAPI app & upload endpoint
│   ├── database.py          # SQLAlchemy models (Media, Incident)
│   └── ml_worker.py         # YOLOv8 inference (Stage 3)
├── frontend/                # Next.js app (Stage 4)
│   ├── pages/
│   │   ├── upload.tsx       # Mobile upload UI
│   │   └── dashboard.tsx    # Operator dashboard
│   └── ...
├── scripts/
│   ├── train_model.py       # Train YOLOv8 on custom datasets
│   └── visualize_dataset.py # Test model on dataset images
├── data/
│   ├── Railway Track Fault...  # Primary Dataset (2600+ images)
│   └── Track fault detection...# Secondary Dataset
├── models/                  # YOLO weights (yolov8n.pt, best.pt)
├── uploads/                 # Raw uploaded media
├── frames/                  # Extracted frames per media
├── reports/                 # Generated PDF incident reports
├── config/
│   └── settings.py          # Configuration
├── utils/
│   └── image_utils.py       # Image processing helpers
├── STAGES.json              # Development roadmap
└── requirements.txt         # Python dependencies
```

## 🚀 Quick Start

### Prerequisites
- Python 3.10+, Conda
- Node.js 18+, npm
- FFmpeg (`ffprobe` in PATH)
- ngrok account (for mobile access)

### 1. Environment Setup (Conda)
```bash
# Create and activate environment
conda create -n railway-detection python=3.10 -y
conda activate railway-detection

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Start Backend (FastAPI)
```bash
uvicorn backend.main:app --reload --port 8000
```

### 3. Start Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```

### 4. Expose for Mobile (ngrok)
```bash
ngrok http 3000
```
Copy the HTTPS URL and open it on your phone.

## 🏋️ Training the Model

To train YOLOv8 on your railway fault dataset:
```bash
python scripts/train_model.py --dataset "data/Railway Track Fault detection.v4i.yolov8" --epochs 50
```
Trained weights will be saved in `runs/detect/train/weights/best.pt`.

## 📊 Features

- **Mobile-First Uploads**: Users can take photos or record short videos directly from their phone browser.
- **YOLOv8 Inference**: Detects `defective` vs `non-defective` tracks with confidence scores.
- **Tampering Score**: Aggregated score based on detection rate, confidence, and persistence across frames.
- **Live Dashboard**: Map-based view of all incidents with severity indicators.
- **PDF Reports**: Downloadable incident reports with annotated images and GPS coordinates.

## 📈 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/media/upload` | Upload image/video with optional lat/lng |
| GET | `/api/v1/incidents` | List all incidents |
| GET | `/api/v1/media/{id}` | Get media details and frames |

## 🧪 Testing

Run inference on sample dataset images:
```bash
python scripts/visualize_dataset.py
```

## � Development Roadmap

See `STAGES.json` for the full implementation plan:
1. ✅ Repo Scaffolding & Cleanup
2. 🔄 FastAPI Backend & Uploads
3. ⏳ YOLOv8 Inference Pipeline
4. ⏳ Next.js Frontend: Uploads
5. ⏳ Operator Dashboard
6. ⏳ Demo & Ngrok Setup

---
*Developed for Railway Track Safety Monitoring.*
