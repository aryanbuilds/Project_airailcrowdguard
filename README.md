# Railway Track Anomaly Detection System

A real-time computer vision system for detecting faults (defective tracks) in railway networks using drone-captured imagery, YOLOv8, and MQTT communication.

## 🚀 Project Overview

This project implements an intelligent monitoring system that analyzes railway tracks for safety hazards. It uses a trained **YOLOv8** model to identify tracks as `defective` or `non-defective`. The system architecture supports real-time data streaming from drones to a central analysis server via the MQTT protocol.

## 🏗️ Architecture

```
┌─────────────────┐    MQTT (Mosquitto)    ┌─────────────────┐    ┌─────────────────┐
│   Drone Client  │ ─────────────────────► │   MQTT Server   │ ──► │  Analysis Server│
│                 │      (Docker)          │                 │    │                 │
│ • Video Stream  │                        │ • Message Broker│    │ • YOLOv8 Detect │
│ • GPS Telemetry │                        │ • Data Routing  │    │ • PDF Reporting │
└─────────────────┘                        └─────────────────┘    └─────────────────┘
```

## 🛠️ Tech Stack

- **Python 3.10+** (Conda Environment)
- **Ultralytics YOLOv8** - Object detection
- **Docker & Docker Compose** - For running the Mosquitto MQTT broker
- **OpenCV** - Video processing
- **Paho-MQTT** - Real-time messaging
- **ReportLab** - Automated PDF reporting

## 📁 Project Structure

```
railway-track-anomaly-detection/
├── client/
│   └── drone_client.py          # Streams video/images to server
├── server/
│   ├── anomaly_detector.py     # Real-time YOLOv8 detector
│   └── pdf_generator.py        # Generates fault reports
├── scripts/
│   ├── train_model.py          # Train YOLOv8 on custom datasets
│   ├── visualize_dataset.py    # Test model on dataset images
│   └── download_weights.py     # Download base YOLO weights
├── data/
│   ├── Railway Track Fault...  # Primary Dataset (2600+ images)
│   ├── Track fault detection...# Secondary Dataset
│   └── reports/                # Generated PDF summaries
├── config/
│   └── settings.py             # System configuration
├── docker-compose.yml          # Mosquitto MQTT setup
└── requirements.txt            # Dependencies
```

## 🚀 Quick Start

### 1. Environment Setup (Conda)
```bash
# Create and activate environment
conda create -n railway-detection python=3.10 -y
conda activate railway-detection

# Install dependencies
pip install -r requirements.txt
```

### 2. Start MQTT Broker (Docker)
Ensure Docker Desktop is running, then start the broker:
```bash
docker-compose up -d
```

### 3. Training the Model
To detect faults reliably, you must train the model on your dataset:
```bash
python scripts/train_model.py --dataset "data/Railway Track Fault detection.v4i.yolov8" --epochs 50
```
*Note: Trained weights will be saved in `runs/detect/train/weights/best.pt`.*

### 4. Running the System

1. **Start Detection Server**:
   ```bash
   python server/anomaly_detector.py
   ```

2. **Run Drone Simulation (Real Data)**:
   Point the client to a video file from your dataset:
   ```bash
   python client/drone_client.py --video-source "data/videos/your_test_video.mp4"
   ```

3. **Inference Test**:
   Run a quick check on random images from your dataset:
   ```bash
   python scripts/visualize_dataset.py
   ```

## 📊 Features

- **Custom-Trained YOLOv8**: Optimized for `defective` vs `non-defective` track classification.
- **Low Latency Protocol**: Uses MQTT for efficient video frame transmission.
- **Automated Reporting**: Generates a PDF report containing annotated images of every detected fault including GPS coordinates.
- **Containerized Infrastructure**: One-click MQTT setup using Docker.

## 📈 Performance
- **Detection Accuracy**: Depends on training (90%+ achievable with provided datasets).
- **Inference Speed**: ~15-30 FPS depending on GPU availability.

---
*Developed for Railway Track Safety Monitoring.*
