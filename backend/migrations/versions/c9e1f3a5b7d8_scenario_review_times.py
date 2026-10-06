"""scenario review times

Revision ID: c9e1f3a5b7d8
Revises: b8d0f2a4c6e7
Create Date: 2026-10-05 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c9e1f3a5b7d8'
down_revision = 'b8d0f2a4c6e7'
branch_labels = None
depends_on = None


def upgrade():
    """Record when a scenario was approved and when it last changed, so admins can find recent ones."""
    with op.batch_alter_table('scenario', schema=None) as batch_op:
        batch_op.add_column(sa.Column('approved_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(), nullable=True))

    # Existing rows: the best known time is when they were created
    op.execute("UPDATE scenario SET updated_at = created_at")
    op.execute("UPDATE scenario SET approved_at = created_at WHERE UPPER(status) IN ('APPROVED', 'ACTIVE', 'ARCHIVED')")


def downgrade():
    """Remove the review time columns."""
    with op.batch_alter_table('scenario', schema=None) as batch_op:
        batch_op.drop_column('updated_at')
        batch_op.drop_column('approved_at')
