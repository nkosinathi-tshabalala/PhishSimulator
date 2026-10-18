# Creates the Flask app and connects the database, logins and every group of endpoints

import os

from flask import Flask
from flask_cors import CORS

from app.config import Config
from app.extensions import bcrypt, db, jwt, migrate
from app.security import register_security

from app.models import *  # noqa: F401,F403

from app.routes.analytics_routes import analytics_bp
from app.routes.auth_routes import auth_bp
from app.routes.baseline_routes import baseline_bp
from app.routes.campaign_routes import campaign_bp
from app.routes.dataset_routes import dataset_bp
from app.routes.scenario_routes import scenario_bp
from app.routes.simulation_routes import simulation_bp


def create_app():
    """Create the Flask app, connect the extensions and register every route."""
    app = Flask(__name__)
    app.config.from_object(Config)

    # The page and the API share one address (nginx in Docker, the Vite proxy in development), so browsers
    # need no cross-origin access. Only FRONTEND_URL may call it from elsewhere, with its cookies.
    CORS(
        app,
        resources={r"/api/*": {"origins": [app.config["FRONTEND_URL"]]}},
        supports_credentials=True,
        allow_headers=["Content-Type", "X-CSRF-Token"],
    )

    db.init_app(app)
    migrate.init_app(app, db)
    bcrypt.init_app(app)
    jwt.init_app(app)
    register_security(app)

    for blueprint in (
        auth_bp,
        baseline_bp,
        dataset_bp,
        scenario_bp,
        simulation_bp,
        analytics_bp,
        campaign_bp,
    ):
        app.register_blueprint(blueprint)

    @app.route("/")
    def home():
        """Health check for the API."""
        return {"application": "PhishSimulator API", "status": "Running"}

    # Background heartbeat that closes campaign emails past their window and sends result emails.
    # Skipped in testing, where the suite drives settling directly (CAMPAIGN_SWEEPER=off).
    if not app.config.get("TESTING") and os.getenv("CAMPAIGN_SWEEPER", "on").lower() != "off":
        from app.services.campaign_service import start_sweeper
        start_sweeper(app)

    return app
