#!/bin/sh
# Start the backend: wait for Postgres, prepare the schema, then run Gunicorn.
set -e

echo "Waiting for the database..."
python - <<'PY'
import time
from sqlalchemy import create_engine
from app.config import Config

url = Config.SQLALCHEMY_DATABASE_URI
for attempt in range(30):
    try:
        create_engine(url).connect().close()
        print("Database is ready.")
        break
    except Exception:
        time.sleep(2)
else:
    raise SystemExit("Database did not become ready in time.")
PY

echo "Applying database migrations..."
flask --app run.py db upgrade

# SEED_DEMO controls the demo data:
#   auto (default) - load it ONCE, only when the database is still empty, then leave it alone.
#                    Your data then persists across restarts until you run "docker compose down -v".
#   reset          - wipe and reload the demo data on every start.
#   off            - never seed; only apply migrations.
MODE="${SEED_DEMO:-auto}"
if [ "$MODE" = "reset" ]; then
  echo "Resetting database and loading demo data..."
  python reset_database.py --confirm-reset
  python seed_demo.py
elif [ "$MODE" = "auto" ]; then
  if python -c "import sys; from app import create_app; from app.models.authentication import User; app=create_app(); app.app_context().push(); sys.exit(0 if User.query.first() else 1)"; then
    echo "Database already has data; leaving it as is."
  else
    echo "Empty database: loading demo data once..."
    python seed_demo.py
  fi
fi

echo "Starting Gunicorn..."
exec gunicorn --bind 0.0.0.0:5000 --workers 3 --timeout 120 "run:app"
