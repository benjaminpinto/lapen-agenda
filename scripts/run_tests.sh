#!/usr/bin/env bash

cd "$(dirname "$0")/.." || exit 1

FAILED=0

# ── Frontend (Vitest) ─────────────────────────────────────────────────────────
echo "Running frontend tests..."
npm run test:unit
if [ $? -ne 0 ]; then
    echo "❌ Frontend tests failed!"
    FAILED=1
else
    echo "✅ Frontend tests passed!"
fi

# ── Backend (pytest) ──────────────────────────────────────────────────────────
echo ""
echo "Running backend tests..."

if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

export DATABASE_URL=postgresql://lapen_user:lapen_password@localhost:5432/lapen_agenda

python -m pytest tests/backend/ -v --cov=src --cov-report=term-missing --tb=short
if [ $? -ne 0 ]; then
    echo "❌ Backend tests failed!"
    FAILED=1
else
    echo "✅ Backend tests passed!"
fi

# ── Result ────────────────────────────────────────────────────────────────────
echo ""
if [ $FAILED -eq 0 ]; then
    echo "✅ All tests passed!"
    exit 0
else
    echo "❌ Some tests failed!"
    exit 1
fi
