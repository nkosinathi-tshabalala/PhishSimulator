"""campaign consent and role-based baseline bank

Revision ID: e7f9a1c3b5d6
Revises: c9e1f3a5b7d8
Create Date: 2026-10-13 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7f9a1c3b5d6'
down_revision = 'c9e1f3a5b7d8'
branch_labels = None
depends_on = None


def upgrade():
    """Players opt in to campaign emails; baseline questions belong to a role and can be switched on or off."""
    with op.batch_alter_table('user_profile', schema=None) as batch_op:
        batch_op.add_column(sa.Column('campaign_consent', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('campaign_consent_at', sa.DateTime(), nullable=True))

    with op.batch_alter_table('baseline_question', schema=None) as batch_op:
        # A role ("Student", "Employee", "Other"), or empty for a general question any role can get
        batch_op.add_column(sa.Column('occupation', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade():
    """Remove consent and the role-based bank columns."""
    with op.batch_alter_table('baseline_question', schema=None) as batch_op:
        batch_op.drop_column('is_active')
        batch_op.drop_column('occupation')

    with op.batch_alter_table('user_profile', schema=None) as batch_op:
        batch_op.drop_column('campaign_consent_at')
        batch_op.drop_column('campaign_consent')
