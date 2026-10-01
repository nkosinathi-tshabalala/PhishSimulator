"""Email campaign tracking

Campaigns are now sent to typed recipient addresses (the admin's own inboxes),
not to players, and we track opens as well as clicks.

- email_campaign: drop target_occupation
- email_campaign_recipient: drop player_id, add opened_at and open_count

Revision ID: d4b6f8a2e1c9
Revises: c7d9a1e4f2b6
Create Date: 2026-09-28 12:00:00

"""
from alembic import op
import sqlalchemy as sa


revision = 'd4b6f8a2e1c9'
down_revision = 'c7d9a1e4f2b6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('email_campaign_recipient') as batch_op:
        batch_op.add_column(sa.Column('opened_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('open_count', sa.Integer(), nullable=False, server_default='0'))
        batch_op.drop_column('player_id')

    with op.batch_alter_table('email_campaign') as batch_op:
        batch_op.drop_column('target_occupation')


def downgrade():
    with op.batch_alter_table('email_campaign') as batch_op:
        batch_op.add_column(sa.Column('target_occupation', sa.String(length=30), nullable=True))

    with op.batch_alter_table('email_campaign_recipient') as batch_op:
        batch_op.add_column(sa.Column('player_id', sa.Integer(), nullable=True))
        batch_op.drop_column('open_count')
        batch_op.drop_column('opened_at')
