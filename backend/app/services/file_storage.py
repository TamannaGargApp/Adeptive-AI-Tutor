"""Storage for study set files: AWS S3 in production, or a local folder during development.

Only the server builds storage keys (users/<user id>/study-sets/<set id>/...), so learners can never
read or overwrite each other's files. S3 objects are private and encrypted at rest; uploads and
downloads use short-lived presigned links, so large files go straight between the browser and S3
instead of through the API.
"""

import asyncio
import os
from collections.abc import AsyncIterator
from functools import lru_cache
from pathlib import Path
from typing import Protocol

from app.core.config import get_settings
from app.core.exceptions import AppError, StorageError

DOWNLOAD_LINK_SECONDS = 300
# A 2 GB upload on a slow connection can take a while, so upload links last longer than downloads.
UPLOAD_LINK_SECONDS = 6 * 60 * 60


class FileTooLargeError(AppError):
    status_code = 413


class FileStorage(Protocol):
    async def save(self, key: str, data: bytes, content_type: str) -> None: ...
    async def load(self, key: str) -> bytes: ...
    async def delete(self, key: str) -> None: ...
    async def size(self, key: str) -> int | None:
        """The stored file's size in bytes, or None if there's no file."""
        ...
    async def download_url(self, key: str, file_name: str) -> str | None:
        """A temporary link to download the file, or None if it must be streamed by the API."""
        ...
    async def upload_url(self, key: str, content_type: str) -> tuple[str, dict[str, str]] | None:
        """A temporary link (and headers) the browser can upload to directly, or None if the file
        must be sent to the API (see save_stream)."""
        ...
    def local_path(self, key: str) -> Path | None:
        """The file on disk, for local storage only."""
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

    async def size(self, key: str) -> int | None:
        path = self._path(key)
        return (await asyncio.to_thread(path.stat)).st_size if path.is_file() else None

    async def download_url(self, key: str, file_name: str) -> str | None:
        return None

    async def upload_url(self, key: str, content_type: str) -> tuple[str, dict[str, str]] | None:
        return None

    def local_path(self, key: str) -> Path | None:
        path = self._path(key)
        return path if path.is_file() else None

    async def save_stream(self, key: str, chunks: AsyncIterator[bytes], max_bytes: int) -> int:
        """Write an upload to disk as it arrives (never all in memory). Returns the size in bytes.
        Stops and deletes the partial file if it grows past max_bytes."""
        path = self._path(key)
        await asyncio.to_thread(path.parent.mkdir, parents=True, exist_ok=True)
        partial = path.with_name(path.name + ".part")
        written = 0
        handle = await asyncio.to_thread(partial.open, "wb")
        try:
            async for chunk in chunks:
                written += len(chunk)
                if written > max_bytes:
                    raise FileTooLargeError("The file is larger than the size it was declared with.")
                await asyncio.to_thread(handle.write, chunk)
        except BaseException:
            await asyncio.to_thread(handle.close)
            await asyncio.to_thread(partial.unlink, missing_ok=True)
            raise
        await asyncio.to_thread(handle.close)
        await asyncio.to_thread(os.replace, partial, path)
        return written


class S3FileStorage:
    """Private, encrypted objects in an AWS S3 bucket. boto3 is synchronous, so calls run in a thread."""

    def __init__(self, bucket: str, region: str, access_key: str, secret_key: str) -> None:
        import boto3  # imported here so local development doesn't need AWS set up
        from botocore.config import Config

        credentials = {"aws_access_key_id": access_key, "aws_secret_access_key": secret_key} if access_key else {}
        self.bucket = bucket
        # Signature v4 with the regional endpoint, which presigned upload links require.
        self.client = boto3.client(
            "s3", region_name=region or None, config=Config(signature_version="s3v4"), **credentials
        )

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

    async def size(self, key: str) -> int | None:
        from botocore.exceptions import ClientError

        try:
            response = await asyncio.to_thread(self.client.head_object, Bucket=self.bucket, Key=key)
        except ClientError:
            return None
        return int(response["ContentLength"])

    async def upload_url(self, key: str, content_type: str) -> tuple[str, dict[str, str]] | None:
        # The browser must send exactly these headers, because they're part of the signature.
        url = await asyncio.to_thread(
            self.client.generate_presigned_url,
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type, "ServerSideEncryption": "AES256"},
            ExpiresIn=UPLOAD_LINK_SECONDS,
        )
        return url, {"Content-Type": content_type, "x-amz-server-side-encryption": "AES256"}

    def local_path(self, key: str) -> Path | None:
        return None

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