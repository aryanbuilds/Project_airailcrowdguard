import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, File, UploadFile, Form, BackgroundTasks, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
import json

from backend.database import init_db, get_db, Media, Incident
from backend.ml_worker import load_models, process_frames, get_severity_level

# MinIO Storage - Optional, falls back to local if unavailable
USE_MINIO = False
try:
    from backend.storage import (
        init_storage, test_minio_connection, upload_frame,
        get_frame_url, list_frames, migrate_local_frames_to_minio,
        MINIO_ENDPOINT, BUCKET_FRAMES
    )
    USE_MINIO = True
except ImportError:
    print("MinIO storage module not available, using local storage")

app = FastAPI(title="Railway Anomaly Detection API", version="2.0.0")

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


# ============================================================================
# Pydantic Models for Chat API
# ============================================================================

class ChatRequest(BaseModel):
    """Request model for chat endpoint."""
    message: str = Field(..., min_length=1, max_length=2000, description="User's question")
    conversation_id: Optional[str] = Field(None, description="Optional conversation ID for context")


class AnomalyData(BaseModel):
    """Structured anomaly data for frontend rendering."""
    id: Optional[str] = None
    type: Optional[str] = None
    severity: Optional[str] = None
    confidence: Optional[float] = None
    status: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    track_name: Optional[str] = None
    detected_at: Optional[str] = None
    image_path: Optional[str] = None


class ChatResponse(BaseModel):
    """Response model for chat endpoint."""
    answer: str = Field(..., description="Natural language response")
    cypher_query: str = Field(default="", description="Generated Cypher query (for debugging)")
    data: List[dict] = Field(default=[], description="Structured data for UI rendering")
    data_type: str = Field(default="text", description="Type of data: text, anomalies, tracks, stats")
    error: Optional[str] = Field(None, description="Error message if any")


class GraphStatsResponse(BaseModel):
    """Graph database statistics."""
    tracks: int = 0
    segments: int = 0
    inspections: int = 0
    total_anomalies: int = 0
    open_anomalies: int = 0
    critical: int = 0
    high_severity: int = 0


# ============================================================================
# Graph-RAG Chat Endpoints
# ============================================================================

@app.post("/api/v1/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Graph-RAG Chat Endpoint.
    
    Accepts natural language questions about railway anomalies and returns
    answers powered by LangGraph + Ollama + Neo4j.
    
    Example queries:
    - "Show me all critical cracks"
    - "How many anomalies are there by type?"
    - "What tracks have the most issues?"
    - "Find all open HIGH severity issues"
    """
    log_event(f"Chat query received: {request.message[:50]}...", "INFO")
    
    try:
        from backend.agent import process_query
        
        result = await process_query(request.message)
        
        # Determine data type for frontend rendering
        data_type = "text"
        if result.get("data"):
            first_record = result["data"][0] if result["data"] else {}
            if "anomaly_type" in first_record or "type" in first_record or "severity" in first_record:
                data_type = "anomalies"
            elif "track_id" in first_record or "track_name" in first_record:
                data_type = "tracks"
            elif "count" in first_record:
                data_type = "stats"
        
        log_event(f"Chat response generated. Data type: {data_type}, Records: {len(result.get('data', []))}", "SUCCESS")
        
        return ChatResponse(
            answer=result["answer"],
            cypher_query=result.get("cypher_query", ""),
            data=result.get("data", []),
            data_type=data_type,
            error=result.get("error")
        )
        
    except ImportError as e:
        log_event(f"Graph-RAG module not available: {e}", "ERROR")
        return ChatResponse(
            answer="The Graph-RAG system is not fully configured. Please ensure Neo4j is running and Ollama is available.",
            error=str(e),
            data_type="text"
        )
    except Exception as e:
        log_event(f"Chat error: {e}", "ERROR")
        return ChatResponse(
            answer=f"I encountered an error processing your request: {str(e)}",
            error=str(e),
            data_type="text"
        )


@app.get("/api/v1/graph/stats", response_model=GraphStatsResponse)
async def get_graph_stats():
    """Get graph database statistics for dashboard."""
    try:
        from backend.graph_db import GraphRepository
        
        stats = GraphRepository.get_graph_statistics()
        return GraphStatsResponse(**stats)
    except Exception as e:
        log_event(f"Graph stats error: {e}", "ERROR")
        return GraphStatsResponse()


@app.post("/api/v1/graph/init")
async def init_graph_database():
    """Initialize or reset the graph database schema."""
    try:
        from backend.graph_db import init_graph_schema, test_connection
        
        if not test_connection():
            raise HTTPException(status_code=503, detail="Cannot connect to Neo4j")
        
        init_graph_schema()
        log_event("Graph schema initialized", "SUCCESS")
        return {"status": "success", "message": "Graph schema initialized"}
    except Exception as e:
        log_event(f"Graph init error: {e}", "ERROR")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/graph/demo-data")
async def generate_demo_graph_data(count: int = 50):
    """Generate demo data in the graph database."""
    try:
        from backend.ingest import generate_demo_data
        
        result = generate_demo_data(num_anomalies=count)
        log_event(f"Demo data generated: {result}", "SUCCESS")
        return {"status": "success", "created": result}
    except Exception as e:
        log_event(f"Demo data error: {e}", "ERROR")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/graph/sync")
async def sync_sqlite_to_neo4j():
    """Sync existing SQLite incidents to Neo4j."""
    try:
        from backend.ingest import sync_sqlite_to_graph
        
        sync_sqlite_to_graph()
        log_event("SQLite synced to Neo4j", "SUCCESS")
        return {"status": "success", "message": "Data synced to graph database"}
    except Exception as e:
        log_event(f"Sync error: {e}", "ERROR")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/graph/health")
async def graph_health_check():
    """Check Neo4j, Ollama, and MinIO connectivity."""
    global USE_MINIO
    status = {
        "neo4j": False,
        "ollama": False,
        "minio": False,
        "models_loaded": False
    }
    
    # Check Neo4j
    try:
        from backend.graph_db import test_connection
        status["neo4j"] = test_connection()
    except Exception:
        pass
    
    # Check Ollama
    try:
        import requests
        resp = requests.get("http://localhost:11434/api/tags", timeout=5)
        status["ollama"] = resp.status_code == 200
    except Exception:
        pass
    
    # Check MinIO
    try:
        if USE_MINIO:
            status["minio"] = test_minio_connection()
    except Exception:
        pass
    
    # Check YOLO models
    status["models_loaded"] = True  # Already loaded at startup
    
    return status


# ============================================================================
# Storage & Migration Endpoints
# ============================================================================

@app.get("/api/v1/storage/status")
async def storage_status():
    """Get current storage configuration."""
    global USE_MINIO
    return {
        "storage_type": "minio" if USE_MINIO else "local",
        "minio_endpoint": MINIO_ENDPOINT if USE_MINIO else None,
        "minio_connected": test_minio_connection() if USE_MINIO else False,
        "frames_bucket": BUCKET_FRAMES if USE_MINIO else None
    }


@app.post("/api/v1/storage/migrate")
async def migrate_to_minio():
    """Migrate local frames to MinIO storage."""
    global USE_MINIO
    
    if not USE_MINIO:
        raise HTTPException(status_code=503, detail="MinIO storage not available")
    
    try:
        stats = migrate_local_frames_to_minio(FRAMES_DIR)
        log_event(f"Migration complete: {stats}", "SUCCESS")
        return {"status": "success", "stats": stats}
    except Exception as e:
        log_event(f"Migration error: {e}", "ERROR")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/frames/{media_id}/{frame_name}")
async def get_frame(media_id: str, frame_name: str):
    """
    Get frame URL - returns MinIO URL if available, otherwise serves local file.
    """
    global USE_MINIO
    
    if USE_MINIO:
        try:
            frame_url = get_frame_url(media_id, frame_name)
            return {"url": frame_url, "storage": "minio"}
        except Exception:
            pass
    
    # Fallback to local file
    local_path = FRAMES_DIR / media_id / frame_name
    if local_path.exists():
        return {"url": f"/frames/{media_id}/{frame_name}", "storage": "local"}
    
    raise HTTPException(status_code=404, detail="Frame not found")


# ============================================================================
# Original Endpoints (Unchanged)
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Load ML models and initialize storage on startup."""
    global USE_MINIO
    log_event("Starting up RailSafe API...", "INFO")
    
    # Initialize MinIO storage
    if USE_MINIO:
        log_event("Initializing MinIO storage...", "INFO")
        if init_storage():
            log_event(f"MinIO storage ready at {MINIO_ENDPOINT}", "SUCCESS")
        else:
            log_event("MinIO unavailable, using local storage", "WARNING")
            USE_MINIO = False
    
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
    Uploads results to MinIO if available, otherwise uses local storage.
    """
    global USE_MINIO
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
                    
                    # Upload to MinIO if available
                    if USE_MINIO:
                        try:
                            minio_url = upload_frame(media_id, "annotated.mp4", final_video_path)
                            log_event(f"Video uploaded to MinIO: {minio_url}", "SUCCESS")
                        except Exception as minio_err:
                            log_event(f"MinIO upload failed: {minio_err}", "WARNING")
                            
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
            
            # Upload frame to MinIO if available
            if USE_MINIO:
                try:
                    for frame_file in frame_output_dir.glob("*.jpg"):
                        minio_url = upload_frame(media_id, frame_file.name, frame_file)
                        log_event(f"Frame uploaded to MinIO: {frame_file.name}", "SUCCESS")
                except Exception as minio_err:
                    log_event(f"MinIO upload failed: {minio_err}", "WARNING")
            
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
        
        # Step 4: Create incident if tampering detected (Threshold 0.1 for demo/debugging)
        if tampering_score >= 0.0:  # Create incident for EVERYTHING (SAFE or UNSAFE)

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
