"""Courses (subjects) and their topics. New courses or topics can be added here (or directly in
MongoDB) without code changes elsewhere, because the rest of the app only reads them from the database.

To add a course: add an entry to COURSES with its own list of topics. Topic slugs must be unique
across all courses, so prefix them (e.g. "js-loops").
To add a topic: append it to the end of its course's list (see the note on ordering below)."""

from datetime import UTC, datetime

from app.db.mongodb import get_database

PYTHON_TOPICS: list[dict] = [
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
    # New topics are appended: existing topics keep their stored order, so inserting one in the
    # middle of this list would give it the same order number as an existing topic.
    {
        "slug": "file-handling",
        "name": "File Handling",
        "description": "Read and write text files safely with open() and the with statement.",
        "key_concepts": ["opening files", "file modes", "reading files", "writing files", "with statement", "handling file errors"],
    },
]


JAVASCRIPT_TOPICS: list[dict] = [
    {
        "slug": "js-variables-data-types",
        "name": "Variables & Data Types",
        "description": "Declare variables with let and const and work with numbers, strings and booleans.",
        "key_concepts": ["let and const", "numbers", "strings", "booleans", "typeof", "null and undefined"],
    },
    {
        "slug": "js-operators",
        "name": "Operators",
        "description": "Arithmetic, comparison and logical operators, and how JavaScript converts types.",
        "key_concepts": ["arithmetic operators", "comparison operators", "strict equality", "logical operators", "type coercion"],
    },
    {
        "slug": "js-conditionals",
        "name": "Conditional Statements",
        "description": "Make decisions with if, else, the ternary operator and switch.",
        "key_concepts": ["if and else", "else if", "ternary operator", "switch statement", "truthy and falsy values"],
    },
    {
        "slug": "js-loops",
        "name": "Loops",
        "description": "Repeat work with for, while, for...of and for...in.",
        "key_concepts": ["for loop", "while loop", "for...of", "for...in", "break and continue"],
    },
    {
        "slug": "js-functions",
        "name": "Functions",
        "description": "Function declarations, arrow functions, parameters and return values.",
        "key_concepts": ["function declarations", "arrow functions", "default parameters", "return values", "scope"],
    },
    {
        "slug": "js-arrays",
        "name": "Arrays",
        "description": "Store lists of values and transform them with array methods.",
        "key_concepts": ["indexing", "push and pop", "map and filter", "iterating arrays", "spread syntax"],
    },
    {
        "slug": "js-objects",
        "name": "Objects",
        "description": "Group related data and behaviour with object literals.",
        "key_concepts": ["object literals", "dot and bracket notation", "methods", "iterating objects", "destructuring"],
    },
    {
        "slug": "js-error-handling",
        "name": "Error Handling",
        "description": "Handle errors with try, catch and finally, and throw your own.",
        "key_concepts": ["try and catch", "finally", "throwing errors", "error types", "common errors"],
    },
]

COURSES: list[dict] = [
    {
        "slug": "python",
        "name": "Python",
        "description": "A beginner-friendly language used for automation, data, and web development.",
        "language": "python",
        "topics": PYTHON_TOPICS,
    },
    {
        "slug": "javascript",
        "name": "JavaScript",
        "description": "The language of the web: make pages interactive and build web apps.",
        "language": "javascript",
        "topics": JAVASCRIPT_TOPICS,
    },
]


async def seed_courses() -> None:
    """Insert missing courses and topics without overwriting ones that were edited in the database."""
    db = get_database()
    now = datetime.now(UTC)
    for course_order, course in enumerate(COURSES, start=1):
        details = {key: value for key, value in course.items() if key != "topics"}
        await db.subjects.update_one(
            {"slug": course["slug"]},
            {"$setOnInsert": {**details, "order": course_order, "created_at": now}},
            upsert=True,
        )
        # Topic order is numbered within each course.
        for order, topic in enumerate(course["topics"], start=1):
            await db.topics.update_one(
                {"slug": topic["slug"]},
                {"$setOnInsert": {**topic, "order": order, "subject": course["slug"], "created_at": now}},
                upsert=True,
            )