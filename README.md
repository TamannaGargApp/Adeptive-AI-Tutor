# App-wide UI update (frontend only)

Copy everything in `frontend/` over your project's `frontend/` folder (same paths). No backend changes, no new npm packages.

New file: `components/Icon.tsx` (shared icon set — `LandingGraphics.tsx` now re-exports it, so the landing page keeps working).

Changed:
- Shared pieces: `components/ui.tsx` (PageHeader, StatTile, ProgressRing, EmptyState, Segmented, refreshed badges/bars/alerts)
- Difficulty fix: `components/Sidebar.tsx` uses the new `Segmented` control, so "Intermediate" never wraps
- Header: `components/Navbar.tsx`, `components/StreakChip.tsx` (fit on phones; the "x/y today" chip shows from tablet width up)
- Cards: `StudyPlan.tsx`, `RecommendationCard.tsx`, `TopicCard.tsx`, `TopicSummaryCard.tsx`, `CourseExamStatus.tsx`, `ActivityCharts.tsx`
- Pages: dashboard, topics, progress, tutor, courses, explore, study-sets, study-plan, achievements, final-test, onboarding, admin
- Auth: `app/(auth)/layout.tsx` (split brand panel), login and register pages

`previews/` has screenshots of the redesigned pages.
