# Starts the backend for local development

from app import create_app

app = create_app()

if __name__ == "__main__":
    # The debugger runs code from the browser, so it is only switched on for local development
    app.run(debug=app.config["FLASK_ENV"] == "development")