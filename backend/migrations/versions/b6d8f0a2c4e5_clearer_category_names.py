"""clearer category names

Revision ID: b6d8f0a2c4e5
Revises: a3d5f7b9c1e2
Create Date: 2026-10-17 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b6d8f0a2c4e5'
down_revision = 'a3d5f7b9c1e2'
branch_labels = None
depends_on = None

# Old name -> new name. The new names say what the messages are about: "Password Reset" also held locked and
# suspended accounts, "Banking" also held prizes and loan requests, and "Microsoft 365" also held webmail and
# IT help-desk messages. "Prizes & Offers" is new and has no old name.
RENAMES = {
    "Banking": "Banking & Money",
    "Password Reset": "Account Security",
    "Microsoft 365": "Email & IT",
}
TABLES = ("scenario", "dataset_record")


def _rename(pairs):
    for table in TABLES:
        for old, new in pairs.items():
            op.execute(
                sa.text(f"UPDATE {table} SET category = :new WHERE category = :old").bindparams(old=old, new=new)
            )


def upgrade():
    """Existing scenarios and dataset rows keep their category under its new name, so players' history,
    badges and the admin filters carry on. Re-run processing on a dataset to re-sort its drafts by the new rules."""
    _rename(RENAMES)


def downgrade():
    _rename({new: old for old, new in RENAMES.items()})
