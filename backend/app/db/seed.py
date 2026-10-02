"""Initial Python topics. New subjects or topics can be added here (or directly in MongoDB)
without code changes elsewhere, because the rest of the app only reads topics from the database."""

from datetime import UTC, datetime

from app.db.mongodb import get_database

INITIAL_TOPICS: list[dict] = [
    {
        "slug": "variables-data-types",
        "name": "Variables & Data Types",
        "description": "Store values in variables and work with int, float, str and bool.",
        "key_concepts": ["variable assignment", "int and float", "strings", "booleans", "type()", "type conversion"],
    },
    {
        "slug": "operators",
        "name": "Operators",
        "description": "Arithmetic, comparison, logical and assignment operators.",
        "key_concepts": ["arithmetic operators", "integer division and modulo", "comparison operators", "logical operators", "operator precedence"],
    },
    {
        "slug": "conditional-statements",
        "name": "Conditional Statements",
        "description": "Make decisions with if, elif and else.",
        "key_concepts": ["if statement", "elif chains", "else", "nested conditions", "truthiness"],
    },
    {
        "slug": "loops",
        "name": "Loops",
        "description": "Repeat work with for and while loops.",
        "key_concepts": ["for loop", "range()", "while loop", "break and continue", "nested loops"],
    },
    {
        "slug": "functions",
        "name": "Functions",
        "description": "Write reusable code with def, parameters and return values.",
        "key_concepts": ["defining functions", "parameters and arguments", "return values", "default arguments", "scope"],
    },
    {
        "slug": "lists-tuples",
        "name": "Lists & Tuples",
        "description": "Ordered collections, indexing, slicing and common methods.",
        "key_concepts": ["indexing", "slicing", "list methods", "mutability", "tuples", "iterating over lists"],
    },
    {
        "slug": "dictionaries-sets",
        "name": "Dictionaries & Sets",
        "description": "Key-value pairs and collections of unique items.",
        "key_concepts": ["creating dictionaries", "accessing keys", "dictionary methods", "iterating over dictionaries", "sets", "set operations"],
    },
    {
        "slug": "exception-handling",
        "name": "Exception Handling",
        "description": "Handle errors gracefully with try, except, else and finally.",
        "key_concepts": ["try and except", "specific exception types", "else and finally", "raising exceptions", "common errors"],
    },
]


async def seed_topics() -> None:
    """Insert missing topics without overwriting topics that were edited in the database."""
    db = get_database()
    now = datetime.now(UTC)
    for order, topic in enumerate(INITIAL_TOPICS, start=1):
        await db.topics.update_one(
            {"slug": topic["slug"]},
            {"$setOnInsert": {**topic, "order": order, "subject": "python", "created_at": now}},
            upsert=True,
        )
