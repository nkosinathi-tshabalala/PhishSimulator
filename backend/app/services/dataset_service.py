# Dataset upload and processing (CATCH "Approve")

import csv
import json
import os
import re
from uuid import uuid4

from werkzeug.utils import secure_filename

from app.extensions import db
from app.datasets.scenario_parser import ScenarioParser
from app.datasets.scenario_realism import enrich_scenario, quality_score
from app.schemas.dataset_schema import DatasetSchema
from app.models.datasets import Dataset, DatasetRecord
from app.models.email import EmailCampaign
from app.models.scenario import Scenario
from app.models.simulation import SimulationAttempt, UserAction
from app.models.analytics import FeedbackReport, PerformanceTracker


UPLOAD_FOLDER = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "uploads",
    "datasets",
)

csv.field_size_limit(10_000_000)

MAX_REJECTED_SHARE = 0.5

BATCH_SIZE = 500

REPROCESS_STATUSES = {"DRAFT", "REJECTED"}


class DatasetService:
    """Uploads datasets and turns their rows into draft scenarios."""

    @staticmethod
    def _scenario_counts(dataset_ids):
        """How many scenarios each dataset has at each review stage (one query)."""
        counts = {dataset_id: {} for dataset_id in dataset_ids}
        if not dataset_ids:
            return counts

        rows = (
            db.session.query(Scenario.dataset_id, db.func.upper(Scenario.status), db.func.count())
            .filter(Scenario.dataset_id.in_(dataset_ids))
            .group_by(Scenario.dataset_id, db.func.upper(Scenario.status))
            .all()
        )
        for dataset_id, status, count in rows:
            counts[dataset_id][status] = count
        return counts

    @staticmethod
    def _serialize(dataset, scenario_counts):
        """A dataset as JSON for the admin page."""
        return {
            "dataset_id": dataset.dataset_id,
            "name": dataset.name,
            "dataset_type": dataset.dataset_type,
            "file_format": dataset.file_format,
            "record_count": dataset.record_count,
            "status": dataset.status,
            "uploaded_at": dataset.uploaded_at.strftime("%Y-%m-%d"),
            "scenario_counts": scenario_counts,
            "quality_report": json.loads(dataset.quality_report) if dataset.quality_report else None,
        }

    @staticmethod
    def get_datasets():
        """Every dataset, newest first."""
        datasets = Dataset.query.order_by(Dataset.uploaded_at.desc()).all()
        counts = DatasetService._scenario_counts([dataset.dataset_id for dataset in datasets])
        return True, "Datasets retrieved successfully.", [
            DatasetService._serialize(dataset, counts[dataset.dataset_id]) for dataset in datasets
        ]

    @staticmethod
    def get_dataset(dataset_id):
        """One dataset with its scenario counts."""
        dataset = db.session.get(Dataset, dataset_id)
        if not dataset:
            return False, "Dataset not found.", None
        counts = DatasetService._scenario_counts([dataset_id])
        return True, "Dataset retrieved successfully.", DatasetService._serialize(dataset, counts[dataset_id])

    @staticmethod
    def _read_rows(filepath, extension):
        """Return the rows of a CSV or JSON file as a list of dictionaries."""
        if extension == "csv":
            with open(filepath, newline="", encoding="utf-8-sig", errors="replace") as csv_file:
                reader = csv.DictReader(csv_file)
                if not reader.fieldnames:
                    raise ValueError("CSV files must include a header row.")
                return list(reader)

        with open(filepath, encoding="utf-8-sig") as json_file:
            rows = json.load(json_file)
        if isinstance(rows, dict):
            rows = rows.get("records", rows.get("data", []))
        if not isinstance(rows, list):
            raise ValueError("JSON must contain a list of records.")
        return rows

    @staticmethod
    def find_label_leaks(records):
        """Find line labels (like "Keywords:") that only one kind of message uses."""
        prefixes_by_label = {"PHISHING": [], "LEGITIMATE": []}
        for record in records:
            if record["label"] in prefixes_by_label:
                found = set(re.findall(r"(?m)^\s*([A-Za-z]{3,20}):", record["message"]))
                prefixes_by_label[record["label"]].append(found)

        phishing, legitimate = prefixes_by_label["PHISHING"], prefixes_by_label["LEGITIMATE"]
        if not phishing or not legitimate:
            return []

        leaks = []
        for prefix in sorted(set().union(*phishing, *legitimate)):
            phishing_share = sum(prefix in found for found in phishing) / len(phishing)
            legitimate_share = sum(prefix in found for found in legitimate) / len(legitimate)
            if max(phishing_share, legitimate_share) >= 0.8 and min(phishing_share, legitimate_share) <= 0.05:
                leaks.append(f"{prefix}:")
        return leaks

    @staticmethod
    def guess_channel(records):
        """Guess if the messages are emails or texts: "EMAIL", "SMS" or None when unsure."""
        if len(records) < 5:
            return None

        total = len(records)
        lengths = sorted(len(record["message"]) for record in records)
        median_length = lengths[total // 2]
        with_subject = sum(bool(record["subject"]) for record in records) / total
        with_email_sender = sum("@" in (record["sender"] or "") for record in records) / total
        multi_line = sum("\n" in record["message"].strip() for record in records) / total

        # Emails usually have subjects, email senders and long, multi-line bodies
        email_points = (
            (2 if with_subject >= 0.5 else 0)
            + (1 if with_email_sender >= 0.5 else 0)
            + (2 if median_length >= 400 else 0)
            + (1 if multi_line >= 0.5 else 0)
        )
        # Texts are short, single-line and have no subject
        sms_points = (
            (1 if with_subject < 0.1 else 0)
            + (2 if median_length <= 200 else 0)
            + (1 if multi_line <= 0.1 else 0)
        )

        if email_points - sms_points >= 2:
            return "EMAIL"
        if sms_points - email_points >= 2:
            return "SMS"
        return None

    @staticmethod
    def check_quality(rows, dataset_type):
        """Parse every row and build the quality report shown to the admin."""
        report = {
            "total_rows": len(rows),
            "empty_rows": 0,
            "too_short": 0,
            "too_long": 0,
            "unreadable": 0,
            "duplicates": 0,
            "unlabelled": 0,
            "personal_data": 0,
            "usable_labelled": 0,
        }
        records = []
        parsed = []
        seen_messages = set()

        for row in rows:
            record = ScenarioParser.parse_row(row, dataset_type) if isinstance(row, dict) else None
            if not record:
                report["empty_rows"] += 1
                continue
            parsed.append(record)
            if len(record["message"]) < ScenarioParser.MIN_MESSAGE_LENGTH:
                report["too_short"] += 1
                continue
            if len(record["message"]) > ScenarioParser.MAX_MESSAGE_LENGTH:
                report["too_long"] += 1
                continue
            if ScenarioParser.is_unreadable(record["message"]):
                report["unreadable"] += 1
                continue
            if record["message"] in seen_messages:
                report["duplicates"] += 1
                continue

            seen_messages.add(record["message"])
            records.append(record)
            if record["label"] is None:
                report["unlabelled"] += 1
            else:
                report["usable_labelled"] += 1
            if ScenarioParser.find_personal_data(record["message"]):
                report["personal_data"] += 1

        report["label_leaks"] = DatasetService.find_label_leaks(records)
        # Stop an SMS file being uploaded as email, and the other way round
        report["looks_like"] = DatasetService.guess_channel(parsed)
        report["channel_mismatch"] = report["looks_like"] not in (None, dataset_type)

        unusable = sum(report[key] for key in ("empty_rows", "too_short", "too_long", "unreadable", "duplicates"))
        report["quality_ok"] = (
            report["usable_labelled"] > 0
            and unusable <= report["total_rows"] * MAX_REJECTED_SHARE
            and not report["label_leaks"]
            and not report["channel_mismatch"]
        )
        return records, report

    @staticmethod
    def upload_dataset(file, dataset_type):
        """Save an uploaded file, then import it (used by the Datasets page)."""
        valid, message = DatasetSchema.validate_upload(file, dataset_type)
        if not valid:
            return False, message, None

        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        original_name = secure_filename(file.filename)
        filepath = os.path.join(UPLOAD_FOLDER, f"{uuid4().hex}_{original_name}")
        file.save(filepath)

        return DatasetService.import_file(filepath, original_name, dataset_type)

    @staticmethod
    def import_file(filepath, original_name, dataset_type):
        """Check a dataset file and turn its labelled rows into draft scenarios."""
        dataset_type = dataset_type.upper()
        extension = original_name.rsplit(".", 1)[-1].lower()

        try:
            rows = DatasetService._read_rows(filepath, extension)
        except (OSError, UnicodeDecodeError, csv.Error, json.JSONDecodeError, ValueError) as error:
            os.remove(filepath)
            return False, f"Could not read dataset: {error}", None

        records, report = DatasetService.check_quality(rows, dataset_type)
        if not report["quality_ok"]:
            os.remove(filepath)
            return False, DatasetService._rejection_message(report), {"quality_report": report}

        dataset = Dataset(
            name=original_name,
            dataset_type=dataset_type,
            file_format=extension.upper(),
            filename=os.path.basename(filepath),
            record_count=len(records),
            status="PROCESSING",
        )
        try:
            db.session.add(dataset)
            db.session.flush()
            dataset_id = dataset.dataset_id
            generated_by_category = DatasetService._store_records(dataset_id, records)

            report["generated_drafts"] = sum(generated_by_category.values())
            dataset = db.session.get(Dataset, dataset_id)
            dataset.status = "IN_REVIEW"
            dataset.quality_report = json.dumps(report)
            db.session.commit()
        except Exception:
            db.session.rollback()
            os.remove(filepath)
            raise

        return True, "Dataset passed the quality check. Draft scenarios are ready for review.", {
            "dataset_id": dataset_id,
            "record_count": len(records),
            "generated_scenarios": report["generated_drafts"],
            "generated_by_category": [
                {"category": category, "count": count}
                for category, count in sorted(generated_by_category.items())
            ],
            "quality_report": report,
            "status": "IN_REVIEW",
        }

    @staticmethod
    def _rejection_message(report):
        """Explain to the admin why a file was rejected."""
        if report["channel_mismatch"]:
            detected = "email" if report["looks_like"] == "EMAIL" else "SMS"
            chosen = "SMS" if detected == "email" else "Email"
            return (
                f"Dataset rejected: this file looks like an {detected} dataset, but it was uploaded as {chosen}. "
                f"Choose {detected.upper() if detected == 'SMS' else 'Email'} as the dataset type and upload it again."
            )
        if report["label_leaks"]:
            return (
                "Dataset rejected: the formatting gives the answer away "
                f"({', '.join(report['label_leaks'])} only appears in one kind of message)."
            )
        return "Dataset rejected by the quality check. See the report for details."

    @staticmethod
    def _store_records(dataset_id, records):
        """Save every record, and a draft scenario for each labelled one."""
        generated_by_category = {}

        for index, record in enumerate(records, start=1):
            is_labelled = record["label"] is not None
            db.session.add(DatasetRecord(
                dataset_id=dataset_id,
                message_type=record["message_type"],
                category=record["category"],
                difficulty=record["difficulty"],
                sender=record["sender"],
                subject=record["subject"],
                message=record["message"],
                label=record["label"],
                processed=is_labelled,
            ))

            if is_labelled:
                scenario = Scenario(
                    title=ScenarioParser.build_scenario_title(
                        record["message_type"], record["subject"], record["message"],
                    ),
                    simulation_type=record["message_type"],
                    category=record["category"],
                    difficulty=record["difficulty"],
                    sender=record["sender"],
                    subject=record["subject"],
                    message=record["message"],
                    correct_answer="REPORT" if record["label"] == "PHISHING" else "SAFE",
                    status="DRAFT",
                    dataset_id=dataset_id,
                )
                scenario.set_phishing_cues(record["phishing_cues"])
                enrich_scenario(scenario)
                db.session.add(scenario)
                category = record["category"]
                generated_by_category[category] = generated_by_category.get(category, 0) + 1

            if index % BATCH_SIZE == 0:
                db.session.flush()
                db.session.expunge_all()

        db.session.flush()
        return generated_by_category

    @staticmethod
    def reprocess(dataset_id):
        """Re-apply the realism rules to a dataset's unreviewed drafts."""
        dataset = db.session.get(Dataset, dataset_id)
        if not dataset:
            return False, "Dataset not found.", None

        updated = rescored = 0
        scenario_ids = DatasetService._scenario_ids(dataset_id)
        for start in range(0, len(scenario_ids), BATCH_SIZE):
            batch = Scenario.query.filter(
                Scenario.scenario_id.in_(scenario_ids[start:start + BATCH_SIZE])
            ).all()
            for scenario in batch:
                if (scenario.status or "DRAFT").upper() in REPROCESS_STATUSES:
                    enrich_scenario(scenario)
                    updated += 1
                else:
                    scenario.quality_score = quality_score(
                        scenario.simulation_type,
                        scenario.sender,
                        scenario.subject,
                        scenario.message,
                        scenario.correct_answer.upper() == "REPORT",
                        scenario.get_phishing_cues(),
                    )
                    rescored += 1
            db.session.commit()

        return True, f"Re-processed {updated} draft(s) and re-scored {rescored} reviewed scenario(s).", {
            "updated": updated,
            "rescored": rescored,
        }

    @staticmethod
    def _scenario_ids(dataset_id):
        """Ids of every scenario from one dataset."""
        return [
            scenario_id for (scenario_id,) in
            db.session.query(Scenario.scenario_id).filter_by(dataset_id=dataset_id).all()
        ]

    @staticmethod
    def _delete_attempts(scenario_ids):
        """Remove attempts on deleted scenarios and recalculate the players' totals."""
        attempt_rows = db.session.query(
            SimulationAttempt.attempt_id, SimulationAttempt.player_id,
        ).filter(SimulationAttempt.scenario_id.in_(scenario_ids)).all()
        if not attempt_rows:
            return

        attempt_ids = [attempt_id for attempt_id, _ in attempt_rows]
        for model in (FeedbackReport, UserAction):
            db.session.query(model).filter(model.attempt_id.in_(attempt_ids)).delete(synchronize_session=False)
        db.session.query(SimulationAttempt).filter(
            SimulationAttempt.attempt_id.in_(attempt_ids)
        ).delete(synchronize_session=False)

        for player_id in {player_id for _, player_id in attempt_rows}:
            tracker = PerformanceTracker.query.filter_by(player_id=player_id).first()
            if not tracker:
                continue
            remaining = SimulationAttempt.query.filter_by(player_id=player_id).all()
            tracker.total_attempts = len(remaining)
            tracker.correct_attempts = sum(attempt.correct for attempt in remaining)
            tracker.total_score = sum(attempt.score or 0 for attempt in remaining)

    @staticmethod
    def delete_dataset(dataset_id):
        """Delete a dataset, its scenarios, and any attempts on those scenarios."""
        dataset = db.session.get(Dataset, dataset_id)
        if not dataset:
            return False, "Dataset not found.", None

        # Campaigns must keep their scenario: the database would refuse the delete anyway
        campaigns = EmailCampaign.query.join(
            Scenario, EmailCampaign.scenario_id == Scenario.scenario_id,
        ).filter(Scenario.dataset_id == dataset_id).all()
        if campaigns:
            names = ", ".join(f'"{campaign.name}"' for campaign in campaigns[:3])
            more = f" and {len(campaigns) - 3} more" if len(campaigns) > 3 else ""
            return False, (
                f"Email campaigns use this dataset's scenarios ({names}{more}), so it cannot be deleted. "
                "Delete any draft or failed ones first. A launched campaign keeps its dataset in place."
            ), None

        scenario_ids = DatasetService._scenario_ids(dataset_id)
        try:
            for start in range(0, len(scenario_ids), BATCH_SIZE):
                batch = scenario_ids[start:start + BATCH_SIZE]
                DatasetService._delete_attempts(batch)
                db.session.query(Scenario).filter(
                    Scenario.scenario_id.in_(batch)
                ).delete(synchronize_session=False)

            db.session.delete(dataset)
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise

        filepath = os.path.join(UPLOAD_FOLDER, dataset.filename)
        if os.path.exists(filepath):
            os.remove(filepath)

        return True, "Dataset and its generated scenarios deleted successfully.", {
            "deleted_scenarios": len(scenario_ids),
        }
