---
title: CompiCode Arena
emoji: 🏟️
colorFrom: blue
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
short_description: Real-time competitive programming arena
---

<div align="center">

<img src="docs/logo.png" alt="CompiCode" width="340" />

### A real-time competitive programming arena

Host or join live coding contests, get judged automatically, and watch the standings move as people pass testcases.

[![React](https://img.shields.io/badge/React-19-18e6d3?style=flat-square&logo=react&logoColor=082640)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-8-18e6d3?style=flat-square&logo=vite&logoColor=082640)](https://vitejs.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.11-ff7b00?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Firestore](https://img.shields.io/badge/Firebase-Firestore-ff7b00?style=flat-square&logo=firebase&logoColor=white)](https://firebase.google.com)
[![Docker](https://img.shields.io/badge/Docker-Hugging_Face_Spaces-0a8fc2?style=flat-square&logo=docker&logoColor=white)](https://huggingface.co/docs/hub/spaces-sdks-docker)

**[Live demo](https://sanjaymarathi-compicode-arena.hf.space)** · **[Hugging Face Space](https://huggingface.co/spaces/sanjaymarathi/CompiCode-Arena)** · **[GitHub](https://github.com/SanjayMarathi/CompiCode)**

</div>

<picture>
  <source media="(prefers-color-scheme: light)" srcset="docs/screenshots/landing-light.png">
  <img src="docs/screenshots/landing-dark.png" alt="CompiCode Arena landing page" />
</picture>

---

## Table of contents

- [Features](#features)
- [Screenshots](#screenshots)
- [How a contest works](#how-a-contest-works)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Data model](#data-model)
- [Deployment](#deployment)
- [Design system](#design-system)
- [Roadmap](#roadmap)

---

## Features

### Three contest modes

| Mode | How it plays |
|---|---|
| **Standard** | Everyone solves every problem at their own pace inside one global time limit. Ranked by score, then lowest penalty time. |
| **Timed** | Every problem has its own countdown. When it expires, that problem locks for you. |
| **Sudden Death** | The whole lobby is on the same problem. The first person to pass every testcase claims the round and everybody advances together. |

### Hosting and moderation

- **Public or private contests.** Private contests put every join request in a **host approval queue** (accept, decline, or accept all), and it keeps working while the contest is live.
- **Access by code or link.** Every contest gets a short access code and a one-click invite link.
- **Scheduled starts.** Set a start time and the lobby counts down for everyone.
- **Kick participants** (their submissions are removed) and **delete your own contests** (type the title to confirm). People inside a deleted contest are told and sent back to the dashboard.
- **Problem bank.** Pull problems from a global bank (managed by admins) or write your own with a built-in sandbox that runs your reference solution against your testcases before you publish.

### Judging and standings

- **Monaco editor** with C++, Python and Java, plus per-problem code autosave.
- **Automated judge** runs submissions against every testcase. The first two testcases are shown as examples; the rest are not displayed.
- **Clear verdicts:** Accepted, Wrong answer or Execution error, with a pass/fail strip, a tab per testcase, and the compiler message when there is one.
- **Live Codeforces-style standings** with score, solved count, testcases passed, finish time, per-problem cells and wrong-attempt penalties.

### Reliable timing

Contest time is decided by the **server's wall clock**, never by a browser. A background sweeper ends expired contests even when nobody has the page open, and every read and submit path applies the same rule (see [How a contest works](#how-a-contest-works)).

### Interface

- **Two themes:** sky blue + white, and sky blue + black, switchable from the navbar and remembered per browser.
- Realistic product screens (editor, standings, verdicts, lobby) drift quietly behind every page.
- Fully responsive down to phone width.

---

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/screenshots/dashboard-dark.png" alt="Dashboard" /><br /><sub><b>Dashboard</b>: join with a code, host a contest, search your history, delete what you host.</sub></td>
    <td width="50%"><img src="docs/screenshots/create-contest-light.png" alt="Create contest" /><br /><sub><b>Create a contest</b>: mode and visibility pickers, limits, scheduling and problems.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/lobby-host-requests.png" alt="Host lobby with join requests" /><br /><sub><b>Host lobby</b>: approve or decline join requests before (or during) the contest.</sub></td>
    <td width="50%"><img src="docs/screenshots/contest-live-standings.png" alt="Live contest and standings" /><br /><sub><b>Live contest</b>: problem list, countdown and Codeforces-style standings.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/screenshots/solve-accepted.png" alt="Accepted verdict" /><br /><sub><b>Accepted</b>: every testcase passed, per-case detail one click away.</sub></td>
    <td width="50%"><img src="docs/screenshots/solve-wrong-answer-light.png" alt="Wrong answer verdict" /><br /><sub><b>Wrong answer</b> (light theme): hidden cases are locked, visible ones show input, expected and actual output.</sub></td>
  </tr>
</table>

<p align="center">
  <img src="docs/screenshots/mobile-dashboard.png" alt="Mobile dashboard" width="260" />
  &nbsp;&nbsp;&nbsp;
  <img src="docs/screenshots/mobile-landing.png" alt="Mobile landing page" width="260" />
</p>

---

## How a contest works

```mermaid
stateDiagram-v2
    [*] --> waiting: host creates contest
    waiting --> active: host starts (or scheduled time)
    active --> ended: time limit reached
    active --> ended: host ends it
    active --> ended: all sudden-death rounds played
    ended --> [*]
    waiting --> [*]: host deletes
    active --> [*]: host deletes
    ended --> [*]: host deletes
```

**Time-up rule.** Once a contest is `active` for longer than its `overall_time_limit` minutes it is over, in every mode. The rule is enforced three ways, so a contest can never keep running by accident:

1. **Lazily**, on every contest lookup, dashboard list and submission.
2. **Eagerly**, by a background sweeper that checks active contests every 30 seconds.
3. **In the client**, which counts down from the server's elapsed time and flips to the ended screen at zero.

The reason is stored as `end_reason`: `time_up`, `host` or `completed`.

**Access control** is enforced on the server, not just in the UI:

- Only the host can start, open, end or delete a contest.
- On a private contest, a user who is pending, rejected or unknown cannot submit.
- The host never appears in their own approval queue.

**Scoring.** The leaderboard supports two evaluation modes. In `strict` mode (the default the UI creates) a problem scores its points only when every testcase passes. In `partial` mode points scale with the testcases passed. Ties are broken by total time, then testcases passed, then penalty.

---

## Architecture

```mermaid
flowchart LR
    subgraph Browser
      UI["React + Vite SPA<br/>Monaco editor"]
    end
    subgraph "FastAPI (Hugging Face Space, Docker)"
      API["REST API"]
      WS["WebSocket<br/>/ws/contest/{id}"]
      SW["Background sweeper<br/>(every 30 s)"]
      SD["Sudden-death<br/>round timers"]
    end
    DB[("Firebase Firestore")]
    EX["Code executor<br/>(separate HF Space)"]

    UI -- "REST + JWT" --> API
    UI <-- "live state, kicks, end/delete" --> WS
    API --> DB
    SW --> DB
    SD --> DB
    API -- "POST /evaluate" --> EX
    API --- WS
    SD --- WS
```

- The **frontend** is a single-page app. In production FastAPI serves the built files from `frontend/dist`, so the whole product runs as one container on one port.
- The **judge** is a separate service: the API posts `{code, language, test_cases}` to the executor Space's `/evaluate` endpoint and gets per-testcase results back. `executor.py` in this repo holds the execution helpers (Python, C++, Java, with timeouts) used by that service.
- **Sudden Death** rounds are driven by in-process timers and pushed to clients over the WebSocket. When the match finishes, the result is written to Firestore.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router 7, Vite 8, Axios, `@monaco-editor/react` |
| Styling | Hand-written CSS design system (no UI library), Rokkitt + Quicksand + JetBrains Mono |
| Backend | FastAPI, Uvicorn, Pydantic, WebSockets, HTTPX |
| Auth | JWT (`python-jose`), bcrypt (`passlib`) |
| Database | Firebase Firestore (`firebase-admin`) |
| Judge | Separate sandboxed executor service (Python / C++ / Java) |
| Hosting | Docker on Hugging Face Spaces |

---

## Project structure

```text
.
├── main.py                 # FastAPI app: auth, contests, judging, leaderboard, WebSocket, sweeper
├── database.py             # Firestore client (FIREBASE_KEY_JSON env var or firebase-key.json)
├── executor.py             # Execution helpers for the standalone executor service
├── contest_manager.py      # Early in-memory contest manager (not used by the API)
├── Dockerfile              # Builds the frontend, then serves everything with Uvicorn on :7860
├── requirements.txt
├── docs/
│   ├── logo.png
│   └── screenshots/        # Images used in this README
└── frontend/
    ├── index.html          # Fonts, favicon, pre-paint theme script
    └── src/
        ├── App.jsx         # Router, navbar, theme toggle, global notice modal
        ├── index.css       # Design tokens (light + dark) and every component style
        ├── config.js       # API/WS URLs, mode metadata, time helpers
        ├── monacoTheme.js  # Editor themes that follow the app theme
        ├── components/     # Logo, Icon, ConfirmModal, StatusPill, Standings, Background mocks
        └── pages/          # Landing, Auth, Dashboard, HostPanel, ContestLayout,
                            #   SolvePlatform, SysAdminPanel, NotFound
```

---

## Getting started

### Prerequisites

- Python 3.11+
- Node.js 20.19+ (or 22+)
- A Firebase project with Firestore enabled and a **service account key** (Project settings → Service accounts → Generate new private key)

### 1. Backend

```bash
# from the repository root
pip install -r requirements.txt

# provide credentials either as a file...
cp /path/to/your-key.json firebase-key.json
# ...or as an environment variable
# export FIREBASE_KEY_JSON="$(cat /path/to/your-key.json)"

uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173, talks to http://localhost:8000
```

In development the frontend calls the API on port 8000 of the same hostname, so no configuration is needed.

### 3. Become an admin

Register a user named **`admin`**. Admins get a **Problem Bank** link in the navbar to manage the global problem set that every host can pull from.

### Run with Docker

```bash
docker build -t compicode-arena .
docker run -p 7860:7860 -e FIREBASE_KEY_JSON="$(cat firebase-key.json)" compicode-arena
# open http://localhost:7860
```

---

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `FIREBASE_KEY_JSON` | backend | Service account JSON as a string. If unset, `firebase-key.json` in the project root is used. |
| `VITE_API_URL` | frontend build | API base URL. Defaults to `http://<host>:8000` in dev and to the same origin in production. |
| `VITE_WS_URL` | frontend build | WebSocket base URL. Derived from the API URL when unset. |

Never commit `firebase-key.json`; it is listed in `.gitignore`.

---

## API reference

Most routes require `Authorization: Bearer <token>`. Registration, login, the contest lookups (`/contests/{code}`, `/info`), the leaderboard, single-problem reads and the WebSocket are open.

**Auth and users**

| Method | Route | Description |
|---|---|---|
| `POST` | `/register` | Create an account |
| `POST` | `/token` | Log in (form fields `username`, `password`) and receive a JWT |
| `GET` | `/me` | Current user |
| `GET` | `/user/contests/hosted` | Contests you host |
| `GET` | `/user/contests/participated` | Contests you joined |

**Problems**

| Method | Route | Description |
|---|---|---|
| `GET` | `/questions` | Global problems plus your own |
| `POST` | `/questions` | Add a problem with testcases |
| `GET` `PUT` `DELETE` | `/questions/{id}` | Read, update or delete a problem |
| `POST` | `/sandbox/test` | Run a reference solution against testcases without creating a submission |

**Contests**

| Method | Route | Description |
|---|---|---|
| `POST` | `/contests` | Create a contest |
| `GET` | `/contests/{link_code}` | Look up by access code (falls back to id); applies the time-up rule |
| `GET` | `/contests/{id}/info` | Same payload, by id |
| `POST` | `/contests/{id}/start` | Host starts the contest (idempotent) |
| `POST` | `/contests/{id}/open` | Host opens a non-sudden-death contest |
| `POST` | `/contests/{id}/end` | Host ends the contest |
| `DELETE` | `/contests/{id}` | Host deletes the contest, its participants and submissions |
| `GET` | `/contests/{id}/leaderboard` | Standings |
| `GET` | `/contests/{id}/my-solved` | Problems you have solved |

**Participation and approvals**

| Method | Route | Description |
|---|---|---|
| `POST` | `/contests/{id}/join` | Join (pending on private contests; the host is auto-accepted) |
| `GET` | `/contests/{id}/my-status` | `none`, `pending`, `accepted` or `rejected` |
| `GET` | `/contests/{id}/pending` | Host: pending join requests |
| `POST` | `/contests/{id}/accept/{user_id}` | Host: accept a request |
| `POST` | `/contests/{id}/reject/{user_id}` | Host: decline a request |
| `DELETE` | `/contests/{id}/kick/{user_id}` | Host: remove a participant and their submissions |

**Judging and realtime**

| Method | Route | Description |
|---|---|---|
| `POST` | `/submit` | Judge a submission (checks time, participation and prior solves) |
| `WS` | `/ws/contest/{id}` | Pushes `SYNC_STATE`, `TIMER_TICK`, `CONTEST_ENDED`, `CONTEST_DELETED`, `KICK_USER` |

Interactive docs are available at `/docs` while the backend is running.

---

## Data model

Firestore collections:

| Collection | Key fields |
|---|---|
| `users` | `username`, `hashed_password`, `is_admin` |
| `questions` | `title`, `description`, `is_global`, `creator_id`, `test_cases[{input_data, expected_output}]` |
| `contests` | `title`, `mode`, `visibility`, `evaluation_mode`, `host_id`, `link_code`, `status` (`waiting`, `active`, `ended`), `end_reason`, `overall_time_limit`, `penalty_per_wrong_answer`, `start_time`, `scheduled_start_time`, `created_at`, `questions[{question_id, points, time_limit}]` |
| `participants` | `contest_id`, `user_id`, `status` (`pending`, `accepted`, `rejected`), `joined_at` |
| `submissions` | `contest_id`, `user_id`, `question_id`, `passed`, `testcases_passed`, `penalty_incurred`, `time_taken`, `timestamp` |

---

## Deployment

The project is set up for **Hugging Face Spaces (Docker SDK)**. The YAML block at the top of this file is the Space configuration.

1. Create a Docker Space and push this repository to it.
2. In **Settings → Variables and secrets**, add `FIREBASE_KEY_JSON` as a **secret** containing your service account JSON.
3. The Space builds the `Dockerfile`: it compiles the React app, installs the Python dependencies and starts Uvicorn on port **7860**.

Screenshots in `docs/` are stored with **Git LFS** (`*.png` is tracked in `.gitattributes`), which Hugging Face requires for binary files.

---

## Design system

The look is a sky-blue accent on white (light) or black (dark), with navy text, 1.5 px outlines, and a signature **notched bubble card**: each card has a circular cut-out on its top edge that holds an icon.

- Every colour is a CSS variable in `frontend/src/index.css`; the light and dark themes are two token blocks.
- The accent (`#18e6d3`) is used for fills, rings and highlights; navy sits on top of it for contrast.
- Orange is reserved for the logo, favicon and the background mockups.
- Headings use Rokkitt (slab serif, uppercase), body text Quicksand, code and timers JetBrains Mono.
- The Monaco editor ships matching light and dark themes.

---

## Roadmap

- Server-enforced per-problem timers for Timed mode (today they run in the browser).
- Server-side scheduled starts (today the host's open tab triggers the start).
- A scoring toggle in the contest form to expose `partial` evaluation.
- Persist Sudden Death round state so a server restart mid-match can resume.
