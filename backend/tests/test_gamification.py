from datetime import date, timedelta

from app.schemas.tutor import QuestionResponse
from app.services.gamification_service import calculate_streaks, level_for_xp, resolve_timezone

TODAY = date(2026, 10, 3)


def _days(*offsets: int) -> set[date]:
    return {TODAY - timedelta(days=offset) for offset in offsets}


def test_streak_counts_consecutive_days_up_to_today():
    assert calculate_streaks(_days(0, 1, 2), TODAY) == (3, 3)


def test_streak_survives_until_today_ends():
    # Nothing yet today, but yesterday was active: the streak is still alive.
    assert calculate_streaks(_days(1, 2), TODAY) == (2, 2)


def test_missing_a_full_day_resets_the_streak_but_keeps_the_record():
    assert calculate_streaks(_days(2, 3, 4, 5), TODAY) == (0, 4)
    assert calculate_streaks(set(), TODAY) == (0, 0)


def test_levels_get_progressively_harder():
    assert level_for_xp(0).level == 1
    assert level_for_xp(99).level == 1
    assert level_for_xp(100).level == 2
    assert level_for_xp(300).level == 3
    level = level_for_xp(450)
    assert (level.level, level.xp_into_level, level.xp_for_next_level) == (3, 150, 300)


def test_unknown_timezones_fall_back_to_utc():
    assert resolve_timezone("Asia/Kolkata") == "Asia/Kolkata"
    assert resolve_timezone("Not/AZone") == "UTC"
    assert resolve_timezone(None) == "UTC"


QUESTION = QuestionResponse(
    question_type="predict_output",
    prompt="What will this code print?",
    code="print(1)",
    options=[],
    correct_answer="1",
    explanation="It prints 1.",
    concept="for loop",
    hint="Look at the number.",
    starter_code=None,
    test_cases=[],
)


async def test_answering_a_question_starts_a_streak_and_earns_a_badge(auth_client, fake_ai):
    empty = (await auth_client.get("/api/gamification", params={"tz": "UTC"})).json()
    assert empty["streak"]["current"] == 0
    assert empty["level"]["level"] == 1
    assert not any(badge["earned"] for badge in empty["badges"])

    fake_ai.responses[QuestionResponse] = QUESTION
    session = (await auth_client.post("/api/sessions", json={"topic_slug": "loops", "mode": "practice"})).json()
    question = (await auth_client.post("/api/tutor/practice", json={"session_id": session["id"]})).json()
    await auth_client.post("/api/tutor/evaluate", json={"question_id": question["id"], "answer": "1"})

    summary = (await auth_client.get("/api/gamification", params={"tz": "UTC"})).json()
    assert summary["streak"]["current"] == 1
    assert summary["streak"]["active_today"] is True
    assert summary["level"]["total_xp"] == 10
    assert summary["newly_earned"] == ["first_answer"]

    again = (await auth_client.get("/api/gamification", params={"tz": "UTC"})).json()
    assert again["newly_earned"] == []
    assert next(badge for badge in again["badges"] if badge["id"] == "first_answer")["earned"] is True

    activity = (await auth_client.get("/api/activity", params={"tz": "UTC", "days": 7})).json()
    assert len(activity["days"]) == 7
    assert activity["days"][-1]["questions"] == 1
    assert activity["days"][-1]["accuracy"] == 100.0