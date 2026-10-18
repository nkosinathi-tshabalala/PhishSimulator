# Tests for input rules, rate limits and other hardening that need no database
# (the cookie sessions, CSRF and token rotation are checked end to end in e2e_check.py)

import unittest

from app.schemas.auth_schema import AuthSchema
from app.security import RateLimiter, _origin
from app.services.analytics_service import AnalyticsService


class InputRuleTests(unittest.TestCase):
    """The server-side rules every account form must pass."""

    def test_real_names_are_accepted(self):
        for name in ("Lerato Mokoena", "Lee-Ann Davids", "Nompumelelo O'Neil", "Johan van der Merwe", "José Núñez",
                     "John Smith 3rd", "Dr. Thabo Molefe"):
            self.assertIsNone(AuthSchema.name_problem(name), name)

    def test_markup_and_code_in_names_are_refused(self):
        for name in ("<script>alert(1)</script>", "Robert'); DROP TABLE player;--", "=cmd|'/c calc'!A1",
                     'a" onmouseover="x', "x" * 101, "   "):
            self.assertIsNotNone(AuthSchema.name_problem(name), name)

    def test_passwords_stay_within_what_bcrypt_accepts(self):
        self.assertIsNone(AuthSchema.password_problem("Valid#2026"))
        self.assertIsNotNone(AuthSchema.password_problem("a1" * 33))        # 66 characters
        self.assertIsNotNone(AuthSchema.password_problem("é1" * 30))        # 60 characters but 90 bytes
        self.assertTrue(AuthSchema.too_long_for_bcrypt("x" * 80))

    def test_a_long_login_password_is_a_wrong_login_not_an_error(self):
        valid, message = AuthSchema.validate_login({"email": "a@example.test", "password": "x" * 100})
        self.assertFalse(valid)
        self.assertEqual(message, "Invalid email or password.")

    def test_ages_and_emails_have_bounds(self):
        self.assertIsNone(AuthSchema.age_problem("21"))
        for age in ("15", "121", "20.5", "-3", "abc"):
            self.assertIsNotNone(AuthSchema.age_problem(age), age)
        self.assertIsNone(AuthSchema.email_problem("Lerato@Example.co.za"))
        self.assertIsNotNone(AuthSchema.email_problem("a" * 250 + "@x.io"))
        self.assertIsNotNone(AuthSchema.email_problem("' OR '1'='1"))

    def test_a_request_body_that_is_not_an_object_is_refused(self):
        self.assertIsNotNone(AuthSchema.missing_field(["email"], ("email",)))


class HardeningTests(unittest.TestCase):
    """Rate limits, origin matching and spreadsheet-safe exports."""

    def test_the_rate_limiter_blocks_after_the_limit_per_address(self):
        limiter = RateLimiter()
        results = [limiter.allow(("login", "10.0.0.1"), 3, 60) for _ in range(5)]
        self.assertEqual(results, [True, True, True, False, False])
        self.assertTrue(limiter.allow(("login", "10.0.0.2"), 3, 60))   # another address has its own count

    def test_origins_are_compared_by_scheme_host_and_port(self):
        self.assertEqual(_origin("http://localhost:8080/some/page"), "http://localhost:8080")
        self.assertNotEqual(_origin("http://localhost:8080"), _origin("http://localhost:8081"))
        self.assertEqual(_origin("not a url"), "")

    def test_export_cells_never_start_a_formula(self):
        for value in ("=HYPERLINK(1)", "+27 82", "-1", "@SUM(A1)", "\tx"):
            self.assertTrue(AnalyticsService._safe_cell(value).startswith("'"), value)
        self.assertEqual(AnalyticsService._safe_cell("Lerato Mokoena"), "Lerato Mokoena")


if __name__ == "__main__":
    unittest.main()
