# Loads realistic demo data so a fresh database looks and behaves like a real deployment.
#
#   .venv\Scripts\python.exe reset_database.py --confirm-reset
#   .venv\Scripts\python.exe seed_demo.py
#
# To update an existing database without wiping it (new demo emails, consent, question bank):
#   .venv\Scripts\python.exe seed_demo.py --refresh-players
#
# It creates an admin, a cohort of test players, the baseline questions and assessments, and about four
# months of practice. Each player has a habit (from never to daily), so trends, streaks, badges and the
# activity calendar look real. Only when OWNER_EMAIL is set does it also create a player for your own
# address, with a couple of finished email campaigns.
#
# Scenarios come from two public dataset files, one email and one SMS (DEMO_EMAIL_DATASET and
# DEMO_SMS_DATASET in DEMO_DATASET_DIR, by default backend/uploads/datasets), plus the admin's own custom
# scenarios (backend/demo/admin_custom_scenarios.json, see backend/demo/README.md): South African phishing and
# genuine messages written by a security specialist, with real-looking senders, links and attachments. Both
# dataset files are imported exactly as the Datasets page does it, so the quality check, cleaning and draft
# scenarios are the real ones. An admin review is then replayed per channel: drafts that pass every automatic
# check are approved and switched on, a few are left approved, a few broken ones are rejected, and the rest
# wait in review. The custom scenarios are added live with no dataset, as the "Create scenario" form adds them
# (unit tests check that each one passes every automatic check), and they make up most of what players see:
# with them, only a few balanced pairs per category go live from the datasets, whose messages are plainer.
# DEMO_AUTHOR_WRITTEN=off leaves the custom scenarios out and switches on more dataset drafts instead, for
# figures that come from the public datasets alone (as in the paper). Players only ever practise on live
# scenarios, and each decision is chosen and scored by the app's own rules (adaptive difficulty and category,
# clue checking, XP with the level multiplier).
#
# Test players get Gmail plus-aliases of DEMO_EMAIL (you+lerato.mokoena@gmail.com), which all arrive in
# your own inbox, so campaigns can be demonstrated end to end. Without DEMO_EMAIL they get clearly fake
# @phishsimulator.test addresses. Most test players have agreed to campaign emails; some have not.

import json
import os
import random
import re
import shutil
import sys
from datetime import datetime, time, timedelta
from pathlib import Path
from uuid import uuid4

from werkzeug.utils import secure_filename

from app import create_app
from app.adaptive.adaptive_engine import AdaptiveEngine
from app.analytics import FeedbackGenerator
from app.datasets.scenario_parser import ScenarioParser
from app.datasets.scenario_realism import enrich_scenario
from app.extensions import db, bcrypt
from app.enums.occupation import Occupation
from app.models.analytics import FeedbackReport, PerformanceTracker
from app.models.authentication import PasswordResetToken, Player, User, UserProfile, UserSession
from app.models.baseline import BaselineAssessment, BaselineQuestion, BaselineResponse, BaselineTemplate
from app.models.datasets import Dataset, DatasetRecord
from app.models.email import EmailCampaign, EmailCampaignRecipient
from app.models.scenario import Scenario
from app.models.simulation import SimulationAttempt, SimulationSession, UserAction
from app.services import dataset_service
from app.services.baseline_service import BaselineService
from app.services.dataset_service import DatasetService
from app.services.progress_service import ProgressService
from app.services.scenario_service import ScenarioService
from app.services.simulation_service import SimulationService
from app.utils.clues import TRUST_SIGNALS, WARNING_SIGNS, clue_options, evaluate_justification, real_clues, round_key
from app.utils.emails import shown_email
from app.utils.links import find_urls

RANDOM_SEED = 2026
# About four months of history, so streaks, badges and the yearly activity calendar have data
DAYS = 120

# How often a kind of player practises: (name, chance of practising on any day, decisions on an active day).
# The weights make most players occasional or weekly, with a few daily learners who build long streaks.
HABITS = [
    ("never", 0.0, (0, 0)),
    ("occasional", 0.12, (1, 3)),
    ("weekly", 0.3, (1, 4)),
    ("regular", 0.6, (2, 5)),
    ("daily", 0.9, (2, 6)),
    ("dedicated", 0.97, (3, 6)),
]
HABIT_WEIGHTS = [2, 3, 3, 2, 1, 1]

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@phishsimulator.com")
# The defaults are printed in the README, so they suit a demo on this computer only
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin#2026")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "Player#2026")
# Only create an owner player when OWNER_EMAIL is set explicitly. Left unset, you register your own
# account from scratch; campaigns still reach it because it is on CAMPAIGN_ALLOWED_RECIPIENTS.
OWNER_EMAIL = (os.getenv("OWNER_EMAIL") or "").strip().lower()
# Your own Gmail address: test players become plus-aliases of it. Put "you+*@gmail.com" on
# CAMPAIGN_ALLOWED_RECIPIENTS too, or the alias addresses cannot be picked for campaigns.
DEMO_EMAIL = (os.getenv("DEMO_EMAIL") or "").strip().lower()
FAKE_DOMAIN = "phishsimulator.test"
# Students' second baseline assessment was switched on this many days ago, and about this share took it
SECOND_BASELINE_DAYS = 21
SECOND_BASELINE_SHARE = 0.5
# Every fourth test player has not agreed to campaign emails (30 of 40 have)
NO_CONSENT_EVERY = 4

# The two dataset files every demo scenario comes from (paths inside DEMO_DATASET_DIR). In Docker,
# DEMO_DATASET_DIR is the read-only folder docker-compose mounts from DEMO_DATASETS_HOST_DIR.
DEMO_DATASET_DIR = Path(os.getenv("DEMO_DATASET_DIR") or Path(__file__).parent / "uploads" / "datasets")
DEMO_DATASETS = (
    ("EMAIL", os.getenv("DEMO_EMAIL_DATASET") or "email/phishing_legit_dataset_KD_10000.csv"),
    ("SMS", os.getenv("DEMO_SMS_DATASET") or "sms/Combined-Labeled-Dataset.csv"),
)
# The admin's own custom scenarios, kept in the repository (backend/demo) and left out with
# DEMO_AUTHOR_WRITTEN=off: South African phishing and genuine messages, email and SMS
ADMIN_CUSTOM_SCENARIOS = Path(__file__).parent / "demo" / "admin_custom_scenarios.json"
INCLUDE_CUSTOM = (os.getenv("DEMO_AUTHOR_WRITTEN") or "on").strip().lower() != "off"
# The datasets were uploaded and reviewed just before the first players joined
UPLOADED_DAYS_AGO = DAYS + 6
# The replayed admin review, per channel (all its datasets together) and category: where a category has both
# answers, the same number of
# phishing and genuine drafts are switched on (at most this many of each). Categories with only one answer
# get at least a few, then are topped up in turn until the channel has as many phishing as genuine live
# (Scenario Review flags them, and they are not offered for focused practice). A few more are approved but
# not yet live, and a few broken ones are rejected. Everything else stays a draft in Scenario Review.
ACTIVE_PER_CATEGORY = 40
ONE_SIDED_PER_CATEGORY = 4
# With the admin's custom scenarios loaded, they are most of what players see: per category, only this many
# phishing and this many genuine dataset drafts go live, and only where the category has both (no one-sided
# categories), so every category stays balanced
ACTIVE_PER_CATEGORY_WITH_CUSTOM = 1
APPROVED_PER_ANSWER = 2
REJECTED_PER_CHANNEL = 10

# How the simulated players behave inside a decision
SMS_SHARE = 0.4                 # share of decisions made in SMS training (the rest is email)
MISTAKE_REVIEW_SHARE = 0.1      # chance a decision is a "review my mistakes" retake, when there are mistakes
TRAP_SHARE = 0.5                # a player who trusts a message with a link or file opens it this often
GENUINE_CLICK_SHARE = 0.25      # ...and opens the link or file of a genuine message they trust this often
WRONG_PICK_SHARE = 0.15         # chance a correct answer also ticks one clue that is not in the message

# Realistic South-African cohort: (full name, age, occupation, has IT background)
PLAYERS = [
    ("Lerato Mokoena", 21, Occupation.STUDENT, False), ("Johan van der Merwe", 44, Occupation.EMPLOYEE, True),
    ("Ayanda Khumalo", 29, Occupation.EMPLOYEE, False), ("Sipho Ndlovu", 37, Occupation.OTHER, False),
    ("Thabo Molefe", 33, Occupation.EMPLOYEE, True), ("Megan Pillay", 24, Occupation.STUDENT, False),
    ("Fatima Govender", 41, Occupation.OTHER, False), ("Lebogang Sithole", 28, Occupation.EMPLOYEE, False),
    ("Mia Venter", 22, Occupation.STUDENT, False), ("Aisha Reddy", 35, Occupation.OTHER, True),
    ("Shaun Isaacs", 26, Occupation.STUDENT, True), ("Liam Botha", 19, Occupation.STUDENT, False),
    ("Yusuf Patel", 48, Occupation.EMPLOYEE, False), ("Karabo Nkosi", 31, Occupation.EMPLOYEE, True),
    ("Chloe Naidoo", 27, Occupation.OTHER, False), ("Carla van Wyk", 23, Occupation.STUDENT, False),
    ("Yusuf Moosa", 20, Occupation.STUDENT, False), ("Nadia Isaacs", 39, Occupation.EMPLOYEE, False),
    ("Refilwe Dlamini", 34, Occupation.EMPLOYEE, True), ("Tshepo Molefe", 45, Occupation.OTHER, False),
    ("Thandi Mthembu", 25, Occupation.STUDENT, False), ("Karabo Tshabalala", 22, Occupation.STUDENT, False),
    ("Daniel Botha", 42, Occupation.EMPLOYEE, True), ("Mpho Masilela", 30, Occupation.EMPLOYEE, False),
    ("Lee-Ann Davids", 38, Occupation.OTHER, False), ("Kagiso Dlamini", 21, Occupation.STUDENT, False),
    ("Lebogang Mashaba", 27, Occupation.EMPLOYEE, True), ("Nompumelelo Sithole", 36, Occupation.EMPLOYEE, False),
    ("Thabo Khumalo", 40, Occupation.OTHER, False), ("Mpho Mahlangu", 24, Occupation.STUDENT, False),
    ("Tshepo Baloyi", 29, Occupation.EMPLOYEE, True), ("Zanele Mashaba", 23, Occupation.STUDENT, False),
    ("Kagiso Khumalo", 33, Occupation.EMPLOYEE, False), ("Busisiwe Shabalala", 46, Occupation.EMPLOYEE, False),
    ("Nhlanhla Ndlovu", 26, Occupation.STUDENT, True), ("Lwazi Mahlangu", 22, Occupation.STUDENT, False),
    ("Pieter Nel", 50, Occupation.EMPLOYEE, False), ("Lebogang Zulu", 31, Occupation.EMPLOYEE, True),
    ("Zanele Mabaso", 28, Occupation.OTHER, False), ("Refilwe Baloyi", 24, Occupation.STUDENT, False),
]

BASELINE_ANSWERS = [
    "I would check the sender's full address and not click any link until I confirm it is genuine.",
    "The urgent deadline and the request for my password are clear warning signs of phishing.",
    "I would hover over the link to see the real destination before deciding to trust it.",
    "I would report it to IT rather than clicking, because the sender domain looks wrong.",
    "A real bank never asks for your PIN by email, so I would treat this as a scam and delete it.",
]


def demo_email(name):
    """A test player's address: a plus-alias of DEMO_EMAIL, or a fake address when it is not set."""
    local = name.lower().replace(" ", ".").replace("-", "")
    if DEMO_EMAIL and "@" in DEMO_EMAIL:
        mailbox, domain = DEMO_EMAIL.split("@", 1)
        return f"{mailbox.split('+', 1)[0]}+{local}@{domain}"
    return f"{local}@{FAKE_DOMAIN}"


def demo_consent(index):
    """Whether test player number `index` has agreed to campaign emails."""
    return index % NO_CONSENT_EVERY != NO_CONSENT_EVERY - 1


def demo_dataset_files():
    """The email and SMS dataset files the demo scenarios come from. Checked (with the custom scenarios file,
    unless DEMO_AUTHOR_WRITTEN=off) before anything is wiped, so a missing file leaves the database as it was."""
    files = [(channel, DEMO_DATASET_DIR / name) for channel, name in DEMO_DATASETS]
    needed = [path for _, path in files] + ([ADMIN_CUSTOM_SCENARIOS] if INCLUDE_CUSTOM else [])
    missing = [str(path) for path in needed if not path.is_file()]
    if missing:
        raise SystemExit(
            "Demo data not loaded: these dataset files are missing:\n  " + "\n  ".join(missing)
            + "\nPut them there, or point DEMO_DATASET_DIR, DEMO_EMAIL_DATASET and DEMO_SMS_DATASET at the files."
        )
    return files


def wipe_dynamic_data():
    """Clear everything the seed creates, so it can be re-run without a full reset. Uploaded dataset files
    of the datasets being removed are deleted too, as deleting a dataset in the app does."""
    stored_files = [name for (name,) in db.session.query(Dataset.filename).all()]
    for model in (FeedbackReport, UserAction, SimulationAttempt, SimulationSession, BaselineResponse,
                  BaselineAssessment, PerformanceTracker, EmailCampaignRecipient, EmailCampaign, UserProfile,
                  Player, UserSession, PasswordResetToken, BaselineQuestion, BaselineTemplate, Scenario,
                  DatasetRecord, Dataset):
        db.session.query(model).delete()
    db.session.query(User).delete()
    db.session.commit()
    for name in stored_files:
        path = Path(dataset_service.UPLOAD_FOLDER) / name
        if path.is_file():
            path.unlink()


def import_demo_dataset(channel, source, uploaded_at):
    """Upload one dataset file exactly as the Datasets page does: store a copy in the upload folder, run the
    quality check and turn every labelled row into a draft scenario. Then date it to when it was uploaded."""
    name = secure_filename(source.name)
    os.makedirs(dataset_service.UPLOAD_FOLDER, exist_ok=True)
    stored = Path(dataset_service.UPLOAD_FOLDER) / f"{uuid4().hex}_{name}"
    shutil.copyfile(source, stored)
    ok, message, result = DatasetService.import_file(str(stored), name, channel)
    if not ok:
        raise SystemExit(f"Demo data not loaded: the {channel} dataset {source} was rejected. {message}")

    dataset = db.session.get(Dataset, result["dataset_id"])
    dataset.uploaded_at = uploaded_at
    Scenario.query.filter_by(dataset_id=dataset.dataset_id).update(
        {Scenario.created_at: uploaded_at, Scenario.updated_at: uploaded_at}, synchronize_session=False,
    )
    db.session.commit()
    return dataset


def _core_text(message):
    """A message without its greeting and sign-off, to spot near-copies: generated datasets repeat one body
    with only the name above or below it changed."""
    lines = [line.strip() for line in (message or "").strip().split("\n") if line.strip()]
    if len(lines) > 2 and len(lines[-1].split()) <= 4:
        lines = lines[:-2] if len(lines[-2].split()) <= 3 else lines[:-1]
    text = ScenarioParser.GREETING.sub("", " ".join(lines))
    return re.sub(r"\W+", " ", text).strip().lower()


def _varied(scenarios, rng):
    """Scenarios in the order a careful reviewer would pick them: taking turns between categories and
    difficulties, and skipping near-copies of ones already picked (a repeated subject only as a last resort)."""
    buckets = {}
    for scenario in scenarios:
        buckets.setdefault((scenario.category, scenario.difficulty), []).append(scenario)
    queues = []
    for key in sorted(buckets):
        rng.shuffle(buckets[key])
        queues.append(buckets[key])
    order = []
    while any(queues):
        for queue in queues:
            if queue:
                order.append(queue.pop())

    chosen, chosen_ids, texts, subjects = [], set(), set(), set()
    for allow_repeated_subject in (False, True):
        for scenario in order:
            text = _core_text(scenario.message)
            if scenario.scenario_id in chosen_ids or text in texts:
                continue
            if not allow_repeated_subject and scenario.subject and scenario.subject in subjects:
                continue
            chosen.append(scenario)
            chosen_ids.add(scenario.scenario_id)
            texts.add(text)
            subjects.add(scenario.subject)
    return chosen


def seed_admin_custom_scenarios(reviewed_at):
    """The admin's own custom scenarios (backend/demo/admin_custom_scenarios.json): common South African
    phishing and smishing with genuine messages of the same kind, the same number of each in every category.
    Added as the Scenario Review "Create scenario" form adds them (no dataset, so they show in the
    "admin_custom_scenarios" group), then approved and switched on. The category is the admin's; warning
    signs, difficulty and realism follow the same rules as dataset imports."""
    items = json.loads(ADMIN_CUSTOM_SCENARIOS.read_text(encoding="utf-8"))
    for index, item in enumerate(items):
        is_phishing = item["answer"] == "phishing"
        fields = ScenarioParser.derive_fields(
            item["channel"], item.get("sender", ""), item.get("subject", ""), item["message"], is_phishing,
        )
        scenario = Scenario(
            title=item["title"], simulation_type=item["channel"], category=item["category"],
            difficulty=fields["difficulty"], sender=fields["sender"] or None, subject=item.get("subject") or None,
            message=item["message"], attachment=item.get("attachment"),
            correct_answer="REPORT" if is_phishing else "SAFE", status="ACTIVE",
            created_at=reviewed_at, approved_at=reviewed_at, updated_at=reviewed_at + timedelta(minutes=index),
        )
        scenario.set_phishing_cues(fields["phishing_cues"])
        enrich_scenario(scenario)
        db.session.add(scenario)
    db.session.commit()
    return len(items)


def review_demo_channel(channel, dataset_ids, rng, reviewed_at):
    """Replay the admin's review of one channel in Scenario Review, across all its datasets (so genuine
    messages from one file can balance phishing from another in the same category). Only drafts that pass
    every automatic check (the same checks the review screen shows) can go live. Per category, an equal
    number of phishing and genuine ones are switched on where the category has both. Without the custom
    scenarios, a one-sided category also gets a few (topped up until the channel is balanced); with them, only
    ACTIVE_PER_CATEGORY_WITH_CUSTOM pairs per category go live. Then a few more are left approved, and a few
    of the worst failing ones are rejected."""
    drafts = Scenario.query.filter(Scenario.dataset_id.in_(dataset_ids)).order_by(Scenario.scenario_id).all()
    passing = {"REPORT": [], "SAFE": []}
    failing = []
    for scenario in drafts:
        if all(check["passed"] for check in ScenarioService.quality_checks(scenario)):
            passing[scenario.correct_answer.upper()].append(scenario)
        else:
            failing.append(scenario)

    by_category = {}
    for answer, group in passing.items():
        for scenario in _varied(group, rng):
            by_category.setdefault(scenario.category, {"REPORT": [], "SAFE": []})[answer].append(scenario)
    live, taken = [], {}
    one_sided = {"REPORT": [], "SAFE": []}
    per_category = ACTIVE_PER_CATEGORY_WITH_CUSTOM if INCLUDE_CUSTOM else ACTIVE_PER_CATEGORY
    for category in sorted(by_category):
        lists = by_category[category]
        both = min(len(lists["REPORT"]), len(lists["SAFE"]))
        if both:
            count = min(both, per_category)
        else:
            count = 0 if INCLUDE_CUSTOM else ONE_SIDED_PER_CATEGORY
        for answer, group in lists.items():
            live += group[:count]
            taken[(category, answer)] = min(count, len(group))
            if group and not both and not INCLUDE_CUSTOM:   # topped up below (public data only)
                one_sided[answer].append(category)

    # Top up the one-sided categories, taking turns, until both answers have the same number live
    def total(answer):
        return sum(1 for scenario in live if scenario.correct_answer.upper() == answer)

    def next_category(answer):
        """The one-sided category of this answer with the fewest live so far that can still take one."""
        open_ones = [c for c in one_sided[answer]
                     if taken[(c, answer)] < min(len(by_category[c][answer]), per_category)]
        return min(open_ones, key=lambda c: (taken[(c, answer)], c)) if open_ones else None

    def add_one(answer):
        category = next_category(answer)
        live.append(by_category[category][answer][taken[(category, answer)]])
        taken[(category, answer)] += 1

    # The smaller side first; once level, one of each while both can still grow
    while True:
        phishing, genuine = total("REPORT"), total("SAFE")
        if phishing != genuine:
            smaller = "REPORT" if phishing < genuine else "SAFE"
            if not next_category(smaller):
                break
            add_one(smaller)
        elif next_category("REPORT") and next_category("SAFE"):
            add_one("REPORT")
            add_one("SAFE")
        else:
            break
    spare = {"REPORT": [], "SAFE": []}
    for (category, answer), count in taken.items():
        spare[answer] += by_category[category][answer][count:]
    if not any(s.correct_answer == "REPORT" for s in live) or not any(s.correct_answer == "SAFE" for s in live):
        raise SystemExit(f"Demo data not loaded: the {channel} datasets have no phishing or no genuine drafts that pass "
                         "every automatic check, so a mixed set cannot be switched on.")

    def mark(scenario, status, when):
        scenario.status = status
        scenario.approved_at = when if status in {"APPROVED", "ACTIVE"} else None
        scenario.updated_at = when + (timedelta(minutes=30) if status == "ACTIVE" else timedelta())

    for index, scenario in enumerate(live):
        mark(scenario, "ACTIVE", reviewed_at + timedelta(minutes=2 * index))
    for group in spare.values():
        for index, scenario in enumerate(group[:APPROVED_PER_ANSWER]):
            mark(scenario, "APPROVED", reviewed_at + timedelta(hours=3, minutes=2 * index))
    failing.sort(key=lambda scenario: (scenario.quality_score or 0, scenario.scenario_id))
    for index, scenario in enumerate(failing[:REJECTED_PER_CHANNEL]):
        mark(scenario, "REJECTED", reviewed_at + timedelta(minutes=index))
    db.session.commit()


def seed_baseline_questions():
    """The template bank: per role, the first assessment switched on and the second off."""
    BaselineService.load_templates()
    return BaselineQuestion.query.all()


def role_template(occupation):
    """The baseline assessment a player of this role took when they joined (their role's first active one)."""
    return BaselineTemplate.query.filter(
        BaselineTemplate.is_active.is_(True), BaselineTemplate.occupation == occupation.value,
    ).order_by(BaselineTemplate.template_id).first()


def seed_second_baseline(rng):
    """Students: their second assessment was switched on three weeks ago and about half of the students have
    taken it, so the Baseline pages show new and completed assessments side by side. The second assessments
    for employees and other players stay off, so switching one on can be shown live."""
    template = BaselineTemplate.query.filter_by(
        occupation=Occupation.STUDENT.value, is_active=False).order_by(BaselineTemplate.template_id).first()
    if not template:
        return 0
    now = datetime.utcnow()
    switched_on = now - timedelta(days=SECOND_BASELINE_DAYS)
    template.is_active, template.activated_at = True, switched_on
    taken = 0
    students = Player.query.join(UserProfile).filter(
        UserProfile.occupation == Occupation.STUDENT).order_by(Player.player_id).all()
    for player in students:
        if rng.random() < SECOND_BASELINE_SHARE:
            start = max(switched_on, player.joined_at)
            when = min(start + timedelta(days=rng.randint(0, SECOND_BASELINE_DAYS - 1), hours=rng.randint(8, 20)),
                       now - timedelta(hours=1))
            seed_baseline(player, template, rng, when)
            taken += 1
    db.session.commit()
    return taken


def make_user(email, password, role, full_name=None, profile=None, joined_at=None, consent=False):
    user = User(email=email.lower(), password_hash=bcrypt.generate_password_hash(password).decode("utf-8"),
                role=role, created_at=joined_at or datetime.utcnow())
    db.session.add(user)
    db.session.flush()
    if role == "PLAYER":
        player = Player(user_id=user.user_id, full_name=full_name, joined_at=joined_at or datetime.utcnow())
        db.session.add(player)
        db.session.flush()
        age, occupation, it_background = profile
        db.session.add(UserProfile(
            player_id=player.player_id, age=age, occupation=occupation, it_background=it_background,
            campaign_consent=consent, campaign_consent_at=(joined_at or datetime.utcnow()) if consent else None,
        ))
        return user, player
    return user, None


def seed_baseline(player, template, rng, joined_at):
    """A completed baseline assessment (their role's first one): score reflects the player's ability."""
    ability = rng.uniform(0.35, 0.95)
    questions = list(template.questions) if template else []
    assessment = BaselineAssessment(player_id=player.player_id, started_at=joined_at,
                                    template_id=template.template_id if template else None,
                                    completed_at=joined_at + timedelta(minutes=6))
    db.session.add(assessment)
    db.session.flush()
    passed_count = 0
    for index, question in enumerate(questions):
        passed = rng.random() < ability
        passed_count += passed
        keywords = question.get_expected_keywords()
        matched = keywords[: max(1, int(len(keywords) * (0.9 if passed else 0.3)))] if keywords else []
        db.session.add(BaselineResponse(
            assessment_id=assessment.assessment_id, question_id=question.question_id,
            answer_text=BASELINE_ANSWERS[index % len(BASELINE_ANSWERS)],
            matched_keywords=",".join(matched),
            score=round(len(matched) / len(keywords) * 100) if keywords else (100 if passed else 40),
            passed=passed,
        ))
    assessment.score = round(passed_count / len(questions) * 100) if questions else 0
    return assessment.score


class ScenarioPool:
    """The live scenarios of each channel, looked up the way ScenarioService does for a player."""

    def __init__(self, scenarios):
        self.by_id = {scenario.scenario_id: scenario for scenario in scenarios}
        # Per channel, the (id, category, difficulty, answer) rows ScenarioService.pick chooses from
        self.channels = {}
        for scenario in sorted(scenarios, key=lambda s: s.scenario_id):
            self.channels.setdefault(scenario.simulation_type.upper(), []).append(
                (scenario.scenario_id, scenario.category, scenario.difficulty, scenario.correct_answer))

    def categories(self, channel):
        return sorted({row[1] for row in self.channels.get(channel, [])})


class PlayerHistory:
    """One player's decisions so far, oldest first, kept in the shapes the app's own rules expect."""

    def __init__(self, player, occupation, baselines, campaign_attempts, scenarios_by_id):
        self.player = player
        self.occupation = occupation
        self.baselines = baselines                    # (completed_at, score) of every baseline they took
        self.pending_campaign = list(campaign_attempts)  # campaign results, recorded once their time comes
        self.scenarios_by_id = scenarios_by_id
        self.attempts = []                            # every decision, oldest first
        self.facts = []                               # ProgressService facts for the same decisions
        self.tiers = []                               # skill tier after each decision (for the multiplier)

    def record(self, attempt):
        """Add one decision, so the next choice and XP see it, as they would in the app."""
        self.attempts.append(attempt)
        # A custom campaign email's result points at its hidden scenario, which is not in the live pool
        scenario = self.scenarios_by_id.get(attempt.scenario_id) or db.session.get(Scenario, attempt.scenario_id)
        self.facts += ProgressService.attempt_facts([attempt], {attempt.scenario_id: scenario})
        self.tiers.append(ProgressService.skill_rating(self.facts)["tier_index"])

    def catch_up(self, when):
        """Campaign results count as decisions from the moment they happened (the app syncs them first)."""
        while self.pending_campaign and self.pending_campaign[0].attempted_at <= when:
            self.record(self.pending_campaign.pop(0))

    def multiplier(self):
        """The level multiplier for the next decision: ProgressService.summary_from_facts(facts)["multiplier"],
        worked out from the running tier list so that a long history stays quick to replay."""
        level = ProgressService.level_for_xp(ProgressService.running_xp(self.facts))["level"]
        rank_dropped = bool(self.tiers) and self.tiers[-1] < max(self.tiers)
        return ProgressService.multiplier(max(level - 1, 1) if rank_dropped else level)


def _next_scenario(history, pool, channel, when, rng):
    """The scenario the app would serve next (ScenarioService.get_random_scenario): phishing or genuine first,
    then the adaptive category and the difficulty from the baseline in effect and recent answers, nothing
    done before while unseen ones remain; when all are done, the player retakes one, avoiding the last few.
    Now and then the player opens "review my mistakes" instead (ScenarioService.get_review_scenario)."""
    newest_first = list(reversed(history.attempts))
    channel_attempts = [a for a in newest_first if a.simulation_type.upper() == channel]

    mistakes = [i for i in ScenarioService.mistakes_to_review(channel_attempts) if i in pool.by_id
                and pool.by_id[i].simulation_type.upper() == channel]
    if mistakes and rng.random() < MISTAKE_REVIEW_SHARE:
        return pool.by_id[rng.choice(sorted(mistakes))]

    in_effect = AdaptiveEngine.baseline_in_effect(
        [baseline for baseline in history.baselines if baseline[0] <= when], newest_first,
    )
    difficulty, _ = AdaptiveEngine.recommend_difficulty(newest_first, in_effect)
    category_attempts = {category: [] for category in pool.categories(channel)}
    for attempt in channel_attempts:
        scenario = history.scenarios_by_id.get(attempt.scenario_id)
        if scenario and scenario.category in category_attempts:
            category_attempts[scenario.category].append(attempt)
    category, _ = AdaptiveEngine.recommend_category(category_attempts, history.occupation, rng=rng)

    candidates = pool.channels[channel]
    completed = {a.scenario_id for a in channel_attempts}
    recent = {a.scenario_id for a in channel_attempts[:ScenarioService.COOLDOWN_ATTEMPTS]}
    answer = AdaptiveEngine.recommend_answer(channel_attempts, rng=rng)
    scenario_id = ScenarioService.pick(candidates, answer, category, difficulty, [completed], rng=rng)
    if scenario_id is None:
        # "You have completed every available scenario": the player asks for a retake (a new request)
        answer = AdaptiveEngine.recommend_answer(channel_attempts, rng=rng)
        scenario_id = ScenarioService.pick(candidates, answer, category, difficulty, [recent, set()], rng=rng)
    return pool.by_id.get(scenario_id)


def _decide(history, scenario, rng, when, skill):
    """One decision, made and scored the way SimulationService.save_attempt does. Whether the player is right
    depends on their skill and the difficulty; the clues they tick follow from what they believed."""
    difficulty_penalty = {"Easy": 0.08, "Medium": 0.0, "Hard": -0.12}.get(scenario.difficulty, 0.0)
    correct = rng.random() < min(0.98, skill + difficulty_penalty)
    is_phishing = scenario.correct_answer.upper() == "REPORT"

    # Clicking a link or opening the file counts as trusting the message (answer Safe), as on the page
    trap = None
    if (is_phishing and not correct) or (not is_phishing and correct):
        share = TRAP_SHARE if is_phishing else GENUINE_CLICK_SHARE
        if find_urls(scenario.message or "") and rng.random() < share:
            trap = "LINK"
        elif scenario.attachment and rng.random() < share:
            trap = "ATTACHMENT"
    answer = "SAFE" if trap else (scenario.correct_answer.upper() if correct else ("SAFE" if is_phishing else "REPORT"))

    key = round_key(history.player.player_id, history.attempts, scenario.scenario_id)
    offered = clue_options(scenario, key)
    if correct:
        real = real_clues(scenario)
        spot_chance = min(0.9, 0.35 + skill * 0.55)
        picks = [clue for clue in offered if clue in real and rng.random() < spot_chance]
        others = [clue for clue in offered if clue not in real]
        if others and rng.random() < WRONG_PICK_SHARE:
            picks.append(rng.choice(others))
    else:
        # They believed the opposite, so the signs they ticked point the wrong way
        believed = TRUST_SIGNALS if is_phishing else WARNING_SIGNS
        options = [clue for clue in offered if clue in believed]
        picks = rng.sample(options, min(len(options), rng.randint(1, 2)))
    if not picks:
        picks = [rng.choice(offered)]   # the page asks for at least one clue or a reason
    clue_result = evaluate_justification(scenario, picks, "", key)

    xp = ProgressService.calculate_xp(correct, scenario.difficulty, clue_result["net_found"], history.multiplier())
    attempt = SimulationAttempt(
        player_id=history.player.player_id, scenario_id=scenario.scenario_id,
        simulation_type=scenario.simulation_type, player_answer=answer, correct=correct, score=xp,
        difficulty=scenario.difficulty, selected_clues=",".join(picks), justification="",
        clue_score=clue_result["score"], attempted_at=when,
    )
    db.session.add(attempt)
    db.session.flush()
    db.session.add(UserAction(attempt_id=attempt.attempt_id, action=SimulationService.TRAP_ACTIONS.get(trap, answer)))
    db.session.add(FeedbackReport(
        attempt_id=attempt.attempt_id, created_at=when,
        feedback=FeedbackGenerator.build(scenario, correct, clue_result, trap)["summary"],
        phishing_cues=",".join(clue_result["real"]),
    ))
    history.record(attempt)


def seed_attempts(player, occupation, pool, rng, joined_at, ability, habit):
    """Decisions day by day since joining: the habit decides how often and how much the player practises.
    Accuracy climbs a little as they learn, and harder scenarios are answered correctly less often.
    Campaign results already recorded for the player are counted in at the time they happened."""
    _, chance, (fewest, most) = habit
    baselines = db.session.query(BaselineAssessment.completed_at, BaselineAssessment.score).filter(
        BaselineAssessment.player_id == player.player_id, BaselineAssessment.completed_at.isnot(None),
    ).all()
    campaign_attempts = SimulationAttempt.query.filter(
        SimulationAttempt.player_id == player.player_id, SimulationAttempt.campaign_recipient_id.isnot(None),
    ).order_by(SimulationAttempt.attempted_at, SimulationAttempt.attempt_id).all()
    history = PlayerHistory(player, occupation, baselines, campaign_attempts, pool.by_id)

    now = datetime.utcnow()
    day, index = joined_at.date(), 0
    while day <= now.date():
        if rng.random() < chance:
            times = []
            for _ in range(rng.randint(fewest, most)):
                when = datetime.combine(day, time(rng.randint(7, 21), rng.randint(0, 59)))
                times.append(min(max(when, joined_at + timedelta(minutes=10)), now - timedelta(minutes=rng.randint(5, 90))))
            for when in sorted(times):
                history.catch_up(when)
                channel = "SMS" if rng.random() < SMS_SHARE else "EMAIL"
                scenario = _next_scenario(history, pool, channel, when, rng) if channel in pool.channels else None
                if scenario:
                    _decide(history, scenario, rng, when, ability + min(index / 100, 1) * 0.15)
                    index += 1
        day += timedelta(days=1)

    db.session.flush()
    _seed_sessions(player, rng)
    _refresh_tracker(player.player_id)


def _seed_sessions(player, rng):
    """Login sessions (for active-user counts) and one training session per active day. Campaign results
    happen in the player's own inbox, so they are not part of a training session."""
    attempts = SimulationAttempt.query.filter(
        SimulationAttempt.player_id == player.player_id, SimulationAttempt.campaign_recipient_id.is_(None),
    ).order_by(SimulationAttempt.attempted_at).all()
    if not attempts:
        return
    by_day = {}
    for attempt in attempts:
        by_day.setdefault(attempt.attempted_at.date(), []).append(attempt)
    for day, day_attempts in by_day.items():
        start = min(a.attempted_at for a in day_attempts)
        end = max(a.attempted_at for a in day_attempts)
        db.session.add(UserSession(user_id=player.user_id, login_time=start, logout_time=end + timedelta(minutes=2),
                                   status="LOGGED_OUT", ended_reason="logout"))
        by_type = {}
        for attempt in day_attempts:
            by_type.setdefault(attempt.simulation_type, []).append(attempt)
        for simulation_type, rows in by_type.items():
            db.session.add(SimulationSession(
                player_id=player.player_id, simulation_type=simulation_type,
                started_at=min(a.attempted_at for a in rows), completed_at=max(a.attempted_at for a in rows),
                total_attempts=len(rows), total_score=sum(a.score or 0 for a in rows),
            ))
    # A recent visit for some players that ended by the idle time-out (no logout), so "active this week" shows
    # data. Only real sign-ins count as "active now": a seeded session holds no key, so it could never be used.
    if rng.random() < 0.5:
        login = datetime.utcnow() - timedelta(hours=rng.randint(1, 72))
        db.session.add(UserSession(user_id=player.user_id, login_time=login, status="EXPIRED",
                                   logout_time=login + timedelta(minutes=30), ended_reason="idle_timeout"))


def _refresh_tracker(player_id):
    """The stored totals for every decision (campaign results may already have created the row)."""
    attempts = SimulationAttempt.query.filter_by(player_id=player_id).all()
    tracker = PerformanceTracker.query.filter_by(player_id=player_id).first()
    if not tracker:
        tracker = PerformanceTracker(player_id=player_id)
        db.session.add(tracker)
    tracker.total_attempts = len(attempts)
    tracker.correct_attempts = sum(a.correct for a in attempts)
    tracker.total_score = sum(a.score or 0 for a in attempts)
    tracker.last_attempt_at = max((a.attempted_at for a in attempts), default=None)


# The phishing email an admin writes for campaigns when no live dataset phishing email has a link or a file
# (the KD emails have none). Checked by the app's own custom-email rules, like one written on the page.
CUSTOM_PHISHING_EMAIL = {
    "sender": "IT Service Desk <servicedesk@it-helpdesk-portal.co>",
    "subject": "Action required: your mailbox is full",
    "message": (
        "Your mailbox has reached its storage limit. From today, new email will be held and not delivered.\n\n"
        "To keep receiving email, sign in and confirm your account within 24 hours:\n\n"
        "[Restore my mailbox](https://it-helpdesk-portal.co/mailbox/restore)\n\n"
        "IT Service Desk"
    ),
    "is_phishing": True,
    "cues": ["Sender domain is not your organisation's", "24-hour deadline", "Asks you to sign in through a link"],
}


def _clicked_kind(email):
    """What a recipient can click in a campaign email: its link, else its attachment card (None if neither)."""
    from app.services.campaign_service import LINK_PATTERN
    if LINK_PATTERN.search(email["message"] or ""):
        return "LINK"
    return "ATTACHMENT" if email["attachment"] else None


def _campaign_email(scenarios, is_phishing):
    """The email for a campaign, as CampaignService.create_campaign would accept it: a live dataset email of
    the right kind with something to click (best quality score first, lowest id on ties), else, for phishing,
    the admin's custom email. None when there is no clickable genuine email."""
    from app.services.campaign_service import CampaignService
    candidates = [s for s in scenarios if s.simulation_type.upper() == "EMAIL"
                  and (s.correct_answer.upper() == "REPORT") == is_phishing
                  and CampaignService.is_clickable(s.message, s.attachment)]
    candidates.sort(key=lambda s: (-(s.quality_score or 0), s.difficulty != "Medium", s.scenario_id))
    if candidates:
        return CampaignService.scenario_email(candidates[0])
    if is_phishing:
        valid, message, email = CampaignService._custom_email(CUSTOM_PHISHING_EMAIL)
        if not valid:
            raise SystemExit(f"Demo data not loaded: the custom campaign email is refused: {message}")
        return email
    return None


def _launch(admin, email, name, when):
    campaign = EmailCampaign(created_by_user_id=admin.user_id, name=name, status="LAUNCHED",
                             created_at=when - timedelta(hours=1), launched_at=when, **email)
    db.session.add(campaign)
    db.session.flush()
    return campaign


def _recipient(campaign, email, address, outcome, sent, acted, seen):
    """One settled result, already marked as notified, so seeding sends no email."""
    from app.services.campaign_service import POINTS
    kind = _clicked_kind(email) if outcome == "CLICKED" else None
    return EmailCampaignRecipient(
        campaign_id=campaign.campaign_id, recipient_email=address, tracking_token=os.urandom(24).hex(),
        delivery_status="SENT", sent_at=sent,
        opened_at=acted if outcome != "IGNORED" else None, open_count=0 if outcome == "IGNORED" else 1,
        clicked_at=acted if outcome == "CLICKED" else None, click_count=1 if outcome == "CLICKED" else 0,
        clicked_kind=kind, reported_at=acted if outcome == "REPORTED" else None,
        settled_outcome=outcome, xp_awarded=POINTS[(campaign.is_phishing, outcome)],
        notified_at=acted, feedback_seen_at=seen,
    )


def seed_campaigns(admin, owner_player, scenarios):
    """A couple of finished campaigns to the owner's own inbox, so the campaign metrics show data."""
    if not owner_player:
        return 0
    from app.services.campaign_service import CampaignService

    now = datetime.utcnow()
    plans = []
    for is_phishing, outcome, days_ago in ((True, "REPORTED", 4), (False, "CLICKED", 1)):
        email = _campaign_email(scenarios, is_phishing)
        if email:
            plans.append((email, outcome, now - timedelta(days=days_ago)))

    for email, outcome, when in plans:
        campaign = _launch(admin, email, f"{email['subject']} campaign", when - timedelta(minutes=5))
        db.session.add(_recipient(campaign, email, owner_player.user.email, outcome,
                                  when - timedelta(minutes=4), when, None))
    db.session.commit()
    # Turn those results into the owner's decisions, exactly as the live app does
    CampaignService.sync_player(owner_player)
    db.session.commit()
    return len(plans)


# The cohort campaigns: (name, phishing?, days ago, outcome weights). Every campaign email has something to
# click (the app refuses one without), so clicking, reporting and ignoring can all happen.
COHORT_CAMPAIGNS = (
    ("Quarterly phishing check", True, 18, {"REPORTED": 5, "IGNORED": 4, "CLICKED": 3}),
    ("Shared document notice", False, 9, {"CLICKED": 6, "IGNORED": 3, "REPORTED": 2}),
)
COHORT_SIZE = 12


def seed_cohort_campaign(admin, scenarios, rng):
    """Finished campaigns to some consenting test players who had joined by then, with mixed results, so
    the campaign pages and analytics show a realistic spread: one phishing email and one genuine email
    (opening its document is the right call, reporting it is a false alarm)."""
    from app.services.campaign_service import CampaignService

    launched = 0
    for name, is_phishing, days_ago, weights in COHORT_CAMPAIGNS:
        email = _campaign_email(scenarios, is_phishing)
        when = datetime.utcnow() - timedelta(days=days_ago)
        consenting = Player.query.join(UserProfile).filter(
            UserProfile.campaign_consent.is_(True), Player.joined_at < when - timedelta(hours=1),
        ).order_by(Player.player_id).all()
        consenting = [player for player in consenting if player.user.email != OWNER_EMAIL]
        if not email or not consenting:
            continue
        chosen = rng.sample(consenting, min(COHORT_SIZE, len(consenting)))
        campaign = _launch(admin, email, name, when)
        for player in chosen:
            outcome = rng.choices(list(weights), weights=list(weights.values()))[0]
            acted = when + timedelta(minutes=rng.randint(1, 9))
            db.session.add(_recipient(campaign, email, player.user.email, outcome, when, acted, acted))
        db.session.commit()
        for player in chosen:
            CampaignService.sync_player(player)
        db.session.commit()
        launched += 1
    return launched


def refresh_players():
    """Update an existing database in place: test players get their alias address and consent choice,
    and any missing question-bank templates are added. Nothing else is touched or deleted."""
    app = create_app()
    with app.app_context():
        moved, consenting = 0, 0
        for index, (name, *_rest) in enumerate(PLAYERS):
            local = name.lower().replace(" ", ".").replace("-", "")
            user = User.query.filter(User.email.in_([f"{local}@{FAKE_DOMAIN}", demo_email(name)])).first()
            if not user or not user.player or not user.player.profile:
                continue
            new_email = demo_email(name)
            if user.email != new_email and not User.query.filter_by(email=new_email).first():
                user.email = new_email
                moved += 1
            consent = demo_consent(index)
            profile = user.player.profile
            if profile.campaign_consent != consent:
                profile.campaign_consent = consent
                profile.campaign_consent_at = user.created_at if consent else None
            consenting += consent
        db.session.commit()
        _, message, _ = BaselineService.load_templates()
        print(f"Test players updated: {moved} new addresses, {consenting} of {len(PLAYERS)} consenting.")
        print(f"Baseline template bank: {message}")
        if not DEMO_EMAIL:
            print("DEMO_EMAIL is not set, so test players keep their @phishsimulator.test addresses.")


def main():
    rng = random.Random(RANDOM_SEED)
    sources = demo_dataset_files()
    app = create_app()
    with app.app_context():
        print("Clearing existing data...")
        wipe_dynamic_data()

        now = datetime.utcnow()
        imported = {}  # channel -> ids of its datasets (ids, since each import detaches earlier objects)
        last_upload = now - timedelta(days=UPLOADED_DAYS_AGO)
        for offset, (channel, source) in enumerate(sources):
            last_upload = now - timedelta(days=UPLOADED_DAYS_AGO - offset, hours=rng.randint(1, 6))
            print(f"Importing the {channel} dataset {source.name} (the same check and drafts as an upload)...")
            imported.setdefault(channel, []).append(import_demo_dataset(channel, source, last_upload).dataset_id)
        for channel, dataset_ids in imported.items():
            review_demo_channel(channel, dataset_ids, rng, last_upload + timedelta(days=1))
        if INCLUDE_CUSTOM:
            print("Adding the admin's custom scenarios...")
            seed_admin_custom_scenarios(last_upload + timedelta(days=1, hours=2))
        # Loaded again here: each import clears the session as it goes, which detaches earlier objects
        live = Scenario.query.filter(Scenario.status == "ACTIVE").order_by(Scenario.scenario_id).all()
        pool = ScenarioPool(live)

        print("Loading baseline questions...")
        questions = seed_baseline_questions()

        admin, _ = make_user(ADMIN_EMAIL, ADMIN_PASSWORD, "ADMIN", joined_at=now - timedelta(days=UPLOADED_DAYS_AGO + 1))

        owner = None
        if OWNER_EMAIL:
            _, owner = make_user(
                OWNER_EMAIL, DEMO_PASSWORD, "PLAYER", full_name="Nkosinathi Tshabalala",
                profile=(24, Occupation.STUDENT, True), joined_at=now - timedelta(days=DAYS),
                consent=True,
            )

        print(f"Creating {len(PLAYERS)} test players and their baseline assessments...")
        learners = []
        for index, (name, age, occupation, it_background) in enumerate(PLAYERS):
            joined = now - timedelta(days=rng.randint(7, DAYS))
            _, player = make_user(demo_email(name), DEMO_PASSWORD, "PLAYER", full_name=name,
                                  profile=(age, occupation, it_background), joined_at=joined,
                                  consent=demo_consent(index))
            ability = seed_baseline(player, role_template(occupation), rng, joined) / 100
            habit = rng.choices(HABITS, weights=HABIT_WEIGHTS)[0]
            learners.append((player, occupation, joined, max(0.3, ability - 0.1), habit))
        if owner:
            ability = seed_baseline(owner, role_template(Occupation.STUDENT), rng, owner.joined_at) / 100
            # The account you demo with, so give it a solid history to look at
            learners.append((owner, Occupation.STUDENT, owner.joined_at, max(0.55, ability), HABITS[3]))
        db.session.commit()
        second_baseline = seed_second_baseline(rng)

        # Campaign results first: in the app they count as decisions from the moment they happen
        campaigns = seed_campaigns(admin, owner, live) + seed_cohort_campaign(admin, live, rng)

        print("Replaying four months of practice on the live scenarios...")
        for player, occupation, joined, skill, habit in learners:
            seed_attempts(player, occupation, pool, rng, joined, skill, habit)
            db.session.commit()

        players = Player.query.count()
        attempts = SimulationAttempt.query.count()
        # This goes to the container log, so it says where the passwords are set, never what they are
        print("\nDemo data loaded (passwords: ADMIN_PASSWORD and DEMO_PASSWORD in backend/.env):")
        print(f"  admin: {ADMIN_EMAIL}")
        if owner:
            print(f"  you:   {OWNER_EMAIL}  (campaigns can be sent here)")
        consenting = UserProfile.query.filter(UserProfile.campaign_consent.is_(True)).count()
        print(f"  test players: {shown_email(demo_email(PLAYERS[0][0]))} ...  ({consenting} of {players} consented)")
        for dataset in Dataset.query.order_by(Dataset.uploaded_at).all():
            counts = dict(db.session.query(Scenario.status, db.func.count()).filter(
                Scenario.dataset_id == dataset.dataset_id).group_by(Scenario.status).all())
            phishing = Scenario.query.filter_by(dataset_id=dataset.dataset_id, status="ACTIVE", correct_answer="REPORT").count()
            print(f"  {dataset.dataset_type} dataset {dataset.name}: {counts.get('ACTIVE', 0)} active "
                  f"({phishing} phishing), {counts.get('APPROVED', 0)} approved, {counts.get('REJECTED', 0)} rejected, "
                  f"{counts.get('DRAFT', 0)} drafts waiting for review")
        for channel in ("EMAIL", "SMS"):
            added = Scenario.query.filter(Scenario.dataset_id.is_(None), Scenario.simulation_type == channel,
                                          Scenario.status == "ACTIVE")
            if added.count():
                print(f"  {channel} admin_custom_scenarios: {added.count()} active "
                      f"({added.filter(Scenario.correct_answer == 'REPORT').count()} phishing)")
        print(f"  {players} players, {BaselineTemplate.query.count()} baseline assessments ({len(questions)} questions), "
              f"{attempts} decisions, {campaigns} campaigns")
        print(f"  baselines: each role's first assessment on; the students' second on ({second_baseline} students took it); "
              "the Employee and Other second ones off (switch one on live)")


if __name__ == "__main__":
    if "--refresh-players" in sys.argv:
        refresh_players()
    else:
        main()
