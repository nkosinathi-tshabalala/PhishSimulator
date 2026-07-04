from app.extensions import bcrypt, db
from app.models.authentication import Player
from app.models.authentication import User
from app.models.authentication import UserProfile
from app.schemas.auth_schema import AuthSchema


class AuthService:
    """Handles authentication business logic."""

    @staticmethod
    def register(data):
        """Register a new player."""

        # Validate input
        is_valid, error = AuthSchema.validate_registration(data)

        if not is_valid:
            return False, error

        # Check whether the email already exists
        existing_user = User.query.filter_by(
            email=data["email"]
        ).first()

        if existing_user:
            return False, "An account with this email already exists."

        try:

            # Hash the password
            password_hash = bcrypt.generate_password_hash(
                data["password"]
            ).decode("utf-8")

            # Create user
            user = User(
                email=data["email"],
                password_hash=password_hash,
                role="PLAYER"
            )

            db.session.add(user)
            db.session.flush()

            # Create player
            player = Player(
                user_id=user.user_id,
                full_name=data["full_name"]
            )

            db.session.add(player)
            db.session.flush()

            # Create profile
            profile = UserProfile(
                player_id=player.player_id,
                age=data["age"],
                it_background=data["it_background"],
                occupation=data["occupation"]
            )

            db.session.add(profile)

            # Save everything
            db.session.commit()

            return True, "Registration successful."

        except Exception as error:
            db.session.rollback()
            raise error