# LAPEN Agenda - Tennis Court Management System

> Sistema completo de gerenciamento de quadras de tênis com sistema de apostas integrado

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/Flask-3.0.0-green.svg)](https://flask.palletsprojects.com/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🎾 Overview

LAPEN Agenda is a comprehensive tennis court management system featuring:
- Court scheduling and availability management
- Match betting system with PIX payments
- User authentication and admin panel
- Real-time notifications and WhatsApp integration
- Complete API with Swagger documentation

## ✨ Key Features

- 🏟️ **Court Management** - Multiple courts with images and availability tracking
- 📅 **Smart Scheduling** - Weekly/monthly views with conflict prevention
- 🎲 **Betting System** - Real-time odds, PIX payments, automatic settlement
- 💳 **Payment Integration** - Mercado Pago with PIX support (fully optimized)
- 👥 **User System** - Registration, authentication, betting history
- 🔐 **Admin Panel** - Complete management dashboard
- 📱 **WhatsApp Integration** - Schedule sharing
- 📊 **API Documentation** - Interactive Swagger UI
- 🌐 **Portuguese UI** - Fully localized interface

[See complete feature list →](docs/FEATURES.md)

## 🚀 Quick Start

```bash
# Clone repository
git clone <repository-url>
cd lapen-agenda

# Setup backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Setup frontend
npm install

# Configure environment
cp .env.example .env
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
- 📊 **Interactive API Docs:** http://localhost:5001/api/docs

## 🛠️ Technology Stack

**Backend:**
- Flask 3.0.0
- SQLite
- JWT Authentication
- Mercado Pago SDK

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- shadcn/ui

[See full architecture →](docs/ARCHITECTURE.md)

## 💳 Payment Integration

**Gateway:** Mercado Pago with PIX support

✅ **Fully Optimized** - All 9 Mercado Pago quality recommendations implemented:
- Device ID tracking for fraud prevention
- Complete item details
- External reference tracking
- Webhook notifications
- PIX QR code generation

## 🔐 Security

- Environment-based configuration
- JWT authentication (7-day expiry)
- Bcrypt password hashing
- Secure session cookies
- Input sanitization
- CORS protection

[Security configuration →](docs/SECURITY.md)

## 📝 Environment Variables

Required variables in `.env`:

```bash
ADMIN_PASSWORD=your-admin-password
SECRET_KEY=your-secret-key-min-32-chars
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MERCADOPAGO_ACCESS_TOKEN=your-token
MERCADOPAGO_PUBLIC_KEY=your-key
```

See [.env.example](.env.example) for complete list.

## 🌐 Access Points

- **Frontend:** http://localhost:5173 (dev) / http://localhost:5001 (prod)
- **API Docs:** http://localhost:5001/api/docs
- **Admin Panel:** http://localhost:5173/admin

## 📦 Production Build

```bash
# Build frontend
npm run build

# Run production server
FLASK_ENV=production python main.py
```

## 🤝 Contributing

Contributions are welcome! Please read the documentation before submitting PRs.

## 📄 License

MIT License - see LICENSE file for details.

## 👥 Authors

Benjamin Pinto

---

**Note:** This system is optimized for Brazilian market with PIX payment integration and Portuguese localization.
