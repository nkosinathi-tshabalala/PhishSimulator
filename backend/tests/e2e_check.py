# End-to-end check of the PhishSimulator API, covering every CATCH stage through real HTTP requests.
#
# It builds a FRESH throwaway database on your PostgreSQL server (every migration in order, then the
# demo data), runs about 140 checks, prints a trace of one test learner, and drops the database again.
# Your own database is never read or changed. Email goes to a fake mail server and uploads to a
# temporary folder, so nothing leaves this machine.
#
#   cd backend
#   .venv\Scripts\python.exe tests\e2e_check.py
#
# (It is not named test_*.py, so the quick unit tests do not run it.)

import io
import os
import re
import shutil
import tempfile
import smtplib
import sys
import traceback
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
SCRATCH = Path(tempfile.mkdtemp(prefix="phishsim_e2e_"))
TEST_DB = "phishsim_e2e_check"
PASSWORD = "E2eCheck!2026"
PLAYER_EMAIL = "e2e.player@example.test"
ADMIN2_EMAIL = "second.admin@example.test"
BASELINE_ANSWER = "I would check the sender address and never click the link."   # sensible, in plain words

sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

from dotenv import dotenv_values  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.engine import URL, make_url  # noqa: E402

env = dotenv_values(BACKEND / ".env")
# Connect to the same PostgreSQL server as the app, but always to a separate, throwaway database
if env.get("DATABASE_URL"):
    SERVER = make_url(env["DATABASE_URL"])
else:
    SERVER = URL.create(
        "postgresql", username=env.get("DB_USER"), password=env.get("DB_PASSWORD"),
        host=env.get("DB_HOST"), port=int(env.get("DB_PORT") or 5432), database=env.get("DB_NAME"),
    )
TEST = SERVER.set(database=TEST_DB)
assert SERVER.database != TEST_DB, "refusing to run: the test database name matches your real one"

maintenance = create_engine(SERVER.set(database="postgres"), isolation_level="AUTOCOMMIT")


def drop_test_db():
    with maintenance.connect() as conn:
        conn.execute(text(
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
            "WHERE datname = :name AND pid <> pg_backend_pid()"
        ), {"name": TEST_DB})
        conn.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB}"'))


# ---------- fake mail server ----------
SENT, LOGINS, MODE = [], [], {"value": "ok"}


class FakeSMTP:
    def __init__(self, host, port, timeout=None, **_):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self, context=None):
        pass

    def login(self, user, password):
        if MODE["value"] == "auth_fail":
            raise smtplib.SMTPAuthenticationError(535, b"5.7.8 Username and Password not accepted")
        LOGINS.append(password)

    def send_message(self, message):
        SENT.append(message)


smtplib.SMTP = FakeSMTP
smtplib.SMTP_SSL = FakeSMTP

RESULTS = []
TRACE = []                      # the test learner's attempts, for the printed trace
baseline_summary, perf_after = {}, {}


def check(name, ok, detail=""):
    RESULTS.append(("PASS" if ok else "FAIL", name, "" if ok else str(detail)[:300]))


app = None
try:
    drop_test_db()
    with maintenance.connect() as conn:
        conn.execute(text(f'CREATE DATABASE "{TEST_DB}"'))

    os.environ["DATABASE_URL"] = TEST.render_as_string(hide_password=False)
    os.environ["SMTP_USERNAME"] = "sender@example.test"
    os.environ["SMTP_PASSWORD"] = "abcd efgh ijkl mnop"   # Gmail's display format, with spaces
    os.environ["CAMPAIGN_ALLOWED_RECIPIENTS"] = PLAYER_EMAIL
    os.environ["CAMPAIGN_SWEEPER"] = "off"   # the test drives the sweep itself

    from app import create_app
    from app.extensions import bcrypt, db
    import app.services.dataset_service as dataset_service

    dataset_service.UPLOAD_FOLDER = str(SCRATCH / "uploads")   # never touch backend/uploads
    app = create_app()
    assert app.config["SQLALCHEMY_DATABASE_URI"].rsplit("/", 1)[-1] == TEST_DB, "app is not on the test database"

    # ---------- a fresh database: every migration in order, then the demo data ----------
    from flask_migrate import upgrade
    from sqlalchemy import inspect as sql_inspect
    with app.app_context():
        assert db.engine.url.database == TEST_DB
        upgrade()
        inspector = sql_inspect(db.engine)
        missing = [f"{table.name}.{column.name}" for table in db.metadata.sorted_tables
                   for column in table.columns
                   if column.name not in {c["name"] for c in inspector.get_columns(table.name)}]
        check("migration: a fresh database built from every migration has every column the models expect",
              not missing, missing)

    import seed_demo
    seed_demo.OWNER_EMAIL = ""  # the demo data never needs a real inbox
    seed_demo.DEMO_EMAIL = ""   # test players keep fake @phishsimulator.test addresses
    seed_demo.main()

    with app.app_context():
        from app.models.authentication import User
        users = User.query.all()
        admin = next(user for user in users if (user.role or "").upper() == "ADMIN")
        password_hash = bcrypt.generate_password_hash(PASSWORD).decode("utf-8")
        admin.password_hash = password_hash
        admin2 = User(email=ADMIN2_EMAIL, password_hash=password_hash, role="ADMIN")
        db.session.add(admin2)
        db.session.commit()
        ADMIN_EMAIL, ADMIN_ID, ADMIN2_ID = admin.email, admin.user_id, admin2.user_id

    client = app.test_client()

    def api(method, path, token=None, **kwargs):
        headers = kwargs.pop("headers", {})
        if token:
            headers["Authorization"] = f"Bearer {token}"
        return client.open(path, method=method, headers=headers, **kwargs)

    def body(response):
        try:
            return response.get_json(silent=True) or {}
        except Exception:
            return {}

    def data_of(response):
        return body(response).get("data") or {}

    def login(email):
        response = api("POST", "/api/auth/login", json={"email": email, "password": PASSWORD})
        return data_of(response).get("access_token"), response

    def items(value, *keys):
        if isinstance(value, list):
            return value
        for key in keys:
            if isinstance(value.get(key), list):
                return value[key]
        return []

    check("config strips spaces from the Gmail app password", app.config["SMTP_PASSWORD"] == "abcdefghijklmnop",
          repr(app.config["SMTP_PASSWORD"]))

    # ================= PLAYER JOURNEY =================
    r = api("POST", "/api/auth/register", json={
        "full_name": "E2E Player", "email": PLAYER_EMAIL, "password": PASSWORD,
        "confirm_password": PASSWORD, "age": 22, "occupation": "STUDENT", "it_background": False,
        "campaign_consent": True,
    })
    check("player: register", r.status_code in (200, 201), f"{r.status_code} {body(r).get('message')}")
    ptoken, r = login(PLAYER_EMAIL)
    check("player: log in", bool(ptoken), f"{r.status_code} {body(r).get('message')}")
    me = data_of(api("GET", "/api/auth/me", ptoken))
    check("player: /auth/me", bool(me.get("email")))
    check("consent: agreeing on registration is recorded with a time",
          me.get("campaign_consent") is True and bool(me.get("campaign_consent_at")),
          {k: me.get(k) for k in ("campaign_consent", "campaign_consent_at")})

    r = api("GET", "/api/analytics/my-performance", ptoken)
    perf_new = data_of(r)
    check("player: dashboard data loads", r.status_code == 200, r.status_code)
    check("player: new player has 15 badges, 0 attempts, no baseline",
          len(perf_new.get("badges", [])) == 15 and perf_new.get("total_attempts") == 0
          and perf_new.get("baseline_score") is None, {k: perf_new.get(k) for k in ("total_attempts", "baseline_score")})

    r = api("POST", "/api/baseline/start", ptoken)
    start = data_of(r)
    questions = start.get("questions") or []
    check("player: baseline quiz starts", r.status_code == 200 and questions, f"{r.status_code} {body(r).get('message')}")
    with app.app_context():
        from app.models.baseline.baseline_question import BaselineQuestion
        role_of = {question.question_id: question.occupation for question in BaselineQuestion.query.all()}
    given_roles = [role_of.get(question.get("id")) for question in questions]
    check("baseline: a Student gets 5 questions, all written for students",
          len(questions) == 5 and set(given_roles) == {"Student"}, given_roles)
    assessment_id = start.get("assessment_id") or (start.get("assessment") or {}).get("assessment_id")
    answered = 0
    for question in questions:
        qid = question.get("question_id") or question.get("id")
        rr = api("POST", "/api/baseline/submit-response", ptoken, json={
            "assessment_id": assessment_id, "question_id": qid,
            "answer_text": BASELINE_ANSWER,
        })
        answered += rr.status_code in (200, 201)
    check("player: every baseline answer accepted", answered == len(questions), f"{answered}/{len(questions)}")
    r = api("POST", "/api/baseline/complete", ptoken, json={"assessment_id": assessment_id})
    baseline_summary = data_of(r)
    check("player: baseline completes", r.status_code == 200, f"{r.status_code} {body(r).get('message')}")
    check("player: baseline result", api("GET", "/api/baseline/latest-result", ptoken).status_code == 200)

    # The Check rule, and its known weakness: it counts expected keywords, not understanding
    with app.app_context():
        keyword_lists = {question.question_id: question.get_expected_keywords() for question in BaselineQuestion.query.all()}
    given = [keyword_lists[question.get("id")] for question in questions]
    keywords_total = sum(len(keywords) for keywords in given)
    keywords_found = sum(keyword.lower() in BASELINE_ANSWER.lower() for keywords in given for keyword in keywords)
    expected_score = round(keywords_found / keywords_total * 100)
    check(f"baseline: score = expected keywords found / expected keywords ({keywords_found} of {keywords_total})",
          baseline_summary.get("overallScore") == expected_score
          and baseline_summary.get("totalKeywordsMatched") == keywords_found, baseline_summary.get("overallScore"))

    KEYWORD_EMAIL = "e2e.keywords@example.test"
    api("POST", "/api/auth/register", json={
        "full_name": "E2E Keywords", "email": KEYWORD_EMAIL, "password": PASSWORD,
        "confirm_password": PASSWORD, "age": 22, "occupation": "STUDENT", "it_background": False,
    })
    ktoken, _ = login(KEYWORD_EMAIL)
    kstart = data_of(api("POST", "/api/baseline/start", ktoken))
    kassessment = kstart.get("assessment_id") or (kstart.get("assessment") or {}).get("assessment_id")
    for question in kstart.get("questions") or []:
        qid = question.get("question_id") or question.get("id")
        api("POST", "/api/baseline/submit-response", ktoken, json={
            "assessment_id": kassessment, "question_id": qid, "answer_text": " ".join(keyword_lists[qid]),
        })
    ksummary = data_of(api("POST", "/api/baseline/complete", ktoken, json={"assessment_id": kassessment}))
    check("baseline: a bare list of the expected keywords scores 100% and starts on Medium (known limitation)",
          ksummary.get("overallScore") == 100 and ksummary.get("startingDifficulty") == "Medium",
          {key: ksummary.get(key) for key in ("overallScore", "startingDifficulty")})

    EMPLOYEE_EMAIL = "e2e.employee@example.test"
    api("POST", "/api/auth/register", json={
        "full_name": "E2E Employee", "email": EMPLOYEE_EMAIL, "password": PASSWORD,
        "confirm_password": PASSWORD, "age": 35, "occupation": "EMPLOYEE", "it_background": False,
    })
    etoken, _ = login(EMPLOYEE_EMAIL)
    estart = data_of(api("POST", "/api/baseline/start", etoken))
    employee_roles = [role_of.get(question.get("id")) for question in estart.get("questions") or []]
    check("baseline: an Employee gets 5 questions, all written for employees",
          len(employee_roles) == 5 and set(employee_roles) == {"Employee"}, employee_roles)
    check("consent: not agreeing on registration is the default",
          data_of(api("GET", "/api/auth/me", etoken)).get("campaign_consent") is False)

    leaked, attempt_codes, last_attempt = [], [], {}
    for channel in ("EMAIL", "SMS", "EMAIL", "SMS", "EMAIL", "EMAIL"):
        r = api("GET", f"/api/scenarios/random/{channel}", ptoken)
        scenario = data_of(r)
        leaked += [key for key in ("correct_answer", "phishing_cues", "feedback", "title") if key in scenario]
        rr = api("POST", "/api/simulation/attempt", ptoken, json={
            "scenario_id": scenario.get("scenario_id"), "player_answer": "REPORT",
            "selected_clues": (scenario.get("clue_options") or [])[:2],
            "justification": "The sender looks odd and the link does not match the company.",
        })
        attempt_codes.append(rr.status_code)
        last_attempt = data_of(rr)
        TRACE.append((channel, scenario.get("category"), scenario.get("difficulty"), last_attempt))
    check("player: 6 attempts saved (email + SMS)", all(code in (200, 201) for code in attempt_codes), attempt_codes)
    check("player: scenario sent to the player never includes the answer or the admin's title", not leaked, leaked)
    check("player: attempt result has feedback, progress, changes",
          all(key in last_attempt for key in ("feedback", "progress", "changes")), list(last_attempt))

    perf_after = data_of(api("GET", "/api/analytics/my-performance", ptoken))
    recent_names = [row.get("scenario", "") for row in perf_after.get("recent_attempts", [])]
    check("player: recent decisions are named by what the player saw, never 'training'",
          recent_names and not any("training" in name.lower() for name in recent_names), recent_names[:3])
    check("player: dashboard updates after training",
          perf_after.get("total_attempts") == 6 and perf_after.get("today_attempts") == 6
          and perf_after.get("practised_today") and perf_after.get("daily_streak") == 1
          and perf_after.get("baseline_score") is not None,
          {k: perf_after.get(k) for k in ("total_attempts", "today_attempts", "daily_streak", "baseline_score")})

    r = api("GET", "/api/scenarios/triage/EMAIL", ptoken)
    messages = data_of(r).get("messages") or []
    check("player: Inbox Rush batch", r.status_code == 200 and len(messages) >= 2
          and not any("correct_answer" in m for m in messages), r.status_code)
    r = api("GET", "/api/scenarios/review/EMAIL", ptoken)
    check("player: mistake review (a scenario, or 'no mistakes')",
          r.status_code == 200 or data_of(r).get("no_mistakes"), f"{r.status_code} {body(r).get('message')}")
    check("public summary without login", api("GET", "/api/analytics/public-summary").status_code == 200)
    check("player is blocked from admin pages", api("GET", "/api/campaigns", ptoken).status_code == 403)
    check("no token is rejected", api("GET", "/api/analytics/my-performance").status_code == 401)

    # ================= ADMIN PAGES =================
    atoken, r = login(ADMIN_EMAIL)
    check("admin: log in", bool(atoken), f"{r.status_code} {body(r).get('message')}")
    for path in ("/api/analytics/admin", "/api/analytics/admin-dashboard", "/api/analytics/users",
                 "/api/datasets", "/api/scenarios", "/api/baseline/questions", "/api/campaigns"):
        r = api("GET", path, atoken)
        check(f"admin: GET {path}", r.status_code == 200, f"{r.status_code} {body(r).get('message')}")
    r = api("GET", "/api/analytics/export/players.csv", atoken)
    check("admin: player CSV export", r.status_code == 200 and "csv" in (r.mimetype or ""), f"{r.status_code} {r.mimetype}")

    monitored = items(data_of(api("GET", "/api/analytics/users", atoken)), "users")
    test_user = next((u for u in monitored if u.get("email") == PLAYER_EMAIL), None)
    check("admin: new player appears in user monitoring", test_user is not None)
    if test_user:
        check("admin: one user's details", api("GET", f"/api/analytics/users/{test_user['user_id']}", atoken).status_code == 200)
    datasets = items(data_of(api("GET", "/api/datasets", atoken)), "datasets")
    if datasets:
        check("admin: one dataset", api("GET", f"/api/datasets/{datasets[0]['dataset_id']}", atoken).status_code == 200)
    scenario_list = items(data_of(api("GET", "/api/scenarios", atoken)), "scenarios", "items")
    if scenario_list:
        check("admin: one scenario", api("GET", f"/api/scenarios/{scenario_list[0]['scenario_id']}", atoken).status_code == 200)
    questions = items(data_of(api("GET", "/api/baseline/questions", atoken)), "questions")
    if questions:
        qid = questions[0].get("question_id") or questions[0].get("id")
        check("admin: one baseline question", api("GET", f"/api/baseline/questions/{qid}", atoken).status_code == 200)
    by_role = {}
    for question in questions:
        if question.get("isActive"):
            by_role[question.get("occupation")] = by_role.get(question.get("occupation"), 0) + 1
    check("bank: 5 questions switched on per role, spares and general questions off",
          by_role == {"Student": 5, "Employee": 5, "Other": 5} and len(questions) > 15, {"active": by_role, "total": len(questions)})
    spare = next((q for q in questions if q.get("occupation") == "Other" and not q.get("isActive")), None)
    if spare:
        r = api("POST", f"/api/baseline/questions/{spare['id']}/active", atoken, json={"active": True})
        check("bank: admin switches a spare question on", r.status_code == 200 and data_of(r).get("isActive") is True,
              f"{r.status_code} {body(r).get('message')}")
        r = api("POST", f"/api/baseline/questions/{spare['id']}/active", atoken, json={"active": False})
        check("bank: and off again", r.status_code == 200 and data_of(r).get("isActive") is False)
    r = api("POST", f"/api/baseline/questions/{qid}/active", ptoken, json={"active": False})
    check("bank: a player cannot switch questions", r.status_code == 403, r.status_code)
    r = api("POST", "/api/baseline/questions/load-templates", atoken)
    check("bank: loading templates again adds nothing (no duplicates)",
          r.status_code == 200 and data_of(r).get("added") == 0, f"{r.status_code} {body(r).get('message')}")

    # ================= EMAIL CAMPAIGNS =================
    context = data_of(api("GET", "/api/campaigns", atoken))
    players = context.get("players", [])
    mine = next((p for p in players if p["email"] == PLAYER_EMAIL), None)
    check("picker: the allow-listed player is selectable", bool(mine and mine["selectable"]))
    check("picker: every other player is locked", all(not p["selectable"] for p in players if p["email"] != PLAYER_EMAIL))
    demo = [p for p in players if p["email"].endswith("@phishsimulator.test")]
    agreed = sum(p["consented"] for p in demo)
    check("consent: most demo players agreed to campaign emails, some did not (30 of 40)",
          len(demo) == 40 and agreed == 30, f"{agreed} of {len(demo)}")
    check("picker: each locked player says why (no consent, or off the allow-list)",
          all(p["blocked_reason"] == ("Not on the safety allow-list" if p["consented"] else "Has not agreed to campaign emails")
              for p in players if not p["selectable"]))
    check("picker: occupations are Student/Employee/Other",
          {p["occupation"] for p in players} <= {"Student", "Employee", "Other"}, {p["occupation"] for p in players})
    check("campaign: scenario list offers phishing and genuine emails",
          {s["is_phishing"] for s in context["scenarios"]} == {True, False}, {s["is_phishing"] for s in context["scenarios"]})
    scenario_id = next(s["scenario_id"] for s in context["scenarios"] if s["is_phishing"])
    locked = next(p["email"] for p in players if not p["selectable"])

    r = api("POST", "/api/campaigns", atoken, json={"scenario_id": scenario_id, "name": "E2E blocked", "recipients": [locked]})
    check("campaign: address off the allow-list is refused", r.status_code == 400, r.status_code)

    def set_consent(agree):
        return api("PUT", "/api/auth/update-profile", ptoken, json={
            "full_name": "E2E Player", "age": 22, "occupation": "Student", "it_background": False,
            "campaign_consent": agree,
        })

    r = set_consent(False)
    check("consent: a player can withdraw it in their profile",
          r.status_code == 200 and data_of(r).get("campaign_consent") is False and not data_of(r).get("campaign_consent_at"),
          f"{r.status_code} {body(r).get('message')}")
    r = api("POST", "/api/campaigns", atoken, json={"scenario_id": scenario_id, "name": "E2E no consent", "recipients": [PLAYER_EMAIL]})
    check("consent: a campaign to a player who withdrew is refused, even when allow-listed",
          r.status_code == 400 and "not agreed" in (body(r).get("message") or ""), f"{r.status_code} {body(r).get('message')}")
    set_consent(True)
    r = api("POST", "/api/campaigns", atoken, json={"scenario_id": scenario_id, "name": "E2E withdraw", "recipients": [PLAYER_EMAIL]})
    c_withdraw = data_of(r).get("campaign_id")
    set_consent(False)
    r = api("POST", f"/api/campaigns/{c_withdraw}/launch", atoken)
    with app.app_context():
        from app.models.email import EmailCampaignRecipient
        withdrawn = EmailCampaignRecipient.query.filter_by(campaign_id=c_withdraw).first()
        withdrawn_status = withdrawn.delivery_status if withdrawn else None
    check("consent: withdrawn after the draft was made -> nothing is sent at launch",
          not SENT and withdrawn_status == "NO_CONSENT" and data_of(r).get("sent") == 0, f"{withdrawn_status} {body(r).get('message')}")
    api("DELETE", f"/api/campaigns/{c_withdraw}", atoken)
    set_consent(True)

    r = api("POST", "/api/campaigns", atoken, json={"scenario_id": scenario_id, "name": "E2E fail", "recipients": [PLAYER_EMAIL]})
    c_fail = data_of(r).get("campaign_id")
    check("campaign: draft created from a picked player", r.status_code == 201 and c_fail, f"{r.status_code} {body(r).get('message')}")
    MODE["value"] = "auth_fail"
    r = api("POST", f"/api/campaigns/{c_fail}/launch", atoken)
    launched = data_of(r)
    check("campaign: bad Gmail password -> FAILED with a clear reason",
          r.status_code == 200 and launched.get("status") == "FAILED" and launched.get("sent") == 0
          and "Gmail rejected the sign-in" in body(r).get("message", ""), body(r).get("message"))
    check("campaign: delete a failed campaign", api("DELETE", f"/api/campaigns/{c_fail}", atoken).status_code == 200)
    check("campaign: deleted campaign is gone", api("GET", f"/api/campaigns/{c_fail}", atoken).status_code == 404)

    MODE["value"] = "ok"
    SENT.clear()
    LOGINS.clear()
    r = api("POST", "/api/campaigns", atoken, json={"scenario_id": scenario_id, "name": "E2E ok", "recipients": [PLAYER_EMAIL]})
    c_ok = data_of(r).get("campaign_id")
    r = api("POST", f"/api/campaigns/{c_ok}/launch", atoken)
    launched = data_of(r)
    check("campaign: launch sends 1 email", launched.get("status") == "LAUNCHED" and launched.get("sent") == 1, body(r).get("message"))
    check("campaign: SMTP gets the app password without spaces", LOGINS == ["abcdefghijklmnop"], LOGINS)
    token = None
    if SENT:
        html = SENT[0].get_body(("html",)).get_content()
        match = re.search(r"/api/campaigns/click/([A-Za-z0-9_-]+)", html)
        token = match.group(1) if match else None
        check("campaign: email has a tracked link and open pixel", bool(token) and "/api/campaigns/open/" in html)
        check("campaign: email goes only to the allow-listed address", SENT[0]["To"] == PLAYER_EMAIL, SENT[0]["To"])
    check("campaign: a launched campaign cannot be deleted", api("DELETE", f"/api/campaigns/{c_ok}", atoken).status_code == 400)
    if SENT:
        check("campaign: email has a neutral report link",
              "/api/campaigns/report/" in html and "Report this email" in html and "outside your organisation" not in html)
    report = data_of(api("GET", f"/api/campaigns/{c_ok}", atoken))
    check("outcome: just sent -> WAITING",
          report.get("recipient_details", [{}])[0].get("outcome") == "WAITING" and report.get("waiting") == 1,
          report.get("recipient_details"))
    if token:
        r = api("GET", f"/api/campaigns/open/{token}")
        check("tracking: open pixel", r.status_code == 200 and r.mimetype == "image/gif", r.status_code)
        r = api("GET", f"/api/campaigns/click/{token}")
        check("tracking: click goes to the caught page", r.status_code == 302 and "/caught?token=" in r.headers.get("Location", ""))
        check("tracking: click emails a debrief", len(SENT) == 2 and "simulated phishing" in SENT[1]["Subject"],
              [m["Subject"] for m in SENT])
        landing = api("GET", f"/api/campaigns/landing/{token}")
        info = data_of(landing)
        check("landing: tells the page who the email was for",
              landing.status_code == 200 and info.get("email") == PLAYER_EMAIL and info.get("clicked") is True, info)
        check("landing: unknown token -> 404", api("GET", "/api/campaigns/landing/not-a-real-token").status_code == 404)
        r = api("GET", f"/api/campaigns/report/{token}")
        check("tracking: report link goes to the reported page",
              r.status_code == 302 and "/reported?token=" in r.headers.get("Location", ""), r.headers.get("Location"))
        report = data_of(api("GET", f"/api/campaigns/{c_ok}", atoken))
        check("campaign: report counts the open and click; the later report is locked out",
              (report.get("opened"), report.get("clicked"), report.get("reported")) == (1, 1, 0),
              (report.get("opened"), report.get("clicked"), report.get("reported")))
        check("outcome: clicked then reported -> CLICKED (the risky action wins)",
              report["recipient_details"][0]["outcome"] == "CLICKED" and report["outcomes"]["CLICKED"] == 1,
              report.get("outcomes"))

    def launch_one(name):
        response = api("POST", "/api/campaigns", atoken, json={"scenario_id": scenario_id, "name": name, "recipients": [PLAYER_EMAIL]})
        campaign_id = data_of(response).get("campaign_id")
        api("POST", f"/api/campaigns/{campaign_id}/launch", atoken)
        with app.app_context():
            from app.models.email import EmailCampaignRecipient
            return campaign_id, EmailCampaignRecipient.query.filter_by(campaign_id=campaign_id).first().tracking_token

    SENT.clear()
    c_rep, rep_token = launch_one("E2E reported only")
    api("GET", f"/api/campaigns/report/{rep_token}")
    report = data_of(api("GET", f"/api/campaigns/{c_rep}", atoken))
    check("outcome: report without clicking -> REPORTED, and counts as opened",
          report["recipient_details"][0]["outcome"] == "REPORTED" and report["opened"] == 1, report.get("outcomes"))
    check("result email: a good result gets an email too",
          any((m["Subject"] or "").startswith("Well spotted") for m in SENT), [m["Subject"] for m in SENT])
    check("campaign: once every result is final it shows as COMPLETED", report.get("status") == "COMPLETED", report.get("status"))
    check("campaign: a completed campaign still cannot be deleted", api("DELETE", f"/api/campaigns/{c_rep}", atoken).status_code == 400)

    c_ign, ign_token = launch_one("E2E ignored")
    with app.app_context():
        from datetime import datetime, timedelta
        from app.models.email import EmailCampaignRecipient
        row = EmailCampaignRecipient.query.filter_by(campaign_id=c_ign).first()
        row.sent_at = datetime.utcnow() - timedelta(minutes=app.config["CAMPAIGN_IGNORE_MINUTES"] + 1)
        db.session.commit()
    report = data_of(api("GET", f"/api/campaigns/{c_ign}", atoken))
    check("outcome: no action after the ignore window -> IGNORED",
          report["recipient_details"][0]["outcome"] == "IGNORED" and report["ignored"] == 1
          and sum(report["outcomes"].values()) == report["recipients"], report.get("outcomes"))
    SENT.clear()
    with app.app_context():
        from app.services.campaign_service import CampaignService
        swept = CampaignService.sweep()
        row = EmailCampaignRecipient.query.filter_by(campaign_id=c_ign).first()
        swept_state = (swept, row.settled_outcome, row.notified_at is not None)
    check("sweeper: closes the expired email as IGNORED and emails the result",
          swept_state == (1, "IGNORED", True) and any("didn't fall for" in (m["Subject"] or "") for m in SENT),
          (swept_state, [m["Subject"] for m in SENT]))
    SENT.clear()
    api("GET", f"/api/campaigns/click/{ign_token}")
    with app.app_context():
        row = EmailCampaignRecipient.query.filter_by(campaign_id=c_ign).first()
        closed_state = (row.settled_outcome, row.clicked_at is None)
    check("closed: a click after the window changes nothing and sends no email",
          closed_state == ("IGNORED", True) and not SENT, (closed_state, [m["Subject"] for m in SENT]))
    info = data_of(api("GET", f"/api/campaigns/landing/{ign_token}"))
    check("closed: the landing page shows the recorded result", info.get("outcome") == "IGNORED", info.get("outcome"))

    # ---------- custom emails, genuine or phishing ----------
    r = api("POST", "/api/campaigns", atoken, json={"name": "E2E custom bad", "recipients": [PLAYER_EMAIL],
                                                     "custom": {"sender": "IT <it@example.test>", "subject": "", "message": "Hi"}})
    check("custom: missing subject is refused", r.status_code == 400, body(r).get("message"))
    r = api("POST", "/api/campaigns", atoken, json={"name": "E2E nothing to click", "recipients": [PLAYER_EMAIL],
                                                     "custom": {"sender": "IT <it@example.test>", "subject": "Hello", "message": "No link here"}})
    check("custom: an email with no link and no attachment is refused", r.status_code == 400, body(r).get("message"))

    def launch_custom(name, is_phishing, attachment=None):
        response = api("POST", "/api/campaigns", atoken, json={
            "name": name, "recipients": [PLAYER_EMAIL],
            "custom": {
                "sender": "Standard Bank <alerts@standardbank.co.za>" if not is_phishing else "Standard Bank <alerts@standardbank-verify.co>",
                "subject": "Your monthly statement is ready",
                "message": "Your statement is ready. [View statement](https://www.standardbank.co.za/statements)",
                "is_phishing": is_phishing,
                "cues": ["Look-alike domain, standardbank-verify.co", "Urgent, tone"] if is_phishing else ["ignored for genuine"],
                "attachment": attachment,
            },
        })
        created = data_of(response)
        campaign_id = created.get("campaign_id")
        api("POST", f"/api/campaigns/{campaign_id}/launch", atoken)
        with app.app_context():
            from app.models.email import EmailCampaignRecipient
            return created, campaign_id, EmailCampaignRecipient.query.filter_by(campaign_id=campaign_id).first().tracking_token

    SENT.clear()
    created, c_gen, gen_token = launch_custom("E2E genuine", is_phishing=False)
    check("custom: genuine email saved as a draft without a scenario",
          created.get("is_custom") is True and created.get("is_phishing") is False, created)
    r = api("GET", f"/api/campaigns/click/{gen_token}")
    info = data_of(api("GET", f"/api/campaigns/landing/{gen_token}"))
    check("genuine: clicking lands on the page, flagged genuine, no warning signs",
          r.status_code == 302 and info.get("is_phishing") is False and info.get("cues") == [], info)
    check("genuine: no 'you clicked a phishing link' debrief email",
          not any("phishing" in (m["Subject"] or "").lower() for m in SENT), [m["Subject"] for m in SENT])
    details = data_of(api("GET", f"/api/campaigns/{c_gen}", atoken))
    check("details: shows exactly what was sent",
          details.get("email", {}).get("subject") == "Your monthly statement is ready"
          and "standardbank.co.za" in details["email"].get("sender", ""), details.get("email"))
    check("genuine: clicked -> +10 XP", details["recipient_details"][0]["xp_awarded"] == 10, details["recipient_details"])

    _, c_gen2, gen2_token = launch_custom("E2E genuine reported", is_phishing=False)
    api("GET", f"/api/campaigns/report/{gen2_token}")
    details = data_of(api("GET", f"/api/campaigns/{c_gen2}", atoken))
    check("genuine: reported -> false alarm, -10 XP",
          details["recipient_details"][0]["outcome"] == "REPORTED" and details["recipient_details"][0]["xp_awarded"] == -10,
          details["recipient_details"])

    _, c_phish, _ = launch_custom("E2E custom phishing", is_phishing=True)
    details = data_of(api("GET", f"/api/campaigns/{c_phish}", atoken))
    check("custom phishing: warning signs stored (commas inside a cue dropped)",
          details.get("email", {}).get("cues") == ["Look-alike domain  standardbank-verify.co", "Urgent  tone"],
          details.get("email", {}).get("cues"))

    # Reported first, then clicked: the first action is locked in
    c_flip, flip_token = launch_one("E2E report then click")
    api("GET", f"/api/campaigns/report/{flip_token}")
    api("GET", f"/api/campaigns/click/{flip_token}")
    with app.app_context():
        from app.models.email import EmailCampaignRecipient
        from app.models.simulation import SimulationAttempt
        flip_id = EmailCampaignRecipient.query.filter_by(tracking_token=flip_token).first().campaign_recipient_id
        flip_attempts = SimulationAttempt.query.filter_by(campaign_recipient_id=flip_id).all()
        flip_state = [(a.player_answer, a.correct, a.score) for a in flip_attempts]
    check("locked: report then click -> the first action (report) stands, one decision, +30",
          flip_state == [("REPORT", True, 30)], flip_state)

    # Attachment tile: a dummy link styled as a file
    SENT.clear()
    _, c_att, att_token = launch_custom("E2E attachment", is_phishing=True, attachment="Payslip_Sep_2026.pdf")
    tile_html = SENT[0].get_body(("html",)).get_content() if SENT else ""
    check("attachment: the email shows the file tile, linked to the tracker",
          "1 attachment" in tile_html and "Payslip_Sep_2026.pdf" in tile_html and "kind=attachment" in tile_html)
    api("GET", f"/api/campaigns/click/{att_token}?kind=attachment")
    info = data_of(api("GET", f"/api/campaigns/landing/{att_token}"))
    check("attachment: opening it is recorded as the attachment",
          info.get("outcome") == "CLICKED" and info.get("via_attachment") is True, info)

    # ---------- the player's inbox and XP ----------
    r = api("GET", "/api/campaigns/inbox", ptoken)
    inbox = data_of(r)
    outcomes = sorted((item["is_phishing"], item["outcome"], item["xp"]) for item in inbox.get("items", []))
    expected = sorted([(True, "CLICKED", -20), (True, "REPORTED", 30), (True, "IGNORED", 10),
                       (False, "CLICKED", 10), (False, "REPORTED", -10), (True, "REPORTED", 30), (True, "CLICKED", -20)])
    check("inbox: one notification per final result, with the right XP", outcomes == expected, outcomes)
    check("inbox: all unread at first", inbox.get("unseen") == len(expected), inbox.get("unseen"))
    first = inbox["items"][0]["id"] if inbox.get("items") else 0
    check("inbox: mark one as read", api("POST", f"/api/campaigns/inbox/{first}/seen", ptoken).status_code == 200)
    check("inbox: unread count drops", data_of(api("GET", "/api/campaigns/inbox", ptoken)).get("unseen") == len(expected) - 1)
    check("inbox: a player cannot mark someone else's result", api("POST", f"/api/campaigns/inbox/{first}/seen", atoken).status_code == 404)
    perf_final = data_of(api("GET", "/api/analytics/my-performance", ptoken))
    campaign_total = sum(xp for _, _, xp in expected)
    check("xp: campaign results add to (or take from) the player's XP",
          perf_final.get("xp") == max(perf_after["xp"] + campaign_total, 0),
          (perf_after.get("xp"), campaign_total, perf_final.get("xp")))

    # ---------- campaign results count as decisions everywhere ----------
    check("decisions: every campaign result counts toward total and today's decisions",
          perf_final.get("total_attempts") == perf_after["total_attempts"] + len(expected)
          and perf_final.get("today_attempts") == perf_after["today_attempts"] + len(expected),
          (perf_after.get("total_attempts"), perf_final.get("total_attempts"), perf_final.get("today_attempts")))
    campaign_rows = [a for a in perf_final.get("recent_attempts", []) if a.get("source") == "CAMPAIGN"]
    check("decisions: shown in recent decisions, tagged as campaign", len(campaign_rows) == len(expected), len(campaign_rows))
    check("decisions: the opened attachment counts as a risky file", perf_final.get("malicious_files_opened") == 1,
          perf_final.get("malicious_files_opened"))
    check("decisions: phishing clicks count as risky clicks, genuine clicks don't",
          perf_final.get("phishing_links_clicked") == 1, perf_final.get("phishing_links_clicked"))
    check("decisions: a reported genuine email counts as a false alarm",
          perf_final.get("false_positives", 0) >= 1, perf_final.get("false_positives"))
    listed = data_of(api("GET", "/api/scenarios?simulation_type=EMAIL&search=Your%20monthly%20statement", atoken))
    total_listed = (listed.get("pagination") or {}).get("total")
    check("scenarios: hidden campaign scenarios never appear in Scenario Review",
          total_listed == 0 and "Email campaign" not in listed.get("categories", []), (total_listed, listed.get("categories")))
    dash = data_of(api("GET", "/api/analytics/admin-dashboard", atoken))
    check("admin dashboard: campaign figures",
          dash.get("campaigns_launched", 0) >= 5 and dash.get("campaign_emails_delivered", 0) >= 5
          and 0 <= dash.get("campaign_click_rate", -1) <= 100, {k: v for k, v in dash.items() if "campaign" in k})
    r = api("GET", "/api/scenarios/random/EMAIL", ptoken)
    check("training: hidden campaign scenarios are never served", data_of(r).get("category") != "Email campaign")

    # ---------- delete guards: a scenario/dataset still used by a campaign ----------
    with app.app_context():
        from app.models.datasets import Dataset
        from app.models.scenario import Scenario
        template = db.session.get(Scenario, scenario_id)
        values = {c.name: getattr(template, c.name) for c in Scenario.__table__.columns
                  if c.name not in ("scenario_id", "created_at")}
        values.update(title="E2E guard scenario", status="ACTIVE", correct_answer="REPORT")
        first_dataset = Dataset.query.first()
        values["dataset_id"] = values.get("dataset_id") or (first_dataset.dataset_id if first_dataset else None)
        fresh = Scenario(**values)
        db.session.add(fresh)
        db.session.commit()
        guard_scenario, guard_dataset = fresh.scenario_id, fresh.dataset_id

    r = api("POST", "/api/campaigns", atoken, json={"scenario_id": guard_scenario, "name": "E2E guard", "recipients": [PLAYER_EMAIL]})
    c_guard = data_of(r).get("campaign_id")
    r = api("DELETE", f"/api/scenarios/{guard_scenario}", atoken)
    check("guard: scenario used by a campaign -> clear error, not a crash",
          r.status_code == 400 and "used by an email campaign" in body(r).get("message", ""), f"{r.status_code} {body(r).get('message')}")
    if guard_dataset:
        r = api("DELETE", f"/api/datasets/{guard_dataset}", atoken)
        check("guard: dataset whose scenario a campaign uses -> clear error, not a crash",
              r.status_code != 500 and "Email campaigns use this dataset" in body(r).get("message", ""), f"{r.status_code} {body(r).get('message')}")
    api("DELETE", f"/api/campaigns/{c_guard}", atoken)
    r = api("DELETE", f"/api/scenarios/{guard_scenario}", atoken)
    check("guard: once the campaign is gone, the scenario deletes", r.status_code == 200, f"{r.status_code} {body(r).get('message')}")

    # ---------- deleting an admin who created a campaign ----------
    a2token, _ = login(ADMIN2_EMAIL)
    r = api("POST", "/api/campaigns", a2token, json={"scenario_id": scenario_id, "name": "E2E admin2", "recipients": [PLAYER_EMAIL]})
    c_admin2 = data_of(r).get("campaign_id")
    r = api("DELETE", f"/api/analytics/users/{ADMIN2_ID}", atoken)
    check("users: delete an admin who created a campaign", r.status_code == 200, f"{r.status_code} {body(r).get('message')}")
    with app.app_context():
        from app.models.email import EmailCampaign
        owner = db.session.get(EmailCampaign, c_admin2).created_by_user_id
    check("users: their campaign passes to the deleting admin", owner == ADMIN_ID, owner)
    check("users: an admin cannot delete themselves", api("DELETE", f"/api/analytics/users/{ADMIN_ID}", atoken).status_code == 400)

    # ---------- dataset upload pipeline (scratch uploads folder) ----------
    csv_bytes = (
        b"TEXT,LABEL\n"
        b"Your parcel is on hold. Pay R25 at http://pudo-track-parcel.example/pay to release it today,smishing\n"
        b"Hi, the team meeting moved to 3pm in room 4. See you there,ham\n"
    )
    r = api("POST", "/api/datasets/upload", atoken, content_type="multipart/form-data",
            data={"file": (io.BytesIO(csv_bytes), "e2e.csv"), "dataset_type": "SMS"})
    uploaded = data_of(r)
    new_dataset = uploaded.get("dataset_id") or (uploaded.get("dataset") or {}).get("dataset_id")
    check("datasets: upload a CSV", r.status_code == 201 and new_dataset, f"{r.status_code} {body(r).get('message')} {list(uploaded)}")
    if new_dataset:
        drafts = items(data_of(api("GET", f"/api/scenarios?dataset_id={new_dataset}", atoken)), "scenarios", "items")
        check("datasets: uploaded rows become drafts awaiting review, not live scenarios",
              drafts and all(scenario.get("status") == "DRAFT" for scenario in drafts),
              [scenario.get("status") for scenario in drafts])
        listing = data_of(api("GET", "/api/scenarios?simulation_type=SMS&status=", atoken))
        groups = {str(group["dataset_id"]): group for group in listing.get("groups", [])}
        check("datasets: scenario review groups scenarios under their dataset, plus one group for the rest",
              str(new_dataset) in groups and groups[str(new_dataset)]["name"] == "e2e.csv"
              and groups[str(new_dataset)]["by_status"]["DRAFT"] == len(drafts) and "none" in groups,
              {key: (group["name"], group["count"]) for key, group in groups.items()})
        only_hand_made = items(data_of(api("GET", "/api/scenarios?simulation_type=SMS&status=&dataset_id=none", atoken)),
                               "scenarios", "items")
        check("datasets: the 'none' group lists only scenarios that are not from a dataset",
              only_hand_made and all(row["dataset_id"] is None for row in only_hand_made))
        r = api("POST", f"/api/datasets/{new_dataset}/reprocess", atoken)
        check("datasets: reprocess", r.status_code == 200, f"{r.status_code} {body(r).get('message')}")
        r = api("DELETE", f"/api/datasets/{new_dataset}", atoken)
        check("datasets: delete (with its scenarios)", r.status_code == 200, f"{r.status_code} {body(r).get('message')}")

    unlabelled = (
        b"TEXT,LABEL\n"
        b"Your parcel is on hold. Pay R25 at http://pudo-track-parcel.example/pay to release it today,\n"
        b"Hi, the team meeting moved to 3pm in room 4. See you there,\n"
    )
    r = api("POST", "/api/datasets/upload", atoken, content_type="multipart/form-data",
            data={"file": (io.BytesIO(unlabelled), "e2e_unlabelled.csv"), "dataset_type": "SMS"})
    report = data_of(r).get("quality_report") or {}
    check("datasets: a file with no labelled rows is rejected by the quality check",
          r.status_code == 400 and report.get("quality_ok") is False and report.get("usable_labelled") == 0,
          f"{r.status_code} {body(r).get('message')}")

    # ---------- review lifecycle: only ACTIVE scenarios reach a learner ----------
    REVIEW_CATEGORY = "E2E Review Check"   # its own category, so the player can ask for it directly
    full_checklist = {key: True for key in (
        "label_correct", "clues_accurate", "category_difficulty_fit", "text_complete", "no_personal_data", "links_safe",
    )}
    r = api("POST", "/api/scenarios", atoken, json={
        "title": "E2E review check", "simulation_type": "SMS", "category": REVIEW_CATEGORY, "difficulty": "Easy",
        "sender": "+27 82 000 0000", "correct_answer": "REPORT", "phishing_cues": ["Suspicious link", "Urgency"],
        "message": "Your parcel is waiting. Confirm delivery today at http://parcel-check.example or it is returned.",
    })
    review_id = data_of(r).get("scenario_id")

    def review(action, checklist=None):
        return api("POST", f"/api/scenarios/{review_id}/review", atoken, json={"action": action, "checklist": checklist})

    def review_status():
        return data_of(api("GET", f"/api/scenarios/{review_id}", atoken)).get("status")

    def served_to_player():
        """The player's request for the test category returns the test scenario."""
        served = data_of(api("GET", f"/api/scenarios/random/SMS?category={REVIEW_CATEGORY}", ptoken))
        return served.get("scenario_id") == review_id, served

    check("review: a new scenario starts as a draft and is not served",
          r.status_code == 201 and review_status() == "DRAFT" and not served_to_player()[0], f"{r.status_code} {review_status()}")
    check("review: a draft cannot go straight to active", review("activate").status_code == 400)
    partial = {**full_checklist, "links_safe": False}
    check("review: approving needs every one of the six checklist items",
          review("approve", partial).status_code == 400 and review_status() == "DRAFT", review_status())
    r = review("approve", full_checklist)
    check("review: approved, but still not served until it is activated",
          r.status_code == 200 and review_status() == "APPROVED" and not served_to_player()[0], review_status())
    detail = data_of(api("GET", f"/api/scenarios/{review_id}", atoken))
    check("review: approving records the approval time",
          bool(detail.get("approved_at")) and detail.get("approved_at", "").endswith("Z"), detail.get("approved_at"))
    recent = items(data_of(api("GET", "/api/scenarios?simulation_type=SMS&when=approved_today&sort=approved&order=desc", atoken)),
                   "scenarios", "items")
    check("review: 'Approved today', newest first, lists it at the top",
          recent and recent[0]["scenario_id"] == review_id, [row.get("scenario_id") for row in recent[:3]])
    r = review("activate")
    served, scenario = served_to_player()
    check("review: activated -> served to the player, without the answer",
          r.status_code == 200 and served and not any(key in scenario for key in ("correct_answer", "phishing_cues")),
          f"{r.status_code} {review_status()} {sorted(scenario)}")
    r = api("PUT", f"/api/scenarios/{review_id}", atoken, json={
        "title": "E2E review check", "simulation_type": "SMS", "category": REVIEW_CATEGORY, "difficulty": "Easy",
        "sender": "+27 82 000 0000", "correct_answer": "REPORT", "phishing_cues": ["Suspicious link", "Urgency"],
        "message": "Your parcel is waiting. Confirm delivery within 2 hours at http://parcel-check.example.",
    })
    check("review: editing a live scenario sends it back to draft and off the learner's queue",
          r.status_code == 200 and review_status() == "DRAFT" and not served_to_player()[0], review_status())
    detail = data_of(api("GET", f"/api/scenarios/{review_id}", atoken))
    changed = items(data_of(api("GET", "/api/scenarios?simulation_type=SMS&status=DRAFT&when=updated_today", atoken)),
                    "scenarios", "items")
    check("review: the edit clears the approval time and shows under 'Changed today'",
          detail.get("approved_at") is None and any(row["scenario_id"] == review_id for row in changed), detail.get("approved_at"))
    check("review: reject a draft, then reopen it as a draft",
          review("reject").status_code == 200 and review_status() == "REJECTED"
          and review("reopen").status_code == 200 and review_status() == "DRAFT", review_status())
    review("approve", full_checklist)
    review("activate")
    check("review: archiving takes a live scenario off the learner's queue",
          review("archive").status_code == 200 and review_status() == "ARCHIVED" and not served_to_player()[0], review_status())
    check("review: the unused test scenario deletes", api("DELETE", f"/api/scenarios/{review_id}", atoken).status_code == 200)

    # ================= SECURITY, FILTERS AND SORTING =================
    r = api("GET", "/api/does-not-exist")
    check("security: unknown API path -> JSON 404", r.status_code == 404 and body(r).get("success") is False, r.status_code)
    r = api("GET", "/api/auth/me", ptoken)
    check("security: hardening headers on API replies",
          r.headers.get("X-Content-Type-Options") == "nosniff" and r.headers.get("X-Frame-Options") == "DENY"
          and r.headers.get("Cache-Control") == "no-store", dict(r.headers))
    r = api("POST", "/api/auth/register", json={
        "full_name": "Weak Password", "email": "weak@example.test", "password": "password",
        "confirm_password": "password", "age": 22, "occupation": "STUDENT", "it_background": False,
    })
    check("security: weak password refused at sign-up",
          r.status_code == 400 and "letter and one number" in body(r).get("message", ""), body(r))
    r = api("PUT", "/api/auth/change-password", ptoken, json={"current_password": PASSWORD, "new_password": "short1", "confirm_password": "short1"})
    check("security: weak new password refused on change", r.status_code == 400, body(r))
    r = api("PUT", "/api/auth/change-password", ptoken, json={})
    check("security: missing fields -> 400, not a crash", r.status_code == 400, f"{r.status_code} {body(r)}")
    r = api("POST", "/api/auth/login", data="not json", content_type="text/plain")
    check("security: login without JSON -> 4xx, not 500", r.status_code in (400, 401), r.status_code)
    r = api("POST", "/api/auth/register", json={"full_name": "X", "email": "x@example.test", "password": "Abcdef12",
                                                "confirm_password": "Abcdef12", "age": "old", "occupation": "PILOT", "it_background": True})
    check("security: bad age/occupation -> 400, not 500", r.status_code == 400, f"{r.status_code} {body(r)}")

    full = data_of(api("GET", "/api/analytics/my-performance", ptoken))
    standing = (full.get("skill") or {}).get("standing") or {}
    badges = full.get("badges", [])
    check("badges: 15 badges in streak, milestone and skill groups, each with how to earn it",
          len(badges) == 15 and {b["group"] for b in badges} == {"streak", "milestone", "skill"} and all(b.get("how") for b in badges),
          [(b.get("key"), b.get("group")) for b in badges])
    check("streaks: current and best streak reported", isinstance(full.get("longest_streak"), int)
          and full["longest_streak"] >= full.get("daily_streak", -1), (full.get("daily_streak"), full.get("longest_streak")))
    check("stats strip: lifetime simulations ignore the filters",
          data_of(api("GET", "/api/analytics/my-performance?range=7d&channel=SMS", ptoken)).get("completed_simulations") == full.get("total_attempts"))
    r = api("GET", "/api/analytics/my-activity", ptoken)
    activity = data_of(r)
    check("activity: this year's calendar with a total that adds up",
          r.status_code == 200 and activity.get("total") == sum(activity.get("days", {}).values())
          and activity.get("active_days") == len(activity.get("days", {})), activity)
    r = api("GET", "/api/analytics/my-activity?year=1999", ptoken)
    check("activity: years before the account existed fall back to the first year",
          r.status_code == 200 and data_of(r).get("year") == data_of(r).get("first_year"), data_of(r).get("year"))
    check("activity: admins have no player calendar", api("GET", "/api/analytics/my-activity", atoken).status_code == 404)
    check("standing: player sees only their own position and the player count",
          set(standing) == {"position", "out_of", "top_percent", "rated"} and standing.get("out_of", 0) > 0
          and (standing["position"] is None or 1 <= standing["position"] <= standing["out_of"]), standing)
    with app.app_context():
        from app.models.authentication import Player
        all_players = Player.query.count()
    check(f"standing: counts every player ({all_players}), not only rated ones",
          standing.get("out_of") == all_players and standing.get("position") is not None, standing)
    # The second test account has made no decisions, so it is not rated and must sit below every rated player
    unrated = data_of(api("GET", "/api/analytics/my-performance", ktoken)).get("skill", {}).get("standing", {})
    with app.app_context():
        from app.models.simulation import SimulationAttempt
        from collections import Counter
        rated_players = sum(count >= 10 for count in Counter(a.player_id for a in SimulationAttempt.query.all()).values())
    check("standing: a player not yet rated is counted, below every rated player",
          unrated.get("rated") is False and unrated.get("out_of") == all_players
          and unrated.get("position", 0) > rated_players, {**unrated, "rated_players": rated_players})
    narrowed = data_of(api("GET", "/api/analytics/my-performance?range=7d&channel=SMS", ptoken))
    check("filters: player stats narrow to the chosen channel and dates",
          narrowed.get("total_attempts", -1) <= full.get("total_attempts", 0)
          and all(row["type"] == "SMS" for row in narrowed.get("recent_attempts", []))
          and narrowed.get("xp") == full.get("xp"),
          f"{narrowed.get('total_attempts')} vs {full.get('total_attempts')}, xp {narrowed.get('xp')} vs {full.get('xp')}")
    r = api("GET", "/api/analytics/admin?range=30d&group=student&difficulty=hard&channel=bogus&start=nope", atoken)
    check("filters: admin analytics takes filters and ignores bad values", r.status_code == 200 and "category_options" in data_of(r), r.status_code)
    everything = data_of(api("GET", "/api/analytics/admin?range=all", atoken))
    email_only = data_of(api("GET", "/api/analytics/admin?range=all&channel=EMAIL", atoken))
    by_type = {row["type"]: row["attempts"] for row in everything.get("by_type", [])}
    check("filters: admin channel filter keeps only that channel",
          email_only.get("total_simulations") == by_type.get("EMAIL") and email_only["by_type"][1]["attempts"] == 0,
          f"{email_only.get('total_simulations')} vs {by_type}")
    check("filters: a player cannot open the admin analytics", api("GET", "/api/analytics/admin", ptoken).status_code == 403)

    rows = items(data_of(api("GET", "/api/scenarios?sort=uses&order=desc", atoken)), "scenarios")
    uses = [row["uses"] for row in rows]
    check("sorting: scenarios sort by a column on the server", bool(uses) and uses == sorted(uses, reverse=True), uses[:10])
    rows = items(data_of(api("GET", "/api/scenarios?sort=title&order=asc", atoken)), "scenarios")
    titles = [row["title"].lower() for row in rows]
    check("sorting: ascending by title", titles == sorted(titles), titles[:5])

    for _ in range(5):
        api("POST", "/api/auth/login", json={"email": PLAYER_EMAIL, "password": "wrong-password-1"})
    r = api("POST", "/api/auth/login", json={"email": PLAYER_EMAIL, "password": PASSWORD})
    check("security: 5 wrong passwords lock the account for a while",
          r.status_code == 401 and "Too many failed attempts" in body(r).get("message", ""), body(r))
    check("security: the lock does not end a session already signed in", api("GET", "/api/auth/me", ptoken).status_code == 200)

    SENT.clear()
    r = api("POST", "/api/auth/forgot-password", json={"email": PLAYER_EMAIL.upper()})
    check("reset: request a link (email matched in any case)", r.status_code == 200 and len(SENT) == 1, f"{r.status_code} sent={len(SENT)}")
    found = re.search(r"reset-password\?token=([\w-]+)", SENT[-1].get_body(("plain",)).get_content()) if SENT else None
    reset_token = found.group(1) if found else ""
    with app.app_context():
        from app.models.authentication import PasswordResetToken
        stored = PasswordResetToken.query.order_by(PasswordResetToken.reset_token_id.desc()).first()
        stored_token = stored.token if stored else ""
    check("reset: the database keeps only a hash of the token",
          bool(reset_token) and stored_token != reset_token and len(stored_token) == 64, stored_token[:12])
    r = api("POST", "/api/auth/forgot-password", json={"email": "nobody@example.test"})
    check("reset: unknown email gets the same reply", r.status_code == 200 and "If that account exists" in body(r).get("message", ""), body(r))
    r = api("POST", "/api/auth/reset-password", json={"token": reset_token, "new_password": "weak", "confirm_password": "weak"})
    check("reset: weak new password refused", r.status_code == 400, body(r))
    new_password = "Fresh#Start2026"
    r = api("POST", "/api/auth/reset-password", json={"token": reset_token, "new_password": new_password, "confirm_password": new_password})
    check("reset: set a new password from the link", r.status_code == 200, body(r))
    r = api("POST", "/api/auth/reset-password", json={"token": reset_token, "new_password": new_password, "confirm_password": new_password})
    check("reset: the link only works once", r.status_code == 400, body(r))
    check("reset: every old session is signed out", api("GET", "/api/auth/me", ptoken).status_code == 401)
    r = api("POST", "/api/auth/login", json={"email": PLAYER_EMAIL, "password": new_password})
    check("reset: sign in with the new password (lock cleared)", r.status_code == 200, body(r))
    ptoken = data_of(r).get("access_token")

    check("security: log out", api("POST", "/api/auth/logout", ptoken).status_code == 200)
    check("security: a logged-out token is rejected straight away", api("GET", "/api/auth/me", ptoken).status_code == 401)

    # ---------- delete the player last (removes attempts + baseline too) ----------
    if test_user:
        r = api("DELETE", f"/api/analytics/users/{test_user['user_id']}", atoken)
        check("users: delete a player with attempts and a baseline", r.status_code == 200, f"{r.status_code} {body(r).get('message')}")
    check("auth: log out", api("POST", "/api/auth/logout", atoken).status_code == 200)

except Exception:
    traceback.print_exc()
    RESULTS.append(("FAIL", "script crashed", "see traceback above"))
finally:
    if app is not None:
        from app.extensions import db
        with app.app_context():
            db.session.remove()
            db.engine.dispose()
    drop_test_db()
    maintenance.dispose()
    shutil.rmtree(SCRATCH, ignore_errors=True)

if TRACE and perf_after:
    print("\nTrace of the test learner through CATCH (values from this run):")
    print(f"  C Check    baseline {baseline_summary.get('overallScore')}% -> starts on {baseline_summary.get('startingDifficulty')}")
    print("  A Approve  only ACTIVE (approved) scenarios were served; none carried the answer")
    for number, (channel, category, difficulty, result) in enumerate(TRACE, 1):
        feedback = result.get("feedback") or {}
        print(f"  T/C #{number}    {channel:<5} {category or '-':<15} {difficulty or '-':<6} -> "
              f"{'correct' if result.get('correct') else 'wrong':<7} clues found {len(feedback.get('clues_spotted', []))}, "
              f"missed {len(feedback.get('clues_missed', []))}, wrong picks {len(feedback.get('wrong_picks', []))}, "
              f"{result.get('xp_earned')} XP")
    skill = perf_after.get("skill", {})
    earned = [badge["name"] for badge in perf_after.get("badges", []) if badge.get("earned")]
    print(f"  H Help     {perf_after.get('total_attempts')} decisions, {perf_after.get('overall_accuracy')}% accuracy, "
          f"level {perf_after.get('level')}, {perf_after.get('xp')} XP, rank {skill.get('tier')} "
          f"({skill.get('attempts_until_rated')} more to be rated), next difficulty {perf_after.get('difficulty')}, "
          f"badges {earned}")

width = max(len(name) for _, name, _ in RESULTS)
for status, name, detail in RESULTS:
    print(f"{status}  {name.ljust(width)}  {detail}")
failed = sum(status == "FAIL" for status, _, _ in RESULTS)
print(f"\n{len(RESULTS) - failed} passed, {failed} failed. Test database {TEST_DB} dropped.")
sys.exit(1 if failed else 0)
