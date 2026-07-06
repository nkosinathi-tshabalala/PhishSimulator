from flask import Flask
from flask_cors import CORS

from app.config import Config
from app.extensions import bcrypt
from app.extensions import db
from app.extensions import jwt
from app.extensions import migrate

# Import models so Flask-Migrate can detect them
from app.models import *

# Import Blueprints
from app.routes.auth_routes import auth_bp


def create_app():
    """Create and configure the Flask application."""

    app = Flask(__name__)

    # Load application configuration
    app.config.from_object(Config)

    # Allow requests from the React frontend
    CORS(
        app,
        resources={r"/api/*": {"origins": "http://localhost:5173"}}
    )

    # Initialise Flask extensions
    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    jwt.init_app(app)

    # Register API Blueprints
    app.register_blueprint(auth_bp)

    # Health check route
    @app.route("/")
    def home():
        return {
            "application": "PhishSimulator API",
            "version": "1.0.0",
            "status": "Running"
        }

    return app