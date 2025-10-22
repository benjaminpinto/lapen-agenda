# Architecture

## Technology Stack

### Backend
- **Framework:** Flask 3.0.0
- **Database:** SQLite
- **Authentication:** JWT (PyJWT 2.8.0) + Session-based
- **Password Hashing:** bcrypt 4.1.2
- **Email:** Flask-Mail 0.9.1
- **Payments:** Stripe 7.9.0, Mercado Pago 2.2.1
- **API Documentation:** Flasgger 0.9.7.1

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Routing:** React Router
- **HTTP Client:** Fetch API
- **Date Handling:** date-fns

## Project Structure

```
lapen-agenda/
├── docs/                       # Documentation
│   ├── API_DOCUMENTATION.md
│   ├── ARCHITECTURE.md
│   ├── FEATURES.md
│   ├── SECURITY.md
│   └── SETUP.md
├── src/
│   ├── components/            # React components
│   │   ├── admin/            # Admin panel
│   │   ├── betting/          # Betting system
│   │   ├── shared/           # Shared components
│   │   └── ui/               # UI primitives
│   ├── contexts/             # React contexts
│   ├── database/             # Database schema
│   ├── routes/               # Flask API routes
│   │   ├── admin.py
│   │   ├── admin_matches.py
│   │   ├── auth.py
│   │   ├── betting.py
│   │   ├── matches.py
│   │   ├── payments.py
│   │   ├── public.py
│   │   └── webhooks.py
│   ├── static/               # Static files
│   ├── utils/                # Utility functions
│   ├── auth.py               # Authentication logic
│   ├── database.py           # Database connection
│   ├── email_service.py      # Email functionality
│   ├── logger.py             # Logging configuration
│   └── payment_gateway.py    # Payment processing
├── main.py                   # Flask application entry
├── swagger.yaml              # OpenAPI specification
├── .env.example              # Environment template
└── requirements.txt          # Python dependencies

## Database Schema

### Core Tables
- **courts** - Tennis court information
- **players** - Player registry
- **schedules** - Court bookings
- **holidays_blocks** - Unavailable dates/times
- **recurring_schedules** - Recurring bookings

### Betting Tables
- **users** - User accounts
- **matches** - Match information
- **bets** - User bets
- **match_results** - Match outcomes
- **payment_logs** - Payment tracking

## API Architecture

### Authentication Layers
1. **Public Routes** (`/api/public`) - No authentication
2. **User Routes** (`/api/auth`, `/api/betting`) - JWT required
3. **Admin Routes** (`/api/admin`) - Session required

### Request Flow
```
Client → CORS → Route → Auth Middleware → Handler → Database → Response
```

## Payment Flow

### Betting Process
1. User selects match and player
2. Create payment intent (Mercado Pago)
3. Generate PIX QR code
4. User scans and pays
5. Webhook confirms payment
6. Bet is activated
7. Match finishes
8. Bets are settled automatically

### Settlement Logic
- Total pool collected
- 20% house edge applied
- Remaining 80% distributed to winners
- Proportional to bet amounts

## Security Architecture

### Authentication
- **Users:** JWT tokens (7-day expiry)
- **Admin:** Session cookies (HTTP-only)

### Data Protection
- Passwords hashed with bcrypt
- Environment-based secrets
- Input sanitization
- SQL parameterization

### Network Security
- CORS restricted origins
- Secure cookies in production
- HTTPS recommended

## Deployment Architecture

### Development
```
Frontend (Vite:5173) → Backend (Flask:5001) → SQLite
```

### Production
```
Frontend (Static) ← Backend (Flask:5001) → SQLite
                  ↓
            Mercado Pago API
```

## Scalability Considerations

### Current Limitations
- SQLite (single-file database)
- No caching layer
- No load balancing
- Synchronous processing

### Future Improvements
- Migrate to PostgreSQL
- Add Redis caching
- Implement message queue (Celery)
- Add rate limiting
- Horizontal scaling with load balancer
