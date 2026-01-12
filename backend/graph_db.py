"""
Neo4j Graph Database Module for Railway Anomaly Detection System

Schema:
- Nodes: Track, Segment, Inspection, Anomaly
- Relationships: 
  - (:Segment)-[:PART_OF]->(:Track)
  - (:Anomaly)-[:LOCATED_AT]->(:Segment)
  - (:Anomaly)-[:FOUND_IN]->(:Inspection)
"""

import os
from typing import Dict, List, Optional, Any
from datetime import datetime
from contextlib import contextmanager

from neo4j import GraphDatabase, Driver
from pydantic import BaseModel, Field


# ============================================================================
# Configuration
# ============================================================================

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "password")


# ============================================================================
# Pydantic Models for Type Safety
# ============================================================================

class TrackModel(BaseModel):
    """Track node model."""
    track_id: str = Field(..., description="Unique track identifier (e.g., 'TRACK-001')")
    name: str = Field(..., description="Track name (e.g., 'Main Line North')")
    region: str = Field(default="Unknown", description="Geographic region")
    total_length_km: float = Field(default=0.0, description="Total track length in km")
    status: str = Field(default="active", description="Track status: active, maintenance, closed")


class SegmentModel(BaseModel):
    """Segment node model - represents a geo-located section of track."""
    segment_id: str = Field(..., description="Unique segment identifier")
    track_id: str = Field(..., description="Parent track ID")
    start_km: float = Field(..., description="Start kilometer marker")
    end_km: float = Field(..., description="End kilometer marker")
    lat: float = Field(..., description="Latitude of segment center")
    lng: float = Field(..., description="Longitude of segment center")
    terrain_type: str = Field(default="flat", description="Terrain: flat, hilly, bridge, tunnel")


class InspectionModel(BaseModel):
    """Inspection node model - represents a single inspection event."""
    inspection_id: str = Field(..., description="Unique inspection identifier")
    media_id: str = Field(..., description="Associated media upload ID")
    timestamp: str = Field(..., description="ISO format timestamp")
    inspector_name: Optional[str] = Field(None, description="Name of inspector/reporter")
    inspector_phone: Optional[str] = Field(None, description="Phone number")
    inspection_type: str = Field(default="manual", description="Type: manual, drone, train-mounted")


class AnomalyModel(BaseModel):
    """Anomaly node model - represents a detected defect."""
    anomaly_id: str = Field(..., description="Unique anomaly identifier")
    anomaly_type: str = Field(..., description="Type: crack, missing_bolt, debris, etc.")
    severity: str = Field(..., description="Severity: LOW, MEDIUM, HIGH, CRITICAL")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score")
    image_path: str = Field(..., description="Path to evidence image")
    description: Optional[str] = Field(None, description="Additional details")
    status: str = Field(default="open", description="Status: open, verified, resolved, dismissed")
    detected_at: str = Field(..., description="ISO format detection timestamp")


# ============================================================================
# Neo4j Connection Manager
# ============================================================================

class Neo4jConnection:
    """Singleton Neo4j connection manager."""
    
    _driver: Optional[Driver] = None
    
    @classmethod
    def get_driver(cls) -> Driver:
        """Get or create Neo4j driver instance."""
        if cls._driver is None:
            cls._driver = GraphDatabase.driver(
                NEO4J_URI,
                auth=(NEO4J_USER, NEO4J_PASSWORD),
                max_connection_lifetime=3600
            )
        return cls._driver
    
    @classmethod
    def close(cls):
        """Close the driver connection."""
        if cls._driver:
            cls._driver.close()
            cls._driver = None
    
    @classmethod
    @contextmanager
    def session(cls):
        """Context manager for Neo4j sessions."""
        driver = cls.get_driver()
        session = driver.session()
        try:
            yield session
        finally:
            session.close()


# ============================================================================
# Schema Initialization
# ============================================================================

def init_graph_schema():
    """
    Initialize Neo4j schema with constraints and indexes.
    Call this once at application startup.
    """
    constraints = [
        "CREATE CONSTRAINT track_id IF NOT EXISTS FOR (t:Track) REQUIRE t.track_id IS UNIQUE",
        "CREATE CONSTRAINT segment_id IF NOT EXISTS FOR (s:Segment) REQUIRE s.segment_id IS UNIQUE",
        "CREATE CONSTRAINT inspection_id IF NOT EXISTS FOR (i:Inspection) REQUIRE i.inspection_id IS UNIQUE",
        "CREATE CONSTRAINT anomaly_id IF NOT EXISTS FOR (a:Anomaly) REQUIRE a.anomaly_id IS UNIQUE",
    ]
    
    indexes = [
        "CREATE INDEX anomaly_severity IF NOT EXISTS FOR (a:Anomaly) ON (a.severity)",
        "CREATE INDEX anomaly_type IF NOT EXISTS FOR (a:Anomaly) ON (a.anomaly_type)",
        "CREATE INDEX anomaly_status IF NOT EXISTS FOR (a:Anomaly) ON (a.status)",
        "CREATE INDEX segment_location IF NOT EXISTS FOR (s:Segment) ON (s.lat, s.lng)",
        "CREATE INDEX inspection_timestamp IF NOT EXISTS FOR (i:Inspection) ON (i.timestamp)",
    ]
    
    with Neo4jConnection.session() as session:
        for constraint in constraints:
            try:
                session.run(constraint)
            except Exception as e:
                print(f"Constraint may already exist: {e}")
        
        for index in indexes:
            try:
                session.run(index)
            except Exception as e:
                print(f"Index may already exist: {e}")
    
    print("[Neo4j] Schema initialized successfully")


# ============================================================================
# CRUD Operations
# ============================================================================

class GraphRepository:
    """Repository for Neo4j CRUD operations."""
    
    # ---------- Track Operations ----------
    
    @staticmethod
    def create_track(track: TrackModel) -> Dict:
        """Create a new Track node."""
        query = """
        MERGE (t:Track {track_id: $track_id})
        ON CREATE SET
            t.name = $name,
            t.region = $region,
            t.total_length_km = $total_length_km,
            t.status = $status,
            t.created_at = datetime()
        ON MATCH SET
            t.name = $name,
            t.region = $region,
            t.total_length_km = $total_length_km,
            t.status = $status,
            t.updated_at = datetime()
        RETURN t
        """
        with Neo4jConnection.session() as session:
            result = session.run(query, **track.model_dump())
            record = result.single()
            return dict(record["t"]) if record else {}
    
    # ---------- Segment Operations ----------
    
    @staticmethod
    def create_segment(segment: SegmentModel) -> Dict:
        """Create a new Segment node and link to Track."""
        query = """
        MATCH (t:Track {track_id: $track_id})
        MERGE (s:Segment {segment_id: $segment_id})
        ON CREATE SET
            s.start_km = $start_km,
            s.end_km = $end_km,
            s.lat = $lat,
            s.lng = $lng,
            s.terrain_type = $terrain_type,
            s.created_at = datetime()
        MERGE (s)-[:PART_OF]->(t)
        RETURN s, t.track_id as parent_track
        """
        with Neo4jConnection.session() as session:
            result = session.run(query, **segment.model_dump())
            record = result.single()
            if record:
                return {**dict(record["s"]), "parent_track": record["parent_track"]}
            return {}
    
    # ---------- Inspection Operations ----------
    
    @staticmethod
    def create_inspection(inspection: InspectionModel) -> Dict:
        """Create a new Inspection node."""
        query = """
        MERGE (i:Inspection {inspection_id: $inspection_id})
        ON CREATE SET
            i.media_id = $media_id,
            i.timestamp = $timestamp,
            i.inspector_name = $inspector_name,
            i.inspector_phone = $inspector_phone,
            i.inspection_type = $inspection_type,
            i.created_at = datetime()
        RETURN i
        """
        with Neo4jConnection.session() as session:
            result = session.run(query, **inspection.model_dump())
            record = result.single()
            return dict(record["i"]) if record else {}
    
    # ---------- Anomaly Operations ----------
    
    @staticmethod
    def create_anomaly(
        anomaly: AnomalyModel,
        segment_id: str,
        inspection_id: str
    ) -> Dict:
        """
        Create a new Anomaly node and link to Segment and Inspection.
        
        Relationships:
        - (:Anomaly)-[:LOCATED_AT]->(:Segment)
        - (:Anomaly)-[:FOUND_IN]->(:Inspection)
        """
        query = """
        MATCH (s:Segment {segment_id: $segment_id})
        MATCH (i:Inspection {inspection_id: $inspection_id})
        MERGE (a:Anomaly {anomaly_id: $anomaly_id})
        ON CREATE SET
            a.anomaly_type = $anomaly_type,
            a.severity = $severity,
            a.confidence = $confidence,
            a.image_path = $image_path,
            a.description = $description,
            a.status = $status,
            a.detected_at = $detected_at,
            a.created_at = datetime()
        MERGE (a)-[:LOCATED_AT]->(s)
        MERGE (a)-[:FOUND_IN]->(i)
        RETURN a, s.segment_id as segment, i.inspection_id as inspection
        """
        params = {
            **anomaly.model_dump(),
            "segment_id": segment_id,
            "inspection_id": inspection_id
        }
        with Neo4jConnection.session() as session:
            result = session.run(query, **params)
            record = result.single()
            if record:
                return {
                    **dict(record["a"]),
                    "segment": record["segment"],
                    "inspection": record["inspection"]
                }
            return {}
    
    # ---------- Query Operations ----------
    
    @staticmethod
    def execute_cypher(query: str, params: Optional[Dict] = None) -> List[Dict]:
        """
        Execute arbitrary Cypher query and return results.
        Used by the LangGraph agent for dynamic queries.
        """
        with Neo4jConnection.session() as session:
            result = session.run(query, params or {})
            return [dict(record) for record in result]
    
    @staticmethod
    def get_anomalies_by_severity(severity: str) -> List[Dict]:
        """Get all anomalies with specific severity."""
        query = """
        MATCH (a:Anomaly {severity: $severity})-[:LOCATED_AT]->(s:Segment)-[:PART_OF]->(t:Track)
        MATCH (a)-[:FOUND_IN]->(i:Inspection)
        RETURN 
            a.anomaly_id as id,
            a.anomaly_type as type,
            a.severity as severity,
            a.confidence as confidence,
            a.status as status,
            a.image_path as image_path,
            a.detected_at as detected_at,
            s.segment_id as segment_id,
            s.lat as lat,
            s.lng as lng,
            t.track_id as track_id,
            t.name as track_name,
            i.inspection_id as inspection_id,
            i.timestamp as inspection_time
        ORDER BY a.detected_at DESC
        """
        return GraphRepository.execute_cypher(query, {"severity": severity.upper()})
    
    @staticmethod
    def get_anomalies_by_track(track_id: str) -> List[Dict]:
        """Get all anomalies for a specific track."""
        query = """
        MATCH (a:Anomaly)-[:LOCATED_AT]->(s:Segment)-[:PART_OF]->(t:Track {track_id: $track_id})
        MATCH (a)-[:FOUND_IN]->(i:Inspection)
        RETURN 
            a.anomaly_id as id,
            a.anomaly_type as type,
            a.severity as severity,
            a.confidence as confidence,
            a.status as status,
            a.detected_at as detected_at,
            s.segment_id as segment_id,
            s.lat as lat,
            s.lng as lng,
            i.timestamp as inspection_time
        ORDER BY a.severity DESC, a.detected_at DESC
        """
        return GraphRepository.execute_cypher(query, {"track_id": track_id})
    
    @staticmethod
    def get_graph_statistics() -> Dict:
        """Get overall graph statistics for dashboard."""
        query = """
        MATCH (t:Track) WITH count(t) as tracks
        MATCH (s:Segment) WITH tracks, count(s) as segments
        MATCH (i:Inspection) WITH tracks, segments, count(i) as inspections
        MATCH (a:Anomaly) WITH tracks, segments, inspections, count(a) as total_anomalies
        MATCH (a:Anomaly {status: 'open'}) WITH tracks, segments, inspections, total_anomalies, count(a) as open_anomalies
        MATCH (a:Anomaly {severity: 'CRITICAL'}) WITH tracks, segments, inspections, total_anomalies, open_anomalies, count(a) as critical
        MATCH (a:Anomaly {severity: 'HIGH'}) 
        RETURN 
            tracks, segments, inspections, total_anomalies, open_anomalies, critical,
            count(a) as high_severity
        """
        results = GraphRepository.execute_cypher(query)
        return results[0] if results else {}


# ============================================================================
# Utility Functions
# ============================================================================

def test_connection() -> bool:
    """Test Neo4j connection."""
    try:
        with Neo4jConnection.session() as session:
            result = session.run("RETURN 1 as test")
            return result.single()["test"] == 1
    except Exception as e:
        print(f"[Neo4j] Connection test failed: {e}")
        return False


def clear_database():
    """Clear all nodes and relationships (use with caution!)."""
    with Neo4jConnection.session() as session:
        session.run("MATCH (n) DETACH DELETE n")
    print("[Neo4j] Database cleared")


# ============================================================================
# Module Initialization
# ============================================================================

if __name__ == "__main__":
    # Test the connection
    if test_connection():
        print("[Neo4j] Connection successful!")
        init_graph_schema()
    else:
        print("[Neo4j] Connection failed. Ensure Neo4j is running.")
