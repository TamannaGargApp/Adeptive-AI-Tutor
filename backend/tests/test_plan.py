"""Courses and the learner's plan."""


async def test_new_learner_starts_with_python(auth_client):
    me = (await auth_client.get("/api/auth/me")).json()
    assert me["subjects"] == ["python"]
    assert me["current_subject"] == "python"

    subjects = (await auth_client.get("/api/subjects")).json()
    by_slug = {subject["slug"]: subject for subject in subjects}
    assert by_slug["python"]["in_plan"] and by_slug["python"]["current"]
    assert by_slug["javascript"]["in_plan"] is False
    assert by_slug["javascript"]["topic_count"] == 8


async def test_adding_a_course_switches_to_it(auth_client):
    user = (await auth_client.post("/api/plan/subjects/javascript")).json()
    assert user["subjects"] == ["python", "javascript"]
    assert user["current_subject"] == "javascript"

    topics = (await auth_client.get("/api/topics")).json()
    assert len(topics) == 8
    assert all(topic["subject"] == "javascript" for topic in topics)

    progress = (await auth_client.get("/api/progress")).json()
    assert progress["subject_name"] == "JavaScript"
    assert len(progress["topics"]) == 8


async def test_switching_and_removing_courses(auth_client):
    await auth_client.post("/api/plan/subjects/javascript")
    switched = (await auth_client.put("/api/plan/current", json={"subject_slug": "python"})).json()
    assert switched["current_subject"] == "python"

    removed = (await auth_client.delete("/api/plan/subjects/javascript")).json()
    assert removed["subjects"] == ["python"]

    last = await auth_client.delete("/api/plan/subjects/python")
    assert last.status_code == 409


async def test_cannot_switch_to_a_course_outside_the_plan(auth_client):
    response = await auth_client.put("/api/plan/current", json={"subject_slug": "javascript"})
    assert response.status_code == 400


async def test_onboarding_can_choose_the_first_course(client):
    from tests.conftest import register

    await register(client)
    profile = await client.put(
        "/api/profile",
        json={
            "name": "Ada",
            "level": "beginner",
            "goal": "learn_python",
            "preferred_difficulty": "beginner",
            "subject_slug": "javascript",
        },
    )
    assert profile.json()["subjects"] == ["javascript"]
    assert profile.json()["current_subject"] == "javascript"