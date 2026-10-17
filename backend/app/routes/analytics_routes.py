# These are the endpoints for stats, progress and user monitoring

from flask import Blueprint, Response, request
from flask_jwt_extended import jwt_required

from app.analytics.filters import MetricFilters
from app.routes.route_helpers import current_user_id, require_admin, respond
from app.services.analytics_service import AnalyticsService


analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")


# GET /api/analytics/public-summary - public totals for the landing page (no login)
@analytics_bp.route("/public-summary", methods=["GET"])
def get_public_platform_summary():
    """Public numbers for the landing page."""
    return respond(True, "Summary retrieved.", AnalyticsService.get_public_platform_summary())


# GET /api/analytics/admin-dashboard - admin only: headline numbers
@analytics_bp.route("/admin-dashboard", methods=["GET"])
@jwt_required()
@require_admin
def get_admin_dashboard_stats():
    """Admin: platform-wide numbers for the dashboard."""
    return respond(True, "Dashboard statistics retrieved.", AnalyticsService.get_admin_dashboard_stats())


# GET /api/analytics/admin?range=30d&channel=EMAIL... - admin only: filtered charts across all players
@analytics_bp.route("/admin", methods=["GET"])
@jwt_required()
@require_admin
def get_admin_analytics():
    """Admin: charts and statistics, narrowed by the filters in the URL."""
    filters = MetricFilters.from_args(request.args)
    return respond(True, "Analytics retrieved.", AnalyticsService.get_admin_analytics(filters))


# GET /api/analytics/export/players.csv - admin only: downloads every player's progress
@analytics_bp.route("/export/players.csv", methods=["GET"])
@jwt_required()
@require_admin
def export_player_progress():
    """Admin: every player's progress as a CSV file for tutors."""
    return Response(
        AnalyticsService.export_player_progress_csv(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=player_progress.csv"},
    )


# GET /api/analytics/users - admin only: every user with their stats
@analytics_bp.route("/users", methods=["GET"])
@jwt_required()
@require_admin
def get_monitored_users():
    """Admin: every user for monitoring."""
    return respond(True, "Users retrieved.", AnalyticsService.get_monitored_users())


# GET /api/analytics/users/<id> - admin only: one user's details
@analytics_bp.route("/users/<int:user_id>", methods=["GET"])
@jwt_required()
@require_admin
def get_monitored_user(user_id):
    """Admin: one user's details and progress."""
    user = AnalyticsService.get_monitored_user(user_id)
    return respond(bool(user), "User retrieved." if user else "User not found.", user, error_status=404)


# DELETE /api/analytics/users/<id> - admin only: deletes a user and their data
@analytics_bp.route("/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
@require_admin
def delete_user(user_id):
    """Admin: delete a user and all their data."""
    success, message = AnalyticsService.delete_user(user_id, current_user_id())
    return respond(success, message, None)


# GET /api/analytics/my-performance?range=30d&channel=SMS... - the signed-in player's own progress
@analytics_bp.route("/my-performance", methods=["GET"])
@jwt_required()
def get_my_performance():
    """The signed-in player's progress, narrowed by the filters in the URL."""
    filters = MetricFilters.from_args(request.args)
    performance = AnalyticsService.get_player_performance(current_user_id(), filters)
    return respond(bool(performance), "Performance retrieved." if performance else "Player profile not found.",
                   performance, error_status=404)


# GET /api/analytics/my-activity?year=2026 - the signed-in player's activity per day for one year
@analytics_bp.route("/my-activity", methods=["GET"])
@jwt_required()
def get_my_activity():
    """The signed-in player's activity calendar for one year (this year by default)."""
    activity = AnalyticsService.get_player_activity(current_user_id(), request.args.get("year", type=int))
    return respond(bool(activity), "Activity retrieved." if activity else "Player profile not found.",
                   activity, error_status=404)
