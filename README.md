# Adaptive AI Tutor

A personalized Python tutor for beginners and early-intermediate learners. It explains concepts at the
learner's level, asks practice and quiz questions, grades answers, gives hints before solutions, tracks
progress per topic, adapts difficulty, and recommends what to study next.

It is deliberately **not** a general chatbot: every AI call is scoped to the selected Python topic, and
off-topic requests are politely redirected.

## Features

- **Accounts**: registration, login, logout, Argon2 password hashing, JWT in an httpOnly cookie.
- **Onboarding**: name, Python level, learning goal, preferred difficulty.
- **Dashboard**: course completion, questions attempted, correct answers, accuracy, completion and status
  for every topic, and a recommended next topic.
- **Learn mode**: chat-style lessons: explanation, example, walkthrough of the example, and a check question.
  Conversations are saved and resumed per topic, with a "New conversation" option.
- **Practice mode**: one question at a time; wrong answers get feedback and a hint. The answer is revealed
  after 3 attempts.
- **Quiz mode**: 5 generated questions, one attempt each, final score, strong areas, areas to practice,
  and a recommendation.
- **Final test**: 10 questions per topic with a 15-minute timer. Answers autosave and stay hidden until
  you submit (or time runs out), then a full analysis shows score, time, per-concept results, and a
  review of every question.
- **Topic completion standard**: 100% when you've answered at least 10 questions, got 9 of your last 10
  right, and answered every key concept correctly, with remarks on what's left.
- **Progress tracking**: accuracy, mastery level, strengths and weaknesses by concept.
- **Light, dark, and system themes**, remembered per browser.
- **Adaptive difficulty**: 3 correct in a row moves up a level; 2 misses in the last 3 moves down.
- **Recommendations**: deterministic rules (review weak topics → continue the course → strengthen → challenge).

## Course content

The course has 9 Python topics, each with its own key concepts:

| # | Topic | Key concepts |
| --- | --- | --- |
| 1 | Variables & Data Types | variable assignment, int and float, strings, booleans, `type()`, type conversion |
| 2 | Operators | arithmetic, integer division and modulo, comparison, logical, operator precedence |
| 3 | Conditional Statements | `if`, `elif` chains, `else`, nested conditions, truthiness |
| 4 | Loops | `for` loop, `range()`, `while` loop, `break` and `continue`, nested loops |
| 5 | Functions | defining functions, parameters and arguments, return values, default arguments, scope |
| 6 | Lists & Tuples | indexing, slicing, list methods, mutability, tuples, iterating over lists |
| 7 | Dictionaries & Sets | creating dictionaries, accessing keys, dictionary methods, iteration, sets, set operations |
| 8 | Exception Handling | `try`/`except`, specific exception types, `else` and `finally`, raising exceptions, common errors |
| 9 | File Handling | opening files, file modes, reading files, writing files, `with` statement, handling file errors |

Topics live in the `topics` collection and are seeded from `backend/app/db/seed.py` on startup.
**To add a topic**, append it to the end of `INITIAL_TOPICS` and restart the backend. Nothing else in
the code needs to change. Append rather than insert: existing topics keep their stored order number,
so a topic inserted mid-list would share a number with an existing one.

### How topic completion works

A topic is **100% complete** when all three requirements are met:

| Requirement | Share of the percentage |
| --- | --- |
| Answer at least 10 questions (first attempts in Practice, Quiz, or Final test) | 20% |
| Get 9 of your last 10 answers right | 40% |
| Answer every key concept correctly at least once | 40% |

Partial progress counts toward each share, and the percentage never shows 100% until every requirement
is fully met. Each topic also gets a status (Not started, Needs more practice, In progress, Almost
complete, Complete) and remarks that say exactly what's left. The thresholds are constants at the top
of the completion section in `progress_service.py`.

## Architecture

```text
Next.js (React, Tailwind)  ──fetch, cookie auth──▶  FastAPI
                                                     │
                     api/ (thin routes) ─────────────┤
                     services/ (business logic) ─────┼──▶ MongoDB (pymongo async)
                     services/ai_service.py ─────────┴──▶ Google Gemini (google-genai)
```

Key design decisions:

- **Routes are thin.** They validate input, call one service function, and return a schema.
- **Each MongoDB collection is owned by one service**, so queries aren't scattered.
- **All Gemini calls go through `ai_service.py`.** Services depend on a small `StructuredLLM` protocol;
  adding another provider means one new class with a `generate_structured()` method.
- **AI calls can't hang.** Each Gemini call is limited to 20 seconds and a whole request to 45. A busy
  or slow model is skipped for 60 seconds in favour of the fallback model, and the browser shows a
  progress note during long waits and a clear error with a retry option if a request fails.
- **AI output is structured.** Gemini is given Pydantic models as response schemas (`LessonResponse`,
  `QuestionResponse`, `EvaluationResponse`, `QuizResponse`), and every response is validated again on our
  side. Malformed responses are retried once, then reported as a friendly error.
- **Correctness doesn't depend on the AI where it doesn't have to.** Multiple-choice and "predict the
  output" answers are graded in code (whitespace-tolerant), so a learner can't argue the AI into marking
  them right. The AI writes the feedback and grades open-ended short answers.
- **Answers never reach the browser before they should.** Correct answers stay in the `questions`
  collection until the backend decides to reveal them.
- **Only first attempts count toward accuracy.** Retries are stored in `attempts` but don't inflate stats.
- **Recommendations are rule-based**, so they are predictable and testable.
- **Final tests reveal nothing early.** Their questions can't be checked through the normal evaluate
  endpoint. Answers are autosaved and graded together on submit, or automatically once the time runs
  out, even if the browser was closed.
- **Themes use CSS variables.** Components use colour tokens (`ink`, `surface`, `blue`, …) that switch
  values in dark mode, so no component needs dark-specific classes.

### MongoDB collections

| Collection | Contents |
| --- | --- |
| `users` | Accounts and onboarding profile (password stored only as an Argon2 hash) |
| `topics` | Course topics and their key concepts |
| `sessions` | Learn, Practice, and Quiz sessions; Learn chat history is stored here |
| `questions` | Every generated question, including its correct answer (never sent early) |
| `attempts` | Every answer submitted, including retries |
| `topic_progress` | Per-learner, per-topic stats used for mastery, completion, and difficulty |
| `final_tests` | Timed final tests: questions, autosaved answers, timing, and the result analysis |

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, react-markdown |
| Backend | Python 3.11+, FastAPI, Uvicorn, Pydantic 2, Pydantic Settings |
| Database | MongoDB (local), PyMongo async API (`AsyncMongoClient`) |
| AI | Google Gemini via the `google-genai` SDK |
| Auth | PyJWT, pwdlib (Argon2) |
| Tooling | uv, pytest, pytest-asyncio, httpx |

## Project structure

```text
adaptive-ai-tutor/
├── README.md
├── docker-compose.yml
├── backend/
│   ├── pyproject.toml          # uv project (uv.lock is created on first `uv sync`)
│   ├── .env.example
│   ├── app/
│   │   ├── main.py             # app factory, lifespan, error handling, CORS
│   │   ├── api/                # thin routes: auth, profile, topics, sessions, tutor, final_tests,
│   │   │                       #   progress, recommendations
│   │   ├── core/               # config, security (hashing + JWT), dependencies, exceptions
│   │   ├── db/                 # mongodb connection, indexes, topic seed data
│   │   ├── models/             # shapes of documents stored in MongoDB
│   │   ├── schemas/            # API request/response and AI output schemas
│   │   ├── services/
│   │   │   ├── ai_service.py               # the only code that calls Gemini (retries, fallback, timeouts)
│   │   │   ├── tutor_service.py            # Learn lessons, practice questions, quizzes
│   │   │   ├── evaluation_service.py       # grading and feedback for practice and quiz answers
│   │   │   ├── final_test_service.py       # timed tests, autosave, grading, analysis
│   │   │   ├── progress_service.py         # accuracy, mastery, completion standard, difficulty
│   │   │   ├── recommendation_service.py   # what to study next
│   │   │   └── user/topic/session/question services  # one per collection
│   │   └── prompts/            # tutor system prompt and prompt builders
│   └── tests/                  # pytest suite (Gemini is always mocked)
└── frontend/
    ├── app/
    │   ├── layout.tsx          # fonts, theme script, auth provider
    │   ├── globals.css         # colour tokens for light and dark themes
    │   ├── page.tsx            # landing page
    │   ├── (auth)/             # /login, /register
    │   └── (app)/              # signed-in pages: onboarding, dashboard, topics, tutor, quiz,
    │                           #   final-test, progress
    ├── components/             # Navbar, Logo, ThemeToggle, Sidebar, ChatWindow, PracticePanel,
    │                           #   QuizQuestion, FinalTestRunner, FinalTestResults, cards, ui
    └── lib/                    # api client, auth context, types, labels
```

`(auth)` and `(app)` are Next.js route groups: they share a layout but don't appear in the URL.
`(app)/layout.tsx` is the guard that requires login and completed onboarding.

## Prerequisites

- **Python 3.11+** (uv can install it for you)
- **uv**: <https://docs.astral.sh/uv/getting-started/installation/>
- **Node.js 20+** and npm
- **MongoDB Community Server 7+** running locally
- A **Gemini API key** from Google AI Studio: <https://aistudio.google.com/apikey>

## Local MongoDB setup

The app expects MongoDB at `mongodb://localhost:27017` and creates the `ai_tutor` database, indexes, and
the 9 Python topics automatically on first start.

**Windows**: install MongoDB Community Server with the MSI installer and keep "Install MongoDB as a
Service" checked. It then starts automatically. To check it's running, open PowerShell:

```powershell
Get-Service MongoDB
```

**macOS (Homebrew)**:

```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Ubuntu/Debian**: follow <https://www.mongodb.com/docs/manual/administration/install-on-linux/>, then:

```bash
sudo systemctl start mongod
```

Optional: install **MongoDB Compass** or the VS Code MongoDB extension to browse the data.

## Environment variables

Copy the example file and fill it in:

```bash
cd backend
cp .env.example .env          # Windows PowerShell: Copy-Item .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | no | Defaults to `mongodb://localhost:27017` |
| `DATABASE_NAME` | no | Defaults to `ai_tutor` |
| `GEMINI_API_KEY` | for tutor features | The app starts without it, but Learn/Practice/Quiz return a clear error |
| `GEMINI_MODEL` | no | Defaults to `gemini-3.8-flash` |
| `GEMINI_FALLBACK_MODEL` | no | Defaults to `gemini-3.5-flash-lite`. Used automatically when the main model is busy, slow, or unavailable |
| `JWT_SECRET_KEY` | **yes** | At least 32 characters. Generate with the command below |
| `JWT_ALGORITHM` | no | `HS256` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | no | `60` |
| `CORS_ORIGINS` | no | Comma-separated. Defaults to `http://localhost:3000` |
| `COOKIE_SECURE` | no | Set to `true` when served over HTTPS |

Generate a JWT secret:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

The frontend reads one optional variable. To change it, create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

`.env` and `.env.local` are git-ignored. Never commit them.

## Backend setup

```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload
```

`uv sync` creates `.venv` and `uv.lock`. Commit `uv.lock` so everyone gets the same versions.

In VS Code, select the interpreter at `backend/.venv` (Command Palette → "Python: Select Interpreter").

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

## API documentation

With the backend running, open <http://localhost:8000/docs> for interactive Swagger docs.
Logging in through `/api/auth/login` in Swagger sets the auth cookie, so protected endpoints work there
too. API clients can alternatively send `Authorization: Bearer <token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register` | Create account and log in |
| POST | `/api/auth/login` | Log in (sets httpOnly cookie) |
| POST | `/api/auth/logout` | Log out (clears cookie) |
| GET | `/api/auth/me` | Current user |
| GET / PUT | `/api/profile` | Read / save onboarding profile |
| GET | `/api/topics` | All topics, in course order |
| POST | `/api/sessions` | Start a learn / practice / quiz session (`resume: true` continues the last Learn chat) |
| GET | `/api/sessions/{id}` | Session with chat history |
| POST | `/api/tutor/learn` | Send a message in Learn mode (empty message starts the lesson) |
| POST | `/api/tutor/practice` | Generate one practice question |
| POST | `/api/tutor/evaluate` | Grade an answer, update progress |
| POST | `/api/tutor/quiz` | Generate a 5-question quiz for a quiz session |
| GET | `/api/tutor/quiz/{session_id}/result` | Quiz score, strong areas, needs practice, recommendation |
| POST | `/api/final-tests` | Start a timed final test for a topic |
| GET | `/api/final-tests/{id}` | Load a test (auto-graded if its time ran out) |
| PUT | `/api/final-tests/{id}/answers` | Autosave one answer |
| POST | `/api/final-tests/{id}/submit` | Submit, grade, and return the analysis |
| GET | `/api/progress` | Overall and per-topic progress |
| GET | `/api/progress/{topic_slug}` | One topic's progress |
| GET | `/api/recommendations` | What to study next |
| GET | `/api/health` | Health check (pings MongoDB) |

## Running the application

1. **Start MongoDB** (see above).
2. **Start the backend** in one terminal:
   ```bash
   cd backend
   uv sync
   uv run uvicorn app.main:app --reload
   ```
   You should see `Connected to MongoDB database 'ai_tutor'`.
3. **Start the frontend** in a second terminal:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
4. Open <http://localhost:3000>. Use `localhost`, not `127.0.0.1`: the auth cookie is set for
   `localhost`, and mixing the two looks like a different site to the browser.

### With Docker (optional)

```bash
docker compose up --build
```

This runs MongoDB, the backend (using `backend/.env`), and a production build of the frontend.

## Running tests

Tests use a separate `ai_tutor_test` database (dropped after each test) and a fake AI, so they never
call Gemini. MongoDB must be running; otherwise database tests are skipped.

```bash
cd backend
uv run pytest
```

Covered:

- **Auth:** registration, duplicate email, password hashing, login, invalid login, logout, protected
  endpoints, invalid tokens.
- **Learning:** topic retrieval, Learn mode replies and resuming a conversation, practice evaluation
  (including the fallback when the AI is unavailable), a full quiz flow, and quiz feedback without hints.
- **Final test:** answers hidden until submit, grading and analysis, no one-by-one checking, double
  submit counted once, and automatic grading after the time runs out.
- **Progress:** accuracy, mastery thresholds, difficulty adjustment, deterministic grading, the topic
  completion standard and its remarks, and recommendations.
- **AI service:** fallback to the second model, skipping a busy model, timeouts, and a rejected API key.

Frontend type check:

```bash
cd frontend
npm run typecheck
```

## Troubleshooting

- **"Can't reach the server"** in the browser: the backend isn't running, or `NEXT_PUBLIC_API_URL` is wrong.
- **Logged out immediately after logging in**: open the app at `http://localhost:3000`, not `127.0.0.1`.
- **Backend fails with `JWT_SECRET_KEY` error**: set a secret of at least 32 characters in `backend/.env`.
- **Backend fails with `ServerSelectionTimeoutError`**: MongoDB isn't running at `MONGODB_URI`.
- **"The AI tutor is not configured yet"**: add `GEMINI_API_KEY` to `backend/.env` and restart.
- **Gemini 404 / model not found**: set `GEMINI_MODEL` to a current model name from Google AI Studio.
- **`Gemini error 503` warnings in the log**: the main model is overloaded on Google's side. The app
  switches to `GEMINI_FALLBACK_MODEL` and skips the busy model for 60 seconds, so no action is needed.

## Future enhancements

- Smarter adaptive difficulty (per-concept, spaced repetition)
- A course-wide final exam across all topics
- RAG over course notes or documentation
- PDF upload to learn from your own material
- History pages: browse past Learn conversations and final test results
- Progress charts over time
- Badges and learning streaks
- Personalized study plans
- Admin dashboard to manage topics and review AI output
- Running learner code in a sandbox for coding exercises
- Login rate limiting and CSRF tokens before any public deployment