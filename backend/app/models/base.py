from typing import Any, Self

from pydantic import BaseModel


class MongoModel(BaseModel):
    """Base for models loaded from MongoDB. Converts the ObjectId `_id` into a string `id`."""

    id: str

    @classmethod
    def from_document(cls, document: dict[str, Any]) -> Self:
        data = {key: value for key, value in document.items() if key != "_id"}
        data["id"] = str(document["_id"])
        return cls.model_validate(data)
