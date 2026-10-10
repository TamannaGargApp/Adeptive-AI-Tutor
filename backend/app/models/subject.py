from app.models.base import MongoModel


class Subject(MongoModel):
    """A course, e.g. Python, JavaScript or Flask. Each topic belongs to one subject."""

    slug: str
    name: str
    description: str
    # Used for code examples and prompts, e.g. "python" or "javascript".
    language: str
    order: int
    # Extra instructions for the AI on writing code for this course, e.g. "use Flask's test client
    # instead of app.run()", so examples and exercises run in the browser. Empty for most courses.
    code_guidelines: str = ""
    # Archived content is hidden from learners but kept, so existing progress stays valid.
    archived: bool = False