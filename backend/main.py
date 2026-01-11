import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, File, UploadFile, Form, BackgroundTasks, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from backend.database import init_db, get_db, Media, Incident
from backend.ml_worker import load_models, process_frames, get_severity_level

app = FastAPI(title="Railway Anomaly Detection API", version="1.0.0")

# CORS setup for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
UPLOAD_DIR = Path("uploads")
FRAMES_DIR = Path("frames")
REPORTS_DIR = Path("reports")

UPLOAD_DIR.mkdir(exist_ok=True)
FRAMES_DIR.mkdir(exist_ok=True)
REPORTS_DIR.mkdir(exist_ok=True)

# Mount static directories to serve images
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")
app.mount("/frames", StaticFiles(directory=str(FRAMES_DIR)), name="frames")

# Initialize DB and load ML models
init_db()

import logging

# Logging Setup
LOG_FILE = Path("logs") / "app.log"
LOG_FILE.parent.mkdir(exist_ok=True)
logging.basicConfig(
    filename=LOG_FILE,
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%H:%M:%S"
)

def log_event(message: str, level="INFO"):
    """Write log to file and print to console."""
    print(f"[{level}] {message}")
    if level == "ERROR":
        logging.error(message)
    else:
        logging.info(message)

@app.on_event("startup")
async def startup_event():
    """Load ML models on startup."""
    log_event("Starting up RailSafe API...", "INFO")
    log_event("Loading ML models...", "INFO")
    load_models()
    log_event("Models loaded successfully. API Ready.", "SUCCESS")

@app.get("/api/v1/logs")
def get_logs():
    """Get the last 100 lines of logs."""
    if not LOG_FILE.exists():
        return {"logs": ["No logs available yet."]}
    
    try:
        with open(LOG_FILE, "r") as f:
            lines = f.readlines()
            return {"logs": [line.strip() for line in lines[-100:]]}
    except Exception as e:
        return {"logs": [f"Error reading logs: {str(e)}"]}



def process_media_background(media_id: str, file_path: Path, media_type: str, lat: float, lng: float, db: Session):
    """
    Background task to extract frames and run cascade inference.
    """
    frame_output_dir = FRAMES_DIR / media_id
    frame_output_dir.mkdir(exist_ok=True)

    log_event(f"Processing media background task for {media_id}...", "INFO")

    try:
        results = {}
        # Step 1: Process Media (Image vs Video)
        if media_type == "video":
            from backend.ml_worker import annotate_video
            import subprocess
            
            temp_video_path = frame_output_dir / "temp_annotated.mp4"
            final_video_path = frame_output_dir / "annotated.mp4"
            
            log_event(f"Annotating video frame sequence: {file_path}", "INFO")
            
            # Step 1: Run CV2 / YOLO annotation (Produces raw MP4)
            results = annotate_video(str(file_path), str(temp_video_path), target_fps=16)
            
            # Step 2: Use FFmpeg to re-encode for Web Compatibility (H.264 + Faststart)
            if temp_video_path.exists():
                log_event("Re-encoding video for web compatibility (H.264)...", "INFO")
                ffmpeg_cmd = [
                    "ffmpeg",
                    "-i", str(temp_video_path),
                    "-c:v", "libx264",
                    "-preset", "fast",
                    "-crf", "23",
                    "-pix_fmt", "yuv420p", # Critical for browser support
                    "-movflags", "+faststart",
                    str(final_video_path),
                    "-y"
                ]
                try:
                    subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    log_event(f"Video re-encoded successfully: {final_video_path}", "SUCCESS")
                    # Remove temp file
                    temp_video_path.unlink()
                    results["video_file"] = "annotated.mp4"
                except Exception as ff_err:
                    print(f"FFmpeg encoding failed: {ff_err}. Falling back to raw video.")
                    # Fallback: just rename temp to final
                    temp_video_path.replace(final_video_path)
                    results["video_file"] = "annotated.mp4"
            
            log_event(f"Video processing complete. Tampering Score: {results.get('tampering_score')}", "SUCCESS")

        elif media_type == "image":
            # Image logic (existing)
            target_path = frame_output_dir / "frame_001.jpg"
            shutil.copy(file_path, target_path)
            
            log_event(f"Running cascade inference on {media_id}...", "INFO")
            results = process_frames(str(frame_output_dir))
            
            # Add single frame to detection list
            if results["defective_frames"] > 0:
                 results["video_file"] = None 

        tampering_score = results.get("tampering_score", 0.0)
        severity = get_severity_level(tampering_score)
        
        log_event(f"Analysis Complete. Score: {tampering_score} | Severity: {severity}", "INFO")
        
        # Step 3: Update media status
        media_item = db.query(Media).filter(Media.id == media_id).first()
        if media_item:
            media_item.status = "analyzed"
            db.commit()
        
        # Step 4: Create incident if tampering detected
        if tampering_score >= 0.4:  # MEDIUM or HIGH
            # Find most common defect type
            defect_types = [d["defect"] for d in results.get("detections", []) if "defect" in d and d["defect"]]
             # Fallback for image worker dict keys
            if not defect_types:
                defect_types = [d["defect_type"] for d in results.get("detections", []) if "defect_type" in d and d["defect_type"]]

            primary_defect = max(set(defect_types), key=defect_types.count) if defect_types else "unknown"
            
            # Fetch reporter info from media
            media_item = db.query(Media).filter(Media.id == media_id).first()
            
            # Prepare evidence list
            evidence = []
            if results.get("video_file"):
                evidence = [results["video_file"]] # Video file
            else:
                 # Image frames
                evidence = [d["frame"] for d in results.get("detections", []) if "frame" in d]
                if not evidence: # Fallback if no frames listed but score is high
                     evidence = ["frame_001.jpg"]

            incident = Incident(
                id=f"INC-{media_id[:8]}",
                media_id=media_id,
                lat=lat or 0.0,
                lng=lng or 0.0,
                timestamp=datetime.now().isoformat(),
                reporter_name=media_item.reporter_name if media_item else None,
                reporter_phone=media_item.reporter_phone if media_item else None,
                tampering_score=tampering_score,
                fault_type=primary_defect,
                severity=severity,
                status="unverified",
                evidence_frames=evidence
            )
            db.add(incident)
            db.commit()
            log_event(f"Incident created: {incident.id}", "SUCCESS")

    except Exception as e:
        log_event(f"Error processing media {media_id}: {e}", "ERROR")
        media_item = db.query(Media).filter(Media.id == media_id).first()
        if media_item:
            media_item.status = "error"
            db.commit()


@app.post("/api/v1/media/upload")
async def upload_media(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    reporter_id: Optional[str] = Form(None),
    reporter_name: Optional[str] = Form(None),
    reporter_phone: Optional[str] = Form(None),
    timestamp: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Upload image or video for analysis."""
    media_id = str(uuid.uuid4())
    extension = file.filename.split(".")[-1].lower() if "." in file.filename else "tmp"
    
    # Determine type
    media_type = "video" if extension in ["mp4", "mov", "avi", "webm"] else "image"
    
    file_name = f"{media_id}.{extension}"
    file_path = UPLOAD_DIR / file_name

    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Save DB record
    if not timestamp:
        timestamp = datetime.now().isoformat()

    new_media = Media(
        id=media_id,
        filename=str(file_path),
        media_type=media_type,
        lat=lat,
        lng=lng,
        timestamp=timestamp,
        reporter_id=reporter_id,
        reporter_name=reporter_name,
        reporter_phone=reporter_phone,
        status="uploaded"
    )
    db.add(new_media)
    db.commit()
    db.refresh(new_media)

    # Queue background processing
    background_tasks.add_task(
        process_media_background, 
        media_id, file_path, media_type, lat or 0.0, lng or 0.0, db
    )

    return {
        "media_id": media_id,
        "status": "processing_started",
        "message": "File uploaded successfully. Processing in background."
    }


@app.get("/api/v1/incidents")
def get_incidents(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all incidents with optional filtering."""
    query = db.query(Incident)
    
    if severity:
        query = query.filter(Incident.severity == severity.upper())
    if status:
        query = query.filter(Incident.status == status)
    
    incidents = query.order_by(Incident.timestamp.desc()).all()
    
    return [
        {
            "id": inc.id,
            "media_id": inc.media_id,
            "lat": inc.lat,
            "lng": inc.lng,
            "timestamp": inc.timestamp,
            "tampering_score": inc.tampering_score,
            "fault_type": inc.fault_type,
            "severity": inc.severity,
            "status": inc.status,
            "evidence_frames": inc.evidence_frames,
            "reporter_name": inc.reporter_name,
            "reporter_phone": inc.reporter_phone
        }
        for inc in incidents
    ]


@app.get("/api/v1/incidents/{incident_id}")
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    """Get a specific incident by ID."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@app.patch("/api/v1/incidents/{incident_id}")
def update_incident(
    incident_id: str,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Update incident status (verify/dismiss)."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    
    if status:
        incident.status = status
        db.commit()
    
    return {"message": "Incident updated", "id": incident_id, "status": incident.status}


@app.get("/api/v1/media/{media_id}")
def get_media(media_id: str, db: Session = Depends(get_db)):
    """Get media details and frames."""
    media = db.query(Media).filter(Media.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    # List frames
    frame_dir = FRAMES_DIR / media_id
    frames = []
    if frame_dir.exists():
        frames = [f.name for f in frame_dir.glob("*.jpg")]
    
    return {
        "id": media.id,
        "filename": media.filename,
        "media_type": media.media_type,
        "lat": media.lat,
        "lng": media.lng,
        "timestamp": media.timestamp,
        "status": media.status,
        "frames": frames
    }


@app.get("/")
def read_root():
    return {
        "message": "Railway Anomaly Detection API",
        "version": "1.0.0",
        "endpoints": {
            "upload": "POST /api/v1/media/upload",
            "incidents": "GET /api/v1/incidents",
            "incident_detail": "GET /api/v1/incidents/{id}",
            "media_detail": "GET /api/v1/media/{id}"
        }
    }
