from datetime import date, datetime

from pydantic import BaseModel


class StreakDay(BaseModel):
    date: date
    active: bool


class Streak(BaseModel):
    current: int
    longest: int
    active_today: bool
    # The last 30 days, oldest first, for the streak calendar.
    recent_days: list[StreakDay]


class Level(BaseModel):
    level: int
    total_xp: int
    # XP earned since reaching the current level, and XP needed to reach the next one.
    xp_into_level: int
    xp_for_next_level: int


class Badge(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    earned: bool
    earned_at: datetime | None
    progress: int
    target: int


class GamificationOut(BaseModel):
    streak: Streak
    level: Level
    badges: list[Badge]
    # Badges unlocked by this request, so the app can announce them once.
    newly_earned: list[str]


class ActivityDay(BaseModel):
    date: date
    questions: int
    correct: int
    # First-attempt accuracy for the day, or null if no questions were answered.
    accuracy: float | None
    learn_messages: int
    xp: int


class ActivityHistory(BaseModel):
    timezone: str
    days: list[ActivityDay]