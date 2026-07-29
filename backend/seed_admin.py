from app import create_app
from app.extensions import db, bcrypt
from app.models.authentication import User

app = create_app()

with app.app_context():

    existing_admin = User.query.filter_by(
        email="admin@phishsimulator.com"
    ).first()

    if existing_admin:
        print("Admin already exists.")
    else:

        admin = User(
            email="admin@phishsimulator.com",
            password_hash=bcrypt.generate_password_hash(
                "Admin@123"
            ).decode("utf-8"),
            role="ADMIN"
        )

        db.session.add(admin)
        db.session.commit()

        print("Admin created successfully.")