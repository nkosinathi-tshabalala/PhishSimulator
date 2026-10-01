"""CATCH framework columns

Adds the scenario review link to its dataset, the dataset quality report,
and the justification / XP details stored on each simulation attempt.

Revision ID: b1c4e2a9d7f3
Revises: 6f2e1731c815
Create Date: 2026-09-27 10:00:00

"""
from alembic import op
import sqlalchemy as sa


revision = 'b1c4e2a9d7f3'
down_revision = '6f2e1731c815'
branch_labels = None
depends_on = None


# Link scenarios generated before dataset_id existed, by their message text.
LINK_LEGACY_SCENARIOS = """
    UPDATE scenario SET dataset_id = (
        SELECT MIN(dataset_record.dataset_id) FROM dataset_record
        WHERE dataset_record.message = scenario.message AND dataset_record.processed
    )
    WHERE dataset_id IS NULL
"""


def upgrade():
    with op.batch_alter_table('scenario') as batch_op:
        batch_op.add_column(sa.Column('dataset_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_scenario_dataset', 'dataset', ['dataset_id'], ['dataset_id'],
        )

    with op.batch_alter_table('dataset') as batch_op:
        batch_op.add_column(sa.Column('quality_report', sa.Text(), nullable=True))

    with op.batch_alter_table('simulation_attempt') as batch_op:
        batch_op.add_column(sa.Column('difficulty', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('selected_clues', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('justification', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('clue_score', sa.Integer(), nullable=True))

    op.execute("UPDATE scenario SET status = 'ARCHIVED' WHERE status = 'INACTIVE'")
    op.execute(LINK_LEGACY_SCENARIOS)


def downgrade():
    with op.batch_alter_table('simulation_attempt') as batch_op:
        batch_op.drop_column('clue_score')
        batch_op.drop_column('justification')
        batch_op.drop_column('selected_clues')
        batch_op.drop_column('difficulty')

    with op.batch_alter_table('dataset') as batch_op:
        batch_op.drop_column('quality_report')

    with op.batch_alter_table('scenario') as batch_op:
        batch_op.drop_constraint('fk_scenario_dataset', type_='foreignkey')
        batch_op.drop_column('dataset_id')
