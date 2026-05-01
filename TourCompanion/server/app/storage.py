"""Object storage abstraction. Local volume by default; S3-compatible if configured."""
import os
import shutil
import uuid
from pathlib import Path
from typing import BinaryIO

from .config import settings


def _is_s3() -> bool:
    return bool(settings.s3_bucket)


def _s3_client():
    import boto3  # imported lazily so dev install can skip
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url or None,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key or None,
        aws_secret_access_key=settings.s3_secret_key or None,
    )


def upload(stream: BinaryIO, filename: str, content_type: str = "application/octet-stream") -> str:
    """Upload bytes; return a URL the frontend can render."""
    ext = Path(filename or "").suffix or ".bin"
    key = f"{uuid.uuid4().hex}{ext}"

    if _is_s3():
        client = _s3_client()
        client.upload_fileobj(
            stream, settings.s3_bucket, key,
            ExtraArgs={"ContentType": content_type},
        )
        if settings.s3_public_url_base:
            base = settings.s3_public_url_base.rstrip("/")
            return f"{base}/{key}"
        # Fallback: presigned URL valid for 1h. (Production: use public bucket or CDN.)
        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket, "Key": key},
            ExpiresIn=3600,
        )

    # Local fallback
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    dest = Path(settings.upload_dir) / key
    with dest.open("wb") as out:
        shutil.copyfileobj(stream, out)
    return f"/uploads/{key}"


def backend_name() -> str:
    return "s3" if _is_s3() else "local"
