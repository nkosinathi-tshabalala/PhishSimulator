class AnalyticsSchema:
    """Small shared validators for analytics route parameters."""

    @staticmethod
    def validate_user_id(user_id):
        if not isinstance(user_id, int) or isinstance(user_id, bool) or user_id < 1:
            return False, "user_id must be a positive integer."
        return True, None
