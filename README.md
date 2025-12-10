# LAPEN Agenda - Tennis Court Management System

> Sistema completo de gerenciamento de quadras de tênis com sistema de apostas integrado

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/Flask-3.0.0-green.svg)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-yellow.svg)](https://buymeacoffee.com/benjaminpinto)

## 🎾 Overview

LAPEN Agenda is a comprehensive tennis court management system with advanced features:
- **Smart Scheduling** - Court booking with conflict prevention and recurring schedules
- **Betting Platform** - Real-time odds calculation with PIX payments (Mercado Pago)
- **Ranking System** - Automated tournament draws with Elite/Challenger groups
- **Statistics Dashboard** - Player performance analytics with clay court themed charts
- **User Management** - JWT authentication with LAPEN member approval workflow
- **Admin Panel** - Complete management dashboard with W.O. resolution
- **Payment Integration** - PIX and card payments with automatic settlement
- **API Documentation** - Interactive Swagger UI with 60+ endpoints
- **E2E Testing** - Playwright tests with Allure reporting on GitHub Pages

## ✨ Key Features

### 🏟️ Court Management
- Multiple court types with images and availability tracking
- Active/inactive status control
- Holiday and time block management

### 📅 Smart Scheduling System
- 90-minute time slots (07:30-22:30)
- Weekly/monthly calendar views with conflict prevention
- Recurring schedules with date ranges
- Player autocomplete and match type categorization
- WhatsApp schedule sharing integration

### 🎲 Advanced Betting Platform
- Real-time odds calculation based on bet distribution
- PIX and card payment support (Mercado Pago + Stripe)
- Automatic bet settlement with 20% house edge
- QR code generation for PIX payments
- Device ID tracking for fraud prevention
- Refund system for cancelled matches
- Complete betting history and payment logs

### 🏆 Intelligent Ranking System
- **Automated Draw Engine** - Smart pairing algorithm avoiding recent opponents
- **Elite/Challenger Groups** - Dynamic 50/50 split based on performance
- **Points Calculator** - Configurable scoring with set/game bonuses
- **W.O. Resolution** - Administrative walkover handling with evidence tracking
- **Temporary Points** - Season start positioning with automatic expiration
- **Finals System** - Top performer qualification tracking
- **Season Management** - Draft/Active/Finished status workflow
- **Round Control** - Pending/Drawn/Open/Closed lifecycle

### 📊 Statistics & Analytics
- Player performance tracking with win/loss ratios
- Head-to-head records and match history
- Set/game statistics with leaderboards
- Clay court themed charts (Recharts)
- Match type filtering (Liga, Amistoso, Aula, Torneio)
- Recent matches display with trends

### 👥 User Management
- JWT authentication (7-day expiry) with email verification
- LAPEN member approval workflow
- Profile management (name, phone, PIX key, short name)
- Password reset with token expiry
- Admin role management
- Betting history tracking

### 🔐 Admin Dashboard
- Court, holiday, and recurring schedule CRUD
- Match management (finish/cancel with results)
- User management with LAPEN approval
- Ranking season and round control
- W.O. resolution with evidence
- Draw execution and cancellation
- Betting reports and statistics

### 💳 Payment Integration
- **Mercado Pago** - PIX payments with QR code
- **Stripe** - Card payments with 3D Secure
- Webhook notifications for real-time status
- External reference tracking
- Payment logs for audit trail
- ✅ 9/9 Mercado Pago quality recommendations implemented

### 🧪 Testing & CI/CD
- Unit tests with pytest and coverage reporting
- E2E tests with Playwright (local and CI)
- Allure reports published to GitHub Pages
- Automated testing on every push/PR
- Preview deployments with E2E validation
- Screenshots, videos, and traces attached

### 📡 API & Documentation
- Interactive Swagger UI (OpenAPI 3.0.4)
- 60+ REST endpoints across 11 blueprints
- JWT and session authentication
- Comprehensive error handling
- Portuguese error messages
- Request/response validation

[See complete feature list →](docs/FEATURES.md)

## 🚀 Quick Start

### Docker (Recommended)

```bash
# Clone repository
git clone <repository-url>
cd lapen-agenda

# Start with Docker
docker-compose up -d

# Access application
http://localhost:5001
```

### Manual Setup

```bash
# Requires PostgreSQL running locally
export DATABASE_URL=postgresql://user:password@localhost:5432/lapen_agenda

# Setup backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Setup frontend
npm install

# Configure environment
cp .env.docker .env
# Edit .env with your credentials

# Run development servers
python main.py          # Backend (port 5001)
npm run dev            # Frontend (port 5173)
```

[Detailed setup guide →](docs/SETUP.md)

## 📚 Documentation

- 📖 [Setup Guide](docs/SETUP.md) - Installation and configuration
- 🏗️ [Architecture](docs/ARCHITECTURE.md) - System design and structure
- ✨ [Features](docs/FEATURES.md) - Complete feature list
- 🔒 [Security](docs/SECURITY.md) - Security configuration
- 🔌 [API Documentation](docs/API_DOCUMENTATION.md) - REST API reference
- 🎾 [LAPEN Member System](docs/QUICK_START_LAPEN.md) - Member approval workflow
- 🏆 [Ranking System](docs/RANKING_IMPLEMENTATION_PLAN.md) - Ranking implementation details
- 📊 [Statistics Module](docs/STATISTICS_MODULE.md) - Statistics implementation
- 🧪 [Testing Guide](docs/TESTING.md) - Unit and E2E testing
- 🎭 [Playwright Setup](docs/PLAYWRIGHT_SETUP.md) - E2E testing configuration
- 📈 [Allure Reporting](docs/ALLURE_REPORTING.md) - Test reporting and analytics
- 📘 [User Manual](docs/Manual%20do%20Usuário%20-%20Agenda%20LAPEN.md) - Complete user guide (Portuguese)
- 📋 [System Overview](docs/Agenda%20LAPEN%20-%20Sistema%20de%20Gerenciamento%20de%20Quadras%20de%20Tênis.md) - Detailed system documentation (Portuguese)
- 🔗 **Interactive API Docs:** http://localhost:5001/api/docs

## 🛠️ Technology Stack

**Backend:**
- Flask 3.0.0 (Python 3.9+)
- PostgreSQL 15
- Gunicorn (production)
- JWT Authentication
- Mercado Pago SDK (PIX)
- Stripe SDK (Cards)
- Flask-Mail (Gmail SMTP)
- Flasgger (OpenAPI 3.0.4)

**Frontend:**
- React 18.3.1
- Vite 6.0.1
- Tailwind CSS 3.4.17
- shadcn/ui (Radix UI)
- Recharts 3.5.1
- React Router 6.28.0

**Testing & Quality:**
- pytest with pytest-cov (Unit tests)
- Playwright 1.48.0 (E2E tests)
- Allure 2.34.1 (Test reporting)
- GitHub Actions (CI/CD pipeline)
- PostgreSQL 15 (Test database)

**Infrastructure:**
- Vercel (Hosting)
- Docker + Docker Compose
- GitHub Actions (CI/CD)
- Nginx (Production proxy)

[See full architecture →](docs/ARCHITECTURE.md)

## 💳 Payment Integration

**Primary Gateway:** Mercado Pago (PIX) | **Secondary:** Stripe (Cards)

✅ **Fully Optimized** - All 9 Mercado Pago quality recommendations:
- ✅ Device ID tracking for fraud prevention
- ✅ Complete item details in payment requests
- ✅ External reference tracking
- ✅ Webhook signature verification
- ✅ PIX QR code generation
- ✅ Real-time payment status updates
- ✅ Automatic refund processing
- ✅ Payment logs for audit trail
- ✅ Error handling and retry logic

## 🔐 Security

- Environment-based configuration
- JWT authentication (7-day expiry)
- Bcrypt password hashing (12 rounds)
- Secure session cookies (HTTP-only, SameSite=Lax)
- Input sanitization
- CORS protection (restricted origins)
- SQL parameterization
- Webhook signature verification
- Device ID tracking (fraud prevention)
- Path traversal protection

[Security configuration →](docs/SECURITY.md)

## 📝 Environment Variables

Required variables in `.env`:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/lapen_agenda
ADMIN_PASSWORD=your-admin-password
SECRET_KEY=your-secret-key-min-32-chars
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MERCADOPAGO_ACCESS_TOKEN=your-token
MERCADOPAGO_PUBLIC_KEY=your-key
```

Optional variables:
```bash
FRONTEND_URL=https://your-domain.com  # Production only
STRIPE_SECRET_KEY=your-stripe-key
STRIPE_PUBLISHABLE_KEY=your-stripe-public-key
FLASK_ENV=development  # or production
```

See [.env.example](.env.example) for complete list.

## 🌐 Access Points

- **Frontend:** http://localhost:5173 (dev) / http://localhost:5001 (prod)
- **API Docs:** http://localhost:5001/api/docs
- **Admin Panel:** http://localhost:5173/admin (dev) / http://localhost:5001/admin (prod)
- **PostgreSQL:** localhost:5432 (Docker)

## 🧪 Testing

```bash
# Unit tests
pytest tests/ --cov=src

# E2E tests (local)
npm run test:e2e

# E2E tests with UI
npm run test:e2e:ui

# Allure reports
npm run allure:serve  # Generate and view report
```

**Test Reports:**
- 📊 **[View Live Test Reports](https://benjaminpinto.github.io/lapen-agenda)** - Allure reports on GitHub Pages
- Interactive dashboards with trends and analytics
- Screenshots, videos, and traces attached automatically
- History tracking across test runs

[Complete testing guide →](docs/TESTING.md)

## 🚀 CI/CD Pipeline

**Automated Testing & Deployment:**

1. **Unit Tests** - Run on every push/PR (all branches)
   - Python unit tests with pytest
   - Blocks deployment if tests fail

2. **Vercel Deployment**
   - **Main branch** → Production environment
   - **Other branches** → Preview environments

3. **E2E Tests** - Triggered after successful preview deployments
   - Runs Playwright tests against preview URL
   - Only executes for non-main branches
   - Allure reports published to GitHub Pages
   - Results reported back to Vercel

**Pipeline Flow:**
```
Push to branch → Unit Tests → Vercel Deploy → E2E Tests (preview only) → Allure Report → Vercel Check
                                    ├─ main → Production
                                    └─ other → Preview
```

## 📦 Production Deployment

### Docker (Recommended)

```bash
# Configure production environment
cp .env.production.example .env.production
# Edit .env.production with your credentials

# Start production stack
docker-compose -f docker-compose.prod.yml up -d
```

[See Docker documentation →](README.docker.md)

### Manual

```bash
# Build frontend
npm run build

# Run with Gunicorn
export FLASK_ENV=production
gunicorn --config gunicorn.conf.py main:app
```

## 🤝 Contributing

Contributions are welcome! Please read the documentation before submitting PRs.

## 📄 License

MIT License - see LICENSE file for details.

## 👥 Authors

Benjamin Pinto

---

**Note:** This system is optimized for Brazilian market with PIX payment integration and Portuguese localization.

## 📚 Additional Documentation

- 🎯 [Ranking System](docs/RANKING_IMPLEMENTATION_PLAN.md) - Detailed ranking system documentation
- 📊 [Statistics Module](docs/STATISTICS_MODULE.md) - Statistics implementation details
- 👨‍💼 [User Manual (Portuguese)](docs/Manual%20do%20Usuário%20-%20Agenda%20LAPEN.md) - Complete user guide
- 📝 [System Overview (Portuguese)](docs/Agenda%20LAPEN%20-%20Sistema%20de%20Gerenciamento%20de%20Quadras%20de%20Tênis.md) - Detailed system documentation
