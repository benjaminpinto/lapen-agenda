# Setup Guide

## Prerequisites

- Python 3.9+
- Node.js 16+
- PostgreSQL 15+ (or Docker for local development)
- Git

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd lapen-agenda
```

### 2. Backend Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
# Install Node dependencies
npm install
```

### 4. Database Setup

**Option A: Docker (Recommended)**
```bash
# Start PostgreSQL container
docker-compose up -d postgres

# Database will be available at:
# Host: localhost:5432
# Database: lapen_agenda
# User: lapen_user
# Password: lapen_password
```

**Option B: Local PostgreSQL**
```bash
# Install PostgreSQL 15+
# Create database and user
psql -U postgres
CREATE DATABASE lapen_agenda;
CREATE USER lapen_user WITH PASSWORD 'lapen_password';
GRANT ALL PRIVILEGES ON DATABASE lapen_agenda TO lapen_user;
\q
```

### 5. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

**Required Variables:**
- `DATABASE_URL` - PostgreSQL connection string (e.g., postgresql://lapen_user:lapen_password@localhost:5432/lapen_agenda)
- `ADMIN_PASSWORD` - Admin panel password
- `SECRET_KEY` - Flask secret key (min 32 chars)
- `MAIL_USERNAME` - Gmail address
- `MAIL_PASSWORD` - Gmail app password
- `MERCADOPAGO_ACCESS_TOKEN` - Mercado Pago credentials
- `MERCADOPAGO_PUBLIC_KEY` - Mercado Pago public key

**Optional Variables:**
- `FRONTEND_URL` - Frontend URL for email links (production only, e.g., https://lapen-agenda.vercel.app)
- `STRIPE_SECRET_KEY` - Stripe API key (for card payments)
- `STRIPE_PUBLISHABLE_KEY` - Stripe public key
- `FLASK_ENV` - development/production

### 6. Database Initialization

The database is automatically initialized on first run. Migrations are applied automatically.

### 7. Run the Application

**Development Mode:**

```bash
# Terminal 1 - Backend
python main.py

# Terminal 2 - Frontend
npm run dev
```

**Production Mode:**

```bash
# Build frontend
npm run build

# Run backend (serves built frontend)
FLASK_ENV=production python main.py
```

## Access Points

- **Frontend:** http://localhost:5173 (dev) or http://localhost:5001 (prod)
- **API Docs:** http://localhost:5001/api/docs
- **Admin Panel:** http://localhost:5173/admin

## Default Credentials

- **Admin Password:** Set in `.env` file (`ADMIN_PASSWORD`)

## Docker Setup (Alternative)

For a complete Docker setup with all services:

```bash
# Start all services (PostgreSQL + Backend)
docker-compose up -d

# Access application at http://localhost:5001
# PostgreSQL at localhost:5432

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Reset database
docker-compose down -v
docker-compose up -d
```

See [README.docker.md](../README.docker.md) for detailed Docker documentation.

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 5001
lsof -ti:5001 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Kill process on port 5432 (PostgreSQL)
lsof -ti:5432 | xargs kill -9
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
psql -U lapen_user -d lapen_agenda -h localhost

# Or with Docker
docker exec -it lapen-postgres psql -U lapen_user -d lapen_agenda

# Reset database
docker-compose down -v
docker-compose up -d
```

### Database Migration Issues

```bash
# Migrations are applied automatically on startup
# If issues occur, check logs:
python main.py

# Or with Docker:
docker-compose logs backend
```

### Email Not Sending

1. Enable 2FA on Gmail
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use App Password in `MAIL_PASSWORD`
