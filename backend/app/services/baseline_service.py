# Baseline assessments: marking answers and managing the role-based bank (CATCH "Check")

import json
from datetime import datetime
from pathlib import Path
from random import SystemRandom

from sqlalchemy import func

from app.extensions import db
from app.adaptive.adaptive_engine import AdaptiveEngine
from app.enums.occupation import Occupation
from app.models.authentication import Player
from app.models.baseline import BaselineAssessment, BaselineQuestion, BaselineResponse, BaselineTemplate
from app.schemas.baseline_schema import BaselineSchema


# The template bank: ready-made baseline assessments for each role, which the admin can switch on
TEMPLATE_FILE = Path(__file__).resolve().parent.parent / "seed" / "baseline_questions.json"


class BaselineService:
    """CATCH "Check" stage: keyword-scored baseline assessments that set the starting difficulty.

    Questions belong to named baseline assessments (e.g. "Student · Baseline assessment 1"). The admin
    switches an assessment on for its role; every player of that role can then take it, once. The most
    recent completed assessment sets the starting difficulty."""

    # A baseline assessment needs at least this many questions before it can be switched on (no upper limit)
    MIN_QUESTIONS = 5
    ROLES = tuple(occupation.value for occupation in Occupation)

    # ---------- serialising ----------

    @staticmethod
    def _serialize_question(question, include_answers=False):
        """Players only see the question; admins also see the hint and marking guide."""
        data = {
            "id": question.question_id,
            "question": question.question_text,
            "confidenceThreshold": question.confidence_threshold,
        }
        if include_answers:
            data.update({
                "templateId": question.template_id,
                "instruction": question.instruction,
                "expectedKeywords": question.get_expected_keywords(),
                "exampleAnswer": question.example_answer,
                "feedback": question.feedback,
            })
        return data

    @staticmethod
    def _role_label(occupation):
        """How a role is shown: "Student", or "All roles" for a general assessment."""
        return occupation or "All roles"

    @staticmethod
    def _serialize_template(template, include_questions=False):
        """A baseline assessment for the admin page, with how often it has been taken."""
        completed = [a for a in template.assessments if a.completed_at]
        count = len(template.questions)
        data = {
            "id": template.template_id,
            "name": template.name,
            "occupation": template.occupation,
            "role": BaselineService._role_label(template.occupation),
            "description": template.description or "",
            "isActive": template.is_active,
            "activatedAt": template.activated_at.isoformat() if template.activated_at else None,
            "questionCount": count,
            "ready": count >= BaselineService.MIN_QUESTIONS,
            "timesTaken": len(completed),
            "averageScore": round(sum(a.score for a in completed) / len(completed)) if completed else None,
        }
        if include_questions:
            data["questions"] = [
                BaselineService._serialize_question(question, include_answers=True)
                for question in template.questions
            ]
        return data

    @staticmethod
    def _serialize_result(response):
        """A marked answer, including the marking guide now that it's answered."""
        question = response.question
        return {
            "questionId": question.question_id,
            "question": question.question_text,
            "userAnswer": response.answer_text,
            "matchedKeywords": response.get_matched_keywords(),
            "expectedKeywords": question.get_expected_keywords(),
            "exampleAnswer": question.example_answer,
            "feedback": question.feedback,
            "score": response.score,
            "maxScore": len(question.get_expected_keywords()),
            "passed": response.passed,
        }

    @staticmethod
    def _confidence_level(overall_percent):
        """Label the overall quiz score."""
        if overall_percent >= AdaptiveEngine.BASELINE_PASS_SCORE:
            return "Intermediate"
        if overall_percent >= 40:
            return "Beginner"
        return "Novice"

    @staticmethod
    def _summary(assessment, responses):
        """The assessment result with every marked answer."""
        results = [BaselineService._serialize_result(response) for response in responses]
        overall_percent = round(assessment.score or 0)
        template = assessment.template
        return {
            "assessmentId": assessment.assessment_id,
            "templateId": assessment.template_id,
            "templateName": template.name if template else "Baseline assessment",
            "role": BaselineService._role_label(template.occupation) if template else None,
            "overallScore": overall_percent,
            "questionsPassed": sum(1 for response in responses if response.passed),
            "totalKeywordsMatched": sum(response.score for response in responses),
            "confidenceLevel": BaselineService._confidence_level(overall_percent),
            "startingDifficulty": AdaptiveEngine.starting_difficulty(overall_percent),
            "completedAt": (
                assessment.completed_at.isoformat() if assessment.completed_at else None
            ),
            "results": results,
        }

    # ---------- players ----------

    @staticmethod
    def _player_for(user_id):
        """The player profile for a user id."""
        return Player.query.filter_by(user_id=int(user_id)).first()

    @staticmethod
    def _owned_assessment(assessment_id, user_id):
        """Return the assessment only if it belongs to this user's player."""
        player = BaselineService._player_for(user_id)
        assessment = db.session.get(BaselineAssessment, assessment_id)
        if not player or not assessment or assessment.player_id != player.player_id:
            return None
        return assessment

    @staticmethod
    def _role_of(player):
        """The player's role as text ("Student"), or None when they have no profile."""
        return player.profile.occupation.value if player and player.profile else None

    @staticmethod
    def offered_to(player):
        """Active baseline assessments for this player's role (and general ones), oldest first."""
        role = BaselineService._role_of(player)
        return BaselineTemplate.query.filter(
            BaselineTemplate.is_active.is_(True),
            db.or_(BaselineTemplate.occupation == role, BaselineTemplate.occupation.is_(None)),
        ).order_by(BaselineTemplate.occupation.asc().nullslast(), BaselineTemplate.template_id.asc()).all()

    @staticmethod
    def _completed_by_template(player_id):
        """The player's completed assessment for each baseline assessment they have taken."""
        done = {}
        for assessment in BaselineAssessment.query.filter(
            BaselineAssessment.player_id == player_id,
            BaselineAssessment.completed_at.isnot(None),
            BaselineAssessment.template_id.isnot(None),
        ).order_by(BaselineAssessment.completed_at.asc()):
            done[assessment.template_id] = assessment
        return done

    @staticmethod
    def count_new_for(player):
        """How many active baseline assessments this player has not taken yet (for the dashboard)."""
        done = BaselineService._completed_by_template(player.player_id)
        return sum(1 for template in BaselineService.offered_to(player) if template.template_id not in done)

    @staticmethod
    def get_available(user_id):
        """The player's baseline assessments: the ones they can take and the ones they have taken."""
        player = BaselineService._player_for(user_id)
        if not player:
            return False, "Player profile not found.", None
        done = BaselineService._completed_by_template(player.player_id)
        offered = BaselineService.offered_to(player)
        rows = []
        for template in offered:
            assessment = done.get(template.template_id)
            rows.append({
                "templateId": template.template_id,
                "name": template.name,
                "role": BaselineService._role_label(template.occupation),
                "description": template.description or "",
                "questionCount": len(template.questions),
                "status": "completed" if assessment else "new",
                "assessmentId": assessment.assessment_id if assessment else None,
                "score": round(assessment.score) if assessment else None,
                "completedAt": assessment.completed_at.isoformat() if assessment else None,
            })
        # Taken earlier but since switched off: still listed, so the player can see their result
        offered_ids = {template.template_id for template in offered}
        for template_id, assessment in done.items():
            if template_id not in offered_ids:
                rows.append({
                    "templateId": template_id,
                    "name": assessment.template.name,
                    "role": BaselineService._role_label(assessment.template.occupation),
                    "description": assessment.template.description or "",
                    "questionCount": len(assessment.template.questions),
                    "status": "completed",
                    "assessmentId": assessment.assessment_id,
                    "score": round(assessment.score),
                    "completedAt": assessment.completed_at.isoformat(),
                })
        return True, "Baseline assessments retrieved successfully.", {
            "role": BaselineService._role_of(player),
            "assessments": rows,
            "newCount": sum(1 for row in rows if row["status"] == "new"),
        }

    @staticmethod
    def _randomised_questions(template, player_id):
        """The assessment's questions in a new order, avoiding the order of the player's last attempt at it."""
        questions = list(template.questions)
        SystemRandom().shuffle(questions)
        if len(questions) < 2:
            return questions

        previous = BaselineAssessment.query.filter(
            BaselineAssessment.player_id == player_id,
            BaselineAssessment.template_id == template.template_id,
        ).order_by(BaselineAssessment.started_at.desc()).first()
        if not previous:
            return questions
        previous_order = [
            response.question_id
            for response in BaselineResponse.query.filter_by(
                assessment_id=previous.assessment_id,
            ).order_by(BaselineResponse.response_id.asc()).all()
        ]
        if previous_order == [question.question_id for question in questions]:
            questions = questions[1:] + questions[:1]
        return questions

    @staticmethod
    def start_assessment(user_id, data=None):
        """Start one baseline assessment. Without a template id, the first one the player has not taken.
        Each baseline assessment can be taken once."""
        player = BaselineService._player_for(user_id)
        if not player:
            return False, "Player profile not found.", None

        data = data or {}
        done = BaselineService._completed_by_template(player.player_id)
        offered = BaselineService.offered_to(player)
        if data.get("template_id") is not None:
            template = next((t for t in offered if t.template_id == data.get("template_id")), None)
            if not template:
                return False, "That baseline assessment is not available for your role.", None
        else:
            template = next((t for t in offered if t.template_id not in done), None)
            if not template:
                if offered:
                    return False, "You have taken every baseline assessment available to you.", None
                return False, "No baseline assessment is switched on for your role yet. Please ask the admin.", None

        if template.template_id in done:
            return False, f"You have already taken {template.name}. Your result is saved.", None

        assessment = BaselineAssessment(player_id=player.player_id, template_id=template.template_id)
        db.session.add(assessment)
        db.session.commit()
        questions = BaselineService._randomised_questions(template, player.player_id)
        return True, "Baseline assessment started successfully.", {
            "assessment_id": assessment.assessment_id,
            "template_id": template.template_id,
            "name": template.name,
            "role": BaselineService._role_label(template.occupation),
            "questions": [BaselineService._serialize_question(question) for question in questions],
        }

    @staticmethod
    def submit_response(data, user_id):
        """Mark one answer by counting the expected keywords it contains."""
        is_valid, error = BaselineSchema.validate_submit_response(data)
        if not is_valid:
            return False, error, None

        assessment = BaselineService._owned_assessment(data["assessment_id"], user_id)
        if not assessment:
            return False, "Assessment not found.", None
        if assessment.completed_at:
            return False, "This assessment is already complete.", None

        question = db.session.get(BaselineQuestion, data["question_id"])
        if not question:
            return False, "Question not found.", None
        if assessment.template_id and question.template_id != assessment.template_id:
            return False, "That question is not part of this assessment.", None

        answer = data["answer_text"].lower()
        matched_keywords = [
            keyword for keyword in question.get_expected_keywords()
            if keyword.lower() in answer
        ]
        score = len(matched_keywords)

        response = BaselineResponse.query.filter_by(
            assessment_id=assessment.assessment_id,
            question_id=question.question_id,
        ).first() or BaselineResponse(
            assessment_id=assessment.assessment_id,
            question_id=question.question_id,
        )
        response.answer_text = data["answer_text"]
        response.matched_keywords = ",".join(matched_keywords)
        response.score = score
        response.passed = score >= question.confidence_threshold
        db.session.add(response)
        db.session.commit()

        return True, "Response submitted successfully.", BaselineService._serialize_result(response)

    @staticmethod
    def complete_assessment(data, user_id):
        """Work out the overall percentage and the starting difficulty. Every question must be answered."""
        is_valid, error = BaselineSchema.validate_complete_assessment(data)
        if not is_valid:
            return False, error, None

        assessment = BaselineService._owned_assessment(data["assessment_id"], user_id)
        if not assessment:
            return False, "Assessment not found.", None
        if assessment.completed_at:
            return False, "This assessment is already complete.", None

        responses = BaselineResponse.query.filter_by(
            assessment_id=assessment.assessment_id
        ).order_by(BaselineResponse.response_id.asc()).all()
        if not responses:
            return False, "No responses found.", None
        if assessment.template:
            answered = {response.question_id for response in responses}
            unanswered = [q for q in assessment.template.questions if q.question_id not in answered]
            if unanswered:
                return False, f"Answer every question before finishing ({len(unanswered)} left).", None

        total_score = sum(response.score for response in responses)
        total_max = sum(len(response.question.get_expected_keywords()) for response in responses)

        assessment.score = round(total_score / total_max * 100) if total_max else 0
        assessment.completed_at = datetime.utcnow()
        db.session.commit()

        return True, "Assessment completed successfully.", BaselineService._summary(
            assessment, responses,
        )

    @staticmethod
    def _result_of(assessment):
        """A completed assessment with its marked answers."""
        responses = BaselineResponse.query.filter_by(
            assessment_id=assessment.assessment_id
        ).order_by(BaselineResponse.response_id.asc()).all()
        return BaselineService._summary(assessment, responses)

    @staticmethod
    def get_latest_result(user_id):
        """Return the player's latest completed assessment, or None."""
        player = BaselineService._player_for(user_id)
        if not player:
            return False, "Player profile not found.", None

        assessment = BaselineAssessment.query.filter(
            BaselineAssessment.player_id == player.player_id,
            BaselineAssessment.completed_at.isnot(None),
        ).order_by(BaselineAssessment.completed_at.desc()).first()
        if not assessment:
            return True, "No completed baseline assessment found.", None
        return True, "Latest baseline result retrieved successfully.", BaselineService._result_of(assessment)

    @staticmethod
    def get_result(assessment_id, user_id):
        """One of the player's own completed assessments."""
        assessment = BaselineService._owned_assessment(assessment_id, user_id)
        if not assessment or not assessment.completed_at:
            return False, "Result not found.", None
        return True, "Baseline result retrieved successfully.", BaselineService._result_of(assessment)

    # ---------- admin: baseline assessments ----------

    @staticmethod
    def get_templates():
        """Every baseline assessment with its questions, by role then name (admin)."""
        templates = BaselineTemplate.query.order_by(
            BaselineTemplate.occupation.asc().nullslast(), BaselineTemplate.name.asc(), BaselineTemplate.template_id.asc(),
        ).all()
        return True, "Baseline assessments retrieved successfully.", {
            "templates": [BaselineService._serialize_template(t, include_questions=True) for t in templates],
            "minQuestions": BaselineService.MIN_QUESTIONS,
            "roles": list(BaselineService.ROLES),
        }

    @staticmethod
    def _next_name(occupation):
        """The next free "Baseline assessment N" name for a role."""
        names = {name for (name,) in db.session.query(BaselineTemplate.name).filter(
            BaselineTemplate.occupation.is_(None) if not occupation else BaselineTemplate.occupation == occupation
        )}
        number = 1
        while f"Baseline assessment {number}" in names:
            number += 1
        return f"Baseline assessment {number}"

    @staticmethod
    def create_template(data):
        """Add an empty baseline assessment for a role (admin). It starts switched off."""
        is_valid, error = BaselineSchema.validate_template(data, require_name=False)
        if not is_valid:
            return False, error, None
        occupation = data.get("occupation") or None
        name = (data.get("name") or "").strip() or BaselineService._next_name(occupation)
        if BaselineService._name_taken(name, occupation):
            return False, f"{BaselineService._role_label(occupation)} already has a baseline called \"{name}\".", None
        template = BaselineTemplate(name=name, occupation=occupation,
                                    description=(data.get("description") or "").strip() or None, is_active=False)
        db.session.add(template)
        db.session.commit()
        return True, f"Created {BaselineService._role_label(occupation)} · {name}. Add at least " \
                     f"{BaselineService.MIN_QUESTIONS} questions, then switch it on.", \
            BaselineService._serialize_template(template, include_questions=True)

    @staticmethod
    def _name_taken(name, occupation, except_id=None):
        """True when this role already has an assessment with this name."""
        query = BaselineTemplate.query.filter(func.lower(BaselineTemplate.name) == name.lower())
        query = query.filter(BaselineTemplate.occupation.is_(None) if not occupation else BaselineTemplate.occupation == occupation)
        if except_id:
            query = query.filter(BaselineTemplate.template_id != except_id)
        return db.session.query(query.exists()).scalar()

    @staticmethod
    def update_template(template_id, data):
        """Rename an assessment or change its description (admin). Its role is fixed once players have taken it."""
        template = db.session.get(BaselineTemplate, template_id)
        if not template:
            return False, "Baseline assessment not found.", None
        is_valid, error = BaselineSchema.validate_template(data, require_name=True)
        if not is_valid:
            return False, error, None
        occupation = data.get("occupation") or None if "occupation" in data else template.occupation
        if occupation != template.occupation and any(a.completed_at for a in template.assessments):
            return False, "Players have already taken this assessment, so its role cannot change.", None
        name = data["name"].strip()
        if BaselineService._name_taken(name, occupation, except_id=template.template_id):
            return False, f"{BaselineService._role_label(occupation)} already has a baseline called \"{name}\".", None
        template.name = name
        template.occupation = occupation
        template.description = (data.get("description") or "").strip() or None
        db.session.commit()
        return True, "Baseline assessment updated.", BaselineService._serialize_template(template, include_questions=True)

    @staticmethod
    def set_template_active(template_id, data):
        """Switch an assessment on or off for its role (admin). It needs at least 5 questions to be switched on."""
        template = db.session.get(BaselineTemplate, template_id)
        if not template:
            return False, "Baseline assessment not found.", None
        if not isinstance(data.get("active"), bool):
            return False, "Say whether the assessment should be active (true or false).", None
        count = len(template.questions)
        if data["active"] and count < BaselineService.MIN_QUESTIONS:
            return False, (
                f"{template.name} has {count} question(s). A baseline needs at least "
                f"{BaselineService.MIN_QUESTIONS} before it can be switched on."
            ), None
        if data["active"] and not template.is_active:
            template.activated_at = datetime.utcnow()
        template.is_active = data["active"]
        db.session.commit()
        role = BaselineService._role_label(template.occupation)
        message = (
            f"{role} · {template.name} is now on: every {role.lower() if template.occupation else 'player'} "
            "who has not taken it can take it."
            if template.is_active else f"{role} · {template.name} is now off. Results already taken are kept."
        )
        return True, message, BaselineService._serialize_template(template, include_questions=True)

    @staticmethod
    def delete_template(template_id):
        """Delete an assessment and its questions (admin). Not allowed once players have taken it."""
        template = db.session.get(BaselineTemplate, template_id)
        if not template:
            return False, "Baseline assessment not found.", None
        if template.assessments:
            return False, "Players have taken this assessment, so it is kept as a record. Switch it off instead.", None
        for question in list(template.questions):
            db.session.delete(question)
        db.session.delete(template)
        db.session.commit()
        return True, f"Deleted {template.name}.", None

    # ---------- admin: questions ----------

    @staticmethod
    def get_question(question_id):
        """One question with its marking guide (admin)."""
        question = db.session.get(BaselineQuestion, question_id)
        if not question:
            return False, "Question not found.", None
        return True, "Question retrieved successfully.", BaselineService._serialize_question(
            question, include_answers=True,
        )

    @staticmethod
    def _apply_question_fields(question, data):
        """Copy form fields onto a question."""
        question.question_text = data["question"]
        question.instruction = data["instruction"]
        question.expected_keywords = ",".join(data["expectedKeywords"])
        question.example_answer = data["exampleAnswer"]
        question.feedback = data["feedback"]
        question.confidence_threshold = data["confidenceThreshold"]

    @staticmethod
    def create_question(data):
        """Add a question to a baseline assessment (admin)."""
        is_valid, error = BaselineSchema.validate_question(data)
        if not is_valid:
            return False, error, None
        template = db.session.get(BaselineTemplate, data.get("templateId"))
        if not template:
            return False, "Choose the baseline assessment this question belongs to.", None
        question = BaselineQuestion(template_id=template.template_id)
        BaselineService._apply_question_fields(question, data)
        db.session.add(question)
        db.session.commit()
        return True, "Question added.", BaselineService._serialize_question(question, include_answers=True)

    @staticmethod
    def update_question(question_id, data):
        """Edit a question, or move it to another baseline assessment (admin)."""
        question = db.session.get(BaselineQuestion, question_id)
        if not question:
            return False, "Question not found.", None

        is_valid, error = BaselineSchema.validate_question(data)
        if not is_valid:
            return False, error, None

        target_id = data.get("templateId", question.template_id)
        if target_id != question.template_id:
            target = db.session.get(BaselineTemplate, target_id)
            if not target:
                return False, "Choose the baseline assessment this question belongs to.", None
            error = BaselineService._removal_problem(question)
            if error:
                return False, error, None
            question.template_id = target.template_id

        BaselineService._apply_question_fields(question, data)
        db.session.commit()
        return True, "Question updated.", BaselineService._serialize_question(question, include_answers=True)

    @staticmethod
    def _removal_problem(question):
        """An error when taking this question out would leave an active assessment too short, else None."""
        template = question.template
        if template and template.is_active and len(template.questions) - 1 < BaselineService.MIN_QUESTIONS:
            return (f"{template.name} is switched on and needs at least {BaselineService.MIN_QUESTIONS} questions. "
                    "Add another question or switch it off first.")
        return None

    @staticmethod
    def delete_question(question_id):
        """Delete a question (admin)."""
        is_valid, error = BaselineSchema.validate_delete_question(question_id)
        if not is_valid:
            return False, error, None
        question = db.session.get(BaselineQuestion, question_id)
        error = BaselineService._removal_problem(question)
        if error:
            return False, error, None
        db.session.delete(question)
        db.session.commit()
        return True, "Question deleted successfully.", None

    # ---------- the template bank ----------

    @staticmethod
    def load_templates():
        """Add any baseline assessment or question from the template bank that is not in the database yet.
        Assessments are matched on role and name, questions on their text. Existing ones are left alone,
        including any the admin edited or switched off."""
        existing_texts = {text.strip().lower() for (text,) in db.session.query(BaselineQuestion.question_text)}
        added_templates = added_questions = 0
        for row in json.loads(TEMPLATE_FILE.read_text(encoding="utf-8")):
            occupation = row.get("occupation") or None
            template = BaselineTemplate.query.filter(
                func.lower(BaselineTemplate.name) == row["name"].lower(),
                BaselineTemplate.occupation.is_(None) if not occupation else BaselineTemplate.occupation == occupation,
            ).first()
            if not template:
                template = BaselineTemplate(
                    name=row["name"], occupation=occupation, description=row.get("description"),
                    is_active=bool(row.get("active")), activated_at=datetime.utcnow() if row.get("active") else None,
                )
                db.session.add(template)
                db.session.flush()
                added_templates += 1
            for item in row["questions"]:
                if item["question"].strip().lower() in existing_texts:
                    continue
                question = BaselineQuestion(template_id=template.template_id)
                BaselineService._apply_question_fields(question, item)
                db.session.add(question)
                existing_texts.add(item["question"].strip().lower())
                added_questions += 1
        db.session.commit()
        if not (added_templates or added_questions):
            return True, "Every template in the bank is already here.", {"added": 0, "addedTemplates": 0}
        return True, (
            f"Added {added_templates} baseline assessment(s) and {added_questions} question(s) from the template bank."
        ), {"added": added_questions, "addedTemplates": added_templates}
