# PhishSimulator

PhishSimulator is a scenario-based, gamified phishing-awareness trainer built on the **CATCH framework**. Players inspect realistic email and SMS messages, choose **Report** or **Mark Safe**, and then **justify** the decision by picking clues. The server checks the reasons against the real clues, gives instant feedback, awards XP, and adapts the next scenario to the player's skill. There is no public leaderboard: progress and skill rank are private.

## The CATCH framework

| Stage | What happens | Where in the code |
| --- | --- | --- |
| **C · Check** | Keyword-scored baseline quiz. Score of 70+ starts on Medium, otherwise Easy. | `services/baseline_service.py`, `adaptive/adaptive_engine.py` |
| **A · Approve** | Dataset upload → quality report (reject if poor) → **Draft** scenarios → admin preview + 6-item QA checklist → **Approved** → **Active**. Only Active scenarios reach players. | `services/dataset_service.py`, `services/scenario_service.py`, `ScenarioManagementPage.tsx` |
| **T · Test** | Inspect a realistic message: sender display names hide the real address until opened, link text hides the real address until hovered, and emails may carry an attachment. Clicking a link or opening a file counts as trusting the message. Then Report / Mark Safe, then "Why?": 6 clue buttons drawn from 8 warning signs and 8 trust signals (such as "Official link", "No link or attachment", "Personal greeting" and "Safe way to check", which are true for some genuine messages and decoys on others). The side that matches the answer gets 2, 3 or 4 buttons, equally often, with at least one real clue and at least one decoy, so neither the layout nor ticking a whole side gives the answer away. The buttons are drawn again each time a message comes back, and the server scores against the exact set shown. An optional written reason is matched with regex keywords and counts even for a clue that has no button. Each decoy picked cancels one correct clue, so guessing doesn't pay. | `utils/clues.py`, `services/simulation_service.py`, `simulation/DecisionPanel.tsx` |
| **C · Correct** | Instant feedback: clues spotted vs missed, a threat explanation, and a safe-behaviour tip. | `analytics/feedback_generator.py`, `simulation/FeedbackPanel.tsx` |
| **H · Help** | XP = (Easy 10 / Medium 20 / Hard 30 + 5 per real clue, max 15) × 1.29^(level−1). Each level needs ×1.5 more XP (max level 10). Private skill rank from weighted accuracy on the last 20 attempts (Easy ×1, Medium ×1.5, Hard ×2): Recruit, Spotter (50), Analyst (65), Defender (80), Guardian (90+ and ≤5% missed phishing). 15 badges in three groups (streaks, milestones, skills; see "Gamification" below), a daily goal, current and best practice-day streaks, a yearly activity calendar, a private position among all players, and **Review mistakes** to retry scenarios answered wrong. | `services/progress_service.py`, `progress/ProgressWidgets.tsx` |

**Adaptive loop:** under 5 attempts the baseline sets the level. After that, every 5 answers at a level step the difficulty one level up (80%+), one level down (under 60%), or keep it; after a change the new level gets 5 fresh answers before the next check. Campaign emails don't move the difficulty. Each message is first chosen to be phishing or genuine (balanced over the last 10, never certain), so neither its difficulty nor its category gives the answer away. Scenario choice then skips the last 2 categories, prefers the player's job group, prefers unseen scenarios, and never repeats within 5.

## Main capabilities

- Email phishing and SMS/smishing simulations that look like a real inbox and phone. Links and files never open: hovering a link shows its address (like Office), the sender's real address is behind the display name (opening it also shows the email was sent to you), and clicking a link or opening an attachment counts as trusting the message ("You've been phished" if it was phishing).
- Decide → justify → feedback loop with keyboard shortcuts (R / S), confetti, level-up celebrations, streaks and XP animation.
- **Review mistakes**: scenarios answered wrong come back a few rounds later for a second chance.
- Baseline assessment with a different question order on retakes. The marking guide is only shown after answering.
- Occupation-aware adaptive practice, category focus or an adaptive mix.
- Dataset upload with a quality report (rejects unreadable, pre-processed or spam-labelled corpora) that turns rows into realistic draft scenarios (hidden links, display names, attachments) with a 0–100 quality score; an admin review pipeline with Email/SMS tabs, filters, sorting by any column and bulk actions on the filtered set with a preview count.
- Tutor CSV export of player progress (without the private skill rank).
- Works on phones: the sidebar becomes a slide-in menu, and pages load on demand.
- Every table and list has a search, filters and click-to-sort columns (click once for ascending, again for descending), and every row opens its details.
- The metrics pages (admin **System Analytics** and the player's **My Progress**) filter by date range (7, 30 or 90 days, all time, or custom dates), channel, difficulty, category, training vs campaign emails and, for admins, group (students, employees, other). XP, level and badges always count the full history.
- Skeleton loaders and toast notifications (shadcn/ui + Sonner) throughout.
- Private progress, inspired by platforms like TryHackMe: a stats strip (rank, badges, streak, simulations completed), 15 badges, current and best streaks, a yearly activity calendar, XP, levels and the skill rank, plus your position among all players (e.g. **#11 of 41, top 27%**; players with fewer than 10 decisions are not rated yet and sit below everyone who is). Players only ever see their own position, never another player's name or score.
- **Home** is about what to do next (daily goal, training, goals, campaign inbox, recent decisions); **My Progress** is about how you are doing, in three tabs: *Overview* (activity calendar, skill rank, level), *Performance* (filtered metrics and charts) and *Badges* (the full collection).
- Administrator dashboard, user monitoring, role-based baseline assessment management and analytics, with tinted stat cards throughout.
- Email phishing campaigns: send a real training email through Gmail to your own inboxes — from an approved scenario or a custom email you write, phishing or genuine, with a link and/or a look-alike attachment — then track opens, clicks, attachment opens, reports and "ignored" (no action inside the response window). Once a recipient acts, the result is locked; once every recipient's result is final, the campaign shows as **Completed**. Every result emails the recipient branded feedback (good or bad) and awards XP (a mistake earns 0, never less), and each result counts as a real decision in the player's stats, streak, rank and Home **Inbox**.
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
| `.env` (next to `docker-compose.yml`) | Database name, user and password (shared by the `db` and `backend` containers), `HOST_IP` (`127.0.0.1` = only this computer), ports, the URLs the browser uses, the frontend's API path, `MAX_UPLOAD_MB`, `REQUEST_TIMEOUT_SECONDS` and `DEMO_DATASETS_HOST_DIR` (the folder holding the demo's dataset files) |
| `backend/.env` | Secrets, Gmail, the campaign allow-list, and the demo data settings (`SEED_DEMO`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `DEMO_PASSWORD`, `DEMO_EMAIL`, `OWNER_EMAIL`, `DEMO_EMAIL_DATASET`, `DEMO_SMS_DATASET`, `DEMO_AUTHOR_WRITTEN`) |

Both are ignored by git, and neither is copied into an image.

With `SEED_DEMO=auto` (the default), the demo data is loaded **once**, the first time the database is empty. After that it is kept across restarts, rebuilds and `docker compose down`, and so are the datasets you upload (they live in their own `uploads_data` volume). No public datasets are baked into the image (only the two small demo-only files in `backend/demo`): the demo's public datasets are imported from the two files in `DEMO_DATASETS_HOST_DIR` (by default `backend/uploads/datasets`), which compose mounts read-only into the backend, and you can upload more from the Datasets page once running. Loading takes about three minutes (most of it the quality check and import of the 85,000-row SMS file). It loads in the background: the app answers at once, but until it finishes every page says "PhishSimulator is still getting ready" and `docker compose ps` shows the backend as `health: starting`. Wait for `healthy` (or "Ready: the app can be used now." in `docker compose logs -f backend`) and do not restart the container meanwhile, because an interrupted load starts again from the beginning. If a demo file is missing, the seed stops before deleting anything and the app starts without demo data. Set `SEED_DEMO=reset` to reload the demo data on every start, or `off` to never seed.

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

`seed_demo.py` builds a fixed, reproducible demo (random seed 2026). Scenarios come from two public dataset files, one email and one SMS, plus the admin's own custom scenarios (below). The history is replayed with the app's own rules. It creates:

- **Two uploaded public datasets**, imported exactly as the Datasets page does it (quality check, cleaning, a draft scenario per labelled row): `DEMO_EMAIL_DATASET` (default `email/phishing_legit_dataset_KD_10000.csv`, a generated phishing and legitimate email set: 8,948 usable rows) and `DEMO_SMS_DATASET` (default `sms/Combined-Labeled-Dataset.csv`, real texts with separate spam and smishing labels: 57,201 usable rows; before 18 October 2026 the default was `sms/Dataset_5971.csv`). Both are read from `DEMO_DATASET_DIR` (default `backend/uploads/datasets`, which git ignores; in Docker the folder in `DEMO_DATASETS_HOST_DIR`). Their stored copies and drafts behave like any upload: reprocess or delete them from the Datasets page.
- **The admin's custom scenarios** (`backend/demo/admin_custom_scenarios.json`, committed and shipped in the image; see `backend/demo/README.md`): 108 South African scenarios a security specialist wrote, added the way the "Create scenario" form adds them (no dataset) and switched on. In Scenario Review they are the `admin_custom_scenarios` group, and anything the admin creates later joins them there. Common local phishing and smishing (bank suspensions, fake proof of payment, SARS refunds and penalties, SASSA SRD, PUDO and courier fees, NSFAS, job fees, prize SMSes, the WhatsApp code hijack, a "director" asking for gift cards) come with genuine messages of the same kind from the real senders, the same number of each in every category: 64 emails and 44 texts. Every web address is a full `https://` link, so players can hover it and a click counts as trusting the message; genuine messages link to the organisation's real site, so a link alone never gives the answer away. **Set `DEMO_AUTHOR_WRITTEN=off` in `backend/.env` for a demo built from the public datasets only**, as reported in the paper.
- **A replayed admin review** in Scenario Review, per channel across its datasets: only drafts that pass every automatic check go live, skipping near-copies. With the custom scenarios loaded, they are most of what players see: per category only 1 phishing and 1 genuine dataset draft go live, and only where the category has both answers. With `DEMO_AUTHOR_WRITTEN=off`, up to 40 of each go live per category; categories with only one answer get at least 4, then are topped up in turn until the channel has as many phishing as genuine live where the data allows (Scenario Review flags them). Either way, two per answer stay approved but not live, the 10 lowest-scoring failing drafts are rejected, and the rest wait for review.

  | With the default files | Email live (phishing) | Email focus categories | SMS live (phishing) | SMS focus categories |
  | --- | --- | --- | --- | --- |
  | `DEMO_AUTHOR_WRITTEN=on` (default) | 66 (33): 64 custom, 2 from KD | 10: all | 64 (32): 44 custom, 20 from Combined | 10: all |
  | `DEMO_AUTHOR_WRITTEN=off` (public data only) | 124 (62) | 1: Banking & Money | 716 (358) | 10: all |
- **The baseline bank**: two named assessments of 7 questions per role, named after what they cover: Student "Student Money and Campus Accounts" and "Prizes, Exams and Free Offers"; Employee "Workplace Email and Payments" and "Shared Files, Calls and QR Codes"; Other "Everyday Banking and Delivery Scams" and "Grants, Marketplaces and Investments". The first is on for every role; the students' second was switched on three weeks ago and some of the students have taken it. A new assessment needs a name of its own.
- An admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env` (default **admin@phishsimulator.com** / **Admin#2026**), and an **owner player** for your own address only if `OWNER_EMAIL` is set. Leave it blank to register yourself in the app instead.
- **40 test players** with South African names (Gmail plus-aliases of `DEMO_EMAIL`, or `@phishsimulator.test` without it; 30 of 40 agreed to campaign emails), each with a profile, a baseline, login and training sessions, and about four months of practice. Each player has a habit, from never trained through occasional and weekly to daily, so streaks, badges, the activity calendar and the trends look real. Every decision is on a live scenario (with `DEMO_AUTHOR_WRITTEN=on` mostly the admin's custom ones, with a few from the datasets) and follows the app, using the same selection function: phishing or genuine first, then the adaptive difficulty (set by the baseline in effect, then by the last five answers) and the adaptive category, unseen ones first; the clues ticked are scored by the real clue check; XP uses the level multiplier at that moment; each decision has its feedback; and a risky click is only recorded on a message that has a link or a file. Their addresses are shown with your inbox hidden (`•••+zanele.mashaba@gmail.com`) on every page, in the CSV export and in messages (`app/utils/emails.py`); sending and signing in still use the full address, and every other address is shown unchanged.
- **Two finished cohort campaigns** to consenting players who had joined by then, with mixed results that count as decisions: a phishing email (18 days ago) and a genuine email with a document (9 days ago). The phishing campaign is a custom email the admin wrote (a full mailbox, with a sign-in link), so it can be clicked; an email with no link or attachment can be sent too, and its result is then a report or an ignore. Two more go to the owner's address when an owner player is created.

Every player uses `DEMO_PASSWORD` (default `Player#2026`).

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
3. Normalises message text, sender, subject, labels, category, difficulty and clues (`app/datasets/scenario_parser.py`). Every rule below uses only what the player can see, and treats phishing and genuine messages the same way, so nothing it adds can give the answer away.
   - **Sender (From).** Headers written in MIME words (`=?utf-8?Q?Support?=`) are decoded, and every sender is written one way, `Display Name <address>` (`"PayPal" <a@b.com>` and `a@b.com (Name)` included). The recipient's own address and domain are replaced with `you@example.com` / `example.com`, in the sender too. When a dataset has no sender column, the sender is read from the email's signature: `Best,\nAlex Singh` gives "Alex Singh", and `Security Team,\nCameron Nguyen` gives "Security Team", since that is how the message presents itself. No address is invented, so such a sender shows as a name only. Texts (SMS) have no signature and stay "Unknown number". The player is always the recipient (To).
   - **Category.** Read from the message's own words: each category has strong words that name the topic on their own (a brand, "parcel", "password") and weak words that only count together; a strong word in the subject counts twice. The highest score wins, and a message with no clear topic goes to **General**. A dataset's own "phishing type" column is ignored: only phishing rows have one, so it would sort the two answers by different rules.
   - **Warning signs and difficulty.** Phrases and patterns for each sign (for example "final warning", "will block your account", "avoid a fine" but not "I'm fine", "YOU VE WON", "Dear user", a greeting to an email address, `.zip` files, money in the millions). **Fake sender** covers a look-alike domain, a brand in the name or mailbox but not in the domain (`"American Express" <x@cox.net>`), and a display name that is another address or domain. Difficulty follows the count: for phishing, 3 or more signs = Easy, 2 = Medium, 1 or none = Hard; a genuine message is harder the more signs it shows.
   A link only counts as the **Suspicious link** clue when it looks fake (`app/utils/links.py`): a letter swapped for a number (`m1crosoft.com`), a brand name on a site that isn't the brand's (`paypal.com.secure-login.ru`), a raw IP address, a link shortener, an `@` trick, a fake "-za" on a non-.za site, bait words such as `secure-` or `-portal`, an unusual ending such as `.xyz`, or a tunnel or free host such as `ngrok.io`. A genuine message linking to the real site (`takealot.com`) is not flagged. The same reason is shown to the player in their feedback. A repeated body (some corpora store an email's plain and HTML parts together) is kept once.
4. Saves each usable row as a dataset record (raw text).
5. Creates a **Draft** scenario (linked by `dataset_id`) for each labelled row and makes it realistic (`app/datasets/scenario_realism.py`): email links hide behind button text, senders get a display name, emails that mention an attachment get a fake file (risky `.htm/.zip/.docm/.iso` for phishing, `.pdf/.docx/.xlsx` for genuine), and a quality score is calculated. Phishing and genuine messages get the same treatment, so the formatting never gives the answer away.
6. The admin reviews drafts in **Scenario Review**: preview, automatic checks, QA checklist, then Approve → Activate (or Reject / Archive).
   The automatic checks include **No real contact details** (email addresses or phone numbers still in the text, partly hidden, plus a person-like sender address; public datasets come from real mailboxes, so these must be replaced with made-up ones) and **Links checked** (each link with its verdict, and a warning when the clues and the links disagree).
   The **quality score** starts at 100 and loses points for each problem, and the review screen lists every reason: no sender or subject, too short or too long, big gaps between words (text copied from a web page), leftover HTML, the same text twice, website footer text, "click here" with no link, contact details, no warning signs on a phishing message, or clues that disagree with the links. 80 or more passes. Re-processing a dataset tidies its drafts (gaps, blank lines, repeated text) and re-scores them.

Datasets uploaded before these rules existed can be upgraded with **Re-run processing** in the dataset's details: unreviewed drafts get their sender, category, warning signs, difficulty and realism worked out again; reviewed scenarios keep what the admin approved and are only re-scored.

Scenario text supports `[Button text](https://real-address)` for hidden links, and the sender field supports `Display Name <address>`.

The parser recognises common fields such as `text`, `body`, `content`, `message`, `email_body`, and `text_combined`. It normalises values such as `1`, `phishing`, and `smishing` to phishing (marketing `spam` is left unlabelled), and `0`, `legitimate`, `safe`, and `ham` to legitimate.

The training categories are Banking & Money, Account Security, Email & IT, Prizes & Offers, Delivery, Government, Employment, University and Social Media, plus General for messages with no clear topic. (Before 17 October 2026 they were Banking, Password Reset and Microsoft 365, without Prizes & Offers; migration `b6d8f0a2c4e5` renames stored values.) Uploaded datasets are ignored by Git.

### Which datasets work well

| File (in `backend/uploads/datasets`) | What it is | Verdict |
| --- | --- | --- |
| `sms/Combined-Labeled-Dataset.csv` (`message,spam label,smishing label`) | Real texts from several countries: 84,863 rows, 24,086 smishing (`smishing label` 1), 53,647 genuine, 7,130 marketing spam (spam 1, smishing 0: left unlabelled) | **Best SMS set, the demo default.** Modern smishing (bank KYC, loan apps, couriers) and genuine texts in every category, so SMS focus practice works with real data. About 14,000 rows are lower-cased with punctuation stripped (dropped as unreadable) and some labels are wrong (a "genuine" courier text with a `rebrand.ly` link fails the link check and stays a draft). Importing it takes a minute or two |
| `sms/Dataset_5971.csv` (Mendeley SMS phishing) | Real texts: 4,844 ham, 638 smishing, 489 spam (left unlabelled) | Good but small; many scams are old UK premium-rate texts. Largely contained in the combined set above |
| `email/phishing_legit_dataset_KD_10000.csv` | Generated: 6,000 phishing from about 10 templates, 4,000 genuine workplace notes | **The demo's email set**, balanced and clean, but repetitive. Genuine emails are all meeting notes, so most categories hold only phishing. No sender column (read from the signature) |
| `email/Nazario.csv` | Real phishing (1,565) with real senders, subjects and links | **Good phishing**, phishing only. Pair it with a genuine set of similar notifications |
| `email/phishing_dataset_with_category.csv` | 1,000 short generated phishing lines ("Urgent! Your Google has been compromised...") | Phishing only; no genuine messages and no senders |
| `email/Nigerian_Fraud.csv` | Real advance-fee ("419") fraud, phishing only | Narrow: one scam type, many long or unreadable rows |
| `email/CEAS_08.csv` | 2008 spam-challenge email: 21,842 label 1, 17,312 label 0 | **Avoid** for phishing training: label 1 is mostly pharmacy and replica spam, and the genuine rows are mailing-list threads (Postfix, Python, SpamAssassin) |
| `email/SpamAssasin.csv` | 2002 mailing-list email; its label 1 is marketing spam | **Avoid.** Genuine rows are Linux list replies, and spam would be stored as phishing |

Datasets that label phishing and spam in separate columns are read correctly: a `smishing label` (or `phishing label`) column decides, and a message it clears that the `spam label` column marks as spam stays unlabelled.

For focused practice to work in a category, it needs genuine messages on the same topic (real bank alerts, delivery updates, password-reset confirmations, university notices). The combined SMS set has them; no email file here does, so most email categories stay phishing-only with public data alone. The demo adds the admin's custom scenarios for this (`backend/demo/admin_custom_scenarios.json`, see "Demo data"). They are not public data and are left out with `DEMO_AUTHOR_WRITTEN=off`. In production, the upload storage should be replaced with S3 or another object-storage service.

When an administrator deletes a dataset, the generated scenarios and related attempts, feedback, and actions are deleted as well. The affected performance totals are recalculated.

## Adaptive training behaviour

Difficulty moves one step at a time:

- Before five attempts, a baseline score of 70 or higher starts at Medium; otherwise Easy.
- After that, if 80%+ of the last five answers are correct, step up one level (Easy → Medium → Hard).
- Below 60%, step down one level. Otherwise stay.
- After a change, the window starts again: the new level is judged on 5 answers given at that level, so a player can't jump from Easy to Hard in two answers.
- Real-inbox campaign results don't count, because those emails are not chosen at the player's difficulty.

For a genuine message, "Known sender" only counts as a real clue when the message shows a sender; when neither the dataset nor the signature gives one, the player sees "Unknown sender" or "Unknown number".

Category selection avoids the two most recent categories when possible, prefers unpractised relevant categories, and then reinforces the weakest relevant area. Occupation priorities are:

- Student: University, Social Media, Account Security, Delivery.
- Employee: Email & IT, Employment, Banking & Money, Account Security.
- Other: Government, Banking & Money, Delivery, Social Media.

Phishing or genuine is decided before category and difficulty. Datasets are rarely balanced (in the demo email set, almost every genuine message is an Easy meeting note in General), so choosing by category and difficulty alone would let a player guess the answer from them. The chance of phishing leans away from the last 10 training messages (more phishing recently makes genuine likelier) but stays between 25% and 75%, so the order can't be predicted. Within that answer the app looks for the practice category at the player's difficulty, then the nearest difficulty, then any category; only when no scenario with that answer is left does it use the other one. The badge on the message shows the player's level, not the message's own difficulty, since a message borrowed from a nearby level would otherwise hint at its answer. Scenario Review shows a "Categories with only one kind of answer" card listing live categories and difficulties where one answer is missing or under a quarter, and how to fix them.

Players can select a category manually for focused practice, but only one whose live scenarios hold both answers, neither under a quarter (the same rule as the admin's balance card): in a one-sided category the player would soon see only one answer. Other categories show greyed out and still come up in the adaptive mix. Messages that match no category's keywords go to "General" (an everyday message, not a phishing type), which the All-Rounder badge does not require. Otherwise, the system prefers unseen scenarios, applies a short repeat cooldown, and then falls back to random eligible content. This prevents large dataset uploads from becoming a long fixed queue.

## Gamification and progress

Each mechanic has a learning purpose, and progress stays private: there is no public leaderboard.

| Mechanic | What the player sees | Why it is there |
| --- | --- | --- |
| XP and levels | XP for correct decisions, more for harder scenarios and spotted clues; a level multiplier | Rewards effort and shows steady progress |
| Skill rank | Recruit to Guardian, from weighted accuracy on the last 20 decisions; it can fall | Measures skill separately from effort |
| Private position | "Top 5%" in the top half; below it, "#21 of 24" and how many players to pass to reach the top half | Relative feedback without names, scores or a leaderboard, and never "Top 88%" for a weak result |
| Streaks | Current and best run of practice days | Encourages short, regular practice instead of cramming |
| Daily goal and goals | 5 decisions a day; one current goal and the next four | A clear next step on every visit |
| Badges | 15 in three groups (below) | Most of them need skill, not just activity |
| Yearly activity | A calendar of practice days with a count per day | Makes the habit visible |

A practice day counts when the player makes at least one decision (training or a campaign email), not when they merely log in, so streaks reward learning rather than visits. Days follow local time (`APP_UTC_OFFSET_HOURS`, default 2 for South Africa), so practice just after midnight counts for the new day.

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
4. Open campaign emails on this computer. The app runs on `localhost` only, and the links in each email point to `PUBLIC_BACKEND_URL` (`http://localhost:5000`), which only this computer can reach.

**Building a campaign:** pick an active email scenario, or write your own (sender, subject, body, phishing or genuine, warning signs, and an optional look-alike attachment such as `Invoice_2026.pdf`). Choose recipients from the registered players — the picker greys out anyone not on the allow-list. Save the draft, then Send.

**How it works:** each recipient gets a unique tracking link, an invisible tracking pixel, a clickable attachment tile (styled like a mail client — no real file is attached), and a neutral report link. Opening the email loads the pixel (an open); clicking the link or the attachment, or using the report link, is recorded. The **first** action is the one that counts and locks the result; a later action changes nothing. If nothing happens within `CAMPAIGN_IGNORE_MINUTES` (default 10), the result is **Ignored**. An email with no link and no attachment (like a scam that asks for a reply) can be sent as well: its result can only be **Reported** or **Ignored**, and the campaign page lists such emails apart as "report or ignore only". A background sweep closes expired emails even if no one is looking at the app.

Every final result:
- **emails the recipient branded feedback** (good or bad) that matches the app's theme — what the email was, what gave it away or why it was genuine, and their XP;
- **awards XP** (phishing: report +30, ignore +10, click 0; genuine: click +10, ignore 0, report 0). As in training, a mistake earns 0 XP, so XP never goes down; mistakes still count against accuracy and skill rank;
- **counts as a real decision** in the player's accuracy, missed-phishing, risky-clicks, streak, skill rank, badges and history, tagged "Campaign";
- appears in the player's **Inbox** on Home with a "Get feedback" panel.

The admin report shows opens, clicks, attachment opens, reports and ignored per recipient; once every result is final the campaign is **Completed** and read-only (launched campaigns are kept as a record and cannot be deleted). Clicks, attachment opens and reports are recorded when the email is opened on this computer. Opens are recorded only by mail apps that load images directly: Gmail loads them through Google's servers, which cannot reach `localhost`, so a Gmail open may not show (the click, report or ignore still counts).

**Safety:** nothing is sent unless Gmail is configured, and only to allow-listed addresses. This is why demo players' `@phishsimulator.test` addresses are never emailed — they are not real inboxes, and they are not on the allow-list. Only send to inboxes you own.

## Security

### How signing in works

Logins are **server-side sessions**: every sign-in is one row in the `user_session` table. The browser holds two signed tokens (JWT, HS256), both in **HttpOnly cookies** that page scripts cannot read, so a cross-site-scripting bug could not steal them:

| Cookie | Lasts | Sent to | Carries |
| --- | --- | --- | --- |
| `ps_access` | 10 minutes (`ACCESS_TOKEN_MINUTES`) | `/api/` | a random session key and the session's refresh count |
| `ps_refresh` | the session | `/api/auth/refresh` only | the same session key |

- **No personal data in tokens.** Neither token names the user, their email or their role. The server looks the session up on every request and reads the role from the database, so a role change or a deleted account takes effect at once. Only SHA-256 hashes of the session key and the refresh token are stored.
- **Rotation.** When the access token runs out, the page calls `/api/auth/refresh`: the refresh token is swapped for a new one, and the previous access token stops working at once. Using a replaced refresh token again means it was copied, so the whole session is revoked (a short grace period covers two tabs refreshing together).
- **The session ends** after `SESSION_IDLE_MINUTES` (30) without a refresh, after `SESSION_MAX_HOURS` (12) in any case, on logout, when the password is changed (other devices) or reset (all devices), and when its token is used from a different browser (User-Agent). The session row records why it ended, and a background job closes the ones that ran out.
- **One login per browser.** The cookies are shared by every tab of the site. To be the admin and a player at the same time, use a second browser or a private window.
- **Cookie flags.** `HttpOnly`, `SameSite=Strict` and `Secure`. Browsers send Secure cookies to `http://localhost`, so Docker and Vite work as they are. To open the app over plain http from another device, set `COOKIE_SECURE=false` (or serve it over HTTPS).

### Protections

| Area | What the app does |
| --- | --- |
| Cross-site request forgery | Three layers: SameSite=Strict cookies; every change (POST, PUT, PATCH, DELETE) must repeat the readable `ps_csrf` cookie in the `X-CSRF-Token` header; and a change whose `Origin` is another site is refused. |
| Cross-site scripting | React escapes all text; the page's Content-Security-Policy only runs scripts from the app itself (`script-src 'self'`, `object-src 'none'`, no framing); tokens are out of reach of scripts; names are limited to letters, digits and `' . -`. |
| SQL injection | Every query goes through SQLAlchemy with bound parameters, never by pasting text into SQL. The server checks every field (type, length, format); the forms repeat the same rules (`frontend/src/services/validation.ts`) only to help the user, since anyone can send requests without the page. |
| Secrets | Passwords and keys live only in `.env` files, which git and Docker both ignore. The API refuses to start unless `SECRET_KEY` and `JWT_SECRET_KEY` are at least 32 characters. Tokens only accept HS256 with this API's issuer and audience. |
| Accidental commits | `.githooks/pre-commit` blocks a commit that adds an `.env` file, a key file, uploaded data, or a line such as `SMTP_PASSWORD=...`. Turn it on once per clone with `git config core.hooksPath .githooks`. |
| Passwords | Stored as bcrypt hashes. New passwords need 8 to 64 characters with a letter and a number (bcrypt reads at most 72 bytes). |
| Guessing | Five wrong passwords in a row lock the account for 15 minutes. Per-address rate limits on sign-in (10 a minute), registration (10 an hour), password resets (5 per 15 minutes) and refreshing. The reply never says whether an email exists, and an unknown email takes as long to answer as a known one. |
| Password reset | A one-time link that works for 30 minutes. The token is after `#` in the link, so it never reaches a server log or a Referer header. Only a SHA-256 hash is stored, and using it signs out every session. |
| Data leaks | Replies carry only what the page shows: no ids or security fields in `/me`, no tokens in any body. Errors are logged on the server; the browser only sees a plain message. The CSV export makes any cell that would run as a spreadsheet formula plain text. |
| Headers | The API sends a `default-src 'none'` Content-Security-Policy, `X-Frame-Options: DENY`, `nosniff`, `no-referrer`, `Cache-Control: no-store`, `Cross-Origin-Opener-Policy` and `Cross-Origin-Resource-Policy`, plus HSTS when reached over HTTPS. |
| Uploads | CSV or JSON only, saved under a random name, and capped at `MAX_UPLOAD_MB` by both nginx and Flask. |
| Containers | The backend runs as a normal user, not root. The frontend port listens on `127.0.0.1` unless `HOST_IP` says otherwise; the API port always listens on `127.0.0.1` only (other devices go through nginx), and the database port is never published. `docker-compose.yml` fixes `FLASK_ENV=production` (Gunicorn, never the debugger) and `TRUSTED_PROXY_COUNT=1` (the API sees each visitor's address behind nginx), so neither can be changed from `.env` or the shell. |
| Roles | Admin endpoints check the role in the database on every request (`@require_admin`), and players can only read their own data. |

Known limits: the rate-limit counts are kept per Gunicorn worker in memory (3 workers, so up to 3 times the stated limit; the per-account lock still applies), and the User-Agent check is a signal, not proof, since a thief can copy it too. Registration does say when an email is already registered, so people can sign in instead.

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

End-to-end check of the whole API (233 checks across every CATCH stage, sessions, security and the demo data). It builds a fresh throwaway database on your PostgreSQL server from every migration plus the demo data, prints a trace of one test learner, then drops the database; your own database is never touched:

```powershell
cd backend; .\.venv\Scripts\python.exe tests\e2e_check.py
```

After pulling model changes, apply migrations with `flask --app run.py db upgrade`.

Frontend build:

```powershell
cd frontend
npm run build
```
