"""
Visualization script for Railway Track Anomaly Detection System
Tests BOTH models (Binary + Detailed) on sample images from datasets.

Two-Stage Cascade:
  1. Binary Model: Quick filter (defective / non-defective)
  2. Detailed Model: Only if defective -> classify defect type + severity
"""

import cv2
import random
import argparse
from ultralytics import YOLO
from pathlib import Path

# Dataset paths
DATASETS = {
    "binary": "data/Railway Track Fault detection.v4i.yolov8",
    "detailed": "data/Railway Track Defect Detection.v1i.yolov8"
}

# Model paths (update after training)
MODELS = {
    "binary": "models/binary_model.pt",      # Train with --dataset binary
    "detailed": "models/detailed_model.pt"   # Train with --dataset detailed
}


def extract_severity(class_name: str) -> str:
    """Extract severity level from class name."""
    if "high" in class_name.lower():
        return "HIGH"
    elif "medium" in class_name.lower():
        return "MEDIUM"
    elif "low" in class_name.lower():
        return "LOW"
    return "UNKNOWN"


def run_cascade_inference(image_path: str, binary_model: YOLO, detailed_model: YOLO, threshold: float = 0.5):
    """
    Run two-stage cascade inference on a single image.
    
    Returns:
        dict with results or None if non-defective
    """
    # Stage 1: Binary detection
    binary_result = binary_model(image_path, conf=threshold, verbose=False)
    
    # Check if any defect detected
    boxes = binary_result[0].boxes
    if boxes is None or len(boxes) == 0:
        return {"status": "non-defective", "confidence": 0.0}
    
    # Get highest confidence detection
    max_conf = float(boxes.conf.max())
    
    # If confidence is low, treat as non-defective
    if max_conf < threshold:
        return {"status": "non-defective", "confidence": max_conf}
    
    # Stage 2: Detailed classification (only if defective)
    detailed_result = detailed_model(image_path, conf=0.25, verbose=False)
    
    detailed_boxes = detailed_result[0].boxes
    if detailed_boxes is None or len(detailed_boxes) == 0:
        return {
            "status": "defective",
            "defect_type": "unknown",
            "severity": "UNKNOWN",
            "confidence": max_conf
        }
    
    # Get best detection from detailed model
    best_idx = detailed_boxes.conf.argmax()
    class_id = int(detailed_boxes.cls[best_idx])
    class_name = detailed_result[0].names[class_id]
    conf = float(detailed_boxes.conf[best_idx])
    
    return {
        "status": "defective",
        "defect_type": class_name,
        "severity": extract_severity(class_name),
        "confidence": conf
    }


def visualize_single_model(dataset_path: str, model_path: str, num_samples: int = 5):
    """Run inference using a single model on random samples."""
    img_dir = Path(dataset_path) / "train" / "images"
    output_dir = Path("data/test_results")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if not img_dir.exists():
        print(f"❌ Error: Could not find images at {img_dir}")
        return

    # Load model
    print(f"📦 Loading model: {model_path}")
    model = YOLO(model_path)
    
    # Get random images
    all_images = list(img_dir.glob("*.jpg")) + list(img_dir.glob("*.png"))
    if not all_images:
        print("❌ No images found in dataset!")
        return
        
    samples = random.sample(all_images, min(len(all_images), num_samples))
    
    print(f"🔍 Running inference on {len(samples)} images...")
    
    for img_path in samples:
        results = model(str(img_path), verbose=False)
        res_plotted = results[0].plot()
        out_path = output_dir / f"result_{img_path.name}"
        cv2.imwrite(str(out_path), res_plotted)
        print(f"   Saved: {out_path}")

    print(f"\n✅ Done! Check results in: {output_dir.absolute()}")


def visualize_cascade(num_samples: int = 5):
    """Run two-stage cascade inference on samples from detailed dataset."""
    # Check if trained models exist
    binary_path = Path(MODELS["binary"])
    detailed_path = Path(MODELS["detailed"])
    
    # Fallback to base models if custom not trained
    if not binary_path.exists():
        print(f"⚠️  Binary model not found at {binary_path}, using yolov8n.pt")
        binary_path = Path("models/yolov8n.pt")
    if not detailed_path.exists():
        print(f"⚠️  Detailed model not found at {detailed_path}, using yolov8n.pt")
        detailed_path = Path("models/yolov8n.pt")
    
    # Load models
    print(f"📦 Loading Binary Model:   {binary_path}")
    print(f"📦 Loading Detailed Model: {detailed_path}")
    binary_model = YOLO(str(binary_path))
    detailed_model = YOLO(str(detailed_path))
    
    # Get samples from detailed dataset
    img_dir = Path(DATASETS["detailed"]) / "train" / "images"
    if not img_dir.exists():
        print(f"❌ Error: Could not find images at {img_dir}")
        return
    
    all_images = list(img_dir.glob("*.jpg")) + list(img_dir.glob("*.png"))
    samples = random.sample(all_images, min(len(all_images), num_samples))
    
    print(f"\n🔍 Running CASCADE inference on {len(samples)} images...\n")
    print("-" * 60)
    
    for img_path in samples:
        result = run_cascade_inference(str(img_path), binary_model, detailed_model)
        
        status = result["status"]
        if status == "non-defective":
            print(f"✅ {img_path.name}: NON-DEFECTIVE (conf: {result['confidence']:.2f})")
        else:
            print(f"⚠️  {img_path.name}: {result['defect_type']} | Severity: {result['severity']} | Conf: {result['confidence']:.2f}")
    
    print("-" * 60)
    print("✅ Cascade inference complete!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Visualize model inference on railway dataset")
    parser.add_argument(
        "--mode",
        type=str,
        default="cascade",
        choices=["binary", "detailed", "cascade"],
        help="Mode: 'binary', 'detailed', or 'cascade' (two-stage)"
    )
    parser.add_argument("--samples", type=int, default=5, help="Number of samples to test")
    parser.add_argument("--model", type=str, default=None, help="Custom model path (for single mode)")
    
    args = parser.parse_args()
    
    if args.mode == "cascade":
        visualize_cascade(num_samples=args.samples)
    elif args.mode == "binary":
        model = args.model or MODELS["binary"]
        visualize_single_model(DATASETS["binary"], model, num_samples=args.samples)
    elif args.mode == "detailed":
        model = args.model or MODELS["detailed"]
        visualize_single_model(DATASETS["detailed"], model, num_samples=args.samples)
