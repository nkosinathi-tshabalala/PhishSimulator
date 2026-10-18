"""descriptive baseline assessment names

Revision ID: d8f0b2c4e6a8
Revises: b6d8f0a2c4e5
Create Date: 2026-10-18 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd8f0b2c4e6a8'
down_revision = 'b6d8f0a2c4e5'
branch_labels = None
depends_on = None

# (role, old name) -> new name. The bank's assessments are named after what their questions cover instead of
# "Baseline assessment 1" and "2", so "Load template bank" still matches them by role and name afterwards.
RENAMES = {
    ("Student", "Baseline assessment 1"): "Student Money and Campus Accounts",
    ("Student", "Baseline assessment 2"): "Prizes, Exams and Free Offers",
    ("Employee", "Baseline assessment 1"): "Workplace Email and Payments",
    ("Employee", "Baseline assessment 2"): "Shared Files, Calls and QR Codes",
    ("Other", "Baseline assessment 1"): "Everyday Banking and Delivery Scams",
    ("Other", "Baseline assessment 2"): "Grants, Marketplaces and Investments",
}


def _rename(pairs):
    """Rename each template, unless the role already has one with the new name (an admin's own)."""
    for (role, old), new in pairs:
        op.execute(sa.text(
            "UPDATE baseline_template SET name = :new WHERE occupation = :role AND name = :old "
            "AND NOT EXISTS (SELECT 1 FROM baseline_template t WHERE t.occupation = :role AND t.name = :new)"
        ).bindparams(new=new, role=role, old=old))


def upgrade():
    _rename(RENAMES.items())


def downgrade():
    _rename(((role, new), old) for (role, old), new in RENAMES.items())
