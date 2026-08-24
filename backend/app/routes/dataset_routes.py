from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from app.services.dataset_service import DatasetService

dataset_bp = Blueprint(
    "dataset",
    __name__,
    url_prefix="/api/datasets"
)


@dataset_bp.route("", methods=["GET"])
@jwt_required()
def get_datasets():

    success, message, result = DatasetService.get_datasets()

    status = 200 if success else 400

    return jsonify({

        "success": success,

        "message": message,

        "data": result

    }), status


@dataset_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_dataset():

    file = request.files.get("file")

    dataset_type = request.form.get(
        "dataset_type",
        "EMAIL"
    )

    success, message, result = DatasetService.upload_dataset(

        file,

        dataset_type

    )

    status = 201 if success else 400

    return jsonify({

        "success": success,

        "message": message,

        "data": result

    }), status


@dataset_bp.route("/<int:dataset_id>", methods=["GET"])
@jwt_required()
def get_dataset(dataset_id):

    success, message, result = DatasetService.get_dataset(

        dataset_id

    )

    status = 200 if success else 404

    return jsonify({

        "success": success,

        "message": message,

        "data": result

    }), status


@dataset_bp.route("/<int:dataset_id>", methods=["DELETE"])
@jwt_required()
def delete_dataset(dataset_id):

    success, message, result = DatasetService.delete_dataset(

        dataset_id

    )

    status = 200 if success else 404

    return jsonify({

        "success": success,

        "message": message,

        "data": result

    }), status