# Backend API image (Flask + Gunicorn).
FROM python:3.12-slim

# Faster, cleaner Python in a container.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install dependencies first so Docker can cache this layer.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code.
COPY . .

# entrypoint.sh waits for the database, applies migrations, then starts Gunicorn.
RUN chmod +x entrypoint.sh

# Run as a normal user, not root, so a bug in the app cannot take over the container.
# Only the uploads folder needs to be writable.
RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p uploads/datasets \
    && chown -R appuser uploads
USER appuser

EXPOSE 5000
CMD ["./entrypoint.sh"]
