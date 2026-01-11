from sqlalchemy import create_engine, Column, String, Float, Integer, JSON
from sqlalchemy.orm import sessionmaker, declarative_base
from pathlib import Path

# Database path
DB_PATH = Path("railway.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Media(Base):
    __tablename__ = "media"
    
    id = Column(String, primary_key=True, index=True)  # UUID
    filename = Column(String)
    media_type = Column(String)  # image or video
    lat = Column(Float, nullable=True)
    lng = Column(Float, nullable=True)
    timestamp = Column(String) # ISO format
    reporter_id = Column(String, nullable=True)
    reporter_name = Column(String, nullable=True)
    reporter_phone = Column(String, nullable=True)
    status = Column(String, default="processing") # processing, analyzed, error

class Incident(Base):
    __tablename__ = "incidents"
    
    id = Column(String, primary_key=True, index=True) # UUID
    media_id = Column(String, index=True)
    lat = Column(Float)
    lng = Column(Float)
    timestamp = Column(String)
    
    reporter_name = Column(String, nullable=True)
    reporter_phone = Column(String, nullable=True)
    
    tampering_score = Column(Float) # 0.0 to 1.0
    fault_type = Column(String) # crack, tampering, etc.
    severity = Column(String) # LOW, MEDIUM, HIGH
    status = Column(String, default="unverified") # unverified, verified, dismissed
    
    # Store evidence paths as JSON array
    evidence_frames = Column(JSON) 

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
