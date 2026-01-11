import cv2
import os
import random
from ultralytics import YOLO
from pathlib import Path

def test_on_real_data(dataset_path, model_path='yolov8n.pt', num_samples=5):
    """Run inference on a few random images from the dataset and save results."""
    # Setup paths
    img_dir = Path(dataset_path) / "train" / "images"
    output_dir = Path("data/test_results")
    output_dir.mkdir(parents=True, exist_ok=True)
    
    if not img_dir.exists():
        print(f"Error: Could not find images at {img_dir}")
        return

    # Load model
    model = YOLO(model_path)
    
    # Get random images
    all_images = list(img_dir.glob("*.jpg")) + list(img_dir.glob("*.png"))
    if not all_images:
        print("No images found in dataset!")
        return
        
    samples = random.sample(all_images, min(len(all_images), num_samples))
    
    print(f"Running inference on {len(samples)} images from dataset...")
    
    for img_path in samples:
        # Run detection
        results = model(str(img_path))
        
        # Save annotated image
        res_plotted = results[0].plot()
        out_path = output_dir / f"result_{img_path.name}"
        cv2.imwrite(str(out_path), res_plotted)
        print(f"Saved: {out_path}")

    print(f"\n✅ Done! Check the results in the '{output_dir.absolute()}' folder.")

if __name__ == "__main__":
    dataset = "data/Railway Track Fault detection.v4i.yolov8"
    # If you have already trained a model, change 'yolov8n.pt' to your 'best.pt' path
    test_on_real_data(dataset)
