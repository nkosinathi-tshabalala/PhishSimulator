from flask import Blueprint, current_app, jsonify, redirect, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from app.services.email_service import EmailService


email_bp = Blueprint("email", __name__, url_prefix="/api/email")


def _is_admin():
	return get_jwt().get("role") == "ADMIN"


@email_bp.route("/dispatcher", methods=["GET"])
@jwt_required()
def get_dispatcher_context():
	if not _is_admin():
		return jsonify({"success": False, "message": "Administrator access is required."}), 403

	return jsonify({"success": True, "data": EmailService.get_dispatcher_context()}), 200


@email_bp.route("/dispatcher/campaigns", methods=["POST"])
@jwt_required()
def create_campaign():
	if not _is_admin():
		return jsonify({"success": False, "message": "Administrator access is required."}), 403

	success, message, campaign = EmailService.create_campaign(
		request.get_json() or {},
		int(get_jwt_identity()),
	)
	return jsonify({"success": success, "message": message, "data": campaign}), 201 if success else 400


@email_bp.route("/dispatcher/campaigns/<int:campaign_id>/launch", methods=["POST"])
@jwt_required()
def launch_campaign(campaign_id):
	if not _is_admin():
		return jsonify({"success": False, "message": "Administrator access is required."}), 403

	success, message, campaign = EmailService.launch_campaign(campaign_id)
	return jsonify({"success": success, "message": message, "data": campaign}), 202 if success else 400


@email_bp.route("/dispatcher/campaigns/<int:campaign_id>/report", methods=["GET"])
@jwt_required()
def get_campaign_report(campaign_id):
	if not _is_admin():
		return jsonify({"success": False, "message": "Administrator access is required."}), 403

	campaign = EmailService.get_campaign_report(campaign_id)
	if not campaign:
		return jsonify({"success": False, "message": "Campaign not found."}), 404
	return jsonify({"success": True, "data": campaign}), 200


@email_bp.route("/click/<tracking_token>", methods=["GET"])
def record_campaign_click(tracking_token):
	"""Record a campaign click then send the recipient to the training app."""

	if not EmailService.record_click(tracking_token):
		return jsonify({"success": False, "message": "Tracking link not found."}), 404
	return redirect(current_app.config["FRONTEND_URL"], code=302)


@email_bp.route("/report/<tracking_token>", methods=["GET"])
def record_campaign_report(tracking_token):
	"""Record a user report, then return the learner to the approved training app."""

	if not EmailService.record_report(tracking_token):
		return jsonify({"success": False, "message": "Reporting link not found."}), 404
	return redirect(current_app.config["FRONTEND_URL"], code=302)
