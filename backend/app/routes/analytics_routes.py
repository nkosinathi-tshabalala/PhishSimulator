from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from app.services.analytics_service import AnalyticsService


analytics_bp = Blueprint(
	"analytics",
	__name__,
	url_prefix="/api/analytics",
)


@analytics_bp.route("/public-summary", methods=["GET"])
def get_public_platform_summary():
	return jsonify({
		"success": True,
		"data": AnalyticsService.get_public_platform_summary(),
	}), 200


@analytics_bp.route("/admin-dashboard", methods=["GET"])
@jwt_required()
def get_admin_dashboard_stats():
	"""Return platform-wide dashboard metrics to administrators."""

	if get_jwt().get("role") != "ADMIN":
		return jsonify({
			"success": False,
			"message": "Administrator access is required.",
		}), 403

	return jsonify({
		"success": True,
		"message": "Administrator dashboard statistics retrieved.",
		"data": AnalyticsService.get_admin_dashboard_stats(),
	}), 200


@analytics_bp.route("/admin", methods=["GET"])
@jwt_required()
def get_admin_analytics():
	if get_jwt().get("role") != "ADMIN":
		return jsonify({"success": False, "message": "Administrator access is required."}), 403

	return jsonify({
		"success": True,
		"data": AnalyticsService.get_admin_analytics(),
	}), 200


@analytics_bp.route("/users", methods=["GET"])
@jwt_required()
def get_monitored_users():
	if get_jwt().get("role") != "ADMIN":
		return jsonify({"success": False, "message": "Administrator access is required."}), 403

	return jsonify({
		"success": True,
		"data": AnalyticsService.get_monitored_users(),
	}), 200


@analytics_bp.route("/users/<int:user_id>", methods=["GET"])
@jwt_required()
def get_monitored_user(user_id):
	if get_jwt().get("role") != "ADMIN":
		return jsonify({"success": False, "message": "Administrator access is required."}), 403

	user = AnalyticsService.get_monitored_user(user_id)

	if not user:
		return jsonify({"success": False, "message": "User not found."}), 404

	return jsonify({"success": True, "data": user}), 200


@analytics_bp.route("/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):
	if get_jwt().get("role") != "ADMIN":
		return jsonify({"success": False, "message": "Administrator access is required."}), 403

	success, message = AnalyticsService.delete_user(
		user_id,
		int(get_jwt_identity()),
	)

	return jsonify({"success": success, "message": message}), 200 if success else 400


@analytics_bp.route("/my-performance", methods=["GET"])
@jwt_required()
def get_my_performance():
	performance = AnalyticsService.get_player_performance(int(get_jwt_identity()))

	if not performance:
		return jsonify({"success": False, "message": "Player profile not found."}), 404

	return jsonify({"success": True, "data": performance}), 200
