# PhishSimulator

PhishSimulator is a scenario-based, gamified phishing-awareness trainer built on the **CATCH framework**. Players inspect realistic email and SMS messages, choose **Report** or **Mark Safe**, and then **justify** the decision by picking clues. The server checks the reasons against the real clues, gives instant feedback, awards XP, and adapts the next scenario to the player's skill. There is no public leaderboard: progress and skill rank are private.

## The CATCH framework

| Stage | What happens | Where in the code |
| --- | --- | --- |
| **C · Check** | Keyword-scored baseline quiz. Score of 70+ starts on Medium, otherwise Easy. | `services/baseline_service.py`, `adaptive/adaptive_engine.py` |
| **A · Approve** | Dataset upload → quality report (reject if poor) → **Draft** scenarios → admin preview + 6-item QA checklist → **Approved** → **Active**. Only Active scenarios reach players. | `services/dataset_service.py`, `services/scenario_service.py`, `ScenarioManagementPage.tsx` |
| **T · Test** | Inspect a realistic message: sender display names hide the real address until opened, link text hides the real address until hovered, and emails may carry an attachment. Clicking a link or opening a file counts as trusting the message. Then Report / Mark Safe, then "Why?": 6 clue buttons (always 3 warning signs + 3 trust signals, real clues mixed with decoys) plus an optional written reason matched with regex keywords. Each decoy picked cancels one correct clue, so guessing doesn't pay. | `utils/clues.py`, `services/simulation_service.py`, `simulation/DecisionPanel.tsx` |
| **C · Correct** | Instant feedback: clues spotted vs missed, a threat explanation, and a safe-behaviour tip. | `analytics/feedback_generator.py`, `simulation/FeedbackPanel.tsx` |
| **H · Help** | XP = (Easy 10 / Medium 20 / Hard 30 + 5 per real clue, max 15) × 1.29^(level−1). Each level needs ×1.5 more XP (max level 10). Private skill rank from weighted accuracy on the last 20 attempts (Easy ×1, Medium ×1.5, Hard ×2): Recruit, Spotter (50), Analyst (65), Defender (80), Guardian (90+ and ≤5% missed phishing). 15 badges in three groups (streaks, milestones, skills; see "Gamification" below), a daily goal, current and best practice-day streaks, a yearly activity calendar, a private position among all players, and **Review mistakes** to retry scenarios answered wrong. | `services/progress_service.py`, `progress/ProgressWidgets.tsx` |

**Adaptive loop:** under 5 attempts the baseline sets the level. After that, the last 5 answers step the difficulty one level up (80%+), one level down (under 60%), or keep it. Scenario choice skips the last 2 categories, prefers the player's job group, prefers unseen scenarios, and never repeats within 5.

## Main capabilities

- Email phishing and SMS/smishing simulations that look like a real inbox and phone. Links and files never open: hovering a link shows its address (like Office), the sender's real address is behind the display name, and clicking a link or opening an attachment counts as trusting the message ("You've been phished" if it was phishing).
- Decide → justify → feedback loop with keyboard shortcuts (R / S), confetti, level-up celebrations, streaks and XP animation.
- **Inbox Rush**: sort a whole inbox of mixed messages against the clock; every decision is still justified and scored by the server.
- **Review mistakes**: scenarios answered wrong come back a few rounds later for a second chance.
- Baseline assessment with a different question order on retakes. The marking guide is only shown after answering.
- Occupation-aware adaptive practice, category focus or an adaptive mix.
- Dataset upload with a quality report (rejects unreadable, pre-processed or spam-labelled corpora) that turns rows into realistic draft scenarios (hidden links, display names, attachments) with a 0–100 quality score; an admin review pipeline with Email/SMS tabs, filters, sorting by any column and bulk actions on the filtered set with a preview count.
- Tutor CSV export of player progress (without the private skill rank).
- Works on phones: the sidebar becomes a slide-in menu, and pages load on demand.
- Every table and list has a search, filters and click-to-sort columns (click once for ascending, again for descending), and every row opens its details.
- The metrics pages (admin **System Analytics** and the player's **My Progress**) filter by date range (7, 30 or 90 days, all time, or custom dates), channel, difficulty, category, training vs campaign emails and, for admins, group (students, employees, other). XP, level and badges always count the full history.
- Skeleton loaders and toast notifications (shadcn/ui + Sonner) throughout.
- Private progress, inspired by platforms like TryHackMe: a stats strip (rank, badges, streak, simulations completed), 15 badges, current and best streaks, a yearly activity calendar, XP, levels and the skill rank, plus your position among all rated players (e.g. **#11 of 27, top 41%**). Players only ever see their own position, never another player's name or score.
- **Home** is about what to do next (daily goal, training, goals, campaign inbox, recent decisions); **My Progress** is about how you are doing, in three tabs: *Overview* (activity calendar, skill rank, level), *Performance* (filtered metrics and charts) and *Badges* (the full collection).
- Administrator dashboard, user monitoring, baseline-question management and analytics, with tinted stat cards throughout.
- Email phishing campaigns: send a real training email through Gmail to your own inboxes — from an approved scenario or a custom email you write, phishing or genuine, with a link and/or a look-alike attachment — then track opens, clicks, attachment opens, reports and "ignored" (no action inside the response window). Once a recipient acts, the result is locked; once every recipient's result is final, the campaign shows as **Completed**. Every result emails the recipient branded feedback (good or bad) and awards or deducts XP, and each result counts as a real decision in the player's stats, streak, rank and Home **Inbox**.
- Local reset and realistic demo-data generation utilities.

### Email campaign safety

Campaign emails are only ever sent to addresses on the `CAMPAIGN_ALLOWED_RECIPIENTS` allow-list in `backend/.env`, and only when Gmail credentials are configured. This keeps the feature to the author's own inboxes (use Gmail "plus" aliases such as `you+finance@gmail.com`), so no real person is targeted. See the "Email campaigns" section below.

## Architecture

The application has two parts:

- `backend/`: Flask API, JWT authentication, SQLAlchemy models, migrations, dataset processing, adaptive logic, and analytics.
- `frontend/`: React/TypeScript/Vite interface for player and administrator workflows.

The frontend communicates with the backend through JSON API services. The backend is the source of truth for authentication, scenario correctness, scores, permissions, adaptive recommendations, and analytics.

The main runtime flow is:

```text
C  Check    baseline quiz sets the starting difficulty
        ↓
A  Approve  only admin-approved ACTIVE scenarios are served
        ↓
T  Test     player decides (Report / Safe), then justifies with clues
        ↓
C  Correct  server scores decision + reasons, returns clue feedback
        ↓
H  Help     XP, level, badges and private skill rank update
        ↓
Adaptive loop back to T with the next difficulty
```

## Running with Docker (easiest)

The whole app (PostgreSQL, API and frontend) runs with one command. You need Docker Desktop.

```powershell
Copy-Item .env.example .env                   # Docker settings: database, ports, URLs
Copy-Item backend\.env.example backend\.env   # then set SECRET_KEY and JWT_SECRET_KEY
docker compose up -d --build
```

Open http://localhost:8080. The API is on http://localhost:5000.

Nothing is hard-coded in `docker-compose.yml`; every setting comes from one of two files:

| File | Holds |
| --- | --- |
| `.env` (next to `docker-compose.yml`) | Database name, user and password (shared by the `db` and `backend` containers), `FLASK_ENV`, `HOST_IP` (`127.0.0.1` = only this computer), ports, the URLs the browser uses, the frontend's API path and `MAX_UPLOAD_MB` |
| `backend/.env` | Secrets, Gmail, the campaign allow-list, and the demo data settings (`SEED_DEMO`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_PASSWORD`, `OWNER_EMAIL`) |

Both are ignored by git, and neither is copied into an image.

With `SEED_DEMO=auto` (the default), the demo data is loaded **once**, the first time the database is empty. After that it is kept across restarts, rebuilds and `docker compose down`, and so are the datasets you upload (they live in their own `uploads_data` volume). No uploaded datasets are baked into the image — the demo scenarios come from the built-in seed, and you upload your own datasets from the Datasets page once running. Set `SEED_DEMO=reset` to reload the demo data on every start, or `off` to never seed.

Sign in as the admin the seed creates (`ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env`, by default **admin@phishsimulator.com** / **Admin#2026**). Every test player uses `DEMO_PASSWORD` (by default `Player#2026`, e.g. `lerato.mokoena@phishsimulator.test`). The seed does not create an account for you: register your own player in the app. Campaigns can still reach it as long as your address is on `CAMPAIGN_ALLOWED_RECIPIENTS`.

| Command | Containers | Data |
| --- | --- | --- |
| `docker compose stop` / `start` | Stopped / started again | Kept |
| `docker compose down` | Removed | Kept |
| `docker compose down -v` | Removed | **Deleted** (database and uploads); the next `up` loads the demo data again |

The database user and password are applied only when the database volume is first created. If you change `DB_USER` or `DB_PASSWORD` in `.env`, run `docker compose down -v` once so the database is recreated with them.

## Requirements (manual setup)

- Python 3.10+ recommended.
- Node.js and npm.
- Git.
- PostgreSQL (the only supported database).

## Backend setup

From the repository root, create or activate the backend virtual environment:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Create local environment settings:

```powershell
Copy-Item .env.example .env
```

At minimum, set the two secrets in `backend/.env` (at least 32 characters each). Generate a value for each with:

```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```

Then fill them in, with the URLs:

```env
SECRET_KEY=
JWT_SECRET_KEY=
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000
```

PhishSimulator uses **PostgreSQL only**. Set `DATABASE_URL`, or the five `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` values, in `backend/.env`. Create the database once (for example `createdb phishsimulator_db`), then apply the schema:

```powershell
flask --app run.py db upgrade
```

Start the API:

```powershell
python run.py
```

The API runs at `http://localhost:5000` in development mode.

## Frontend setup

Open a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

To create a production frontend build:

```powershell
npm run build
```

## Demo data

To populate a realistic demonstration database locally, reset then seed:

```powershell
cd backend
.\.venv\Scripts\python.exe reset_database.py --confirm-reset
.\.venv\Scripts\python.exe seed_demo.py
```

`seed_demo.py` loads a fixed, reproducible dataset (random seed 2026). The scenario and baseline-question content lives in `backend/app/seed/*.json`; players, history and campaigns are generated. It creates:

- **41 active scenarios**: South African email and SMS messages, 23 phishing and 18 legitimate, across all 8 categories and 3 difficulties, with catalogue clue names. Four carry a look-alike attachment. (Uploaded datasets are **not** part of the seed; you add your own from the Datasets page.)
- **5 baseline questions** and an admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env` (default **admin@phishsimulator.com** / **Admin#2026**).
- An **owner player** for your own address only if `OWNER_EMAIL` is set. Leave it blank to register yourself in the app instead.
- **40 test players** with realistic South African names and `@phishsimulator.test` emails, each with a profile, a keyword-marked baseline, login and training sessions, and about four months of practice. Each player has a habit, from never trained through occasional and weekly to daily, so streaks, badges, the activity calendar and the trends look real (a few dedicated players hold month-long streaks). Accuracy falls with difficulty (Easy > Medium > Hard) and improves slightly over time.
- **Two finished campaigns** to the owner's address (one reported phishing, one clicked genuine), when an owner player is created, so the campaign metrics and the player Inbox show data.

Every player uses the password `Player#2026`. Override defaults with the `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_PASSWORD` and `OWNER_EMAIL` environment variables.

Re-running `seed_demo.py` clears the seeded data and rebuilds it; it leaves the schema in place, so no migration is needed between runs.

## Resetting the database

The reset utility is deliberately protected because it permanently removes all application data:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python reset_database.py --confirm-reset
```

This removes users, datasets, dataset records, scenarios, attempts, analytics, baseline history, sessions, and campaign records, then recreates the tables. It does not restore uploaded files or production object-storage data.

## Dataset processing

Administrators upload CSV or JSON datasets from the Dataset Management page. The backend:

1. Validates the file and selected dataset type.
2. Builds a **quality report**: empty, too-short, too-long, unreadable, duplicate, unlabelled and personal-data rows. It also detects **label leaks** — formatting that only appears in one label (for example a `Keywords:` line on every phishing message), which would let a player win by spotting the format instead of the phishing. If no rows are labelled, more than half are unusable, or a label leak is found, the dataset is **rejected** and nothing is stored.

   The original recipient's address is removed from message text (real corpora were collected from one mailbox), and yes/no flag columns some datasets use are not mistaken for a sender.
3. Normalises message text, sender, subject, labels, category, difficulty and clues. Many obvious clues = Easy, few subtle clues = Hard.
4. Saves each usable row as a dataset record (raw text).
5. Creates a **Draft** scenario (linked by `dataset_id`) for each labelled row and makes it realistic (`app/datasets/scenario_realism.py`): email links hide behind button text, senders get a display name, emails that mention an attachment get a fake file (risky `.htm/.zip/.docm/.iso` for phishing, `.pdf/.docx/.xlsx` for genuine), and a quality score is calculated. Phishing and genuine messages get the same treatment, so the formatting never gives the answer away.
6. The admin reviews drafts in **Scenario Review**: preview, automatic checks, QA checklist, then Approve → Activate (or Reject / Archive).

Datasets uploaded before these rules existed can be upgraded with **Re-run processing** in the dataset's details (unreviewed drafts are rewritten; reviewed scenarios are only re-scored).

Scenario text supports `[Button text](https://real-address)` for hidden links, and the sender field supports `Display Name <address>`.

The parser recognises common fields such as `text`, `body`, `content`, `message`, `email_body`, and `text_combined`. It normalises values such as `1`, `phishing`, and `smishing` to phishing (marketing `spam` is left unlabelled), and `0`, `legitimate`, `safe`, and `ham` to legitimate.

The supported training categories are Banking, Delivery, Government, Employment, University, Password Reset, Microsoft 365, and Social Media. Uploaded datasets are ignored by Git. In production, the upload storage should be replaced with S3 or another object-storage service.

When an administrator deletes a dataset, the generated scenarios and related attempts, feedback, and actions are deleted as well. The affected performance totals are recalculated.

## Adaptive training behaviour

Difficulty moves one step at a time:

- Before five attempts, a baseline score of 70 or higher starts at Medium; otherwise Easy.
- After that, if 80%+ of the last five answers are correct, step up one level (Easy → Medium → Hard).
- Below 60%, step down one level. Otherwise stay.

Category selection avoids the two most recent categories when possible, prefers unpractised relevant categories, and then reinforces the weakest relevant area. Occupation priorities are:

- Student: University, Social Media, Password Reset, Delivery.
- Employee: Microsoft 365, Employment, Banking, Password Reset.
- Other: Government, Banking, Delivery, Social Media.

Players can select a category manually for focused practice. Otherwise, the system prefers unseen scenarios, applies a short repeat cooldown, and then falls back to random eligible content. This prevents large dataset uploads from becoming a long fixed queue.

## Gamification and progress

Each mechanic has a learning purpose, and progress stays private: there is no public leaderboard.

| Mechanic | What the player sees | Why it is there |
| --- | --- | --- |
| XP and levels | XP for correct decisions, more for harder scenarios and spotted clues; a level multiplier | Rewards effort and shows steady progress |
| Skill rank | Recruit to Guardian, from weighted accuracy on the last 20 decisions; it can fall | Measures skill separately from effort |
| Private position | "#11 of 27 players · Top 41%" | Relative feedback without names, scores or a leaderboard |
| Streaks | Current and best run of practice days | Encourages short, regular practice instead of cramming |
| Daily goal and goals | 5 decisions a day; one current goal and the next four | A clear next step on every visit |
| Badges | 15 in three groups (below) | Most of them need skill, not just activity |
| Yearly activity | A calendar of practice days with a count per day | Makes the habit visible |

A practice day counts when the player makes at least one decision (training or a campaign email), not when they merely log in, so streaks reward learning rather than visits.

| Group | Badges |
| --- | --- |
| Streaks | Day One (first practice), 5-Day Streak, 2-Week Streak, Month Streak (30 days) |
| Milestones | Getting Started (10 simulations), Committed (50), Centurion (100) |
| Skills | First Catch, Clue Hunter, Sharp Eye (5 Hard phishing caught), Zero Misses, Category Master, All-Rounder (a correct decision in every category), Comeback, Real-World Catch (report a phishing campaign email) |

Badge rules, targets and "how to earn it" text live in one place: `ProgressService.BADGES` in `backend/app/services/progress_service.py`. A new badge is celebrated after the decision that earns it.

## Email campaigns

An admin can send a real phishing-awareness email, built from an approved email scenario, to their own inboxes and see who opens it, clicks the link, or reports it.

**Setup (Gmail):**

1. Turn on 2-Step Verification on the Google account, then create an **App Password** (Google Account → Security → App passwords).
2. In `backend/.env`, set `SMTP_USERNAME` to the Gmail address and `SMTP_PASSWORD` to the 16-character app password.
3. Set `CAMPAIGN_ALLOWED_RECIPIENTS` to your own addresses. `*` is a wildcard, so `you+*@gmail.com` lets you send to any Gmail plus-alias of your own address (each alias arrives in your inbox but looks like a separate recipient).
4. For tracking to work from a real device (opening the email on your phone), set `PUBLIC_BACKEND_URL` to a URL that reaches the backend from outside your machine — for a demo, a tunnel such as `ngrok http 5000` gives you an https address to paste in.

**Building a campaign:** pick an active email scenario, or write your own (sender, subject, body, phishing or genuine, warning signs, and an optional look-alike attachment such as `Invoice_2026.pdf`). Choose recipients from the registered players — the picker greys out anyone not on the allow-list. Save the draft, then Send.

**How it works:** each recipient gets a unique tracking link, an invisible tracking pixel, a clickable attachment tile (styled like a mail client — no real file is attached), and a neutral report link. Opening the email loads the pixel (an open); clicking the link or the attachment, or using the report link, is recorded. The **first** action is the one that counts and locks the result; a later action changes nothing. If nothing happens within `CAMPAIGN_IGNORE_MINUTES` (default 10), the result is **Ignored**. A background sweep closes expired emails even if no one is looking at the app.

Every final result:
- **emails the recipient branded feedback** (good or bad) that matches the app's theme — what the email was, what gave it away or why it was genuine, and their XP;
- **awards or deducts XP** (phishing: report +30, ignore +10, click −20; genuine: click +10, ignore 0, report −10) — total XP never drops below 0;
- **counts as a real decision** in the player's accuracy, missed-phishing, risky-clicks, streak, skill rank, badges and history, tagged "Campaign";
- appears in the player's **Inbox** on Home with a "Get feedback" panel.

The admin report shows opens, clicks, attachment opens, reports and ignored per recipient; once every result is final the campaign is **Completed** and read-only (launched campaigns are kept as a record and cannot be deleted). For tracking and links to work on a real device (Gmail loads images through Google, which cannot reach `localhost`), set `PUBLIC_BACKEND_URL` to a public URL — a tunnel such as `ngrok http 5000` works for a demo.

**Safety:** nothing is sent unless Gmail is configured, and only to allow-listed addresses. This is why demo players' `@phishsimulator.test` addresses are never emailed — they are not real inboxes, and they are not on the allow-list. Only send to inboxes you own.

## Security

| Area | What the app does |
| --- | --- |
| Secrets | Passwords and keys live only in `.env` files, which git and Docker both ignore. The API refuses to start unless `SECRET_KEY` and `JWT_SECRET_KEY` are at least 32 characters. |
| Accidental commits | `.githooks/pre-commit` blocks a commit that adds an `.env` file, a key file, uploaded data, or a line such as `SMTP_PASSWORD=...`. Turn it on once per clone with `git config core.hooksPath .githooks`. |
| Passwords | Stored as bcrypt hashes. New passwords need at least 8 characters with a letter and a number (sign-up, change and reset). |
| Guessing passwords | Five wrong passwords in a row lock the account for 15 minutes. The login reply never says whether an email exists. |
| Sessions | Login tokens last 15 minutes and renew while you are active. Each token belongs to a login session, so logging out (or resetting the password) stops it working immediately. |
| Password reset | A one-time link that works for 30 minutes. Only a SHA-256 hash of the token is stored, and using it signs out every session. Reset emails, like campaigns, only go to allow-listed addresses. |
| Errors | Unexpected errors are logged on the server; the browser only sees "Something went wrong". |
| Headers | The API sends `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and `Cache-Control: no-store`. nginx adds a Content-Security-Policy so the page only runs code from the app itself. |
| Uploads | CSV or JSON only, saved under a random name, and capped at `MAX_UPLOAD_MB` by both nginx and Flask. |
| Containers | The backend runs as a normal user, not root. Ports listen on `127.0.0.1` unless `HOST_IP` says otherwise, and the database port is never published. In Docker `FLASK_ENV=production`, so the debugger is off. |
| Roles | Admin endpoints check the role on the server (`@require_admin`), and players can only read their own data. |

One known trade-off: the login token is kept in the browser's `localStorage`, which a successful cross-site-scripting attack could read. React's escaping and the Content-Security-Policy make that unlikely; moving the token into an `httpOnly` cookie would be the next step for a production deployment.

## Important development rules

- Keep correctness and score validation in the backend; do not trust frontend-supplied correctness.
- Keep progress private. Players see only their own XP, badges, streaks, skill rank and position, never another player's name or score.
- Never send `correct_answer`, clues or feedback to the player before they submit a decision.
- Preserve adaptive variety and occupation-based recommendations.
- Do not commit `.env` files or `backend/uploads/`; enable the pre-commit hook (`git config core.hooksPath .githooks`) to be stopped if you try.
- Add an Alembic migration for every change to a persistent model.
- Only send campaign emails to allow-listed inboxes you own.
- Treat demo passwords and uploaded datasets as local-only data.

## Verification commands

Backend syntax check and CATCH rule tests:

```powershell
.\backend\.venv\Scripts\python.exe -m compileall -q backend\app backend\seed_demo.py
cd backend; .\.venv\Scripts\python.exe -m unittest discover tests
```

After pulling model changes, apply migrations with `flask --app run.py db upgrade`.

Frontend build:

```powershell
cd frontend
npm run build
```
