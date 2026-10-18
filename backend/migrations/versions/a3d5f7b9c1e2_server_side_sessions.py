"""server-side login sessions with rotating refresh tokens

Revision ID: a3d5f7b9c1e2
Revises: f2b4d6e8a0c1
Create Date: 2026-10-17 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a3d5f7b9c1e2'
down_revision = 'f2b4d6e8a0c1'
branch_labels = None
depends_on = None


def upgrade():
    """Each login session row now holds hashes of its secrets (the session key inside the tokens, the current
    and previous refresh token), how many times it was refreshed, when it ends if idle and at the latest,
    a hash of the browser it started in, and why it ended. Sessions started before this change have no key,
    so their old tokens stop working and everyone signs in again once."""
    with op.batch_alter_table('user_session') as batch:
        batch.add_column(sa.Column('key_hash', sa.String(length=64), nullable=True))
        batch.add_column(sa.Column('refresh_hash', sa.String(length=64), nullable=True))
        batch.add_column(sa.Column('previous_refresh_hash', sa.String(length=64), nullable=True))
        batch.add_column(sa.Column('generation', sa.Integer(), nullable=False, server_default='0'))
        batch.add_column(sa.Column('rotated_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('idle_expires_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('expires_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('user_agent_hash', sa.String(length=64), nullable=True))
        batch.add_column(sa.Column('ended_reason', sa.String(length=40), nullable=True))
        batch.create_index('ix_user_session_key_hash', ['key_hash'], unique=True)

    # Old sessions cannot be continued (their tokens carry no session key), so close them
    op.execute(
        "UPDATE user_session SET status = 'EXPIRED', ended_reason = 'security_upgrade', "
        "logout_time = COALESCE(logout_time, now()) WHERE status = 'ACTIVE'"
    )


def downgrade():
    with op.batch_alter_table('user_session') as batch:
        batch.drop_index('ix_user_session_key_hash')
        for column in ('ended_reason', 'user_agent_hash', 'expires_at', 'idle_expires_at', 'rotated_at',
                       'generation', 'previous_refresh_hash', 'refresh_hash', 'key_hash'):
            batch.drop_column(column)
