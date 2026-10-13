"""named baseline assessments per role

Revision ID: f2b4d6e8a0c1
Revises: e7f9a1c3b5d6
Create Date: 2026-10-14 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f2b4d6e8a0c1'
down_revision = 'e7f9a1c3b5d6'
branch_labels = None
depends_on = None


def upgrade():
    """Questions move into named baseline assessments (e.g. "Baseline assessment 1" for students).
    The role and the on/off switch move from each question to its assessment."""
    op.create_table(
        'baseline_template',
        sa.Column('template_id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('occupation', sa.String(length=20), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('activated_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    with op.batch_alter_table('baseline_question', schema=None) as batch_op:
        batch_op.add_column(sa.Column('template_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_baseline_question_template', 'baseline_template', ['template_id'], ['template_id'])
    with op.batch_alter_table('baseline_assessment', schema=None) as batch_op:
        batch_op.add_column(sa.Column('template_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_baseline_assessment_template', 'baseline_template', ['template_id'], ['template_id'])

    # Existing questions: per role, the switched-on ones become "Baseline assessment 1" (switched on)
    # and the switched-off ones "Baseline assessment 2" (switched off). Nothing is deleted.
    conn = op.get_bind()
    groups = conn.execute(sa.text(
        "SELECT occupation, is_active FROM baseline_question GROUP BY occupation, is_active "
        "ORDER BY occupation NULLS LAST, is_active DESC"
    )).fetchall()
    numbers = {}
    for occupation, active in groups:
        numbers[occupation] = numbers.get(occupation, 0) + 1
        template_id = conn.execute(sa.text(
            "INSERT INTO baseline_template (name, occupation, description, is_active, activated_at, created_at, updated_at) "
            "VALUES (:name, :occupation, :description, :active, CASE WHEN :active THEN now() END, now(), now()) "
            "RETURNING template_id"
        ), {
            "name": f"Baseline assessment {numbers[occupation]}",
            "occupation": occupation,
            "description": "Created from the questions that existed before baseline assessments had names.",
            "active": bool(active),
        }).scalar()
        conn.execute(sa.text(
            "UPDATE baseline_question SET template_id = :template_id "
            "WHERE occupation IS NOT DISTINCT FROM :occupation AND is_active = :active"
        ), {"template_id": template_id, "occupation": occupation, "active": bool(active)})

    # Earlier attempts: link each to the assessment its questions now belong to, when they all belong to one,
    # so players are not offered an assessment they have already taken
    conn.execute(sa.text(
        "UPDATE baseline_assessment a SET template_id = sub.template_id FROM ("
        " SELECT r.assessment_id, MIN(q.template_id) AS template_id FROM baseline_response r"
        " JOIN baseline_question q ON q.question_id = r.question_id"
        " GROUP BY r.assessment_id HAVING COUNT(DISTINCT q.template_id) = 1"
        ") sub WHERE a.assessment_id = sub.assessment_id"
    ))

    with op.batch_alter_table('baseline_question', schema=None) as batch_op:
        batch_op.drop_column('is_active')
        batch_op.drop_column('occupation')


def downgrade():
    """Put the role and on/off switch back on each question, then remove the assessments."""
    with op.batch_alter_table('baseline_question', schema=None) as batch_op:
        batch_op.add_column(sa.Column('occupation', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.execute(
        "UPDATE baseline_question q SET occupation = t.occupation, is_active = t.is_active "
        "FROM baseline_template t WHERE q.template_id = t.template_id"
    )
    with op.batch_alter_table('baseline_assessment', schema=None) as batch_op:
        batch_op.drop_constraint('fk_baseline_assessment_template', type_='foreignkey')
        batch_op.drop_column('template_id')
    with op.batch_alter_table('baseline_question', schema=None) as batch_op:
        batch_op.drop_constraint('fk_baseline_question_template', type_='foreignkey')
        batch_op.drop_column('template_id')
    op.drop_table('baseline_template')
