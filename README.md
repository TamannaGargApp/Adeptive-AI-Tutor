# Adaptive AI Tutor

A personalized programming tutor for beginners and early-intermediate learners. It ships with five
courses (**Python**, **JavaScript**, **Object-Oriented Programming in Python**, **Data Analysis with
Pandas** and **Web Development with Flask**), and more can be added without code changes. It explains
concepts at the
learner's level, asks practice and quiz questions, grades answers, gives hints before solutions, tracks
progress per topic, adapts difficulty, and recommends what to study next.

It is deliberately **not** a general chatbot: every AI call is scoped to the selected course and topic, and
off-topic requests are politely redirected.

## Features

- **Accounts**: registration, login, logout, Argon2 password hashing, JWT in an httpOnly cookie.
- **Onboarding**: name, programming level, learning goal, preferred difficulty, and a choice between
  picking a first course or building a study plan.
- **Courses aren't hard-coded**: courses, topics and their names come from the database, so the app
  (pages, icons, labels, AI prompts) works with any course an admin adds.
- **Courses and learning plan**: the **Courses** page lists every course (open one for its topics and add
  it to your plan); **My courses** shows only the courses in your plan, where you can switch or remove
  them. Switch the current course from the course menu in the header; the main pages are in the menu behind your name (☰). Every page shows the current course. Removing a course keeps its progress.
- **Dashboard**: course completion, questions attempted, correct answers, accuracy, completion and status
  for every topic, and a recommended next topic.
- **Read mode**: study notes for every topic covering each key concept, with runnable examples, common
  mistakes and key takeaways. Written by the AI on first use, then stored and shared; admins can edit or
  regenerate them.
- **Learn mode**: a chat tutor that answers what the learner actually asks, in tidy Markdown: explanations,
  examples, or sets of exercises (without giving away the answers before they're attempted).
  Conversations are saved and resumed per topic. "History" lists past conversations to reopen, and
  "New conversation" starts fresh.
- **Practice mode**: one question at a time; wrong answers get feedback and a hint. The answer is revealed
  after 3 attempts.
- **Quiz mode**: 5 generated questions, one attempt each, final score, strong areas, areas to practice,
  and a recommendation. Quizzes are started from a topic: the
  topic dialog on the Topics page, the tutor sidebar, or a recommendation.
- **Final tests**: a topic test (10 questions, 15 minutes) or a **course exam** across every topic of a
  course (2 questions per topic, 90 seconds each). Answers autosave and stay hidden until you submit (or
  time runs out). Questions can be marked for review, and the navigator shows each question's status:
  green answered, yellow marked for review, red skipped, grey not visited. The analysis shows score,
  time, results by concept (or by topic for a course exam), and a review of every question.
- **Completion standard**: a topic is complete after enough practice, high recent accuracy, every key
  concept covered, and a passed final test. A course is complete once every topic is complete and its
  course exam (locked until then) is passed. Remarks say exactly what's left.
- **Progress tracking**: accuracy, mastery level, strengths and weaknesses by concept.
- **Study sets**: learners upload their own notes (PDF, text or Markdown, on any subject) and get AI
  Notes, an AI Summary, AI Flashcards (with "known / review again" progress), an AI Quiz and an AI Tutor
  for that material. Each tool is generated the first time it's opened, then saved. A set can hold up to
  **20 files and 2 GB**; files can be added to or removed from an existing set, and tools made before a
  change are marked so they can be updated. "More flashcards" adds new cards that don't repeat the deck
  (up to 120), and a new quiz avoids the previous questions.
- **Personalized study plans (optional)**: a guided planner turns a goal (e.g. "learn Python and
  JavaScript to build web apps") into a plan across one or more courses: it suggests courses from the
  catalogue, works out the timing, and shows a draft with phases, order and the time split between
  courses. The learner adjusts it with quick controls or a chat box ("no weekends", "finish JS sooner")
  and accepts it. Courses can be in the plan or studied on their own, and every change to what's in the
  plan is shown as a draft to approve.
- **Streaks, XP and badges**: a daily learning streak (counted in the learner's own timezone), XP and
  levels, 14 badges with progress toward each, and a "badge unlocked" notice. A 🔥 streak chip sits in the
  navbar, with the full view on the Achievements page.
- **Topics page**: compact topic cards; click one to see its checklist and key concepts and to start
  Learn, Practice, Quiz or the final test.
- **Progress page**: compact topic cards; click one for the full breakdown (checklist, concepts, remarks,
  scores and the final test).
- **Progress charts**: questions per day (correct vs incorrect), first-try accuracy over time, and a
  30-day streak calendar.
- **File attachments in Learn**: attach up to 3 PDFs, text or code files to a conversation (📎) and ask
  about them. Text is extracted in the browser and kept in the browser's IndexedDB; the server receives
  it with each question and **never stores file contents**, only file names in the chat history. Files
  that don't fit the course are politely declined.
- **Voice tutoring**: speak to the tutor (🎤), hear any reply read aloud (🔊), or turn on Voice mode to do
  both automatically. Uses the browser's built-in speech features (speaking works in Chrome and Edge).
- **Code execution**: tutor code examples have a ▶ Run button, and Practice includes write-code exercises
  with test cases. Code runs in the learner's browser (Python via Pyodide, JavaScript in a Web Worker),
  never on the server. Libraries load the first time code imports them: Pandas from Pyodide's packages
  and Flask through micropip (Flask code is exercised with its test client, so no server is started).
  A 5-second guard stops endless loops; it starts only after libraries have loaded.
- **Course coding guidelines**: a course can carry its own instructions for the AI on how to write
  code, which are added to every lesson, question, test, study note and feedback prompt for that course.
  For example, Flask examples use `app.test_client()` instead of `app.run()`, and Pandas data is built
  inline instead of read from files, so everything runs in the browser.
- **Personalized feedback**: an AI coach report on the Progress page, built from the learner's actual
  mistakes and progress: strengths, mistake patterns, areas to improve (why and how), and next steps.
- **Course notes (admin uploads)**: admins upload notes per topic (PDF, Markdown or text), review the
  extracted text, and save it. The tutor uses the notes as its main source in Learn, Practice, quizzes,
  topic tests and Read-mode notes, and adds what they lack (such as examples) from its own knowledge.
  Admins see which notes a reply used ("📘 From course notes"); learners don't.
- **Admin dashboard**: platform stats, a learner list, and course/topic management (create, edit, reorder,
  archive). Admins are set with `ADMIN_EMAILS`.
- **Light, dark, and system themes**, remembered per browser, with a multi-colour palette, open
  page layouts and scroll-in animations (turned off for people who prefer reduced motion).
- **Landing page** with product screenshots; logging out returns to it.
- **Adaptive difficulty**: 3 correct in a row moves up a level; 2 misses in the last 3 moves down.
- **Recommendations**: deterministic rules (review weak topics → continue the course → strengthen → challenge).

## Course content

Each course has its own topics, and each topic has key concepts.

Each course starts with an introduction topic (order 0).

**Python** (10 topics)

| # | Topic | Key concepts |
| --- | --- | --- |
| 0 | Introduction to Python | what Python is, running a program, `print()`, comments, indentation and syntax |
| 1 | Variables & Data Types | variable assignment, int and float, strings, booleans, `type()`, type conversion |
| 2 | Operators | arithmetic, integer division and modulo, comparison, logical, operator precedence |
| 3 | Conditional Statements | `if`, `elif` chains, `else`, nested conditions, truthiness |
| 4 | Loops | `for` loop, `range()`, `while` loop, `break` and `continue`, nested loops |
| 5 | Functions | defining functions, parameters and arguments, return values, default arguments, scope |
| 6 | Lists & Tuples | indexing, slicing, list methods, mutability, tuples, iterating over lists |
| 7 | Dictionaries & Sets | creating dictionaries, accessing keys, dictionary methods, iteration, sets, set operations |
| 8 | Exception Handling | `try`/`except`, specific exception types, `else` and `finally`, raising exceptions, common errors |
| 9 | File Handling | opening files, file modes, reading files, writing files, `with` statement, handling file errors |

**JavaScript** (9 topics)

| # | Topic | Key concepts |
| --- | --- | --- |
| 0 | Introduction to JavaScript | what JavaScript is, running JavaScript, `console.log()`, comments, statements and semicolons |
| 1 | Variables & Data Types | `let` and `const`, numbers, strings, booleans, `typeof`, `null` and `undefined` |
| 2 | Operators | arithmetic, comparison, strict equality, logical operators, type coercion |
| 3 | Conditional Statements | `if` and `else`, `else if`, ternary operator, `switch`, truthy and falsy values |
| 4 | Loops | `for`, `while`, `for...of`, `for...in`, `break` and `continue` |
| 5 | Functions | function declarations, arrow functions, default parameters, return values, scope |
| 6 | Arrays | indexing, `push` and `pop`, `map` and `filter`, iterating arrays, spread syntax |
| 7 | Objects | object literals, dot and bracket notation, methods, iterating objects, destructuring |
| 8 | Error Handling | `try` and `catch`, `finally`, throwing errors, error types, common errors |

**Object-Oriented Programming in Python** (8 topics)

| # | Topic | Key concepts |
| --- | --- | --- |
| 0 | Introduction to OOP | objects and classes, attributes and methods, procedural vs object-oriented code, everything in Python is an object |
| 1 | Classes & Objects | `class` keyword, the `__init__` method, `self`, instance attributes, creating instances |
| 2 | Methods & Class Attributes | instance methods, class attributes, `@classmethod`, `@staticmethod`, instance vs class attributes |
| 3 | Encapsulation | public and protected names, private names and name mangling, `@property`, property setters, validating data |
| 4 | Inheritance | subclasses, `super()`, method overriding, multilevel inheritance, `isinstance()` and `issubclass()` |
| 5 | Polymorphism & Abstraction | polymorphism, duck typing, abstract base classes, `@abstractmethod`, common interfaces |
| 6 | Special (Dunder) Methods | `__str__` and `__repr__`, `__eq__` and comparisons, operator overloading, `__len__` and `__getitem__`, `__iter__` |
| 7 | Composition & Dataclasses | composition (has-a), inheritance vs composition, `@dataclass`, default and field values, custom exception classes |

**Data Analysis with Pandas** (9 topics)

| # | Topic | Key concepts |
| --- | --- | --- |
| 0 | Introduction to Pandas | what pandas is, importing pandas as `pd`, Series and DataFrame, tabular data |
| 1 | Series | creating a Series, index labels, vectorised operations, Series statistics, `value_counts()` |
| 2 | DataFrames | creating a DataFrame, columns and index, `head()` and `tail()`, shape and dtypes, `describe()` and `info()` |
| 3 | Selecting & Filtering Data | selecting columns, `loc`, `iloc`, boolean filtering, combining conditions, `isin()` |
| 4 | Cleaning Data | missing values, `fillna()` and `dropna()`, duplicates, renaming columns, `astype()`, string methods |
| 5 | Transforming Data | adding columns, `apply()`, `map()`, `sort_values()`, conditional columns |
| 6 | Grouping & Aggregation | `groupby()`, aggregation functions, `agg()` with several functions, `pivot_table()`, resetting the index |
| 7 | Combining DataFrames | `concat()`, `merge()`, inner and outer joins, left and right joins, joining on keys |
| 8 | Reading & Writing Data | `read_csv()`, CSV options, `to_csv()`, `to_dict()` and `to_json()`, choosing columns and types on load |

**Web Development with Flask** (10 topics)

| # | Topic | Key concepts |
| --- | --- | --- |
| 0 | Introduction to Flask | what Flask is, HTTP requests and responses, creating a Flask app, a first route, the test client |
| 1 | Routing | `@app.route`, URL variables, variable converters, HTTP methods, `url_for()` |
| 2 | Requests & Responses | `request.args`, `request.form`, `request.get_json()`, status codes, `redirect()`, `make_response()` |
| 3 | Templates with Jinja | rendering templates, template variables, loops and conditions in templates, filters, automatic escaping, template inheritance |
| 4 | Forms & Validation | GET and POST forms, reading form fields, validating input, showing errors, redirect after POST |
| 5 | Building JSON APIs | `jsonify()`, returning dictionaries, REST endpoints, CRUD operations, API status codes |
| 6 | Error Handling | `abort()`, `@app.errorhandler`, 404 and 400 errors, JSON error responses |
| 7 | Sessions & Cookies | setting cookies, reading cookies, the session object, `secret_key`, logging a user in and out |
| 8 | Blueprints & App Structure | `Blueprint`, `register_blueprint()`, URL prefixes, application factory, configuration |
| 9 | Testing Flask Apps | `test_client()`, checking status codes, checking response data, testing JSON APIs, testing forms |

The OOP, Pandas and Flask courses use the `python` code language, so their examples and exercises run
in the browser like the Python course. The Pandas and Flask courses also have **coding guidelines**
(see Features).

Courses and topics live in the `subjects` and `topics` collections and are seeded from
`backend/app/db/seed.py` on startup. Nothing else in the code needs to change to add content:

- **To add a course**, add an entry to `COURSES` with its slug, name, description, code language
  (`python` or `javascript`, the languages the browser can run), and topics. Topic slugs must be unique
  across courses, so prefix them (e.g. `js-loops`). Optionally add `code_guidelines`, instructions the
  AI follows when writing code for that course. On restart, a new course is placed after every existing
  course (including ones created in the admin page), and nothing already in the database is overwritten.
- **Or create it in the app**: Admin → Courses lets admins create, edit, archive and delete courses,
  and add, edit and reorder topics, without touching the code.
- **To add a topic**, append it to the end of its course's list and restart the backend. Append rather
  than insert: existing topics keep their stored order number, so a topic inserted mid-list would share
  a number with an existing one.

Accounts created before courses existed are automatically on the Python course.

### How completion works

**A topic is 100% complete** when all four requirements are met:

| Requirement | Share of the percentage |
| --- | --- |
| Answer at least 10 questions (first attempts in Practice, Quiz, or tests) | 20% |
| Get 9 of your last 10 answers right | 30% |
| Answer every key concept correctly at least once | 30% |
| Pass the topic's final test with 70% or more | 20% |

Partial progress counts toward each share, and the percentage never shows 100% until every requirement
is fully met. Once the first three are done, the topic is marked "ready for the final test" and the
recommendation points to it. Each topic also gets a status (Not started, Needs more practice, In
progress, Almost complete, Complete) and remarks that say exactly what's left.

**A course is complete** when every topic is complete **and** the course exam is passed with 70% or
more. The course exam stays **locked** until every topic is complete. The backend refuses to start it
early, and the app shows which topics are left. Topics count for 90% of the course percentage and the
course exam for the remaining 10%.

The pass mark and all thresholds are constants at the top of the completion section in
`progress_service.py`.

**Passing, failing and retakes** (constants in `progress_service.py`):

| | Topic final test | Course exam |
| --- | --- | --- |
| Pass | 70% or more | 70% or more |
| Fail | Below 70% | Below 70% |
| After a fail | Retake right away; **3 failed attempts in a row lock it for 12 hours**, then 3 more tries | **Locked for 12 hours**, then retake |
| After passing | Shows **Completed**; **2 new attempts** allowed | Shows **Completed**; can't be retaken |

The best score is always kept, so a new attempt can never undo a completion. Locks are enforced by the
backend, and the app shows a live countdown until the next attempt opens.

Tests finished before results were recorded on progress are picked up automatically: on startup, the
backend reads past test results and records each learner's best score and passes. It only ever raises a
best score or marks a pass, so it's safe to run on every start.

### Streaks, XP and badges

All of this is calculated from data the app already stores (answers, Learn messages and test results),
so existing learners get credit for past activity. Only earned badges are stored, so a badge keeps its
unlock date.

- **Streak:** a day counts when the learner answers at least one question or sends a Learn message. Days
  use the browser's timezone. A streak stays alive until a whole day passes with no activity.
- **XP:** +10 for a right first attempt, +2 for any other answer, +3 per Learn message, +50 per topic
  test passed, +200 per course exam passed. Level *L* needs 50 × *L* × (*L* − 1) XP in total
  (level 2 at 100 XP, level 3 at 300, level 4 at 600, …).
- **Badges** are defined in `BADGES` in `gamification_service.py`; adding one is a single line.



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
- **Formatting doesn't make a right answer wrong.** "Predict the output" answers are compared ignoring
  spacing, quotes, capitalization and the `<class '…'>` wrapper. In Practice and quizzes, an answer that
  still doesn't match is judged by the AI, which accepts the same result in different words (e.g.
  "boolean" for `<class 'bool'>`) and shows the exact output. Final tests use only the formatting rules.
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
- **Course notes ground the tutor without limiting it.** The sections of a topic's notes that match the
  question are added to the prompt (keyword matching, up to about 8,000 characters), with instructions to
  follow the notes and fill gaps from general knowledge. Source labels are stripped from learners'
  responses on the server, not just hidden in the UI.
- **Study plans: the AI decides strategy, the app builds the schedule.** The AI chooses courses from
  the catalogue, their order and dependencies, their weight, and whether courses share study days or
  alternate. A rule-based scheduler turns that into daily tasks from each course's real remaining work,
  within the daily time limit, never before a dependency's head start. Drafts aren't stored; only an
  accepted plan is saved.
- **Study set files live in object storage, not the database.** The original file and its text go to a
  private, encrypted AWS S3 bucket (or a local folder in development) under a per-learner folder; MongoDB
  holds only what's generated from them. Downloads use short-lived presigned links.
- **Learner files never touch the database.** Attachments are read and kept in the learner's browser,
  sent with each question, and used for that request only. On another device the conversation is still
  there, with a prompt to re-attach the file.
- **Learner code never runs on the server.** Coding exercises run in the browser and report their test
  results. Because those results come from the browser, coding exercises are part of Practice only;
  final tests and course exams stay fully server-graded.
- **Deleting is deliberate.** Archiving hides content and keeps learner data; deleting a course (after
  typing its name to confirm) removes it with all its learner data. Deleted built-in courses aren't
  recreated on restart. The default course can only be archived.
- **Admins are configured, not promoted.** Admin access comes only from `ADMIN_EMAILS`, and every admin
  route checks it on the server.
- **Nothing assumes which courses exist.** The frontend picks course icons and labels from the course
  data, and prompts take the course name, code language and coding guidelines from the database. The
  learning goal stored as `learn_python` (kept for existing accounts) is described to the AI as learning
  any new language or framework.
- **Libraries load before the clock starts.** The browser code runner downloads any library the code
  imports (Pandas, Flask) first, with a 60-second limit, and only then starts the 5-second run guard, so
  a slow first download is never mistaken for an endless loop.
- **Large uploads skip the backend.** With S3, the browser uploads each study set file straight to the
  bucket with a presigned link, then confirms it; with local storage, the file is streamed to disk.
  Both check the 2 GB limit.
- **Themes use CSS variables.** Components use colour tokens (`ink`, `surface`, `blue`, …) that switch
  values in dark mode, so no component needs dark-specific classes.

### MongoDB collections

| Collection | Contents |
| --- | --- |
| `users` | Accounts, onboarding profile, and learning plan (password stored only as an Argon2 hash) |
| `subjects` | Courses, the code language each uses, and optional coding guidelines for the AI |
| `topics` | Topics of each course and their key concepts |
| `sessions` | Learn, Practice, and Quiz sessions; Learn chat history is stored here |
| `questions` | Every generated question, including its correct answer (never sent early) |
| `attempts` | Every answer submitted, including retries |
| `topic_progress` | Per-learner, per-topic stats used for mastery, completion, and difficulty, plus the best final test score |
| `course_progress` | Per-learner, per-course exam results: best score and whether it was passed |
| `user_badges` | Badges each learner has earned, with the date |
| `course_notes` | Admin-uploaded notes per topic, split into sections (original files aren't kept) |
| `study_sets` | Study sets: title, their files (name, size, storage keys), and the generated notes, summary, flashcards, quiz, progress and chat. The files themselves are in S3 (or `backend/storage/`) |
| `goal_plans` | Each learner's study plan: goal, courses, AI strategy, settings and scheduled tasks |
| `topic_materials` | Study notes for each topic (shared by all learners) |
| `feedback_reports` | Personalized feedback reports, so they're only regenerated after new answers |
| `final_tests` | Topic tests and course exams: questions, autosaved answers, review marks, timing, and the analysis |

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, react-markdown, pdf.js |
| Code runner | Pyodide (Python, with Pandas and Flask on demand) and Web Workers (JavaScript), in the browser |
| Voice | The browser's Web Speech API |
| Backend | Python 3.11+, FastAPI, Uvicorn, Pydantic 2, Pydantic Settings |
| Database | MongoDB (local), PyMongo async API (`AsyncMongoClient`) |
| AI | Google Gemini via the `google-genai` SDK |
| Auth | PyJWT, pwdlib (Argon2) |
| File storage | AWS S3 via boto3, or a local folder |
| Deployment | Docker, Docker Compose |
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
│   │   ├── api/                # thin routes: auth, profile, subjects (courses + plan), topics,
│   │   │                       #   sessions, tutor, final_tests, progress, recommendations,
│   │   │                       #   study_plans, study_sets, gamification, feedback, admin
│   │   ├── core/               # config, security (hashing + JWT), dependencies, exceptions
│   │   ├── db/                 # mongodb connection, indexes, course and topic seed data
│   │   ├── models/             # shapes of documents stored in MongoDB
│   │   ├── schemas/            # API request/response and AI output schemas
│   │   ├── services/
│   │   │   ├── ai_service.py               # the only code that calls Gemini (retries, fallback, timeouts)
│   │   │   ├── tutor_service.py            # Learn lessons, practice questions, quizzes
│   │   │   ├── evaluation_service.py       # grading and feedback for practice and quiz answers
│   │   │   ├── final_test_service.py       # topic tests and course exams: autosave, grading, analysis
│   │   │   ├── subject_service.py          # courses and the learner's plan
│   │   │   ├── gamification_service.py     # streaks, XP levels, badges, daily activity
│   │   │   ├── progress_service.py         # accuracy, mastery, completion standard, difficulty
│   │   │   ├── recommendation_service.py   # what to study next
│   │   │   ├── study_plan_service.py       # goal plans and the rule-based scheduler
│   │   │   ├── study_set_service.py        # study sets, their files and AI tools
│   │   │   ├── file_storage.py             # S3 or local storage for study set files
│   │   │   ├── notes_service.py            # admin course notes and relevant excerpts
│   │   │   ├── material_service.py         # Read-mode study notes
│   │   │   ├── feedback_service.py         # AI coach reports
│   │   │   ├── admin_service.py            # admin stats and content management
│   │   │   └── user/topic/session/question services  # one per collection
│   │   └── prompts/            # tutor, study plan and study set prompts
│   └── tests/                  # pytest suite (Gemini is always mocked)
└── frontend/
    ├── app/
    │   ├── layout.tsx          # fonts, theme script, auth provider
    │   ├── globals.css         # colour tokens for light and dark themes
    │   ├── page.tsx            # landing page
    │   ├── (auth)/             # /login, /register
    │   └── (app)/              # signed-in pages: onboarding, dashboard, explore, courses, topics,
    │                           #   tutor, quiz, final-test, progress, achievements, study-plan,
    │                           #   study-sets, admin
    ├── components/             # Navbar, Logo, CourseSwitcher, ThemeToggle, Sidebar, ChatWindow,
    │                           #   ChatHistory, PracticePanel, QuizQuestion, FinalTestRunner,
    │                           #   FinalTestResults, CompletionChecklist, CourseExamStatus,
    │                           #   Achievements, ActivityCharts, StreakChip, cards, ui
    └── lib/                    # api client, auth and gamification contexts, types, labels,
                                #   codeRunner (browser code execution), courses (course icons and
                                #   labels), attachments, speech, studySetFiles
```

`(auth)` and `(app)` are Next.js route groups: they share a layout but don't appear in the URL.
`(app)/layout.tsx` is the guard that requires login and completed onboarding.

## Prerequisites

- **Python 3.11+** (uv can install it for you)
- **uv**: <https://docs.astral.sh/uv/getting-started/installation/>
- **Node.js 20+** and npm
- Or just **Docker Desktop**, to run everything with Docker Compose (see below)
- **MongoDB Community Server 7+** running locally
- A **Gemini API key** from Google AI Studio: <https://aistudio.google.com/apikey>

## Local MongoDB setup

The app expects MongoDB at `mongodb://localhost:27017` and creates the `ai_tutor` database, indexes, and
every built-in course with its topics automatically on first start. Courses added to the seed later are
inserted on the next start.

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
| `STORAGE_BACKEND` | no | Where study set files go: `local` (default, `backend/storage/`) or `s3` |
| `LOCAL_STORAGE_DIR` | no | Folder for `local` storage. Defaults to `storage` |
| `AWS_REGION`, `S3_BUCKET` | for S3 | The private S3 bucket for study set files |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | no | Leave empty to use the standard AWS credential chain (e.g. an IAM role) |
| `COOKIE_SECURE` | no | Set to `true` when served over HTTPS |
| `ADMIN_EMAILS` | no | Comma-separated emails that get the Admin dashboard. Admin access can't be granted from the app |

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
| GET | `/api/subjects` | All courses, with whether each is in the learner's plan |
| POST | `/api/plan/subjects/{slug}` | Add a course to the plan (and switch to it) |
| DELETE | `/api/plan/subjects/{slug}` | Remove a course from the plan (progress is kept) |
| PUT | `/api/plan/current` | Switch the current course |
| GET | `/api/topics?subject=` | Topics of a course, in order (defaults to the current course) |
| POST | `/api/sessions` | Start a learn / practice / quiz session (`resume: true` continues the last Learn chat) |
| GET | `/api/sessions?topic_slug=` | Past Learn conversations for a topic, newest first |
| GET | `/api/sessions/{id}` | Session with chat history |
| POST | `/api/tutor/learn` | Send a message in Learn mode (empty message starts the lesson) |
| POST | `/api/tutor/practice` | Generate one practice question |
| POST | `/api/tutor/evaluate` | Grade an answer, update progress |
| POST | `/api/tutor/quiz` | Generate a 5-question quiz for a quiz session |
| GET | `/api/tutor/quiz/{session_id}/result` | Quiz score, strong areas, needs practice, recommendation |
| POST | `/api/final-tests` | Start a topic test (`topic_slug`) or a course exam (`subject_slug`) |
| GET | `/api/final-tests/{id}` | Load a test (auto-graded if its time ran out) |
| PUT | `/api/final-tests/{id}/answers` | Autosave one answer |
| PUT | `/api/final-tests/{id}/status` | Mark a question for review, or record that it was opened |
| POST | `/api/final-tests/{id}/submit` | Submit, grade, and return the analysis |
| GET | `/api/progress?subject=` | Course and per-topic progress (defaults to the current course) |
| GET | `/api/progress/{topic_slug}` | One topic's progress |
| GET | `/api/recommendations?subject=` | What to study next in a course |
| GET / POST | `/api/feedback?subject=` | Latest personalized feedback report / generate a new one |
| GET | `/api/admin/stats`, `/api/admin/users` | Admin: platform statistics and learners |
| GET / POST / PUT | `/api/admin/courses`, `/api/admin/topics` | Admin: manage courses and topics (archive instead of delete) |
| GET / DELETE | `/api/admin/courses/{slug}/delete-preview`, `/api/admin/courses/{slug}` | Admin: preview, then permanently delete a course and its learner data |
| PUT / POST | `/api/admin/topics/{slug}/material`, `…/material/regenerate` | Admin: edit or regenerate a topic's study notes |
| GET / POST / DELETE | `/api/admin/topics/{slug}/notes`, `/api/admin/notes/{id}` | Admin: list, upload or remove a topic's course notes |
| GET | `/api/topics/{slug}/material` | A topic's study notes (written by the AI on first request) |
| POST | `/api/admin/topics/{slug}/move` | Admin: move a topic up or down in its course |
| GET / POST | `/api/study-sets` | List study sets / create one from a file read in the browser (the response says where to upload the original) |
| GET / DELETE | `/api/study-sets/{id}` | A study set with its tools / delete it and its stored files |
| POST / DELETE | `/api/study-sets/{id}/materials`, `…/materials/{material_id}` | Add another file to a set (2 GB in total) / remove one (a set keeps at least one) |
| PUT | `/api/study-sets/{id}/materials/{material_id}/file` | Local storage: upload the original file, streamed to disk |
| POST | `/api/study-sets/{id}/materials/{material_id}/complete` | S3: confirm the browser finished its presigned upload |
| POST | `/api/study-sets/{id}/flashcards/more` | Add new flashcards that don't repeat the deck |
| POST | `/api/study-sets/{id}/tools/{notes,summary,flashcards,quiz}` | Generate a tool (once; `?regenerate=true` to redo) |
| PUT / POST | `/api/study-sets/{id}/flashcards/progress`, `…/quiz-result`, `…/chat` | Flashcard progress, quiz score, tutor chat |
| GET | `/api/study-sets/{id}/download?material_id=` | An original file (a short-lived S3 link, or streamed from local storage) |
| GET / DELETE | `/api/study-plan?tz=` | The learner's study plan (deleting keeps its courses) |
| POST | `/api/study-plan/suggest-courses` | Courses from the catalogue that fit a goal |
| POST | `/api/study-plan/draft?tz=` | A draft plan to review (refined with a change request); nothing is saved |
| POST | `/api/study-plan/accept?tz=` | Save the approved draft and add its courses to My courses |
| POST / PATCH | `/api/study-plan/replan`, `/api/study-plan/tasks/{id}` | Rebuild the schedule from today / tick a task |
| GET | `/api/gamification?tz=` | Streak, XP level and badges (records newly earned badges) |
| GET | `/api/activity?tz=&days=` | Questions, accuracy, Learn messages and XP per day, for the charts |
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

### With Docker

```bash
docker compose up --build -d
```

This runs MongoDB, the backend (using `backend/.env`), and a production build of the frontend. With this
project's compose file:

| Service | Address |
| --- | --- |
| Frontend | <http://localhost:3003> |
| API and Swagger docs | <http://localhost:8002>, <http://localhost:8002/docs> |
| MongoDB (from your computer, e.g. Compass) | `mongodb://localhost:27021` |

Things to keep in mind:

- **Inside Docker, services reach each other by service name.** The backend must use
  `MONGODB_URI=mongodb://mongo:27017` (the service name and the container's own port), never
  `localhost` or the published port `27021`.
- **The browser reaches the API at its published address.** The frontend is built with
  `NEXT_PUBLIC_API_URL=http://localhost:8002`, and `CORS_ORIGINS` must list the exact address you open
  the app at, for example `http://localhost:3003,http://127.0.0.1:3003`.
- **Changing ports** means updating the `ports` mappings, `CORS_ORIGINS` and the `NEXT_PUBLIC_API_URL`
  build argument together. `NEXT_PUBLIC_API_URL` is baked in at build time, so rebuild the frontend:
  `docker compose up --build -d frontend`.
- `docker compose down` stops everything and keeps the database; `docker compose down -v` also deletes it.

## Study set storage (AWS S3)

By default, study set files are stored in `backend/storage/` (ignored by git), which is fine for local
development. For production, use a private S3 bucket:

1. Create an S3 bucket in your AWS account with **Block all public access** turned on.
2. Create an IAM user or role allowed to `s3:PutObject`, `s3:GetObject` and `s3:DeleteObject` on that
   bucket only (for example on `arn:aws:s3:::your-bucket/users/*`).
3. In `backend/.env`, set `STORAGE_BACKEND=s3`, `AWS_REGION` and `S3_BUCKET`, plus the access keys
   unless the app runs on AWS with an IAM role.
4. Allow uploads from the browser: in the bucket's **CORS** settings, allow `PUT` from your frontend's
   address (for example `http://localhost:3003`). Files go straight from the browser to S3, so large
   files never pass through the backend.
5. Restart the backend.

Files are saved encrypted (`AES256`) under `users/<user id>/study-sets/<set id>/`, and downloads use
presigned links that expire after 5 minutes. Upload links last 6 hours, long enough for a 2 GB file on
a slow connection.

## Landing page screenshots and video

The landing page shows a labelled placeholder wherever a screenshot is missing. Add the images listed in
`frontend/public/screenshots/README.md` to replace them. For an optional demo video, set
`NEXT_PUBLIC_DEMO_VIDEO_URL` in `frontend/.env.local` to a YouTube link or an `.mp4` URL.

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
- **Courses:** the default Python plan, adding, switching and removing courses, the last-course guard,
  and choosing the first course during onboarding.
- **Learning:** topic retrieval, Learn mode replies, resuming a conversation, conversation history, practice evaluation
  (including the fallback when the AI is unavailable), a full quiz flow, and quiz feedback without hints.
- **Final tests:** answers hidden until submit, grading and analysis, no one-by-one checking, double
  submit counted once, automatic grading after the time runs out, review marks and visited status, and
  a course exam covering every topic with results by topic, the course exam lock, passing tests
  completing topics and courses, the 2 new attempts after passing, unlimited retakes before passing, and
  no retaking a passed course exam, 3 failed attempts in a row locking a topic test (and unlocking after
  the cooldown), the 12-hour course exam cooldown, a pass resetting the fail count, and the backfill of
  older test results.
- **Study sets:** files stored outside MongoDB, tools generated once and reused, flashcard progress and
  quiz results, the study set tutor, deletion removing stored files, other learners being unable to
  open someone's set, adding and removing files (marking tools as out of date), the 2 GB limit, uploads
  bigger than declared being refused, new flashcards and quizzes not repeating earlier ones, and older
  single-file sets taking more files.
- **Built-in courses:** every course listed with its topics and language, new courses placed after
  existing ones, re-seeding keeping courses and order, unique topic slugs, and course coding guidelines
  being stored and reaching the AI.
- **Study plans:** sharing time between courses by weight, alternating days, waiting for a
  dependency's head start or whole course, making AI strategies safe, phase summaries, real-courses-only
  suggestions, draft then accept, chat changes to the schedule, and rescheduling without the AI.
- **Course notes:** splitting by heading, matching only relevant sections, admin-only uploads, notes
  reaching the AI, and source labels shown to admins but removed for learners.
- **Attachments:** file text reaches the AI on every question but is never stored, only file names are
  saved, and attachment limits are enforced.
- **New features:** coding exercises showing tests but not the solution and being graded from test
  results, admin-only access, content management (create, reorder, archive), and feedback reports
  needing enough answers and not being regenerated without new ones.
- **Gamification:** streak counting (including the grace day), XP levels, timezone fallback, and a first
  answer starting a streak, earning XP and unlocking a badge exactly once.
- **Progress:** accuracy, mastery thresholds, difficulty adjustment, deterministic grading, the topic
  completion standard and its remarks (including the final test requirement), and recommendations
  (including sending the learner to a final test or the course exam), for any course.
- **AI service:** fallback to the second model, skipping a busy model, timeouts, and a rejected API key.

Frontend type check:

```bash
cd frontend
npm run typecheck
```

## Troubleshooting

- **"Can't reach the server"** in the browser: the backend isn't running, `NEXT_PUBLIC_API_URL` is wrong,
  or (with Docker) `CORS_ORIGINS` doesn't match the address in your browser exactly, including the port.
- **Logged out immediately after logging in**: open the app at `http://localhost:3000`, not `127.0.0.1`.
- **Backend fails with `JWT_SECRET_KEY` error**: set a secret of at least 32 characters in `backend/.env`.
- **Backend fails with `ServerSelectionTimeoutError`**: MongoDB isn't running at `MONGODB_URI`. In Docker,
  use `mongodb://mongo:27017`, not `localhost` or the published port.
- **The first code run takes a few seconds**: Python and any libraries the code uses (Pandas is about
  10 MB) download once, then are cached by the browser.
- **"The AI tutor is not configured yet"**: add `GEMINI_API_KEY` to `backend/.env` and restart.
- **Gemini 404 / model not found**: set `GEMINI_MODEL` to a current model name from Google AI Studio.
- **`Gemini error 503` warnings in the log**: the main model is overloaded on Google's side. The app
  switches to `GEMINI_FALLBACK_MODEL` and skips the busy model for 60 seconds, so no action is needed.

## Future enhancements

- Smarter adaptive difficulty (per-concept, spaced repetition)
- Embedding-based search over course notes and study sets (notes are currently matched by keywords)
- A history page for past final test results
- More courses (for example SQL, Django or machine learning), added through the seed data or the admin page
- Editing course coding guidelines from the admin page
- Admin review of AI-generated questions
- Login rate limiting and CSRF tokens before any public deployment