#!/bin/bash

echo "Running backend tests..."

if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

python -m pytest tests/ -v --tb=short

if [ $? -eq 0 ]; then
    echo "✅ All tests passed!"
    exit 0
else
    echo "❌ Tests failed!"
    exit 1
fi
