"""Built-in courses, and course-specific instructions for the AI."""

from app.db.seed import COURSES
from app.prompts.tutor_prompt import subject_rules


async def test_every_built_in_course_is_listed_with_its_topics(auth_client):
    subjects = {subject["slug"]: subject for subject in (await auth_client.get("/api/subjects")).json()}
    for course in COURSES:
        assert subjects[course["slug"]]["topic_count"] == len(course["topics"])
        assert subjects[course["slug"]]["language"] == course["language"]
    # New courses are listed after the original ones.
    slugs = list(subjects)
    assert slugs.index("python") < slugs.index("python-oop") < slugs.index("pandas") < slugs.index("flask")


async def test_seeding_again_keeps_courses_and_order(auth_client, database):
    from app.db.seed import seed_courses

    before = [(doc["slug"], doc["order"]) async for doc in database.subjects.find().sort("order", 1)]
    await seed_courses()
    after = [(doc["slug"], doc["order"]) async for doc in database.subjects.find().sort("order", 1)]
    assert before == after


async def test_course_guidelines_are_stored(database):
    flask = await database.subjects.find_one({"slug": "flask"})
    assert "test_client" in flask["code_guidelines"]
    python = await database.subjects.find_one({"slug": "python"})
    assert not python.get("code_guidelines")


def test_topic_slugs_are_unique_across_courses():
    slugs = [topic["slug"] for course in COURSES for topic in course["topics"]]
    assert len(slugs) == len(set(slugs))


def test_course_guidelines_reach_the_ai():
    rules = subject_rules("Web Development with Flask", "Never call app.run().")
    assert "Web Development with Flask tutor" in rules
    assert "Never call app.run()." in rules
    # Courses without guidelines get the plain rules.
    assert "How to write code for this course" not in subject_rules("Python")
