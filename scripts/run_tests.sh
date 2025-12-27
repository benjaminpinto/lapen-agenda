#!/usr/bin/env bash

echo "Running backend tests..."

cd "$(dirname "$0")/.." || exit 1

if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

export DATABASE_URL=postgresql://lapen_user:lapen_password@localhost:5432/lapen_agenda

python -m pytest tests/ -v --cov=src --cov-report=term-missing --tb=short

if [ $? -eq 0 ]; then
    echo "✅ All tests passed!"
    exit 0
else
    echo "❌ Tests failed!"
    exit 1
fi
