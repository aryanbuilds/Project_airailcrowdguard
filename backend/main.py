import shutil
import uuid
import os
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, UploadFile, Form, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.database import init_db, get_db, Media, Incident

app = FastAPI(title="Railway Anomaly Detection API")

# CORS setup for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
UPLOAD_DIR = Path("uploads")
FRAMES_DIR = Path("frames")

UPLOAD_DIR.mkdir(exist_ok=True)
FRAMES_DIR.mkdir(exist_ok=True)

# Initialize DB
init_db()

def process_media_background(media_id: str, file_path: Path, media_type: str, db: Session):
    """
    Background task to extract frames and (later) run inference.
    """
    frame_output_dir = FRAMES_DIR / media_id
    frame_output_dir.mkdir(exist_ok=True)

    print(f"Processing media {media_id}: extracting frames...")

    try:
        # If it's a video, use ffmpeg to extract frames at 1 fps
        if media_type == "video":
            # Command: ffmpeg -i input.mp4 -vf fps=1 -q:v 2 frames/%03d.jpg -y
            # We use os.system for simplicity in this prototype. 
            # In massive production, use a queue + distinct worker.
            import subprocess
            cmd = [
                "ffmpeg",
                "-i", str(file_path),
                "-vf", "fps=1",
                "-q:v", "2",
                str(frame_output_dir / "frame_%03d.jpg"),
                "-y"
            ]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"Frames extracted to {frame_output_dir}")
        
        elif media_type == "image":
            # Just copy the image as the single 'frame'
            target_path = frame_output_dir / "frame_001.jpg"
            shutil.copy(file_path, target_path)
            print("Image copied as single frame.")

        # Updated: Trigger ML pipeline here (placeholder for next stage)
        # ml_worker.analyze(media_id, ...)
        
        # Mark as 'analyzed' for now (until we have ML worker)
        # In Stage 3, we will change this status update.
        media_item = db.query(Media).filter(Media.id == media_id).first()
        if media_item:
            media_item.status = "frames_extracted"
            db.commit()

    except Exception as e:
        print(f"Error processing media {media_id}: {e}")
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
    timestamp: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    media_id = str(uuid.uuid4())
    extension = file.filename.split(".")[-1].lower() if "." in file.filename else "tmp"
    
    # Determine type
    media_type = "video" if extension in ["mp4", "mov", "avi"] else "image"
    
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
        status="uploaded"
    )
    db.add(new_media)
    db.commit()
    db.refresh(new_media)

    # Queue background processing
    background_tasks.add_task(process_media_background, media_id, file_path, media_type, db)

    return {
        "media_id": media_id,
        "status": "processing_started",
        "message": "File uploaded successfully. Processing in background."
    }

@app.get("/api/v1/incidents")
def get_incidents(db: Session = Depends(get_db)):
    # Placeholder for Stage 5 Dashboard
    return db.query(Incident).all()

@app.get("/")
def read_root():
    return {"message": "Railway Anomaly Detection API is running."}
