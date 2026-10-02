async def test_topics_are_seeded_in_course_order(auth_client):
    response = await auth_client.get("/api/topics")

    assert response.status_code == 200
    topics = response.json()
    assert len(topics) == 9
    assert topics[0]["slug"] == "variables-data-types"
    assert topics[-1]["slug"] == "file-handling"
    assert [topic["order"] for topic in topics] == sorted(topic["order"] for topic in topics)


async def test_new_user_progress_starts_empty(auth_client):
    response = await auth_client.get("/api/progress")

    assert response.status_code == 200
    body = response.json()
    assert body["questions_attempted"] == 0
    assert len(body["topics"]) == 9
    assert all(topic["mastery"] == "not_started" for topic in body["topics"])
    assert body["completion_percent"] == 0
    assert all(topic["completion_status"] == "not_started" for topic in body["topics"])