import os
import csv
import json
from uuid import uuid4

from app.datasets.scenario_parser import ScenarioParser
from app.schemas.dataset_schema import DatasetSchema

from werkzeug.utils import secure_filename

from app.extensions import db

from app.models.datasets import Dataset, DatasetRecord
from app.models.scenario import Scenario
from app.models.simulation import SimulationAttempt, UserAction
from app.models.analytics import FeedbackReport, PerformanceTracker


UPLOAD_FOLDER = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "uploads",
    "datasets",
)

# Several supplied corpus files contain raw MIME messages that exceed the
# standard CSV module's 128 KiB field limit.
csv.field_size_limit(10_000_000)


class DatasetService:

    @staticmethod
    def get_datasets():

        datasets = Dataset.query.order_by(
            Dataset.uploaded_at.desc()
        ).all()

        return True, "Datasets retrieved successfully.", [

            {
                "dataset_id": dataset.dataset_id,
                "name": dataset.name,
                "dataset_type": dataset.dataset_type,
                "file_format": dataset.file_format,
                "record_count": dataset.record_count,
                "status": dataset.status,
                "uploaded_at": dataset.uploaded_at.strftime(
                    "%Y-%m-%d"
                )
            }

            for dataset in datasets

        ]


    @staticmethod
    def upload_dataset(file, dataset_type):
        valid, message = DatasetSchema.validate_upload(file, dataset_type)
        if not valid:
            return False, message, None

        dataset_type = dataset_type.upper()
        original_filename = secure_filename(file.filename)
        extension = original_filename.rsplit(".", 1)[1].lower()
        filename = f"{uuid4().hex}_{original_filename}"

        os.makedirs(
            UPLOAD_FOLDER,
            exist_ok=True
        )

        filepath = os.path.join(
            UPLOAD_FOLDER,
            filename
        )

        file.save(filepath)

        try:
            if extension == "csv":
                with open(filepath, newline="", encoding="utf-8-sig", errors="replace") as csv_file:
                    reader = csv.DictReader(csv_file)
                    if not reader.fieldnames:
                        return False, "CSV files must include a header row.", None
                    processed_records = ScenarioParser.parse_dataset(reader, dataset_type)
            else:
                with open(filepath, encoding="utf-8-sig") as json_file:
                    rows = json.load(json_file)
                if isinstance(rows, dict):
                    rows = rows.get("records", rows.get("data", []))
                if not isinstance(rows, list):
                    return False, "JSON must contain a list of records.", None
                processed_records = ScenarioParser.parse_dataset(rows, dataset_type)
        except (OSError, UnicodeDecodeError, csv.Error, json.JSONDecodeError) as error:
            return False, f"Could not read dataset: {error}", None

        if not processed_records:
            return False, "No usable messages were found. Include a text/body/content field.", None

        record_count = len(processed_records)

        dataset = Dataset(

            name=original_filename,

            dataset_type=dataset_type,

            file_format=extension.upper(),

            filename=filename,

            record_count=record_count,

            status="PROCESSING"

        )

        try:
            db.session.add(dataset)
            db.session.flush()

            generated_scenarios = 0
            for index, processed_record in enumerate(processed_records, start=1):
                record = DatasetRecord(
                    dataset_id=dataset.dataset_id,
                    message_type=processed_record["message_type"],
                    category=processed_record["category"],
                    difficulty=processed_record["difficulty"],
                    sender=processed_record["sender"],
                    subject=processed_record["subject"],
                    message=processed_record["message"],
                    label=processed_record["label"],
                    processed=False,
                )
                db.session.add(record)

                scenario = None
                if processed_record["label"] is not None:
                    scenario = Scenario(
                        title=ScenarioParser.build_scenario_title(
                            processed_record["message_type"],
                            processed_record["subject"],
                            processed_record["message"],
                        ),
                        simulation_type=processed_record["message_type"],
                        category=processed_record["category"],
                        difficulty=processed_record["difficulty"],
                        sender=processed_record["sender"],
                        subject=processed_record["subject"],
                        message=processed_record["message"],
                        correct_answer=(
                            "REPORT"
                            if processed_record["label"] == "PHISHING"
                            else "SAFE"
                        ),
                        # Feedback is generated from the learner's actual
                        # decision when the scenario is attempted.
                        feedback=None,
                    )
                    scenario.set_phishing_cues(processed_record["phishing_cues"])
                    db.session.add(scenario)
                    record.processed = True
                    generated_scenarios += 1

                # The supplied email corpora can contain tens of thousands of
                # large raw messages. Flush batches so an upload does not keep
                # every SQLAlchemy object in memory until the final commit.
                if index % 500 == 0:
                    db.session.flush()
                    db.session.expunge_all()

            dataset.status = (
                "GENERATED" if generated_scenarios else "NEEDS_LABELS"
            )
            db.session.add(dataset)
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise

        return True, "Dataset uploaded and scenarios generated successfully.", {

            "dataset_id": dataset.dataset_id,

            "record_count": record_count,

            "processed_records": len(processed_records),

            "generated_scenarios": generated_scenarios,

            "status": dataset.status,

        }


    @staticmethod
    def delete_dataset(dataset_id):

        dataset = Dataset.query.get(dataset_id)

        if not dataset:

            return False, "Dataset not found.", None

        # Scenario does not yet have a dataset_id column. Match the generated
        # rows using the normalised data copied from DatasetRecord so existing
        # datasets and newly uploaded datasets both clean up correctly.
        records = DatasetRecord.query.filter_by(dataset_id=dataset_id).all()
        record_signatures = {
            (
                record.message_type,
                record.sender or "",
                record.subject or "",
                record.message,
                record.category or "",
                record.difficulty or "Easy",
                "REPORT" if record.label == "PHISHING" else "SAFE",
            )
            for record in records
            if record.processed and record.label in {"PHISHING", "LEGITIMATE"}
        }

        scenario_ids = []
        # Query by message in bounded groups: SQLite has a parameter limit and
        # the supplied datasets can contain many thousands of records.
        messages = list({signature[3] for signature in record_signatures})
        for start in range(0, len(messages), 500):
            candidates = Scenario.query.filter(
                Scenario.message.in_(messages[start:start + 500])
            ).all()
            for scenario in candidates:
                signature = (
                    scenario.simulation_type,
                    scenario.sender or "",
                    scenario.subject or "",
                    scenario.message,
                    scenario.category or "",
                    scenario.difficulty or "Easy",
                    scenario.correct_answer,
                )
                if signature in record_signatures:
                    scenario_ids.append(scenario.scenario_id)

        try:
            if scenario_ids:
                attempt_rows = db.session.query(
                    SimulationAttempt.attempt_id,
                    SimulationAttempt.player_id,
                ).filter(SimulationAttempt.scenario_id.in_(scenario_ids)).all()
                attempt_ids = [attempt_id for attempt_id, _ in attempt_rows]
                affected_player_ids = {player_id for _, player_id in attempt_rows}

                if attempt_ids:
                    db.session.query(FeedbackReport).filter(
                        FeedbackReport.attempt_id.in_(attempt_ids)
                    ).delete(synchronize_session=False)
                    db.session.query(UserAction).filter(
                        UserAction.attempt_id.in_(attempt_ids)
                    ).delete(synchronize_session=False)
                    db.session.query(SimulationAttempt).filter(
                        SimulationAttempt.scenario_id.in_(scenario_ids)
                    ).delete(synchronize_session=False)

                    for player_id in affected_player_ids:
                        tracker = PerformanceTracker.query.filter_by(
                            player_id=player_id
                        ).first()
                        if tracker:
                            remaining_attempts = SimulationAttempt.query.filter_by(
                                player_id=player_id
                            ).all()
                            tracker.total_attempts = len(remaining_attempts)
                            tracker.correct_attempts = sum(
                                attempt.correct for attempt in remaining_attempts
                            )
                            tracker.total_score = sum(
                                attempt.score or 0 for attempt in remaining_attempts
                            )

                db.session.query(Scenario).filter(
                    Scenario.scenario_id.in_(scenario_ids)
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


    @staticmethod
    def get_dataset(dataset_id):

        dataset = Dataset.query.get(dataset_id)

        if not dataset:

            return False, "Dataset not found.", None

        return True, "Dataset retrieved successfully.", {

            "dataset_id": dataset.dataset_id,

            "name": dataset.name,

            "dataset_type": dataset.dataset_type,

            "file_format": dataset.file_format,

            "record_count": dataset.record_count,

            "status": dataset.status,

            "uploaded_at": dataset.uploaded_at.strftime("%Y-%m-%d")

        }
