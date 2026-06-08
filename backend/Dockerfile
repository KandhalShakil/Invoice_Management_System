FROM python:3.10-slim

# Install system dependencies needed for report compilation and cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install python requirements
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy project source
COPY . /app/

# Expose ports
EXPOSE 8000

# Default command runs production ASGI server (daphne/uvicorn)
CMD ["daphne", "-b", "0.0.0.0", "-p", "8000", "config.asgi:application"]
