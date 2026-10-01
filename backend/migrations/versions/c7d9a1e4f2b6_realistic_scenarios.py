"""Realistic scenarios

Adds a fake attachment file name and an automatic quality score to each
scenario. Existing scenarios get their score the next time an admin
re-runs processing (Datasets page) or the demo seed runs.

Revision ID: c7d9a1e4f2b6
Revises: b1c4e2a9d7f3
Create Date: 2026-09-28 09:00:00

"""
from alembic import op
import sqlalchemy as sa


revision = 'c7d9a1e4f2b6'
down_revision = 'b1c4e2a9d7f3'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('scenario') as batch_op:
        batch_op.add_column(sa.Column('attachment', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('quality_score', sa.Integer(), nullable=True))


def downgrade():
    with op.batch_alter_table('scenario') as batch_op:
        batch_op.drop_column('quality_score')
        batch_op.drop_column('attachment')
