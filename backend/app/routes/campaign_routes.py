# These are the endpoints for email phishing campaigns and their tracking links

from flask import Blueprint, Response, current_app, redirect, request

from app.routes.route_helpers import current_user_id, require_admin, respond
from app.services.campaign_service import TRACKING_PIXEL, CampaignService
from flask_jwt_extended import jwt_required


campaign_bp = Blueprint("campaign", __name__, url_prefix="/api/campaigns")


# GET /api/campaigns - admin only: email scenarios, allowed addresses and past campaigns
@campaign_bp.route("", methods=["GET"])
@jwt_required()
@require_admin
def get_context():
    """Admin: data the campaign page needs (scenarios, allow-list, campaigns)."""
    return respond(True, "Campaign context retrieved.", CampaignService.get_context())


# POST /api/campaigns - admin only: takes scenario_id, a name and recipient emails
@campaign_bp.route("", methods=["POST"])
@jwt_required()
@require_admin
def create_campaign():
    """Admin: save a new campaign as a draft."""
    success, message, data = CampaignService.create_campaign(
        request.get_json(silent=True) or {},
        current_user_id(),
    )
    return respond(success, message, data, ok_status=201)


# POST /api/campaigns/<id>/launch - admin only: sends the campaign's emails
@campaign_bp.route("/<int:campaign_id>/launch", methods=["POST"])
@jwt_required()
@require_admin
def launch_campaign(campaign_id):
    """Admin: send a campaign's emails."""
    success, message, data = CampaignService.launch_campaign(campaign_id)
    return respond(success, message, data)


# GET /api/campaigns/<id> - admin only: opens, clicks and reports per recipient
@campaign_bp.route("/<int:campaign_id>", methods=["GET"])
@jwt_required()
@require_admin
def get_report(campaign_id):
    """Admin: opens, clicks and reports for one campaign."""
    report = CampaignService.get_report(campaign_id)
    return respond(bool(report), "Campaign report retrieved." if report else "Campaign not found.", report,
                   error_status=404)


# DELETE /api/campaigns/<id> - admin only: removes a draft or failed campaign
@campaign_bp.route("/<int:campaign_id>", methods=["DELETE"])
@jwt_required()
@require_admin
def delete_campaign(campaign_id):
    """Admin: delete a campaign that was never successfully sent."""
    success, message, data = CampaignService.delete_campaign(campaign_id)
    return respond(success, message, data)


# GET /api/campaigns/open/<token> - tracking pixel: records that the email was opened
@campaign_bp.route("/open/<token>", methods=["GET"])
def record_open(token):
    """Invisible pixel: loading it means the recipient opened the email."""
    CampaignService.record_open(token)
    return Response(TRACKING_PIXEL, mimetype="image/gif")


# GET /api/campaigns/click/<token> - records a click, emails a debrief, then shows the caught page
@campaign_bp.route("/click/<token>", methods=["GET"])
def record_click(token):
    """The recipient opened the link or the attachment: record it and show the landing page."""
    kind = request.args.get("kind")
    if not CampaignService.record_click(token, kind):
        return redirect(current_app.config["FRONTEND_URL"], code=302)
    return redirect(f"{current_app.config['FRONTEND_URL']}/caught?token={token}", code=302)


# GET /api/campaigns/inbox - player: their campaign results, as notifications with feedback
@campaign_bp.route("/inbox", methods=["GET"])
@jwt_required()
def player_inbox():
    """Player: results of the campaign emails sent to their address."""
    inbox = CampaignService.player_inbox(current_user_id())
    return respond(inbox is not None, "Inbox retrieved." if inbox is not None else "User not found.", inbox,
                   error_status=404)


# POST /api/campaigns/inbox/<id>/seen - player: they opened the feedback for one result
@campaign_bp.route("/inbox/<int:recipient_id>/seen", methods=["POST"])
@jwt_required()
def mark_seen(recipient_id):
    """Player: mark one campaign result as read."""
    ok = CampaignService.mark_seen(recipient_id, current_user_id())
    return respond(ok, "Marked as read." if ok else "Result not found.", None, error_status=404)


# GET /api/campaigns/report/<token> - records the report, then shows the "well spotted" page
@campaign_bp.route("/report/<token>", methods=["GET"])
def record_report(token):
    """The recipient reported the email instead of clicking."""
    if not CampaignService.record_report(token):
        return redirect(current_app.config["FRONTEND_URL"], code=302)
    return redirect(f"{current_app.config['FRONTEND_URL']}/reported?token={token}", code=302)


# GET /api/campaigns/landing/<token> - public: who the test was for and its warning signs
@campaign_bp.route("/landing/<token>", methods=["GET"])
def landing_info(token):
    """Details for the caught / reported page, so it can send the recipient to their own login."""
    info = CampaignService.landing_info(token)
    return respond(bool(info), "Landing details retrieved." if info else "Link not recognised.", info,
                   error_status=404)
