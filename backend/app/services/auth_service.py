from flask_jwt_extended import get_jwt_identity
from flask_jwt_extended import create_access_token
from app.models.authentication import UserSession
from app.enums.session_status import SessionStatus
from app.enums.occupation import Occupation
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
            raise 
        

    @staticmethod
    def login(data):
        """Authenticate a user."""

        # Validate request
        is_valid, error = AuthSchema.validate_login(data)

        if not is_valid:
            return False, error, None

        # Find user
        user = User.query.filter_by(
            email=data["email"]
        ).first()

        if not user:
            return False, "Invalid email or password.", None

        # Verify password
        if not bcrypt.check_password_hash(
            user.password_hash,
            data["password"]
        ):
            return False, "Invalid email or password.", None

        try:

            # Create JWT
            access_token = create_access_token(
                identity=str(user.user_id)
            )

            # Record login session
            session = UserSession(
                user_id=user.user_id,
                status=SessionStatus.ACTIVE
            )

            db.session.add(session)
            db.session.commit()

            return True, "Login successful.", {
                "access_token": access_token,
                "user_id": user.user_id,
                "role": user.role
            }

        except Exception:
            db.session.rollback()
            raise
    
    @staticmethod
    def get_current_user():
        """Returns the currently authenticated user."""

        user_id = int(get_jwt_identity())

        user = User.query.get(user_id)

        if not user:
            return False, "User not found.", None

        player = Player.query.filter_by(
            user_id=user.user_id
        ).first()

        profile = UserProfile.query.filter_by(
            player_id=player.player_id
        ).first()

        return True, "User retrieved successfully.", {
            "user_id": user.user_id,
            "email": user.email,
            "role": user.role,
            "full_name": player.full_name,
            "age": profile.age,
            "it_background": profile.it_background,
            "occupation": profile.occupation.value
        }
    
    @staticmethod
    def update_profile(data):
        """Updates the authenticated user's profile."""

        user_id = int(get_jwt_identity())

        user = User.query.get(user_id)

        if not user:
            return False, "User not found.", None

        player = Player.query.filter_by(
            user_id=user.user_id
        ).first()

        profile = UserProfile.query.filter_by(
            player_id=player.player_id
        ).first()

        try:
            # Update player details
            player.full_name = data["full_name"]

            # Update profile details
            profile.age = data["age"]
            profile.it_background = data["it_background"]
            try:
                profile.occupation = Occupation(data["occupation"])
            except ValueError:

                return False, "Invalid occupation selected.", None

            db.session.commit()

            return True, "Profile updated successfully.", {
                "user_id": user.user_id,
                "email": user.email,
                "role": user.role,
                "full_name": player.full_name,
                "age": profile.age,
                "it_background": profile.it_background,
                "occupation": profile.occupation.value
            }

        except Exception:
            db.session.rollback()
            raise

    @staticmethod
    def change_password(data):
        """Changes the authenticated user's password."""

        user_id = int(get_jwt_identity())

        user = User.query.get(user_id)

        if not user:
            return False, "User not found.", None

        # Verify current password
        if not bcrypt.check_password_hash(
            user.password_hash,
            data["current_password"]
        ):
            return False, "Current password is incorrect.", None

        # Confirm passwords match
        if data["new_password"] != data["confirm_password"]:
            return False, "New passwords do not match.", None

        try:

            # Hash the new password
            user.password_hash = bcrypt.generate_password_hash(
                data["new_password"]
            ).decode("utf-8")

            db.session.commit()

            return True, "Password updated successfully.", None

        except Exception:
            db.session.rollback()
            raise