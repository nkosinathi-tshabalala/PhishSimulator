"""Campaign email copy, custom emails and player results

- email_campaign: keep a copy of the email that was sent (sender, subject, message,
  is_phishing, phishing_cues); scenario_id becomes optional for custom emails
- email_campaign_recipient: settled_outcome, xp_awarded, feedback_seen_at for the player's inbox

Revision ID: e5a7c9b3d1f2
Revises: d4b6f8a2e1c9
Create Date: 2026-09-30 23:30:00

"""
from alembic import op
import sqlalchemy as sa


revision = 'e5a7c9b3d1f2'
down_revision = 'd4b6f8a2e1c9'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('email_campaign') as batch_op:
        batch_op.add_column(sa.Column('sender', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('subject', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('message', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('is_phishing', sa.Boolean(), nullable=False, server_default=sa.true()))
        batch_op.add_column(sa.Column('phishing_cues', sa.Text(), nullable=True))
        batch_op.alter_column('scenario_id', existing_type=sa.Integer(), nullable=True)

    # Existing campaigns: copy the email from the scenario they were sent from
    op.execute("""
        UPDATE email_campaign
        SET sender = scenario.sender,
            subject = scenario.subject,
            message = scenario.message,
            is_phishing = (upper(scenario.correct_answer) = 'REPORT'),
            phishing_cues = scenario.phishing_cues
        FROM scenario
        WHERE scenario.scenario_id = email_campaign.scenario_id
    """)

    with op.batch_alter_table('email_campaign_recipient') as batch_op:
        batch_op.add_column(sa.Column('settled_outcome', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('xp_awarded', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('feedback_seen_at', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('email_campaign_recipient') as batch_op:
        batch_op.drop_column('feedback_seen_at')
        batch_op.drop_column('xp_awarded')
        batch_op.drop_column('settled_outcome')

    # Custom-email campaigns have no scenario, so they cannot survive the downgrade
    op.execute("DELETE FROM email_campaign_recipient WHERE campaign_id IN "
               "(SELECT campaign_id FROM email_campaign WHERE scenario_id IS NULL)")
    op.execute("DELETE FROM email_campaign WHERE scenario_id IS NULL")
    with op.batch_alter_table('email_campaign') as batch_op:
        batch_op.alter_column('scenario_id', existing_type=sa.Integer(), nullable=False)
        batch_op.drop_column('phishing_cues')
        batch_op.drop_column('is_phishing')
        batch_op.drop_column('message')
        batch_op.drop_column('subject')
        batch_op.drop_column('sender')
