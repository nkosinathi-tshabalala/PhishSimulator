# Choosing scenarios for players and reviewing them for admins

import re
from datetime import datetime, timedelta
from random import SystemRandom

from app.extensions import db

from app.models.datasets import Dataset
from app.models.scenario import Scenario
from app.models.authentication import Player
from app.services.baseline_service import BaselineService
from app.models.email import EmailCampaign
from app.models.simulation import SimulationAttempt
from app.adaptive.adaptive_engine import AdaptiveEngine
from app.datasets.scenario_parser import ScenarioParser
from app.datasets.scenario_realism import quality_review, quality_score
from app.schemas.scenario_schema import ScenarioSchema
from app.utils.clock import iso_utc, local_today, utc_now, utc_start_of
from app.utils.clues import clue_options, round_key
from app.utils.labels import LEGACY_TITLE_PREFIX, message_label
from app.utils.links import describe_link, find_urls, link_problems


class ScenarioService:
    """Scenario review, admin editing and choosing the next scenario for a player."""
    STATUSES = ("DRAFT", "APPROVED", "ACTIVE", "ARCHIVED", "REJECTED")

    REVIEW_ACTIONS = {
        "approve": ({"DRAFT"}, "APPROVED"),
        "reject": ({"DRAFT", "APPROVED"}, "REJECTED"),
        "activate": ({"APPROVED", "ARCHIVED"}, "ACTIVE"),
        "archive": ({"ACTIVE"}, "ARCHIVED"),
        "reopen": ({"REJECTED"}, "DRAFT"),
    }

    QA_CHECKLIST = (
        ("label_correct", "Label correct"),
        ("clues_accurate", "Clues accurate"),
        ("category_difficulty_fit", "Category & difficulty fit"),
        ("text_complete", "Text complete"),
        ("no_personal_data", "No real personal data"),
        ("links_safe", "Links made safe"),
    )

    # A quality score at or above this passes the automatic check
    GOOD_QUALITY = 80

    # A live category or difficulty where one answer is below this share is flagged as uneven
    UNEVEN_SHARE = 0.25

    # The dataset filter value for scenarios written by hand or loaded with the demo data
    NO_DATASET = "none"
    # The group in Scenario Review for scenarios the admin wrote (no dataset): the demo's own and any added later
    CUSTOM_GROUP = "admin_custom_scenarios"

    # "When" filter periods, in local days (today counts as one)
    WHEN_DAYS = {"today": 1, "7d": 7, "30d": 30, "90d": 90}

    COOLDOWN_ATTEMPTS = 5
    MISTAKE_REVIEW_GAP = 3

    @staticmethod
    def display_title(scenario):
        """The admin's name for a scenario. Older imports were titled "EMAIL training: ..."; that prefix is hidden."""
        if scenario.title == "Dataset training scenario":
            return f"{scenario.simulation_type.title()} scenario #{scenario.scenario_id}"
        return LEGACY_TITLE_PREFIX.sub("", scenario.title or "") or scenario.title

    @staticmethod
    def player_label(scenario):
        """How a player recognises a message afterwards: what they actually saw (the subject, or the start of the
        text). Never the admin's title, which may say it is training."""
        return message_label(scenario.subject, scenario.message)

    @staticmethod
    def _reviewable():
        """Every scenario except the hidden ones behind custom campaign emails."""
        return Scenario.query.filter(db.func.upper(Scenario.status) != Scenario.CAMPAIGN_STATUS)

    @staticmethod
    def _filtered_query(filters, include_status=True):
        """Apply the admin table filters. `filters` is a dict of optional values."""
        query = ScenarioService._reviewable()
        channel = (filters.get("simulation_type") or "").upper()
        if channel in {"EMAIL", "SMS"}:
            query = query.filter(db.func.upper(Scenario.simulation_type) == channel)
        dataset = str(filters.get("dataset_id") or "")
        if dataset == ScenarioService.NO_DATASET:
            query = query.filter(Scenario.dataset_id.is_(None))
        elif dataset.isdigit():
            query = query.filter(Scenario.dataset_id == int(dataset))
        if filters.get("difficulty"):
            query = query.filter(Scenario.difficulty == filters["difficulty"])
        if filters.get("category"):
            query = query.filter(Scenario.category == filters["category"])
        if filters.get("answer") in {"REPORT", "SAFE"}:
            query = query.filter(Scenario.correct_answer == filters["answer"])
        if filters.get("search"):
            term = f"%{filters['search'].strip()}%"
            query = query.filter(db.or_(
                Scenario.title.ilike(term), Scenario.sender.ilike(term), Scenario.subject.ilike(term),
            ))
        if filters.get("min_quality"):
            query = query.filter(Scenario.quality_score >= int(filters["min_quality"]))
        when = ScenarioService._when_filter(filters.get("when"))
        if when is not None:
            query = query.filter(when)
        status = (filters.get("status") or "").upper()
        if include_status and status in ScenarioService.STATUSES:
            query = query.filter(db.func.upper(Scenario.status) == status)
        return query

    @staticmethod
    def _when_filter(value):
        """'approved_7d', 'updated_today' and so on: approved or changed since local midnight N days ago."""
        field, _, period = (value or "").partition("_")
        column = {"approved": Scenario.approved_at, "updated": Scenario.updated_at}.get(field)
        days = ScenarioService.WHEN_DAYS.get(period)
        if column is None or days is None:
            return None
        return column >= utc_start_of(local_today() - timedelta(days=days - 1))

    @staticmethod
    def get_scenarios(page=1, per_page=25, filters=None):
        """Load scenarios in pages, with filters and a text search."""
        filters = filters or {}
        page = max(int(page), 1)
        per_page = min(max(int(per_page), 1), 100)
        query = ScenarioService._filtered_query(filters)

        scenario_page = query.order_by(*ScenarioService._sort_order(filters)).paginate(
            page=page,
            per_page=per_page,
            error_out=False,
        )
        page_ids = [scenario.scenario_id for scenario in scenario_page.items]
        uses = dict(
            db.session.query(SimulationAttempt.scenario_id, db.func.count())
            .filter(SimulationAttempt.scenario_id.in_(page_ids))
            .group_by(SimulationAttempt.scenario_id)
            .all()
        ) if page_ids else {}

        rows = [{
            "scenario_id": scenario.scenario_id,
            "title": ScenarioService.display_title(scenario),
            "simulation_type": scenario.simulation_type,
            "category": scenario.category,
            "difficulty": scenario.difficulty,
            # Admins review the label too: "REPORT" is phishing, "SAFE" is genuine
            "correct_answer": (scenario.correct_answer or "").upper(),
            "status": (scenario.status or "DRAFT").upper(),
            "dataset_id": scenario.dataset_id,
            "quality_score": scenario.quality_score,
            "has_attachment": bool(scenario.attachment),
            "uses": uses.get(scenario.scenario_id, 0),
            "approved_at": iso_utc(scenario.approved_at),
            "updated_at": iso_utc(scenario.updated_at),
        } for scenario in scenario_page.items]

        return True, "Scenarios retrieved successfully.", {
            "scenarios": rows,
            "stats": ScenarioService._stats(ScenarioService._filtered_query(filters, include_status=False)),
            "groups": ScenarioService._dataset_groups(filters),
            "balance": ScenarioService.live_balance(filters.get("simulation_type")),
            "categories": sorted(name for (name,) in ScenarioService._reviewable().with_entities(Scenario.category).distinct()),
            "pagination": {
                "page": scenario_page.page,
                "per_page": scenario_page.per_page,
                "pages": scenario_page.pages,
                "total": scenario_page.total,
            },
        }

    @staticmethod
    def _set_status(scenario, status):
        """Change a scenario's status and record when. Approving stamps the approval time;
        going back to draft or being rejected clears it."""
        now = utc_now()
        scenario.status = status
        scenario.updated_at = now
        if status == "APPROVED":
            scenario.approved_at = now
        elif status in {"DRAFT", "REJECTED"}:
            scenario.approved_at = None

    @staticmethod
    def _sort_order(filters):
        """ORDER BY for the review table: any column, ascending or descending (newest first by default).
        Sorting in SQL keeps the order right across every page, not just the one on screen."""
        uses = (
            db.select(db.func.count(SimulationAttempt.attempt_id))
            .where(SimulationAttempt.scenario_id == Scenario.scenario_id)
            .scalar_subquery()
        )
        columns = {
            "title": Scenario.title,
            "category": Scenario.category,
            # Easy, Medium, Hard in that order rather than alphabetically
            "difficulty": db.case({"Easy": 1, "Medium": 2, "Hard": 3}, value=Scenario.difficulty, else_=4),
            "answer": Scenario.correct_answer,
            "status": Scenario.status,
            "quality": Scenario.quality_score,
            "uses": uses,
            "created": Scenario.created_at,
            "approved": Scenario.approved_at,
            "updated": Scenario.updated_at,
        }
        column = columns.get(filters.get("sort"), Scenario.created_at)
        direction = column.asc() if filters.get("order") == "asc" else column.desc()
        return direction.nulls_last(), Scenario.scenario_id

    @staticmethod
    def _dataset_groups(filters):
        """The datasets that have scenarios under the current filters (ignoring the dataset filter itself),
        newest upload first, with the admin's custom scenarios as the last group. `total` and `by_status` cover
        every stage, so a group never seems to lose scenarios when a stage is picked; `count` is how many are at
        the selected stage (the rows the open group lists)."""
        without_dataset = {**filters, "dataset_id": ""}
        query = ScenarioService._filtered_query(without_dataset, include_status=False)
        rows = query.with_entities(
            Scenario.dataset_id, db.func.upper(Scenario.status), db.func.count(),
        ).group_by(Scenario.dataset_id, db.func.upper(Scenario.status)).all()

        status = (filters.get("status") or "").upper()
        groups = {}
        for dataset_id, row_status, count in rows:
            group = groups.setdefault(dataset_id, {
                "by_status": {name: 0 for name in ScenarioService.STATUSES}, "count": 0, "total": 0,
            })
            group["by_status"][row_status] = group["by_status"].get(row_status, 0) + count
            group["total"] += count
            if not status or row_status == status:
                group["count"] += count

        datasets = {
            dataset.dataset_id: dataset
            for dataset in Dataset.query.filter(Dataset.dataset_id.in_([i for i in groups if i is not None])).all()
        } if groups else {}

        def describe(dataset_id):
            dataset = datasets.get(dataset_id)
            return {
                "dataset_id": dataset_id if dataset_id is not None else ScenarioService.NO_DATASET,
                "name": dataset.name if dataset else ScenarioService.CUSTOM_GROUP,
                "uploaded_at": iso_utc(dataset.uploaded_at) if dataset else None,
                **groups[dataset_id],
            }

        def upload_time(dataset_id):
            """When the dataset was uploaded (for newest-first order)."""
            return datasets[dataset_id].uploaded_at or datetime.min

        uploaded = sorted((i for i in groups if i in datasets), key=upload_time, reverse=True)
        ordered = [describe(i) for i in uploaded]
        if None in groups:
            ordered.append(describe(None))
        return [group for group in ordered if group["total"]]

    @staticmethod
    def live_balance(simulation_type=None):
        """Where the live (Active) scenarios lean to one answer, per channel, category and difficulty. Training
        picks phishing or genuine first, so such a group is still mixed in normal practice, but a player who
        focuses on that category sees mostly one answer, and the content does not cover the other case.
        Only the flagged groups are returned, each with its phishing and genuine counts."""
        query = Scenario.query.filter(db.func.upper(Scenario.status) == "ACTIVE")
        channel = (simulation_type or "").upper()
        if channel in {"EMAIL", "SMS"}:
            query = query.filter(db.func.upper(Scenario.simulation_type) == channel)
        rows = query.with_entities(
            db.func.upper(Scenario.simulation_type), Scenario.category, Scenario.difficulty,
            db.func.upper(Scenario.correct_answer), db.func.count(),
        ).group_by(
            db.func.upper(Scenario.simulation_type), Scenario.category, Scenario.difficulty,
            db.func.upper(Scenario.correct_answer),
        ).all()

        totals = {}
        for row_channel, category, difficulty, answer, count in rows:
            for group, name in (("category", category), ("difficulty", difficulty)):
                cell = totals.setdefault((row_channel, group, name), {"phishing": 0, "genuine": 0})
                cell["phishing" if answer == "REPORT" else "genuine"] += count

        levels = AdaptiveEngine.DIFFICULTY_LEVELS
        def order(key):
            row_channel, group, name = key
            return row_channel, group, levels.index(name) if name in levels else len(levels), name

        flagged = []
        for key in sorted(totals, key=order):
            cell = totals[key]
            minority = min(cell["phishing"], cell["genuine"])
            if minority / (cell["phishing"] + cell["genuine"]) < ScenarioService.UNEVEN_SHARE:
                row_channel, group, name = key
                flagged.append({
                    "channel": row_channel, "group": group, "name": name, **cell,
                    "status": "one_sided" if minority == 0 else "uneven",
                })
        return flagged

    @staticmethod
    def _stats(query):
        """Counts by status and channel for the admin page."""
        by_status = dict(
            query.with_entities(db.func.upper(Scenario.status), db.func.count())
            .group_by(db.func.upper(Scenario.status)).all()
        )
        by_channel = dict(
            ScenarioService._reviewable().with_entities(db.func.upper(Scenario.simulation_type), db.func.count())
            .group_by(db.func.upper(Scenario.simulation_type)).all()
        )
        return {
            "total": sum(by_status.values()),
            "by_status": {status: by_status.get(status, 0) for status in ScenarioService.STATUSES},
            "email": by_channel.get("EMAIL", 0),
            "sms": by_channel.get("SMS", 0),
        }

    @staticmethod
    def _quality_check(scenario, is_phishing, cues):
        """The quality score worked out now (so it reflects the current rules), with every reason it lost points."""
        score, problems = quality_review(
            scenario.simulation_type or "EMAIL", scenario.sender, getattr(scenario, "subject", None),
            scenario.message, is_phishing, cues,
        )
        if problems:
            detail = f"{score}/100. " + "; ".join(f"{reason} (-{points})" for points, reason in problems) + "."
        else:
            detail = "100/100. Reads like a real message: no problems found."
        return {"label": "Quality score", "passed": score >= ScenarioService.GOOD_QUALITY, "detail": detail}

    @staticmethod
    def _contact_details_check(scenario):
        """Public datasets come from real mailboxes, so a message can still hold a real person's email address
        or phone number. Those must be replaced with made-up ones before players see them."""
        found = ScenarioParser.personal_details(scenario.message or "")
        sender = ScenarioParser.sender_address(scenario.sender)
        local = sender.split("@")[0].lower() if "@" in sender else ""
        # Shaped like a person: "t.mokoena@", "jaime.adkins@", or a display name such as "Adkins, Jaime"
        personal_sender = bool(
            (re.fullmatch(r"[a-z]{1,15}\.[a-z]{2,20}", local) and local.split(".")[0] not in ("it", "hr", "ict", "no"))
            or re.match(r'\s*"?[A-Z][a-z]+, [A-Z][a-z]+', scenario.sender or "")
        ) and not sender.lower().endswith(ScenarioParser.MADE_UP_DOMAINS)

        if found:
            listed = ", ".join(f"{kind} {value}" for kind, value in found)
            detail = f"Found {listed} in the text. Replace with made-up details, or confirm they are fictional."
        else:
            detail = "No email addresses or phone numbers in the message text."
        if personal_sender:
            detail += f" The sender ({sender}) looks like a person's address: if it is real, change it."
        return {"label": "No real contact details", "passed": not found, "detail": detail}

    @staticmethod
    def _links_check(scenario, is_phishing, cues, links):
        """Which links look fake and why. A link is only a warning sign when it fails a rule in app/utils/links.py
        (look-alike name, brand on the wrong site, IP address, shortener, odd ending...), never just for existing."""
        if not links:
            note = "No links in the message."
            if "Suspicious link" in cues:
                return {"label": "Links checked", "passed": False,
                        "detail": note + " Remove the 'Suspicious link' clue."}
            return {"label": "Links checked", "passed": True, "detail": note}

        verdicts = [describe_link(url) for url in dict.fromkeys(links)]
        any_suspicious = any(link_problems(url) for url in links)
        detail = "; ".join(verdicts) + ". Clicking never opens a website: it is recorded as trusting the message."

        if is_phishing and "Suspicious link" in cues and not any_suspicious:
            return {"label": "Links checked", "passed": False, "detail": detail
                    + " The clues say 'Suspicious link', but no link breaks a rule: check it yourself."}
        if not is_phishing and any_suspicious:
            return {"label": "Links checked", "passed": False, "detail": detail
                    + " A genuine message should not contain a link that looks fake."}
        return {"label": "Links checked", "passed": True, "detail": detail}

    @staticmethod
    def quality_checks(scenario):
        """Automatic checks that help the admin fill in the QA checklist."""
        message = scenario.message or ""
        links = find_urls(message)
        is_phishing = scenario.correct_answer.upper() == "REPORT"
        cues = scenario.get_phishing_cues()

        return [
            {
                "label": "Label present",
                "passed": scenario.correct_answer.upper() in {"REPORT", "SAFE"},
                "detail": f"Marked as {'phishing' if is_phishing else 'legitimate'}.",
            },
            {
                "label": "Clues detected",
                "passed": bool(cues) or not is_phishing,
                "detail": ", ".join(cues) if cues else "No clues found: add them before approving.",
            },
            {
                "label": "Text complete",
                "passed": len(message.strip()) >= ScenarioParser.MIN_MESSAGE_LENGTH,
                "detail": f"{len(message.strip())} characters.",
            },
            ScenarioService._contact_details_check(scenario),
            ScenarioService._links_check(scenario, is_phishing, cues, links),
            ScenarioService._quality_check(scenario, is_phishing, cues),
        ]

    @staticmethod
    def get_scenario(scenario_id):
        """Full scenario details for the admin review screen."""
        scenario = db.session.get(Scenario, scenario_id)
        if not scenario:
            return False, "Scenario not found.", None

        return True, "Scenario retrieved successfully.", {
            "scenario_id": scenario.scenario_id,
            "title": ScenarioService.display_title(scenario),
            "simulation_type": scenario.simulation_type,
            "category": scenario.category,
            "difficulty": scenario.difficulty,
            "sender": scenario.sender,
            "subject": scenario.subject,
            "message": scenario.message,
            "attachment": scenario.attachment,
            "correct_answer": scenario.correct_answer,
            "feedback": scenario.feedback,
            "phishing_cues": scenario.get_phishing_cues(),
            "status": (scenario.status or "DRAFT").upper(),
            "dataset_id": scenario.dataset_id,
            "quality_score": scenario.quality_score,
            "created_at": iso_utc(scenario.created_at),
            "approved_at": iso_utc(scenario.approved_at),
            "updated_at": iso_utc(scenario.updated_at),
            "quality_checks": ScenarioService.quality_checks(scenario),
            "qa_checklist": [
                {"key": key, "label": label} for key, label in ScenarioService.QA_CHECKLIST
            ],
        }

    @staticmethod
    def create_scenario(data):
        """Create a manual scenario. It starts as a draft awaiting review."""
        valid, message = ScenarioSchema.validate_create(data)
        if not valid:
            return False, message, None

        scenario = Scenario(
            title=data["title"],
            simulation_type=data["simulation_type"],
            category=data["category"],
            difficulty=data["difficulty"],
            sender=data.get("sender"),
            subject=data.get("subject"),
            message=data["message"],
            attachment=data.get("attachment") or None,
            correct_answer=data["correct_answer"],
            feedback=data.get("feedback"),
            status="DRAFT",
        )
        scenario.set_phishing_cues(data.get("phishing_cues", []))
        scenario.quality_score = ScenarioService._score(scenario)
        db.session.add(scenario)
        db.session.commit()

        return True, "Scenario created as a draft.", {"scenario_id": scenario.scenario_id}

    @staticmethod
    def update_scenario(scenario_id, data):
        """Edit scenario content. Status changes go through review_scenario."""
        scenario = db.session.get(Scenario, scenario_id)
        if not scenario:
            return False, "Scenario not found.", None

        valid, message = ScenarioSchema.validate_update(data)
        if not valid:
            return False, message, None

        editable_fields = (
            "title", "simulation_type", "category", "difficulty", "sender",
            "subject", "message", "correct_answer", "feedback",
        )
        for field in editable_fields:
            if field in data:
                setattr(scenario, field, data[field])
        if "attachment" in data:
            scenario.attachment = data["attachment"] or None

        scenario.set_phishing_cues(data.get("phishing_cues", []))
        scenario.quality_score = ScenarioService._score(scenario)

        message = "Scenario updated successfully."
        scenario.updated_at = utc_now()
        if (scenario.status or "").upper() in {"APPROVED", "ACTIVE"}:
            ScenarioService._set_status(scenario, "DRAFT")
            message = "Scenario updated and moved back to draft for review."
        db.session.commit()

        return True, message, {"scenario_id": scenario.scenario_id, "status": scenario.status}

    @staticmethod
    def _score(scenario):
        """Quality score (0-100) for a scenario."""
        return quality_score(
            scenario.simulation_type,
            scenario.sender,
            scenario.subject,
            scenario.message,
            scenario.correct_answer.upper() == "REPORT",
            scenario.get_phishing_cues(),
        )

    @staticmethod
    def _checklist_complete(checklist):
        """True when every review checklist item is ticked."""
        checklist = checklist if isinstance(checklist, dict) else {}
        return all(checklist.get(key) is True for key, _ in ScenarioService.QA_CHECKLIST)

    @staticmethod
    def review_scenario(scenario_id, action, checklist=None):
        """Move one scenario through Draft -> Approved -> Active -> Archived."""
        if action not in ScenarioService.REVIEW_ACTIONS:
            return False, f"Unknown review action: {action}.", None

        scenario = db.session.get(Scenario, scenario_id)
        if not scenario:
            return False, "Scenario not found.", None

        allowed_from, new_status = ScenarioService.REVIEW_ACTIONS[action]
        current_status = (scenario.status or "DRAFT").upper()
        if current_status not in allowed_from:
            return False, f"A {current_status.lower()} scenario cannot be {new_status.lower()}.", None

        if action == "approve" and not ScenarioService._checklist_complete(checklist):
            return False, "Tick every QA checklist item before approving.", None

        ScenarioService._set_status(scenario, new_status)
        db.session.commit()
        return True, f"Scenario is now {new_status.lower()}.", {
            "scenario_id": scenario.scenario_id,
            "status": new_status,
        }

    @staticmethod
    def _bulk_query(action, filters):
        """Scenarios matching the admin's filters that this action can move."""
        allowed_from, _ = ScenarioService.REVIEW_ACTIONS[action]
        return ScenarioService._filtered_query(filters or {}, include_status=False).filter(
            db.func.upper(Scenario.status).in_(allowed_from)
        )

    @staticmethod
    def bulk_review(action, filters=None, checklist=None, preview=False):
        """Apply one review action to every matching scenario (or just count them)."""
        if action not in ScenarioService.REVIEW_ACTIONS:
            return False, f"Unknown review action: {action}.", None

        query = ScenarioService._bulk_query(action, filters)
        if preview:
            return True, "Preview ready.", {"count": query.count()}

        if action == "approve" and not ScenarioService._checklist_complete(checklist):
            return False, "Tick every QA checklist item before approving.", None

        _, new_status = ScenarioService.REVIEW_ACTIONS[action]
        matching_ids = query.with_entities(Scenario.scenario_id)
        now = utc_now()
        changes = {Scenario.status: new_status, Scenario.updated_at: now}
        if new_status == "APPROVED":
            changes[Scenario.approved_at] = now
        elif new_status in {"DRAFT", "REJECTED"}:
            changes[Scenario.approved_at] = None
        updated = Scenario.query.filter(Scenario.scenario_id.in_(matching_ids)).update(
            changes, synchronize_session=False,
        )
        db.session.commit()
        return True, f"{updated} scenario(s) are now {new_status.lower()}.", {"updated": updated}

    @staticmethod
    def delete_scenario(scenario_id):
        """Delete a scenario, unless players have attempted it (archive those)."""
        scenario = db.session.get(Scenario, scenario_id)
        if not scenario:
            return False, "Scenario not found.", None

        if SimulationAttempt.query.filter_by(scenario_id=scenario_id).first():
            return False, "Scenarios with attempts cannot be deleted. Archive it instead.", None
        # Campaigns must keep their scenario: the database would refuse the delete anyway
        if EmailCampaign.query.filter_by(scenario_id=scenario_id).first():
            return False, "This scenario is used by an email campaign, so it cannot be deleted. Archive it instead.", None

        db.session.delete(scenario)
        db.session.commit()
        return True, "Scenario deleted successfully.", None

    @staticmethod
    def _player_history(user_id):
        """Load the player, their attempts (newest first) and adaptive difficulty."""
        player = Player.query.filter_by(user_id=user_id).first()
        if not player:
            return None, [], "Easy", ""

        attempts = SimulationAttempt.query.filter_by(
            player_id=player.player_id
        ).order_by(SimulationAttempt.attempted_at.desc()).all()
        # The baseline taken before their 5th training decision sets the start; later ones change nothing
        difficulty, reason = AdaptiveEngine.recommend_difficulty(
            attempts,
            BaselineService.starting_score(player.player_id, attempts),
        )
        return player, attempts, difficulty, reason

    @staticmethod
    def _attempts_by_category(attempts, categories, simulation_type):
        """Group this channel's attempts by scenario category."""
        scenario_ids = {attempt.scenario_id for attempt in attempts}
        category_of = dict(
            db.session.query(Scenario.scenario_id, Scenario.category)
            .filter(Scenario.scenario_id.in_(scenario_ids)).all()
        ) if scenario_ids else {}

        grouped = {category: [] for category in categories}
        for attempt in attempts:
            if attempt.simulation_type.upper() != simulation_type:
                continue
            category = category_of.get(attempt.scenario_id)
            if category in grouped:
                grouped[category].append(attempt)
        return grouped

    @staticmethod
    def pick(candidates, answer, category, difficulty, exclusions, strict_category=False, rng=None):
        """Choose the next scenario id from `candidates`, (scenario_id, category, difficulty, correct_answer)
        rows of one channel's active scenarios. The answer comes first: a scenario with the chosen answer
        ("REPORT" or "SAFE") in the practice category at the player's difficulty, then the nearest difficulty,
        then any category (unless the player picked the category), and only when no scenario with that answer
        is left, one with the other answer in the same order. `exclusions` are id sets tried in turn (for
        example: done before, then only the last few). The demo seed calls this too, so its history is
        chosen exactly as the app chooses. Returns None when nothing is left."""
        rng = rng or SystemRandom()
        levels = AdaptiveEngine.DIFFICULTY_LEVELS

        def distance(level):
            if level in levels and difficulty in levels:
                return abs(levels.index(level) - levels.index(difficulty))
            return 0 if level == difficulty else len(levels)

        scopes = [True] if strict_category else ([True, False] if category else [False])
        for excluded in exclusions:
            remaining = [row for row in candidates if row[0] not in excluded]
            for same_answer in (True, False):
                for in_category in scopes:
                    rows = [
                        row for row in remaining
                        if ((row[3] or "").upper() == answer) == same_answer and (not in_category or row[1] == category)
                    ]
                    for gap in sorted({distance(row[2]) for row in rows}):
                        group = [row for row in rows if distance(row[2]) == gap]
                        return rng.choice(sorted(group))[0]
        return None

    @staticmethod
    def _candidates(query):
        """The (id, category, difficulty, answer) rows `pick` chooses from."""
        return query.with_entities(
            Scenario.scenario_id, Scenario.category, Scenario.difficulty, Scenario.correct_answer,
        ).order_by(Scenario.scenario_id).all()

    @staticmethod
    def _player_payload(scenario, completed_ids, player, channel_attempts):
        """What a player may see before deciding: never the answer or clues. The clue buttons are drawn for
        this showing of the message (see round_key), and the scoring draws the same ones."""
        key = round_key(player.player_id if player else 0, channel_attempts, scenario.scenario_id)
        return {
            "scenario_id": scenario.scenario_id,
            "simulation_type": scenario.simulation_type,
            "category": scenario.category,
            "difficulty": scenario.difficulty,
            "sender": scenario.sender,
            "subject": scenario.subject,
            "message": scenario.message,
            "attachment": scenario.attachment,
            "clue_options": clue_options(scenario, key),
            "already_completed": scenario.scenario_id in completed_ids,
        }

    @staticmethod
    def _active_query(simulation_type):
        """Active scenarios of one channel."""
        return Scenario.query.filter(
            db.func.upper(Scenario.simulation_type) == simulation_type,
            db.func.upper(Scenario.status) == "ACTIVE",
        )

    @staticmethod
    def mistakes_to_review(channel_attempts):
        """Scenarios whose latest answer was wrong, skipping the most recent few."""
        latest_result = {}
        for attempt in channel_attempts:
            latest_result.setdefault(attempt.scenario_id, attempt.correct)

        recent = {a.scenario_id for a in channel_attempts[:ScenarioService.MISTAKE_REVIEW_GAP]}
        return [
            scenario_id for scenario_id, correct in latest_result.items()
            if not correct and scenario_id not in recent
        ]

    @staticmethod
    def get_review_scenario(simulation_type, user_id):
        """CATCH "Help": bring back a scenario the player got wrong earlier."""
        simulation_type = simulation_type.upper()
        player, attempts, difficulty, difficulty_reason = ScenarioService._player_history(user_id)
        channel_attempts = [a for a in attempts if a.simulation_type.upper() == simulation_type]
        mistake_ids = ScenarioService.mistakes_to_review(channel_attempts)

        scenario = ScenarioService._active_query(simulation_type).filter(
            Scenario.scenario_id.in_(mistake_ids)
        ).order_by(db.func.random()).first() if mistake_ids else None
        if not scenario:
            return False, "No mistakes to review right now. Nice work!", {"no_mistakes": True}

        completed_ids = {a.scenario_id for a in channel_attempts}
        occupation = player.profile.occupation if player and player.profile else None
        return True, "Here's one you missed before. Take another look.", {
            **ScenarioService._player_payload(scenario, completed_ids, player, channel_attempts),
            "completed_count": len(completed_ids),
            "mistakes_to_review": len(mistake_ids),
            "total_active": ScenarioService._active_query(simulation_type).count(),
            "practice_category": scenario.category,
            "category_reason": "Second chance at a scenario you got wrong",
            "adaptive_context": {
                "occupation": getattr(occupation, "value", None),
                "mode": "Mistake review",
                "recommended_difficulty": difficulty,
                "difficulty_reason": difficulty_reason,
            },
            "practice_categories": [],
        }

    @staticmethod
    def get_random_scenario(simulation_type, user_id, include_completed=False, focus_category=None):
        """Choose the next scenario for a player. The answer is never included."""
        simulation_type = simulation_type.upper()
        player, attempts, difficulty, difficulty_reason = ScenarioService._player_history(user_id)

        channel_attempts = [a for a in attempts if a.simulation_type.upper() == simulation_type]
        completed_ids = {attempt.scenario_id for attempt in channel_attempts}
        recent_ids = [a.scenario_id for a in channel_attempts[:ScenarioService.COOLDOWN_ATTEMPTS]]

        active_query = ScenarioService._active_query(simulation_type)
        total_active = active_query.count()
        categories = [
            category for (category,) in active_query.with_entities(
                Scenario.category
            ).distinct().order_by(Scenario.category).all()
        ]
        category_attempts = ScenarioService._attempts_by_category(
            attempts, categories, simulation_type,
        )
        available_by_category = dict(
            active_query.with_entities(Scenario.category, db.func.count())
            .group_by(Scenario.category).all()
        )

        occupation = player.profile.occupation if player and player.profile else None
        requested_category = str(focus_category or "").strip()
        if requested_category in category_attempts:
            practice_category, category_reason = requested_category, "Player-selected focus category"
        else:
            requested_category = ""
            practice_category, category_reason = AdaptiveEngine.recommend_category(
                category_attempts, occupation,
            )

        # Phishing or genuine is decided first, so neither the difficulty nor the category gives it away
        candidates = ScenarioService._candidates(active_query)
        answer = AdaptiveEngine.recommend_answer(channel_attempts)
        exclusions = [set(recent_ids), set()] if include_completed else [completed_ids]
        scenario_id = ScenarioService.pick(
            candidates, answer, practice_category, difficulty, exclusions,
            strict_category=bool(requested_category),
        )
        scenario = db.session.get(Scenario, scenario_id) if scenario_id else None
        if scenario and practice_category and scenario.category != practice_category:
            # Says only what was served: naming why could hint at the answer
            practice_category, category_reason = scenario.category, "Mixed practice across categories"

        if not scenario:
            if total_active and not include_completed:
                message = (
                    f"You have completed every {requested_category} scenario. Retake one or pick another track."
                    if requested_category
                    else "You have completed every available scenario. Retake one to keep practising."
                )
                return False, message, {
                    "all_completed": True,
                    "completed_count": len(completed_ids),
                    "total_active": total_active,
                }
            return False, "No scenarios are currently available.", None

        return True, "Scenario retrieved successfully.", {
            **ScenarioService._player_payload(scenario, completed_ids, player, channel_attempts),
            "completed_count": len(completed_ids),
            "mistakes_to_review": len(ScenarioService.mistakes_to_review(channel_attempts)),
            "total_active": total_active,
            "practice_category": practice_category,
            "category_reason": category_reason,
            "adaptive_context": {
                "occupation": getattr(occupation, "value", None),
                "mode": "Focused practice" if requested_category else "Adaptive mix",
                "recommended_difficulty": difficulty,
                "difficulty_reason": difficulty_reason,
            },
            "practice_categories": [
                ScenarioService._category_summary(
                    category, category_attempts[category], available_by_category.get(category, 0),
                    ScenarioService.is_mixed(candidates, category),
                )
                for category in categories
            ],
        }

    @staticmethod
    def is_mixed(candidates, category):
        """True when a category's live scenarios hold both answers, neither under UNEVEN_SHARE (the rule the
        admin's balance card uses). Only such a category is offered for focused practice: in a one-sided one
        the player would soon see only one answer, which gives it away."""
        answers = [(row[3] or "").upper() for row in candidates if row[1] == category]
        if not answers:
            return False
        phishing = answers.count("REPORT")
        return min(phishing, len(answers) - phishing) / len(answers) >= ScenarioService.UNEVEN_SHARE

    @staticmethod
    def _category_summary(category, attempts, available, focusable=True):
        """One category's numbers for the practice picker."""
        return {
            "name": category,
            "available": available,
            "focusable": focusable,
            "attempts": len(attempts),
            "accuracy": round(
                sum(attempt.correct for attempt in attempts) / len(attempts) * 100
            ) if attempts else None,
        }
