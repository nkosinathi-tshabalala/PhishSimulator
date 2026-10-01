# Checks uploaded dataset files

from app.enums.scenario_type import ScenarioType


class DatasetSchema:
    """Validation rules for dataset uploads."""

    ALLOWED_EXTENSIONS = {"csv", "json"}

    @staticmethod
    def validate_upload(file, dataset_type):
        """Check the uploaded file is a CSV or JSON dataset."""
        if file is None or not file.filename:
            return False, "A CSV or JSON dataset file is required."

        if "." not in file.filename:
            return False, "Dataset files must use a .csv or .json extension."

        extension = file.filename.rsplit(".", 1)[1].lower()
        if extension not in DatasetSchema.ALLOWED_EXTENSIONS:
            return False, "Only CSV and JSON files are supported."

        valid_types = {item.value for item in ScenarioType}
        if str(dataset_type or "").upper() not in valid_types:
            return False, f"dataset_type must be one of {sorted(valid_types)}."

        return True, None
