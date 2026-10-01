"""login lockout

Revision ID: b8d0f2a4c6e7
Revises: a7c9e1b3d5f4
Create Date: 2026-10-01 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b8d0f2a4c6e7'
down_revision = 'a7c9e1b3d5f4'
branch_labels = None
depends_on = None


def upgrade():
    """Count wrong passwords and lock an account for a while after too many."""
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.add_column(sa.Column('failed_logins', sa.Integer(), server_default='0', nullable=False))
        batch_op.add_column(sa.Column('locked_until', sa.DateTime(), nullable=True))


def downgrade():
    """Remove the lockout columns."""
    with op.batch_alter_table('user', schema=None) as batch_op:
        batch_op.drop_column('locked_until')
        batch_op.drop_column('failed_logins')
