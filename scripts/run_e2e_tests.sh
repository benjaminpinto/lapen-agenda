#!/bin/bash

# LAPEN Agenda - E2E Test Runner
# This script sets up and runs Playwright E2E tests

set -e

echo "🎾 LAPEN Agenda - E2E Test Runner"
echo "=================================="

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node dependencies..."
    npm install
fi

# Check if Playwright browsers are installed
if [ ! -d "node_modules/@playwright" ]; then
    echo "🌐 Installing Playwright browsers..."
    npx playwright install --with-deps
fi

# Check if .env.test exists
if [ ! -f ".env.test" ]; then
    echo "⚠️  Warning: .env.test not found. Using default test configuration."
fi

# Setup test database
echo "🗄️  Setting up test database..."
python setup_db.py

# Check if backend is running
if ! curl -s http://localhost:5001/api/health > /dev/null 2>&1; then
    echo "🚀 Starting backend server..."
    python main.py &
    BACKEND_PID=$!
    sleep 5
    echo "Backend started with PID: $BACKEND_PID"
else
    echo "✅ Backend already running"
    BACKEND_PID=""
fi

# Check if frontend is running
if ! curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo "🎨 Starting frontend server..."
    npm run dev &
    FRONTEND_PID=$!
    sleep 10
    echo "Frontend started with PID: $FRONTEND_PID"
else
    echo "✅ Frontend already running"
    FRONTEND_PID=""
fi

# Run tests
echo ""
echo "🧪 Running Playwright E2E tests..."
echo "=================================="
npm run test:e2e

# Cleanup
cleanup() {
    echo ""
    echo "🧹 Cleaning up..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
        echo "Stopped backend (PID: $BACKEND_PID)"
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
        echo "Stopped frontend (PID: $FRONTEND_PID)"
    fi
}

trap cleanup EXIT

echo ""
echo "✅ Tests completed!"
echo "📊 View report: npm run test:e2e:report"
