from app.extensions import db

from app.models.scenario import Scenario
from app.models.authentication import Player
from app.models.baseline import BaselineAssessment
from app.models.simulation import SimulationAttempt
from app.adaptive.adaptive_engine import AdaptiveEngine

from app.schemas.scenario_schema import ScenarioSchema


class ScenarioService:

    @staticmethod
    def display_title(scenario):
        """Give legacy generated rows a distinct title without changing answers."""
        if scenario.title == "Dataset training scenario":
            return f"{scenario.simulation_type.title()} training scenario #{scenario.scenario_id}"
        return scenario.title


    @staticmethod
    def get_scenarios(page=1, per_page=25):
        """Load scenario rows in pages so large uploaded datasets remain usable."""

        page = max(int(page), 1)
        per_page = min(max(int(per_page), 1), 100)
        query = Scenario.query.order_by(Scenario.created_at.desc())
        scenario_page = query.paginate(
            page=page,
            per_page=per_page,
            error_out=False,
        )
        scenarios = scenario_page.items

        scenario_data = [

            {

                "scenario_id": s.scenario_id,

                "title": ScenarioService.display_title(s),

                "simulation_type": s.simulation_type,

                "category": s.category,

                "difficulty": s.difficulty,

                "status": s.status,

                "uses": SimulationAttempt.query.filter_by(
                    scenario_id=s.scenario_id
                ).count()

            }

            for s in scenarios

        ]
        categories = {}

        category_rows = db.session.query(
            Scenario.category,
            db.func.count(Scenario.scenario_id),
        ).group_by(Scenario.category).all()

        return True, "Scenarios retrieved successfully.", {
            "scenarios": scenario_data,
            "stats": {
                "total": Scenario.query.count(),
                "active": Scenario.query.filter(
                    db.func.upper(Scenario.status) == "ACTIVE"
                ).count(),
                "email": Scenario.query.filter(
                    db.func.upper(Scenario.simulation_type) == "EMAIL"
                ).count(),
                "sms": Scenario.query.filter(
                    db.func.upper(Scenario.simulation_type) == "SMS"
                ).count(),
            },
            "categories": [
                {"name": name, "count": count}
                for name, count in sorted(category_rows)
            ],
            "pagination": {
                "page": scenario_page.page,
                "per_page": scenario_page.per_page,
                "pages": scenario_page.pages,
                "total": scenario_page.total,
            },
        }


    @staticmethod
    def create_scenario(data):

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

            correct_answer=data["correct_answer"],

            feedback=data.get("feedback")

        )

        if data.get("phishing_cues"):

            scenario.set_phishing_cues(

                data["phishing_cues"]

            )

        db.session.add(scenario)

        db.session.commit()

        return True, "Scenario created successfully.", {

            "scenario_id": scenario.scenario_id

        }


    @staticmethod
    def get_random_scenario(simulation_type, user_id=None, include_completed=False):

        difficulty = None
        completed_ids = set()

        if user_id:
            player = Player.query.filter_by(user_id=user_id).first()
            if player:
                attempts = SimulationAttempt.query.filter_by(
                    player_id=player.player_id
                ).order_by(SimulationAttempt.attempted_at.desc()).all()
                baseline = BaselineAssessment.query.filter(
                    BaselineAssessment.player_id == player.player_id,
                    BaselineAssessment.completed_at.is_not(None),
                ).order_by(BaselineAssessment.completed_at.desc()).first()
                difficulty, _ = AdaptiveEngine.recommend_difficulty(
                    attempts,
                    baseline.score if baseline else None,
                )
                completed_ids = {
                    attempt.scenario_id for attempt in attempts
                    if attempt.simulation_type == simulation_type
                }

        base_query = Scenario.query.filter_by(
            simulation_type=simulation_type,
            status="ACTIVE",
        )
        total_active = base_query.count()

        def pick(query):
            if not include_completed and completed_ids:
                query = query.filter(~Scenario.scenario_id.in_(completed_ids))
            return query.order_by(db.func.random()).first()

        scenario = pick(base_query.filter(Scenario.difficulty == difficulty)) if difficulty else None

        if not scenario:
            scenario = pick(base_query)

        if not scenario:
            if total_active and not include_completed:
                return False, "You have completed every available scenario. Retake one to keep practicing.", {
                    "all_completed": True,
                    "completed_count": len(completed_ids),
                    "total_active": total_active,
                }
            return False, "No scenarios are currently available.", None

        return True, "Scenario retrieved successfully.", {

            "scenario_id": scenario.scenario_id,

            "title": scenario.title,

            "simulation_type": scenario.simulation_type,

            "category": scenario.category,

            "difficulty": scenario.difficulty,

            "sender": scenario.sender,

            "subject": scenario.subject,

            "message": scenario.message,

            "correct_answer": scenario.correct_answer,

            "feedback": scenario.feedback,

            "phishing_cues": scenario.get_phishing_cues(),

            "status": scenario.status,

            "already_completed": scenario.scenario_id in completed_ids,

            "completed_count": len(completed_ids),

            "total_active": total_active,

        }

    @staticmethod
    def evaluate_answer(data):

        scenario = Scenario.query.get(

            data.get("scenario_id")

        )

        if not scenario:

            return False, "Scenario not found.", None

        player_answer = data.get(

            "answer",

            ""

        ).upper()

        correct = (

            player_answer ==

            scenario.correct_answer.upper()

        )

        return True, "Answer evaluated successfully.", {

            "correct": correct,

            "correct_answer": scenario.correct_answer,

            "feedback": scenario.feedback,

            "phishing_cues": scenario.get_phishing_cues(),

            "next_scenario": True

        }

    @staticmethod
    def get_scenario(scenario_id):

        scenario = Scenario.query.get(scenario_id)

        if not scenario:

            return False, "Scenario not found.", None

        return True, "Scenario retrieved successfully.", {

            "scenario_id": scenario.scenario_id,

            "title": scenario.title,

            "simulation_type": scenario.simulation_type,

            "category": scenario.category,

            "difficulty": scenario.difficulty,

            "sender": scenario.sender,

            "subject": scenario.subject,

            "message": scenario.message,

            "correct_answer": scenario.correct_answer,

            "feedback": scenario.feedback,

            "phishing_cues": scenario.get_phishing_cues(),

            "status": scenario.status

        }

    @staticmethod
    def update_scenario(scenario_id, data):
        scenario = db.session.get(Scenario, scenario_id)

        if not scenario:
            return False, "Scenario not found.", None

        valid, message = ScenarioSchema.validate_update(data)

        if not valid:
            return False, message, None

        editable_fields = (
            "title",
            "simulation_type",
            "category",
            "difficulty",
            "sender",
            "subject",
            "message",
            "correct_answer",
            "feedback",
            "status",
        )
        for field in editable_fields:
            if field in data:
                setattr(scenario, field, data[field])

        scenario.set_phishing_cues(data.get("phishing_cues", []))
        db.session.commit()

        return True, "Scenario updated successfully.", {
            "scenario_id": scenario.scenario_id,
        }

    @staticmethod
    def delete_scenario(scenario_id):
        scenario = db.session.get(Scenario, scenario_id)

        if not scenario:
            return False, "Scenario not found.", None

        if SimulationAttempt.query.filter_by(scenario_id=scenario_id).first():
            return False, "Scenarios with simulation attempts cannot be deleted.", None

        db.session.delete(scenario)
        db.session.commit()

        return True, "Scenario deleted successfully.", None
