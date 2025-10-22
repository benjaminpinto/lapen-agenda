# LAPEN Agenda - Tennis Court Management System

## Payment Integration

**Current Gateway:** Mercado Pago (with PIX support)

✅ **Fully Optimized:** All 9 Mercado Pago quality recommendations implemented

### Features
- ✅ Device ID tracking for fraud prevention
- ✅ Complete item details (price, name, quantity, code, description, category)
- ✅ External reference for payment tracking
- ✅ Webhook notifications for real-time updates
- ✅ PIX payment support with QR code

### Documentation
- 📖 [Complete Implementation Guide](MERCADOPAGO_IMPROVEMENTS.md) (English)
- 📖 [Guia de Implementação](MELHORIAS_MERCADOPAGO.md) (Português)
- ✅ [Quick Checklist](MERCADOPAGO_CHECKLIST.md)
- 📋 [Implementation Summary](IMPLEMENTATION_SUMMARY.md)
- 🔄 [Payment Flow Diagram](PAYMENT_FLOW.md)
- 🚀 [Deployment Guide](DEPLOYMENT_GUIDE.md)

To switch payment gateways, change the `PAYMENT_GATEWAY` variable in `.env`:
- `mercadopago` - Mercado Pago with PIX (default, fully optimized)
- `stripe` - Stripe (PIX not available)

## Project Structure

```
lapen-agenda/
├── src/
│   ├── components/           # React components
│   │   ├── admin/           # Admin panel components
│   │   ├── ui/              # UI utility components
│   │   ├── Header.jsx
│   │   ├── Home.jsx
│   │   ├── ScheduleForm.jsx
│   │   └── ScheduleView.jsx
│   ├── database/            # Database related files
│   │   └── schema.sql
│   ├── routes/              # Flask API routes
│   │   ├── admin.py         # Admin API endpoints
│   │   └── public.py        # Public API endpoints
│   ├── static/              # Static files served by Flask
│   │   ├── images/          # Court images
│   │   └── index.html       # Production build output
│   ├── App.jsx              # Main React app component
│   ├── main.jsx             # React entry point
│   ├── database.py          # Database connection utilities
│   ├── index.css            # Global styles
│   └── App.css              # App-specific styles
├── main.py                  # Flask application entry point
├── package.json             # Node.js dependencies
├── requirements.txt         # Python dependencies
├── vite.config.js           # Vite configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── index.html               # Development HTML template
```

## Setup Instructions

### Backend (Flask)
1. Install Python dependencies: `pip install -r requirements.txt`
2. Run the Flask server: `python main.py`
3. Access API documentation: `http://localhost:5001/api/docs`

### Frontend (React + Vite)
1. Install Node.js dependencies: `npm install`
2. Start development server: `npm run dev`
3. Build for production: `npm run build`

## API Documentation

### Interactive API Documentation (Swagger)
🔗 **Access at:** `http://localhost:5001/api/docs`

The interactive Swagger UI provides:
- Complete API reference with all endpoints
- Request/response examples
- Try-it-out functionality to test endpoints
- Authentication support (JWT and Admin session)

### Detailed Documentation
📖 **Full API Reference:** [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

Includes:
- All 50+ endpoints with examples
- Authentication methods
- Data models and schemas
- Error handling
- Payment integration details

### Quick Reference

**Public Routes** (`/api/public`)
- Courts, schedules, players management
- Available time slots
- WhatsApp message generation

**Auth Routes** (`/api/auth`)
- User registration and login
- Email verification
- Password management

**Admin Routes** (`/api/admin`)
- Court and player management
- Holidays and recurring schedules
- Dashboard statistics

**Match Routes** (`/api/matches`, `/api/admin/matches`)
- Match creation and status updates
- Finish/cancel matches
- Match reports and statistics

**Betting Routes** (`/api/betting`)
- Create payment intents
- Place bets
- View betting history
- Match betting statistics

**Payment Routes** (`/api/payments`, `/api/webhooks`)
- Payment status checks
- Webhook handlers (Stripe, Mercado Pago)