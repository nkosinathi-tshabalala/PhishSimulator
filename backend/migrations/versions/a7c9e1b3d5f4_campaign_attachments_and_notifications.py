"""Campaign attachments and result emails

- email_campaign.attachment: a look-alike attachment shown in the email (no real file is sent)
- email_campaign_recipient.clicked_kind: LINK or ATTACHMENT, whichever they opened
- email_campaign_recipient.notified_at: when their result email was sent (so it is sent once)

Revision ID: a7c9e1b3d5f4
Revises: f6b8d0a2c4e3
Create Date: 2026-10-01 01:30:00

"""
from alembic import op
import sqlalchemy as sa


revision = 'a7c9e1b3d5f4'
down_revision = 'f6b8d0a2c4e3'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('email_campaign') as batch_op:
        batch_op.add_column(sa.Column('attachment', sa.String(length=255), nullable=True))
    op.execute("""
        UPDATE email_campaign SET attachment = scenario.attachment
        FROM scenario WHERE scenario.scenario_id = email_campaign.scenario_id
    """)

    with op.batch_alter_table('email_campaign_recipient') as batch_op:
        batch_op.add_column(sa.Column('clicked_kind', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('notified_at', sa.DateTime(), nullable=True))
    op.execute("UPDATE email_campaign_recipient SET clicked_kind = 'LINK' WHERE clicked_at IS NOT NULL")
    # Results that already exist were handled before result emails existed: don't email them now
    op.execute("UPDATE email_campaign_recipient SET notified_at = now() WHERE settled_outcome IS NOT NULL")


def downgrade():
    with op.batch_alter_table('email_campaign_recipient') as batch_op:
        batch_op.drop_column('notified_at')
        batch_op.drop_column('clicked_kind')
    with op.batch_alter_table('email_campaign') as batch_op:
        batch_op.drop_column('attachment')
