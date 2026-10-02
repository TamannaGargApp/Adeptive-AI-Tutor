from bson import ObjectId
from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

_client: AsyncMongoClient | None = None
_database: AsyncDatabase | None = None


async def connect_to_mongo(uri: str, database_name: str) -> None:
    """Open the shared client and fail fast if MongoDB is not reachable."""
    global _client, _database
    _client = AsyncMongoClient(uri, serverSelectionTimeoutMS=5000, tz_aware=True)
    await _client.admin.command("ping")
    _database = _client[database_name]


async def close_mongo_connection() -> None:
    global _client, _database
    if _client is not None:
        await _client.close()
    _client = None
    _database = None


def get_database() -> AsyncDatabase:
    if _database is None:
        raise RuntimeError("MongoDB is not connected. Call connect_to_mongo() during startup.")
    return _database


def to_object_id(value: str) -> ObjectId | None:
    """Convert a string id from a request into an ObjectId, or None if it is malformed."""
    return ObjectId(value) if ObjectId.is_valid(value) else None
