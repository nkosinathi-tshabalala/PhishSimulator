# Server-side login sessions: one row in user_session per sign-in, with rotating refresh tokens
#
# How it works:
#   - Signing in creates a session row with a random key. Only the SHA-256 of the key is stored.
#   - Two signed tokens (JWT, HS256) go to the browser as HttpOnly cookies. Both carry only the session key
#     (as "sub"): no user id, email or role. The server looks the session up on every request.
#       access token  - 10 minutes, sent to /api/*, also carries "gen" (the session's refresh count)
#       refresh token - sent only to /api/auth/refresh, swapped for a new one every time it is used
#   - Refreshing ("rotation") stores the new refresh token's id hash and bumps "gen", so the previous access
#     token stops working at once. Using an older refresh token again means it was copied: the whole session
#     is revoked. The one just replaced is still accepted for a few seconds, for two tabs refreshing together.
#   - A session ends when it is not refreshed for SESSION_IDLE_MINUTES, after SESSION_MAX_HOURS in any case,
#     on logout, when the password changes, or when its tokens are used from a different browser.

import hashlib
import secrets
from datetime import datetime, timedelta

from flask import current_app, g, request
from flask_jwt_extended import create_access_token, create_refresh_token, get_jti

from app.enums.session_status import SessionStatus
from app.extensions import db
from app.models.authentication import UserSession

# How long the refresh token that was just replaced still works (two tabs refreshing at the same moment)
ROTATION_GRACE_SECONDS = 20


def _sha256(value):
    return hashlib.sha256(str(value).encode("utf-8")).hexdigest()


def _user_agent_hash():
    """A hash of the browser's User-Agent. Not proof of identity (it can be copied), but a stolen cookie used
    from another browser or tool usually has a different one, and then the session ends."""
    return _sha256(request.headers.get("User-Agent", ""))


class SessionService:
    """Starts, checks, refreshes and ends login sessions."""

    @staticmethod
    def _idle():
        return timedelta(minutes=current_app.config["SESSION_IDLE_MINUTES"])

    @staticmethod
    def _issue(session, key):
        """New tokens for a session: a fresh refresh token id and the next generation. Returns
        (access token, refresh token)."""
        now = datetime.utcnow()
        refresh = create_refresh_token(identity=key)
        session.previous_refresh_hash = session.refresh_hash
        session.refresh_hash = _sha256(get_jti(refresh))
        session.generation = (session.generation or 0) + 1
        session.rotated_at = now
        session.idle_expires_at = min(now + SessionService._idle(), session.expires_at)
        access = create_access_token(identity=key, additional_claims={"gen": session.generation})
        return access, refresh

    @staticmethod
    def start(user):
        """Begin a new session for a user who just proved their password. A new random key every time, so a
        session id planted before sign-in (session fixation) is never reused. Returns (session, access, refresh)."""
        now = datetime.utcnow()
        key = secrets.token_urlsafe(32)
        session = UserSession(
            user_id=user.user_id, status=SessionStatus.ACTIVE, login_time=now, key_hash=_sha256(key),
            expires_at=now + timedelta(hours=current_app.config["SESSION_MAX_HOURS"]),
            user_agent_hash=_user_agent_hash(), generation=0,
        )
        db.session.add(session)
        access, refresh = SessionService._issue(session, key)
        db.session.commit()
        return session, access, refresh

    @staticmethod
    def find(key):
        """The session row for a token's key, or None."""
        if not key:
            return None
        return UserSession.query.filter_by(key_hash=_sha256(key)).first()

    @staticmethod
    def end(session, reason, status=SessionStatus.LOGGED_OUT):
        """Close a session so none of its tokens work again."""
        if session.status == SessionStatus.ACTIVE:
            session.status = status
            session.logout_time = datetime.utcnow()
            session.ended_reason = reason
            # Forget the refresh token hashes: nothing can continue this session
            session.refresh_hash = session.previous_refresh_hash = None

    @staticmethod
    def _expired_reason(session, now):
        if session.expires_at and now >= session.expires_at:
            return "max_lifetime"
        if session.idle_expires_at and now >= session.idle_expires_at:
            return "idle_timeout"
        return None

    @staticmethod
    def check(claims):
        """Whether a token may be used: its session is active and in time, it comes from the browser the
        session started in, and an access token is from the latest refresh. Ends the session when it has run
        out or looks hijacked. The session is kept on flask.g for the rest of the request."""
        session = SessionService.find(claims.get("sub"))
        if not session or session.status != SessionStatus.ACTIVE:
            return False

        now = datetime.utcnow()
        reason = SessionService._expired_reason(session, now)
        if reason:
            SessionService.end(session, reason, SessionStatus.EXPIRED)
            db.session.commit()
            return False
        if session.user_agent_hash and session.user_agent_hash != _user_agent_hash():
            SessionService.end(session, "browser_changed")
            db.session.commit()
            current_app.logger.warning("Session %s ended: its token was used from a different browser",
                                       session.session_id)
            return False
        if claims.get("type") == "access" and claims.get("gen") != session.generation:
            return False

        g.auth_session = session
        return True

    @staticmethod
    def refresh(claims):
        """Swap a valid refresh token for new tokens. Returns (access, refresh) or None when the session is
        over. A refresh token used again after it was replaced means someone copied it: revoke the session."""
        session = getattr(g, "auth_session", None) or SessionService.find(claims.get("sub"))
        if not session or session.status != SessionStatus.ACTIVE:
            return None

        presented = _sha256(claims.get("jti"))
        just_replaced = (
            presented == session.previous_refresh_hash and session.rotated_at
            and datetime.utcnow() - session.rotated_at <= timedelta(seconds=ROTATION_GRACE_SECONDS)
        )
        if presented != session.refresh_hash and not just_replaced:
            SessionService.end(session, "refresh_reuse")
            db.session.commit()
            current_app.logger.warning("Session %s revoked: an old refresh token was used again", session.session_id)
            return None

        access, refresh = SessionService._issue(session, claims["sub"])
        db.session.commit()
        return access, refresh

    @staticmethod
    def end_all(user_id, reason, keep=None):
        """End every active session of a user (all devices), except `keep` (the one making the change)."""
        query = UserSession.query.filter_by(user_id=user_id, status=SessionStatus.ACTIVE)
        for session in query.all():
            if keep is None or session.session_id != keep.session_id:
                SessionService.end(session, reason)

    @staticmethod
    def expire_idle():
        """Close sessions that ran out without signing out, so "active now" counts only real sign-ins.
        Sessions from before server-side sessions (no expiry recorded) close after the maximum lifetime."""
        now = datetime.utcnow()
        oldest = now - timedelta(hours=current_app.config["SESSION_MAX_HOURS"])
        stale = UserSession.query.filter(
            UserSession.status == SessionStatus.ACTIVE,
            db.or_(
                UserSession.idle_expires_at <= now,
                UserSession.expires_at <= now,
                db.and_(UserSession.idle_expires_at.is_(None), UserSession.login_time <= oldest),
            ),
        ).all()
        for session in stale:
            SessionService.end(session, SessionService._expired_reason(session, now) or "max_lifetime",
                               SessionStatus.EXPIRED)
        if stale:
            db.session.commit()
        return len(stale)

    @staticmethod
    def timing(session):
        """What the page may know about its session: seconds until it ends if idle, and at the latest."""
        now = datetime.utcnow()
        return {
            "idle_expires_in": max(0, int((session.idle_expires_at - now).total_seconds())),
            "expires_in": max(0, int((session.expires_at - now).total_seconds())),
        }
