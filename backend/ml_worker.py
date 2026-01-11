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


def annotate_video(input_path: str, output_path: str, target_fps: int = 16) -> Dict:
    """
    Process video: extract frames at target_fps, run inference, annotate, and save.
    
    Args:
        input_path: Path to source video
        output_path: Path to save annotated video
        target_fps: Frames per second to process and save
        
    Returns:
        Dict with aggregate results (tampering score, etc.)
    """
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {input_path}")

    # Video properties
    original_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # Calculate frame skip to achieve target FPS
    skip_frames = max(1, int(original_fps / target_fps))
    
    # Output writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(output_path, fourcc, target_fps, (width, height))
    
    frame_count = 0
    processed_count = 0
    defective_count = 0
    detections = []
    confidences = []
    
    print(f"Processing video: {input_path} at {target_fps} FPS (Original: {original_fps})")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        frame_count += 1
        
        # Process only every Nth frame to match target FPS
        if frame_count % skip_frames != 0:
            continue
            
        # 1. Save temp image for inference (model expects file path)
        # Optimization: In a real prod env, we'd modify inference to accept numpy array
        # For now, we'll just pass the array if the model supports it, or save temp
        # Ultralytics YOLO accepts numpy arrays directly!
        
        processed_count += 1
        
        # Run inference logic (simplified version of run_cascade_inference for direct memory usage)
        # We need to access the globals
        global _binary_model, _detailed_model
        if _binary_model is None or _detailed_model is None:
            load_models()
            
        # Default state
        is_defective = False
        label = None
        current_conf = 0.0
        
        # DIRECT INFERENCE (Skip Binary Filter for Video to ensure visibility)
        # Stage 2: Detailed
        d_res = _detailed_model(frame, verbose=False, conf=0.15) # Lower confidence for video
        
        if d_res and len(d_res[0].boxes) > 0:
            is_defective = True
            
            # Iterate through ALL detections
            for i, box_data in enumerate(d_res[0].boxes):
                class_id = int(box_data.cls[0])
                label = d_res[0].names[class_id]
                conf = float(box_data.conf[0])
                
                # Draw Box
                box = box_data.xyxy[0].cpu().numpy().astype(int)
                cv2.rectangle(frame, (box[0], box[1]), (box[2], box[3]), (0, 0, 255), 3)
                
                # Draw Label
                text = f"{label.upper()} ({conf:.2f})"
                cv2.putText(frame, text, (box[0], box[1] - 10), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
                
                # Add to stats (only once per frame to avoid duplicate counting of frames)
                if i == 0:
                    current_conf = conf # Track highest confidence for stats
                    label_for_stats = label

            if is_defective:
                defective_count += 1
                confidences.append(current_conf)
                detections.append({
                    "frame_idx": frame_count,
                    "time": frame_count / original_fps,
                    "defect": label_for_stats, # Primary defect
                    "confidence": current_conf
                })
                
                # Overlay "ANOMALY DETECTED" stamp
                cv2.putText(frame, "ANOMALY DETECTED", (50, 50), 
                            cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                print(f"Frame {frame_count}: Defect {label_for_stats} detected ({current_conf:.2f})")

                        
        out.write(frame)
        if frame_count % 50 == 0:
             print(f"Processed {frame_count} frames...")

    cap.release()
    out.release()
    
    # Calculate final stats
    detection_rate = defective_count / processed_count if processed_count else 0
    avg_conf = sum(confidences) / len(confidences) if confidences else 0
    score = 0.5 * detection_rate + 0.5 * avg_conf
    
    return {
        "tampering_score": round(score, 3),
        "total_frames": processed_count,
        "defective_frames": defective_count,
        "detections": detections
    }
