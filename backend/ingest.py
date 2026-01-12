"""
Graph Ingestion Pipeline for Railway Anomaly Detection System

This module handles:
1. Converting detection results from the CV pipeline into graph nodes
2. Creating proper relationships between Track -> Segment -> Anomaly
3. Syncing SQLite incidents with Neo4j graph database
4. Demo data generation for testing
"""

import uuid
import random
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pathlib import Path

from backend.graph_db import (
    Neo4jConnection,
    GraphRepository,
    TrackModel,
    SegmentModel,
    InspectionModel,
    AnomalyModel,
    init_graph_schema,
    test_connection
)


# ============================================================================
# Constants for Demo Data
# ============================================================================

TRACK_DATA = [
    {"track_id": "TRACK-001", "name": "Main Line North", "region": "Northern Division", "total_length_km": 145.5},
    {"track_id": "TRACK-002", "name": "Express Corridor East", "region": "Eastern Division", "total_length_km": 89.2},
    {"track_id": "TRACK-003", "name": "Suburban Loop West", "region": "Western Division", "total_length_km": 67.8},
    {"track_id": "TRACK-004", "name": "Freight Line South", "region": "Southern Division", "total_length_km": 203.4},
    {"track_id": "TRACK-005", "name": "High-Speed Connector", "region": "Central Division", "total_length_km": 112.0},
    {"track_id": "TRACK-006", "name": "Mumbai-Delhi Express", "region": "Western Corridor", "total_length_km": 1384.0},
    {"track_id": "TRACK-007", "name": "Chennai Metro Line A", "region": "Southern Metro", "total_length_km": 45.1},
    {"track_id": "TRACK-008", "name": "Kolkata Circular Rail", "region": "Eastern Metro", "total_length_km": 35.8},
    {"track_id": "TRACK-009", "name": "Bangalore Suburban", "region": "Karnataka Division", "total_length_km": 78.3},
    {"track_id": "TRACK-010", "name": "Jaipur-Agra Heritage Line", "region": "Rajasthan Division", "total_length_km": 232.0},
]

ANOMALY_TYPES = [
    "crack",
    "missing_bolt",
    "missing_clamp", 
    "debris",
    "rail_wear",
    "broken_tie",
    "gauge_deviation",
    "vegetation_overgrowth",
    "ballast_deficiency",
    "rail_corrosion",
    "fishplate_crack",
    "sleeper_damage",
    "track_misalignment",
    "drainage_blockage"
]

SEVERITY_WEIGHTS = {
    "CRITICAL": 0.08,
    "HIGH": 0.20,
    "MEDIUM": 0.35,
    "LOW": 0.37
}

TERRAIN_TYPES = ["flat", "hilly", "bridge", "tunnel", "crossing", "curve", "junction", "station_approach"]

INSPECTOR_NAMES = [
    "Rajesh Kumar", "Amit Sharma", "Priya Patel", "Suresh Reddy", "Anil Verma",
    "Deepak Singh", "Kavita Gupta", "Ravi Krishnan", "Neha Joshi", "Vikram Malhotra"
]


# ============================================================================
# Ingestion from CV Pipeline
# ============================================================================

class GraphIngestor:
    """
    Handles ingestion of detection data into Neo4j graph.
    Integrates with existing SQLite-based incident system.
    """
    
    def __init__(self):
        self.repo = GraphRepository()
    
    def ingest_detection_result(
        self,
        media_id: str,
        detection_results: Dict,
        lat: float,
        lng: float,
        reporter_name: Optional[str] = None,
        reporter_phone: Optional[str] = None,
        track_id: Optional[str] = None
    ) -> Dict:
        """
        Ingest CV pipeline detection results into the graph database.
        
        This is called after process_frames() in ml_worker.py completes.
        
        Args:
            media_id: UUID of the uploaded media
            detection_results: Output from process_frames() or annotate_video()
            lat, lng: GPS coordinates from upload
            reporter_name, reporter_phone: Optional reporter info
            track_id: Optional track ID (if known, otherwise nearest track is used)
        
        Returns:
            Dict with created node IDs and summary
        """
        timestamp = datetime.now().isoformat()
        
        # Step 1: Find or create Track (use provided or find nearest)
        if not track_id:
            track_id = self._find_nearest_track(lat, lng)
        
        if not track_id:
            # Create default track if none exists
            track_id = "TRACK-AUTO-001"
            self.repo.create_track(TrackModel(
                track_id=track_id,
                name="Auto-Generated Track",
                region="Unknown",
                total_length_km=10.0,
                status="active"
            ))
        
        # Step 2: Create or find Segment for this location
        segment_id = f"SEG-{media_id[:8]}"
        self.repo.create_segment(SegmentModel(
            segment_id=segment_id,
            track_id=track_id,
            start_km=0.0,
            end_km=1.0,
            lat=lat,
            lng=lng,
            terrain_type="flat"
        ))
        
        # Step 3: Create Inspection record
        inspection_id = f"INSP-{media_id[:8]}"
        self.repo.create_inspection(InspectionModel(
            inspection_id=inspection_id,
            media_id=media_id,
            timestamp=timestamp,
            inspector_name=reporter_name,
            inspector_phone=reporter_phone,
            inspection_type="manual"
        ))
        
        # Step 4: Create Anomaly nodes for each detection
        created_anomalies = []
        detections = detection_results.get("detections", [])
        
        for i, detection in enumerate(detections):
            if detection.get("status") == "defective" or detection.get("defect"):
                anomaly_id = f"ANOM-{media_id[:8]}-{i:03d}"
                
                # Extract fields (handle both image and video detection formats)
                anomaly_type = detection.get("defect_type") or detection.get("defect") or "unknown"
                severity = detection.get("severity") or self._confidence_to_severity(
                    detection.get("confidence", 0.5)
                )
                confidence = detection.get("confidence", 0.5)
                image_path = detection.get("frame") or f"frame_{i:03d}.jpg"
                
                anomaly = AnomalyModel(
                    anomaly_id=anomaly_id,
                    anomaly_type=anomaly_type,
                    severity=severity,
                    confidence=confidence,
                    image_path=f"/frames/{media_id}/{image_path}",
                    description=f"Auto-detected {anomaly_type} with {confidence:.1%} confidence",
                    status="open",
                    detected_at=timestamp
                )
                
                result = self.repo.create_anomaly(anomaly, segment_id, inspection_id)
                created_anomalies.append(result)
        
        return {
            "track_id": track_id,
            "segment_id": segment_id,
            "inspection_id": inspection_id,
            "anomalies_created": len(created_anomalies),
            "anomaly_ids": [a.get("anomaly_id") for a in created_anomalies]
        }
    
    def _find_nearest_track(self, lat: float, lng: float) -> Optional[str]:
        """Find the nearest track based on coordinates."""
        query = """
        MATCH (s:Segment)-[:PART_OF]->(t:Track)
        WITH t, s, 
             point.distance(
                 point({latitude: s.lat, longitude: s.lng}),
                 point({latitude: $lat, longitude: $lng})
             ) as distance
        ORDER BY distance ASC
        LIMIT 1
        RETURN t.track_id as track_id
        """
        results = self.repo.execute_cypher(query, {"lat": lat, "lng": lng})
        return results[0]["track_id"] if results else None
    
    def _confidence_to_severity(self, confidence: float) -> str:
        """Convert confidence score to severity level."""
        if confidence >= 0.9:
            return "CRITICAL"
        elif confidence >= 0.7:
            return "HIGH"
        elif confidence >= 0.4:
            return "MEDIUM"
        return "LOW"


# ============================================================================
# Demo Data Generation
# ============================================================================

def generate_demo_data(num_anomalies: int = 50):
    """
    Generate demo data for testing the Graph-RAG system.
    Creates tracks, segments, inspections, and anomalies.
    """
    print("[Ingest] Starting demo data generation...")
    
    repo = GraphRepository()
    
    # Step 1: Create Tracks
    print("[Ingest] Creating tracks...")
    for track_data in TRACK_DATA:
        repo.create_track(TrackModel(**track_data, status="active"))
    
    # Step 2: Create Segments for each track
    print("[Ingest] Creating segments...")
    segments = []
    for track_data in TRACK_DATA:
        track_id = track_data["track_id"]
        length_km = track_data["total_length_km"]
        
        # Create 5-10 segments per track
        num_segments = random.randint(5, 10)
        segment_length = length_km / num_segments
        
        for i in range(num_segments):
            segment_id = f"SEG-{track_id[-3:]}-{i+1:03d}"
            
            # Generate realistic coordinates (India railway network area)
            base_lat = 20.0 + random.uniform(-5, 5)
            base_lng = 78.0 + random.uniform(-10, 10)
            
            segment = SegmentModel(
                segment_id=segment_id,
                track_id=track_id,
                start_km=i * segment_length,
                end_km=(i + 1) * segment_length,
                lat=base_lat + (i * 0.01),
                lng=base_lng + (i * 0.01),
                terrain_type=random.choice(TERRAIN_TYPES)
            )
            repo.create_segment(segment)
            segments.append(segment_id)
    
    # Step 3: Create Inspections
    print("[Ingest] Creating inspections...")
    inspections = []
    base_date = datetime.now() - timedelta(days=30)
    
    for i in range(num_anomalies):
        inspection_id = f"INSP-{uuid.uuid4().hex[:8]}"
        inspection_date = base_date + timedelta(
            days=random.randint(0, 30),
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59)
        )
        
        inspection = InspectionModel(
            inspection_id=inspection_id,
            media_id=f"MEDIA-{uuid.uuid4().hex[:8]}",
            timestamp=inspection_date.isoformat(),
            inspector_name=random.choice(INSPECTOR_NAMES),
            inspector_phone=f"+91-{random.randint(7000000000, 9999999999)}",
            inspection_type=random.choice(["manual", "drone", "train-mounted", "walking_patrol", "ultrasonic"])
        )
        repo.create_inspection(inspection)
        inspections.append(inspection_id)
    
    # Step 4: Create Anomalies
    print("[Ingest] Creating anomalies...")
    severity_list = list(SEVERITY_WEIGHTS.keys())
    severity_probs = list(SEVERITY_WEIGHTS.values())
    
    for i in range(num_anomalies):
        anomaly_id = f"ANOM-{uuid.uuid4().hex[:8]}"
        anomaly_type = random.choice(ANOMALY_TYPES)
        severity = random.choices(severity_list, weights=severity_probs)[0]
        
        # Confidence correlates with severity
        if severity == "CRITICAL":
            confidence = random.uniform(0.85, 0.99)
        elif severity == "HIGH":
            confidence = random.uniform(0.7, 0.85)
        elif severity == "MEDIUM":
            confidence = random.uniform(0.5, 0.7)
        else:
            confidence = random.uniform(0.3, 0.5)
        
        anomaly = AnomalyModel(
            anomaly_id=anomaly_id,
            anomaly_type=anomaly_type,
            severity=severity,
            confidence=round(confidence, 3),
            image_path=f"/frames/demo/{anomaly_id}.jpg",
            description=f"Demo {anomaly_type} defect detected during routine inspection",
            status=random.choice(["open", "open", "open", "verified", "resolved"]),
            detected_at=(base_date + timedelta(days=random.randint(0, 30))).isoformat()
        )
        
        # Link to random segment and inspection
        segment_id = random.choice(segments)
        inspection_id = random.choice(inspections)
        
        repo.create_anomaly(anomaly, segment_id, inspection_id)
    
    print(f"[Ingest] Demo data generation complete!")
    print(f"  - Tracks: {len(TRACK_DATA)}")
    print(f"  - Segments: {len(segments)}")
    print(f"  - Inspections: {len(inspections)}")
    print(f"  - Anomalies: {num_anomalies}")
    
    return {
        "tracks": len(TRACK_DATA),
        "segments": len(segments),
        "inspections": len(inspections),
        "anomalies": num_anomalies
    }


# ============================================================================
# Sync with SQLite Database
# ============================================================================

def sync_sqlite_to_graph():
    """
    Sync existing SQLite incidents to Neo4j graph.
    Useful for migrating existing data.
    """
    from backend.database import SessionLocal, Incident, Media
    
    db = SessionLocal()
    ingestor = GraphIngestor()
    
    try:
        incidents = db.query(Incident).all()
        print(f"[Sync] Found {len(incidents)} incidents in SQLite")
        
        for incident in incidents:
            # Create mock detection results from incident data
            detection_results = {
                "tampering_score": incident.tampering_score,
                "detections": [{
                    "status": "defective",
                    "defect_type": incident.fault_type,
                    "severity": incident.severity,
                    "confidence": incident.tampering_score,
                    "frame": incident.evidence_frames[0] if incident.evidence_frames else "frame_001.jpg"
                }]
            }
            
            ingestor.ingest_detection_result(
                media_id=incident.media_id,
                detection_results=detection_results,
                lat=incident.lat,
                lng=incident.lng,
                reporter_name=incident.reporter_name,
                reporter_phone=incident.reporter_phone
            )
        
        print(f"[Sync] Successfully synced {len(incidents)} incidents to Neo4j")
        
    finally:
        db.close()


# ============================================================================
# CLI Entry Point
# ============================================================================

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Railway Graph Ingestion Tool")
    parser.add_argument("--demo", action="store_true", help="Generate demo data")
    parser.add_argument("--sync", action="store_true", help="Sync SQLite to Neo4j")
    parser.add_argument("--count", type=int, default=50, help="Number of anomalies for demo")
    parser.add_argument("--init", action="store_true", help="Initialize schema only")
    
    args = parser.parse_args()
    
    # Test connection first
    if not test_connection():
        print("[ERROR] Cannot connect to Neo4j. Please ensure it's running.")
        print("  - Default: bolt://localhost:7687")
        print("  - Set NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD environment variables")
        exit(1)
    
    # Initialize schema
    init_graph_schema()
    
    if args.init:
        print("[Ingest] Schema initialized. Exiting.")
        exit(0)
    
    if args.demo:
        generate_demo_data(num_anomalies=args.count)
    
    if args.sync:
        sync_sqlite_to_graph()
    
    if not args.demo and not args.sync:
        print("[Ingest] No action specified. Use --demo, --sync, or --init")
        print("  Example: python -m backend.ingest --demo --count 100")
