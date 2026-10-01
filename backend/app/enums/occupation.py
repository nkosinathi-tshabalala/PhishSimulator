# Occupations a player can choose when registering

from enum import Enum

class Occupation(Enum):
    """Occupations a player can choose when registering."""
    STUDENT = "Student"
    EMPLOYEE = "Employee"
    OTHER = "Other"