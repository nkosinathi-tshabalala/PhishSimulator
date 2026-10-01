# These are the endpoints for uploading and managing datasets

from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app.routes.route_helpers import require_admin, respond
from app.services.dataset_service import DatasetService


dataset_bp = Blueprint("dataset", __name__, url_prefix="/api/datasets")


# GET /api/datasets - admin only: every uploaded dataset
@dataset_bp.route("", methods=["GET"])
@jwt_required()
@require_admin
def get_datasets():
    """Admin: list uploaded datasets."""
    success, message, result = DatasetService.get_datasets()
    return respond(success, message, result)


# POST /api/datasets/upload - admin only: takes a CSV or JSON file and its type (EMAIL or SMS)
@dataset_bp.route("/upload", methods=["POST"])
@jwt_required()
@require_admin
def upload_dataset():
    """Upload a CSV/JSON file; labelled rows become draft scenarios for review."""
    success, message, result = DatasetService.upload_dataset(
        request.files.get("file"),
        request.form.get("dataset_type", "EMAIL"),
    )
    return respond(success, message, result, ok_status=201)


# GET /api/datasets/<id> - admin only: one dataset's details
@dataset_bp.route("/<int:dataset_id>", methods=["GET"])
@jwt_required()
@require_admin
def get_dataset(dataset_id):
    """Admin: one dataset's details."""
    success, message, result = DatasetService.get_dataset(dataset_id)
    return respond(success, message, result, error_status=404)


# POST /api/datasets/<id>/reprocess - admin only: re-applies the realism rules to drafts
@dataset_bp.route("/<int:dataset_id>/reprocess", methods=["POST"])
@jwt_required()
@require_admin
def reprocess_dataset(dataset_id):
    """Re-apply the realism rules to a dataset's unreviewed drafts."""
    success, message, result = DatasetService.reprocess(dataset_id)
    return respond(success, message, result, error_status=404)


# DELETE /api/datasets/<id> - admin only: deletes a dataset and its scenarios
@dataset_bp.route("/<int:dataset_id>", methods=["DELETE"])
@jwt_required()
@require_admin
def delete_dataset(dataset_id):
    """Admin: delete a dataset and its scenarios."""
    success, message, result = DatasetService.delete_dataset(dataset_id)
    return respond(success, message, result, error_status=404)
