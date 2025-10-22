# Setup Guide

## Prerequisites

- Python 3.9+
- Node.js 16+
- SQLite (included with Python)

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

### 4. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

**Required Variables:**
- `ADMIN_PASSWORD` - Admin panel password
- `SECRET_KEY` - Flask secret key (min 32 chars)
- `MAIL_USERNAME` - Gmail address
- `MAIL_PASSWORD` - Gmail app password
- `MERCADOPAGO_ACCESS_TOKEN` - Mercado Pago credentials
- `MERCADOPAGO_PUBLIC_KEY` - Mercado Pago public key

### 5. Database Initialization

The database is automatically initialized on first run.

### 6. Run the Application

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

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 5001
lsof -ti:5001 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Database Issues

```bash
# Delete and recreate database
rm lapen_agenda.db
python main.py
```

### Email Not Sending

1. Enable 2FA on Gmail
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use App Password in `MAIL_PASSWORD`
