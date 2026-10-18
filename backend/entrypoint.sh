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
# The demo data takes a few minutes to load. It loads in the background while Gunicorn already answers:
# as long as this file exists, every request gets "still getting ready" and the healthcheck says starting.
export SETUP_MARKER_FILE=/tmp/phishsim-setting-up
rm -f "$SETUP_MARKER_FILE"
# Kept in the uploads volume until a load finishes, so a load cut short by a restart runs again on the
# next start (seed_demo.py clears what it had written) instead of leaving a half-loaded demo
UNFINISHED_LOAD=/app/uploads/.demo-load-unfinished
load_demo() {
  touch "$SETUP_MARKER_FILE" "$UNFINISHED_LOAD"
  (
    set +e   # whatever fails, the marker must go so the app does not stay "getting ready"
    if [ "$1" = "reset" ]; then python reset_database.py --confirm-reset; fi
    if python seed_demo.py; then
      rm -f "$UNFINISHED_LOAD"
    else
      echo "Demo data was not loaded (see the message above). The app starts without it."
    fi
    rm -f "$SETUP_MARKER_FILE"
    echo "Ready: the app can be used now."
  ) &
}
if [ "$MODE" = "reset" ]; then
  echo "Resetting database and loading demo data in the background..."
  load_demo reset
elif [ "$MODE" = "auto" ]; then
  if [ -f "$UNFINISHED_LOAD" ]; then
    echo "The last demo data load did not finish: loading it again, in the background..."
    load_demo
  elif python -c "import sys; from app import create_app; from app.models.authentication import User; app=create_app(); app.app_context().push(); sys.exit(0 if User.query.first() else 1)"; then
    echo "Database already has data; leaving it as is."
  else
    echo "Empty database: loading demo data once, in the background..."
    load_demo
  fi
fi

echo "Starting Gunicorn..."
# REQUEST_TIMEOUT_SECONDS (from .env) gives big dataset imports time to finish
exec gunicorn --bind 0.0.0.0:5000 --workers 3 --timeout "${REQUEST_TIMEOUT_SECONDS:-120}" "run:app"
