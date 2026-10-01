"""Campaign results count as decisions

- simulation_attempt.campaign_recipient_id links a decision to the campaign email it came from

Revision ID: f6b8d0a2c4e3
Revises: e5a7c9b3d1f2
Create Date: 2026-10-01 00:30:00

"""
from alembic import op
import sqlalchemy as sa


revision = 'f6b8d0a2c4e3'
down_revision = 'e5a7c9b3d1f2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('simulation_attempt') as batch_op:
        batch_op.add_column(sa.Column('campaign_recipient_id', sa.Integer(), nullable=True))
        batch_op.create_unique_constraint('uq_simulation_attempt_campaign_recipient', ['campaign_recipient_id'])
        batch_op.create_foreign_key(
            'fk_simulation_attempt_campaign_recipient', 'email_campaign_recipient',
            ['campaign_recipient_id'], ['campaign_recipient_id'],
        )


def downgrade():
    # Campaign decisions only exist because of this column, so they go with it
    op.execute("DELETE FROM feedback_report WHERE attempt_id IN "
               "(SELECT attempt_id FROM simulation_attempt WHERE campaign_recipient_id IS NOT NULL)")
    op.execute("DELETE FROM user_action WHERE attempt_id IN "
               "(SELECT attempt_id FROM simulation_attempt WHERE campaign_recipient_id IS NOT NULL)")
    op.execute("DELETE FROM simulation_attempt WHERE campaign_recipient_id IS NOT NULL")
    with op.batch_alter_table('simulation_attempt') as batch_op:
        batch_op.drop_constraint('fk_simulation_attempt_campaign_recipient', type_='foreignkey')
        batch_op.drop_constraint('uq_simulation_attempt_campaign_recipient', type_='unique')
        batch_op.drop_column('campaign_recipient_id')
