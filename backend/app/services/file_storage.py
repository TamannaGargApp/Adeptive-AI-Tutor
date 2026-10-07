"""Storage for study set files: AWS S3 in production, or a local folder during development.

Only the server builds storage keys (users/<user id>/study-sets/<set id>/...), so learners can never
read or overwrite each other's files. S3 objects are private and encrypted at rest; downloads use
short-lived presigned links.
"""

import asyncio
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from app.core.config import get_settings
from app.core.exceptions import AppError, StorageError

DOWNLOAD_LINK_SECONDS = 300


class FileStorage(Protocol):
    async def save(self, key: str, data: bytes, content_type: str) -> None: ...
    async def load(self, key: str) -> bytes: ...
    async def delete(self, key: str) -> None: ...
    async def download_url(self, key: str, file_name: str) -> str | None:
        """A temporary link to download the file, or None if it must be streamed by the API."""
        ...


class LocalFileStorage:
    """Files under a local folder, for development without AWS."""

    def __init__(self, root: str) -> None:
        self.root = Path(root).resolve()

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise AppError("Invalid storage path.")
        return path

    async def save(self, key: str, data: bytes, content_type: str) -> None:
        path = self._path(key)
        await asyncio.to_thread(path.parent.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(path.write_bytes, data)

    async def load(self, key: str) -> bytes:
        return await asyncio.to_thread(self._path(key).read_bytes)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._path(key).unlink, missing_ok=True)

    async def download_url(self, key: str, file_name: str) -> str | None:
        return None


class S3FileStorage:
    """Private, encrypted objects in an AWS S3 bucket. boto3 is synchronous, so calls run in a thread."""

    def __init__(self, bucket: str, region: str, access_key: str, secret_key: str) -> None:
        import boto3  # imported here so local development doesn't need AWS set up

        credentials = {"aws_access_key_id": access_key, "aws_secret_access_key": secret_key} if access_key else {}
        self.bucket = bucket
        self.client = boto3.client("s3", region_name=region or None, **credentials)

    async def save(self, key: str, data: bytes, content_type: str) -> None:
        await asyncio.to_thread(
            self.client.put_object,
            Bucket=self.bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
            ServerSideEncryption="AES256",
        )

    async def load(self, key: str) -> bytes:
        response = await asyncio.to_thread(self.client.get_object, Bucket=self.bucket, Key=key)
        return await asyncio.to_thread(response["Body"].read)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self.client.delete_object, Bucket=self.bucket, Key=key)

    async def download_url(self, key: str, file_name: str) -> str | None:
        safe_name = file_name.replace('"', "")
        return await asyncio.to_thread(
            self.client.generate_presigned_url,
            "get_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                "ResponseContentDisposition": f'attachment; filename="{safe_name}"',
            },
            ExpiresIn=DOWNLOAD_LINK_SECONDS,
        )


@lru_cache
def get_file_storage() -> FileStorage:
    settings = get_settings()
    if settings.storage_backend == "s3":
        if not settings.s3_bucket:
            raise StorageError("File storage isn't configured: set S3_BUCKET (and AWS_REGION) in backend/.env.")
        return S3FileStorage(
            settings.s3_bucket, settings.aws_region, settings.aws_access_key_id, settings.aws_secret_access_key
        )
    return LocalFileStorage(settings.local_storage_dir)