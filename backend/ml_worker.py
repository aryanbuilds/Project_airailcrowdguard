"""
ML Worker for Railway Track Anomaly Detection
Two-Stage Cascade Inference: Binary (fast filter) -> Detailed (classification)
"""

from pathlib import Path
from typing import Dict, List, Optional
from ultralytics import YOLO
import cv2

# Model paths
MODELS_DIR = Path("models")
BINARY_MODEL_PATH = MODELS_DIR / "binary_model.pt"
DETAILED_MODEL_PATH = MODELS_DIR / "detailed_model.pt"

# Global model instances (loaded once)
_binary_model: Optional[YOLO] = None
_detailed_model: Optional[YOLO] = None


def load_models():
    """Load both models into memory (call once at startup)."""
    global _binary_model, _detailed_model
    
    if BINARY_MODEL_PATH.exists():
        print(f"Loading Binary Model: {BINARY_MODEL_PATH}")
        _binary_model = YOLO(str(BINARY_MODEL_PATH))
    else:
        print(f"Warning: Binary model not found at {BINARY_MODEL_PATH}")
        _binary_model = YOLO("yolov8n.pt")  # Fallback
    
    if DETAILED_MODEL_PATH.exists():
        print(f"Loading Detailed Model: {DETAILED_MODEL_PATH}")
        _detailed_model = YOLO(str(DETAILED_MODEL_PATH))
    else:
        print(f"Warning: Detailed model not found at {DETAILED_MODEL_PATH}")
        _detailed_model = YOLO("yolov8n.pt")  # Fallback
    
    print("Models loaded successfully!")


def extract_severity(class_name: str) -> str:
    """Extract severity level from class name."""
    class_lower = class_name.lower()
    if "high" in class_lower:
        return "HIGH"
    elif "medium" in class_lower:
        return "MEDIUM"
    elif "low" in class_lower:
        return "LOW"
    return "UNKNOWN"


def run_cascade_inference(image_path: str, threshold: float = 0.5) -> Dict:
    """
    Run two-stage cascade inference on a single image.
    
    Stage 1: Binary model (defective / non-defective)
    Stage 2: Detailed model (9 defect classes) - only if defective
    
    Returns:
        Dict with detection results
    """
    global _binary_model, _detailed_model
    
    if _binary_model is None or _detailed_model is None:
        load_models()
    
    # Stage 1: Binary detection
    binary_result = _binary_model(image_path, conf=threshold, verbose=False)
    boxes = binary_result[0].boxes
    
    if boxes is None or len(boxes) == 0:
        return {
            "status": "non-defective",
            "confidence": 0.0,
            "defect_type": None,
            "severity": None,
            "stage": 1
        }
    
    max_conf = float(boxes.conf.max())
    
    # Check if detection confidence is below threshold
    if max_conf < threshold:
        return {
            "status": "non-defective",
            "confidence": max_conf,
            "defect_type": None,
            "severity": None,
            "stage": 1
        }
    
    # Stage 2: Detailed classification
    detailed_result = _detailed_model(image_path, conf=0.25, verbose=False)
    detailed_boxes = detailed_result[0].boxes
    
    if detailed_boxes is None or len(detailed_boxes) == 0:
        return {
            "status": "defective",
            "confidence": max_conf,
            "defect_type": "unknown",
            "severity": "UNKNOWN",
            "stage": 2
        }
    
    # Get best detection
    best_idx = detailed_boxes.conf.argmax()
    class_id = int(detailed_boxes.cls[best_idx])
    class_name = detailed_result[0].names[class_id]
    conf = float(detailed_boxes.conf[best_idx])
    
    return {
        "status": "defective",
        "confidence": conf,
        "defect_type": class_name,
        "severity": extract_severity(class_name),
        "stage": 2
    }


def process_frames(frame_dir: str, threshold: float = 0.5) -> Dict:
    """
    Process all frames in a directory and aggregate results.
    
    Returns aggregated tampering score and detection summary.
    """
    frame_path = Path(frame_dir)
    frames = list(frame_path.glob("*.jpg")) + list(frame_path.glob("*.png"))
    
    if not frames:
        return {
            "tampering_score": 0.0,
            "total_frames": 0,
            "defective_frames": 0,
            "detections": []
        }
    
    detections = []
    defective_count = 0
    confidences = []
    
    for frame in frames:
        result = run_cascade_inference(str(frame), threshold)
        detections.append({
            "frame": frame.name,
            **result
        })
        
        if result["status"] == "defective":
            defective_count += 1
            confidences.append(result["confidence"])
    
    # Calculate tampering score
    detection_rate = defective_count / len(frames) if frames else 0
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0
    
    # Tampering score formula (explainable)
    tampering_score = 0.5 * detection_rate + 0.5 * avg_confidence
    
    return {
        "tampering_score": round(tampering_score, 3),
        "total_frames": len(frames),
        "defective_frames": defective_count,
        "detection_rate": round(detection_rate, 3),
        "avg_confidence": round(avg_confidence, 3),
        "detections": detections
    }


def get_severity_level(tampering_score: float) -> str:
    """Convert tampering score to severity level."""
    if tampering_score >= 0.7:
        return "HIGH"
    elif tampering_score >= 0.4:
        return "MEDIUM"
    else:
        return "LOW"
