# Try alternative registries if Docker Hub is slow
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for frontend build
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy package files and install Node dependencies
COPY package*.json .
RUN npm install

# Copy application code
COPY . .

# Build frontend
RUN npm run build

# Expose port
EXPOSE 5001

# Run migrations and start server
CMD python -c "from src.database import init_db; init_db()" && \
    if [ "$FLASK_ENV" = "production" ]; then \
        gunicorn --bind 0.0.0.0:5001 --workers 4 --timeout 120 main:app; \
    else \
        python main.py; \
    fi
