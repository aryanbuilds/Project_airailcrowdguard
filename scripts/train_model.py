"""
Training script for Railway Track Anomaly Detection System
Supports training TWO models:
  1. Binary Model (defective / non-defective) - FAST FILTER
  2. Detailed Model (9-class defect + severity) - CLASSIFICATION
"""

import argparse
from ultralytics import YOLO
from pathlib import Path

# Dataset paths
DATASETS = {
    "binary": "data/Railway Track Fault detection.v4i.yolov8",
    "detailed": "data/Railway Track Defect Detection.v1i.yolov8"
}

def train_model(dataset_key: str, model_name: str = 'yolov8n.pt', epochs: int = 50, imgsz: int = 640):
    """
    Train a YOLOv8 model on the specified dataset.
    
    Args:
        dataset_key: 'binary' or 'detailed' or a custom path
        model_name: Base model to use (yolov8n.pt, yolov8s.pt, etc.)
        epochs: Number of training epochs
        imgsz: Image size for training
    """
    
    # Resolve dataset path
    if dataset_key in DATASETS:
        dataset_path = Path(DATASETS[dataset_key])
    else:
        dataset_path = Path(dataset_key)
    
    dataset_yaml = dataset_path / "data.yaml"
    
    if not dataset_yaml.exists():
        print(f" Error: data.yaml not found at {dataset_yaml}")
        return None

    # Load base model
    print(f" Loading base model: {model_name}")
    model = YOLO(model_name)

    # Train
    print(f" Starting training on '{dataset_key}' dataset...")
    print(f"   Dataset: {dataset_path}")
    print(f"   Epochs: {epochs}")
    print(f"   Image Size: {imgsz}")
    print("-" * 50)
    
    results = model.train(
        data=str(dataset_yaml.absolute()),
        epochs=epochs,
        imgsz=imgsz,
        plots=True,
        project="runs/detect",
        name=f"train_{dataset_key}"
    )
    
    print("\n" + "=" * 50)
    print(" Training complete!")
    print(f"   Results saved to: {results.save_dir}")
    
    best_weights = Path(results.save_dir) / "weights" / "best.pt"
    print(f"   Best weights: {best_weights}")
    
    # Suggest next steps
    print("\n Next Steps:")
    if dataset_key == "binary":
        print(f"   Copy weights to: models/binary_model.pt")
        print(f"   Command: copy \"{best_weights}\" models\\binary_model.pt")
    elif dataset_key == "detailed":
        print(f"   Copy weights to: models/detailed_model.pt")
        print(f"   Command: copy \"{best_weights}\" models\\detailed_model.pt")
    
    return best_weights


def train_both():
    """Train both models sequentially (Binary first, then Detailed)."""
    print("=" * 60)
    print(" TRAINING BOTH MODELS (Two-Stage Pipeline)")
    print("=" * 60)
    
    # Train Binary Model
    print("\n STAGE 1: Training Binary Model (defective / non-defective)")
    binary_weights = train_model("binary", epochs=50)
    
    # Train Detailed Model
    print("\n STAGE 2: Training Detailed Model (9-class defect types)")
    detailed_weights = train_model("detailed", epochs=50)
    
    print("\n" + "=" * 60)
    print(" ALL TRAINING COMPLETE!")
    print("=" * 60)
    print("\n Summary:")
    print(f"   Binary Model:   {binary_weights}")
    print(f"   Detailed Model: {detailed_weights}")
    print("\n Copy these weights to models/ folder for inference.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Train YOLOv8 models for Railway Track Anomaly Detection",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument(
        "--dataset", 
        type=str, 
        default="binary",
        help="Dataset to train on:\n"
             "  'binary'   - defective/non-defective (v4i)\n"
             "  'detailed' - 9-class defects (v1i)\n"
             "  'both'     - Train both models sequentially\n"
             "  Or provide a custom path to dataset folder"
    )
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Base model (yolov8n/s/m/l/x.pt)")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size for training")
    
    args = parser.parse_args()
    
    if args.dataset == "both":
        train_both()
    else:
        train_model(args.dataset, model_name=args.model, epochs=args.epochs, imgsz=args.imgsz)
