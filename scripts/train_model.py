"""
Training script for Railway Track Anomaly Detection System
Uses YOLOv8 to train on the provided datasets.
"""

import os
import argparse
from ultralytics import YOLO
from pathlib import Path

def train_model(dataset_path, model_name='yolov8n.pt', epochs=50, imgsz=640):
    # Absolute path to the dataset's data.yaml
    dataset_yaml = Path(dataset_path) / "data.yaml"
    
    if not dataset_yaml.exists():
        print(f"Error: dataset.yaml not found at {dataset_yaml}")
        return

    # Load a model
    model = YOLO(model_name)  # load a pretrained model (recommended for training)

    # Train the model
    print(f"Starting training on {dataset_path}...")
    results = model.train(
        data=str(dataset_yaml.absolute()),
        epochs=epochs,
        imgsz=imgsz,
        plots=True
    )
    
    print("Training complete!")
    print(f"Results saved to: {results.save_dir}")
    
    # Path to the best weights
    best_weights = Path(results.save_dir) / "weights" / "best.pt"
    print(f"Best weights: {best_weights}")
    
    return best_weights

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train YOLOv8 on Railway datasets")
    parser.add_argument("--dataset", type=str, required=True, help="Path to the dataset directory")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Base model to use")
    
    args = parser.parse_args()
    
    train_model(args.dataset, model_name=args.model, epochs=args.epochs)
