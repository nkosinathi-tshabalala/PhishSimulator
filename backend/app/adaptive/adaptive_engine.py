class AdaptiveEngine:
	"""Determines a player's next scenario difficulty from recorded results."""

	RECENT_ATTEMPT_COUNT = 5

	@staticmethod
	def recommend_difficulty(attempts, baseline_score=None):
		recent_attempts = attempts[:AdaptiveEngine.RECENT_ATTEMPT_COUNT]

		if len(recent_attempts) < AdaptiveEngine.RECENT_ATTEMPT_COUNT:
			if baseline_score is not None and baseline_score >= 70:
				return "Medium", "Baseline calibration"
			return "Easy", "Building an initial performance record"

		recent_accuracy = (
			sum(attempt.correct for attempt in recent_attempts)
			/ len(recent_attempts)
		) * 100

		if recent_accuracy >= 80:
			return "Hard", "Recent accuracy is at least 80%"
		if recent_accuracy < 60:
			return "Easy", "Recent accuracy is below 60%"
		return "Medium", "Recent accuracy is between 60% and 79%"
