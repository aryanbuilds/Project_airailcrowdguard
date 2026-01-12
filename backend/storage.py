"""
MinIO Object Storage Module for Railway Anomaly Detection
Handles all file storage operations with S3-compatible MinIO backend.
"""

import os
import io
from pathlib import Path
from typing import Optional, BinaryIO, Union
from datetime import timedelta
import mimetypes

from minio import Minio
from minio.error import S3Error

# =============================================================================
# Configuration
# =============================================================================

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "railadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "railsecret123")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

# Bucket names
BUCKET_FRAMES = "railway-frames"
BUCKET_UPLOADS = "railway-uploads"
BUCKET_REPORTS = "railway-reports"

# Global client instance
_minio_client: Optional[Minio] = None


def get_minio_client() -> Minio:
    """Get or create MinIO client singleton."""
    global _minio_client
    
    if _minio_client is None:
        _minio_client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_SECURE
        )
    return _minio_client


def ensure_buckets():
    """Ensure all required buckets exist."""
    client = get_minio_client()
    
    for bucket in [BUCKET_FRAMES, BUCKET_UPLOADS, BUCKET_REPORTS]:
        try:
            if not client.bucket_exists(bucket):
                client.make_bucket(bucket)
                print(f"Created bucket: {bucket}")
            else:
                print(f"Bucket exists: {bucket}")
        except S3Error as e:
            print(f"Error with bucket {bucket}: {e}")


def test_minio_connection() -> bool:
    """Test MinIO connectivity."""
    try:
        client = get_minio_client()
        client.list_buckets()
        return True
    except Exception as e:
        print(f"MinIO connection failed: {e}")
        return False


# =============================================================================
# Upload Operations
# =============================================================================

def upload_file(
    bucket: str,
    object_name: str,
    file_path: Union[str, Path],
    content_type: Optional[str] = None
) -> str:
    """
    Upload a file to MinIO.
    
    Args:
        bucket: Target bucket name
        object_name: Object key/path in bucket (e.g., "media_id/frame_001.jpg")
        file_path: Local file path to upload
        content_type: MIME type (auto-detected if not provided)
    
    Returns:
        Full object URL for accessing the file
    """
    client = get_minio_client()
    file_path = Path(file_path)
    
    if content_type is None:
        content_type, _ = mimetypes.guess_type(str(file_path))
        content_type = content_type or "application/octet-stream"
    
    try:
        client.fput_object(
            bucket,
            object_name,
            str(file_path),
            content_type=content_type
        )
        return get_object_url(bucket, object_name)
    except S3Error as e:
        print(f"Upload failed: {e}")
        raise


def upload_bytes(
    bucket: str,
    object_name: str,
    data: bytes,
    content_type: str = "application/octet-stream"
) -> str:
    """
    Upload bytes directly to MinIO.
    
    Args:
        bucket: Target bucket name
        object_name: Object key/path in bucket
        data: Raw bytes to upload
        content_type: MIME type
    
    Returns:
        Full object URL for accessing the file
    """
    client = get_minio_client()
    
    try:
        data_stream = io.BytesIO(data)
        client.put_object(
            bucket,
            object_name,
            data_stream,
            length=len(data),
            content_type=content_type
        )
        return get_object_url(bucket, object_name)
    except S3Error as e:
        print(f"Upload failed: {e}")
        raise


def upload_frame(media_id: str, frame_name: str, file_path: Union[str, Path]) -> str:
    """
    Upload a detection frame to MinIO.
    
    Args:
        media_id: Unique media identifier
        frame_name: Frame filename (e.g., "frame_001.jpg", "annotated.mp4")
        file_path: Local path to the frame file
    
    Returns:
        Public URL for the uploaded frame
    """
    object_name = f"{media_id}/{frame_name}"
    return upload_file(BUCKET_FRAMES, object_name, file_path)


def upload_frame_bytes(media_id: str, frame_name: str, data: bytes, content_type: str) -> str:
    """
    Upload frame bytes directly to MinIO.
    
    Args:
        media_id: Unique media identifier
        frame_name: Frame filename
        data: Raw frame bytes
        content_type: MIME type (e.g., "image/jpeg", "video/mp4")
    
    Returns:
        Public URL for the uploaded frame
    """
    object_name = f"{media_id}/{frame_name}"
    return upload_bytes(BUCKET_FRAMES, object_name, data, content_type)


# =============================================================================
# URL Generation
# =============================================================================

def get_object_url(bucket: str, object_name: str) -> str:
    """
    Get the public URL for an object.
    
    For public buckets, returns direct URL.
    For private buckets, would generate presigned URL.
    """
    protocol = "https" if MINIO_SECURE else "http"
    return f"{protocol}://{MINIO_ENDPOINT}/{bucket}/{object_name}"


def get_frame_url(media_id: str, frame_name: str) -> str:
    """
    Get the public URL for a detection frame.
    
    Args:
        media_id: Unique media identifier
        frame_name: Frame filename
    
    Returns:
        Full URL to access the frame
    """
    object_name = f"{media_id}/{frame_name}"
    return get_object_url(BUCKET_FRAMES, object_name)


def get_presigned_url(
    bucket: str,
    object_name: str,
    expires: timedelta = timedelta(hours=1)
) -> str:
    """
    Generate a presigned URL for temporary access.
    
    Args:
        bucket: Bucket name
        object_name: Object key
        expires: URL validity duration
    
    Returns:
        Presigned URL with expiration
    """
    client = get_minio_client()
    return client.presigned_get_object(bucket, object_name, expires=expires)


# =============================================================================
# Download / Read Operations
# =============================================================================

def download_file(bucket: str, object_name: str, local_path: Union[str, Path]) -> Path:
    """
    Download an object to local filesystem.
    
    Args:
        bucket: Source bucket
        object_name: Object key
        local_path: Local destination path
    
    Returns:
        Path to downloaded file
    """
    client = get_minio_client()
    local_path = Path(local_path)
    local_path.parent.mkdir(parents=True, exist_ok=True)
    
    client.fget_object(bucket, object_name, str(local_path))
    return local_path


def get_object_bytes(bucket: str, object_name: str) -> bytes:
    """
    Get object contents as bytes.
    
    Args:
        bucket: Source bucket
        object_name: Object key
    
    Returns:
        Object contents as bytes
    """
    client = get_minio_client()
    response = client.get_object(bucket, object_name)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


# =============================================================================
# List / Delete Operations
# =============================================================================

def list_frames(media_id: str) -> list[str]:
    """
    List all frames for a media item.
    
    Args:
        media_id: Unique media identifier
    
    Returns:
        List of frame filenames
    """
    client = get_minio_client()
    prefix = f"{media_id}/"
    
    objects = client.list_objects(BUCKET_FRAMES, prefix=prefix)
    return [obj.object_name.replace(prefix, "") for obj in objects]


def delete_frame(media_id: str, frame_name: str):
    """Delete a specific frame."""
    client = get_minio_client()
    object_name = f"{media_id}/{frame_name}"
    client.remove_object(BUCKET_FRAMES, object_name)


def delete_media_frames(media_id: str):
    """Delete all frames for a media item."""
    client = get_minio_client()
    prefix = f"{media_id}/"
    
    objects = client.list_objects(BUCKET_FRAMES, prefix=prefix, recursive=True)
    for obj in objects:
        client.remove_object(BUCKET_FRAMES, obj.object_name)


# =============================================================================
# Migration Helper - Move local frames to MinIO
# =============================================================================

def migrate_local_frames_to_minio(local_frames_dir: Union[str, Path]) -> dict:
    """
    Migrate existing local frames to MinIO storage.
    
    Args:
        local_frames_dir: Path to local frames directory
    
    Returns:
        Migration statistics
    """
    local_frames_dir = Path(local_frames_dir)
    stats = {"migrated": 0, "failed": 0, "skipped": 0}
    
    if not local_frames_dir.exists():
        print(f"Frames directory not found: {local_frames_dir}")
        return stats
    
    for media_dir in local_frames_dir.iterdir():
        if not media_dir.is_dir():
            continue
            
        media_id = media_dir.name
        
        for frame_file in media_dir.iterdir():
            if not frame_file.is_file():
                continue
                
            try:
                # Check if already exists in MinIO
                client = get_minio_client()
                object_name = f"{media_id}/{frame_file.name}"
                
                try:
                    client.stat_object(BUCKET_FRAMES, object_name)
                    stats["skipped"] += 1
                    continue  # Already exists
                except S3Error:
                    pass  # Doesn't exist, proceed with upload
                
                # Upload to MinIO
                upload_frame(media_id, frame_file.name, frame_file)
                stats["migrated"] += 1
                print(f"Migrated: {object_name}")
                
            except Exception as e:
                stats["failed"] += 1
                print(f"Failed to migrate {frame_file}: {e}")
    
    return stats


# =============================================================================
# Initialization
# =============================================================================

def init_storage():
    """Initialize MinIO storage - call on application startup."""
    if test_minio_connection():
        print("MinIO connection successful")
        ensure_buckets()
        return True
    else:
        print("MinIO not available - falling back to local storage")
        return False
