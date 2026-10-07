from collections import defaultdict
from datetime import date, timedelta

from app.schemas.study_plan import (
    CourseSuggestionResponse,
    PlanSettings,
    PlanStrategy,
    StrategyCourse,
    StrategyResponse,
    SuggestedCourse,
)
from app.services.study_plan_service import TaskDraft, normalize_strategy, schedule_plan, summarize_phases

MONDAY = date(2026, 10, 5)
EVERY_DAY = list(range(7))


def _course(slug: str, weight: int = 5, depends_on: list[str] | None = None, start_after: int = 0) -> StrategyCourse:
    return StrategyCourse(
        subject_slug=slug, weight=weight, focus="complete_course", depends_on=depends_on or [],
        start_after_topics=start_after, reason="",
    )


def _strategy(*courses: StrategyCourse, sharing: str = "split") -> PlanStrategy:
    return PlanStrategy(summary="", day_sharing=sharing, day_sharing_reason="", courses=list(courses))


def _tasks(slug: str, count: int, per_topic: int = 3) -> list[TaskDraft]:
    return [
        TaskDraft(slug, "practice", f"{slug}-t{i // per_topic}", "", "", 15, completes_topic=(i % per_topic == per_topic - 1))
        for i in range(count)
    ]


def _minutes_by_course(schedule) -> dict[str, int]:
    totals: dict[str, int] = defaultdict(int)
    for _, tasks in schedule:
        for task in tasks:
            totals[task.subject_slug] += task.minutes
    return totals


def test_split_days_share_time_by_weight_within_the_daily_limit():
    strategy = _strategy(_course("python", weight=6), _course("javascript", weight=4))
    settings = PlanSettings(study_days=EVERY_DAY, minutes_per_day=60)
    schedule = schedule_plan({"python": _tasks("python", 40), "javascript": _tasks("javascript", 40)},
                             {}, {}, strategy, settings, MONDAY)
    first_ten_days = schedule[:10]
    totals = _minutes_by_course(first_ten_days)
    assert 0.5 < totals["python"] / (totals["python"] + totals["javascript"]) < 0.7
    assert all(sum(task.minutes for task in tasks) <= 60 for _, tasks in schedule)


def test_alternate_days_give_each_day_to_one_course():
    strategy = _strategy(_course("python"), _course("javascript"), sharing="alternate")
    settings = PlanSettings(study_days=EVERY_DAY, minutes_per_day=30)
    schedule = schedule_plan({"python": _tasks("python", 10), "javascript": _tasks("javascript", 10)},
                             {}, {}, strategy, settings, MONDAY)
    assert all(len({task.subject_slug for task in tasks}) == 1 for _, tasks in schedule)
    assert {tasks[0].subject_slug for _, tasks in schedule[:4]} == {"python", "javascript"}


def test_a_dependent_course_waits_for_its_head_start():
    strategy = _strategy(_course("python"), _course("javascript", depends_on=["python"], start_after=2))
    settings = PlanSettings(study_days=EVERY_DAY, minutes_per_day=30)
    schedule = schedule_plan({"python": _tasks("python", 12), "javascript": _tasks("javascript", 6)},
                             {"python": 4}, {"python": 0}, strategy, settings, MONDAY)
    order = [task for _, tasks in schedule for task in tasks]
    first_js = next(index for index, task in enumerate(order) if task.subject_slug == "javascript")
    python_topics_before = sum(1 for task in order[:first_js] if task.subject_slug == "python" and task.completes_topic)
    assert python_topics_before >= 2


def test_waiting_for_a_whole_course():
    strategy = _strategy(_course("python"), _course("javascript", depends_on=["python"], start_after=-1))
    settings = PlanSettings(study_days=EVERY_DAY, minutes_per_day=45)
    schedule = schedule_plan({"python": _tasks("python", 6), "javascript": _tasks("javascript", 3)},
                             {"python": 2}, {"python": 0}, strategy, settings, MONDAY)
    order = [task.subject_slug for _, tasks in schedule for task in tasks]
    assert order == ["python"] * 6 + ["javascript"] * 3


def test_ai_strategies_are_made_safe_to_schedule():
    messy = _strategy(
        _course("javascript", depends_on=["python", "javascript"]),  # forward and self dependencies
        _course("not-a-course"),
    )
    safe = normalize_strategy(messy, ["javascript", "python"])
    assert [course.subject_slug for course in safe.courses] == ["javascript", "python"]
    assert safe.courses[0].depends_on == []  # python comes later, so it can't be a dependency


def test_weeks_with_the_same_split_form_one_phase():
    tasks = [TaskDraft("python", "practice", "t", "", "", 15)]
    schedule = [(MONDAY + timedelta(days=offset), tasks) for offset in range(21)]
    phases = summarize_phases(schedule, {"python": "Python"}, MONDAY)
    assert len(phases) == 1
    assert phases[0].shares[0].percent == 100


# ---------- API ----------

SETTINGS = {"study_days": EVERY_DAY, "minutes_per_day": 60, "target_date": None}
GOAL = {"goal": "Learn Python and JavaScript to build web apps", "level": "beginner"}


def _ai_strategy(**schedule_changes) -> StrategyResponse:
    return StrategyResponse(
        strategy=_strategy(
            _course("python", weight=6),
            _course("javascript", weight=4, depends_on=["python"], start_after=2),
        ),
        study_days=schedule_changes.get("study_days"),
        minutes_per_day=schedule_changes.get("minutes_per_day"),
        target_date=None,
        changes_explained=schedule_changes.get("explained", ""),
    )


async def test_course_suggestions_only_include_real_courses(auth_client, fake_ai):
    fake_ai.responses[CourseSuggestionResponse] = CourseSuggestionResponse(
        message="Start with Python, then JavaScript.",
        courses=[
            SuggestedCourse(subject_slug="python", role="core", reason="Foundations."),
            SuggestedCourse(subject_slug="rust", role="optional", reason="Not offered."),
        ],
        not_available=["HTML and CSS"],
    )
    suggestion = (await auth_client.post("/api/study-plan/suggest-courses", json=GOAL)).json()
    assert [course["subject_slug"] for course in suggestion["courses"]] == ["python"]
    assert suggestion["not_available"] == ["HTML and CSS"]


async def test_draft_then_accept_creates_a_multi_course_plan(auth_client, fake_ai):
    fake_ai.responses[StrategyResponse] = _ai_strategy()
    draft = (
        await auth_client.post(
            "/api/study-plan/draft", params={"tz": "UTC"}, json={**GOAL, "courses": ["python", "javascript"], "settings": SETTINGS}
        )
    ).json()
    assert draft["phases"][0]["shares"][0]["subject_slug"] == "python"
    assert draft["preview_days"][0]["tasks"][0]["subject_slug"] == "python"
    assert {phase_share["subject_slug"] for phase in draft["phases"] for phase_share in phase["shares"]} == {
        "python",
        "javascript",
    }
    assert (await auth_client.get("/api/study-plan")).json() is None  # drafts aren't saved

    plan = (
        await auth_client.post(
            "/api/study-plan/accept",
            params={"tz": "UTC"},
            json={**GOAL, "courses": draft["courses"], "settings": draft["settings"], "strategy": draft["strategy"]},
        )
    ).json()
    assert plan["total_tasks"] == draft["total_tasks"]
    me = (await auth_client.get("/api/auth/me")).json()
    assert set(me["subjects"]) == {"python", "javascript"}

    first = plan["days"][0]["tasks"][0]
    ticked = (await auth_client.patch(f"/api/study-plan/tasks/{first['id']}", params={"tz": "UTC"}, json={"done": True})).json()
    assert ticked["done_tasks"] == 1

    replanned = (await auth_client.post("/api/study-plan/replan", params={"tz": "UTC"})).json()
    assert replanned["strategy"] == plan["strategy"]

    assert (await auth_client.delete("/api/study-plan")).status_code == 204
    assert set((await auth_client.get("/api/auth/me")).json()["subjects"]) == {"python", "javascript"}


async def test_chat_changes_can_adjust_the_schedule(auth_client, fake_ai):
    fake_ai.responses[StrategyResponse] = _ai_strategy(
        study_days=[0, 1, 2, 3, 4], minutes_per_day=30, explained="Weekends are now free."
    )
    draft = (
        await auth_client.post(
            "/api/study-plan/draft",
            params={"tz": "UTC"},
            json={**GOAL, "courses": ["python", "javascript"], "settings": SETTINGS, "change_request": "No weekends please"},
        )
    ).json()
    assert draft["settings"]["study_days"] == [0, 1, 2, 3, 4]
    assert draft["settings"]["minutes_per_day"] == 30
    assert draft["changes_explained"] == "Weekends are now free."


async def test_rescheduling_a_draft_without_changes_needs_no_ai(auth_client, fake_ai):
    strategy = _ai_strategy().strategy.model_dump()
    response = await auth_client.post(
        "/api/study-plan/draft",
        params={"tz": "UTC"},
        json={**GOAL, "courses": ["python"], "settings": SETTINGS, "strategy": strategy},
    )
    assert response.status_code == 200  # the fake AI has no StrategyResponse, so it wasn't called
    assert [course["subject_slug"] for course in response.json()["strategy"]["courses"]] == ["python"]


async def test_tasks_tick_themselves_from_real_activity(auth_client, fake_ai):
    from app.schemas.material import StudyMaterialResponse
    from app.schemas.tutor import QuestionResponse

    fake_ai.responses[StrategyResponse] = StrategyResponse(
        strategy=_strategy(_course("python")), study_days=None, minutes_per_day=None, target_date=None, changes_explained=""
    )
    draft = (
        await auth_client.post("/api/study-plan/draft", params={"tz": "UTC"}, json={**GOAL, "courses": ["python"], "settings": SETTINGS})
    ).json()
    plan = (
        await auth_client.post(
            "/api/study-plan/accept",
            params={"tz": "UTC"},
            json={**GOAL, "courses": draft["courses"], "settings": draft["settings"], "strategy": draft["strategy"]},
        )
    ).json()
    assert plan["goal_progress"] == 0
    assert plan["course_details"][0]["topics_total"] == 10

    # Opening the first topic's notes ticks its "Read" task.
    fake_ai.responses[StudyMaterialResponse] = StudyMaterialResponse(content="Python is a language.", key_takeaways=[])
    await auth_client.get("/api/topics/python-introduction/material")

    # Five practice answers in that topic tick its first practice task.
    fake_ai.responses[QuestionResponse] = QuestionResponse(
        question_type="predict_output", prompt="What prints?", code="print(1)", options=[], correct_answer="1",
        explanation="It prints 1.", concept="print()", hint="Look.", starter_code=None, test_cases=[],
    )
    session = (await auth_client.post("/api/sessions", json={"topic_slug": "python-introduction", "mode": "practice"})).json()
    for _ in range(5):
        question = (await auth_client.post("/api/tutor/practice", json={"session_id": session["id"]})).json()
        await auth_client.post("/api/tutor/evaluate", json={"question_id": question["id"], "answer": "1"})

    plan = (await auth_client.get("/api/study-plan", params={"tz": "UTC"})).json()
    intro_tasks = {
        task["title"]: task for day in plan["days"] for task in day["tasks"] if task["topic_slug"] == "python-introduction"
    }
    assert intro_tasks["Read: Introduction to Python"]["auto_done"] is True
    assert intro_tasks["Practice Introduction to Python (1 of 2)"]["auto_done"] is True
    assert intro_tasks["Practice Introduction to Python (2 of 2)"]["done"] is False
    assert intro_tasks["Learn: Introduction to Python"]["done"] is False