# Architecture

## Technology Stack

### Backend
- **Framework:** Flask 3.0.0 (Python 3.9+)
- **Database:** PostgreSQL 15 (SQLite removed)
- **WSGI Server:** Gunicorn (production)
- **Authentication:** JWT (PyJWT 2.8.0) for users + Session-based for admin
- **Password Hashing:** bcrypt 4.1.2 (12 rounds minimum)
- **Email:** Flask-Mail 0.9.1 (Gmail SMTP)
- **Payments:** Mercado Pago 2.2.1 (PIX), Stripe 7.9.0 (Cards)
- **API Documentation:** Flasgger 0.9.7.1 (OpenAPI 3.0.4)
- **CORS:** Flask-CORS

### Frontend
- **Framework:** React 18.3.1
- **Build Tool:** Vite 6.0.1
- **Styling:** Tailwind CSS 3.4.17
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Routing:** React Router 6.28.0
- **Charts:** Recharts 3.5.1
- **Notifications:** Sonner 1.4.3
- **HTTP Client:** Native Fetch API
- **Image Export:** html2canvas 1.4.1

### Testing
- **Unit Tests:** pytest with pytest-cov
- **E2E Tests:** Playwright 1.48.0
- **Test Reporting:** Allure 2.34.1
- **CI/CD:** GitHub Actions + Vercel

### Infrastructure
- **Hosting:** Vercel (serverless)
- **Database:** Vercel Postgres / External PostgreSQL
- **Container:** Docker + Docker Compose (local dev)
- **Reverse Proxy:** Nginx (production Docker)

## Project Structure

```
lapen-agenda/
├── .amazonq/rules/          # Amazon Q project rules
├── .github/workflows/       # CI/CD pipelines
├── api/                     # Vercel serverless functions
├── docs/                    # Documentation
│   ├── API_DOCUMENTATION.md
│   ├── ARCHITECTURE.md
│   ├── FEATURES.md
│   ├── SECURITY.md
│   ├── SETUP.md
│   ├── TESTING.md
│   ├── PLAYWRIGHT_SETUP.md
│   ├── ALLURE_REPORTING.md
│   └── QUICK_START_LAPEN.md
├── e2e/                     # Playwright E2E tests
├── public/                  # Static assets
├── src/
│   ├── components/          # React components
│   │   ├── admin/          # Admin panel components
│   │   ├── auth/           # Authentication UI
│   │   ├── betting/        # Betting system UI
│   │   ├── hooks/          # Custom React hooks
│   │   ├── ranking/        # Ranking system UI
│   │   ├── shared/         # Shared components
│   │   ├── statistics/     # Statistics dashboard
│   │   └── ui/             # shadcn/ui primitives
│   ├── contexts/           # React Context providers
│   ├── database/           # Database schemas & migrations
│   │   └── migrations/     # PostgreSQL migration files
│   ├── routes/             # Flask API blueprints
│   │   ├── admin.py        # Admin management
│   │   ├── admin_matches.py # Match administration
│   │   ├── auth.py         # User authentication
│   │   ├── betting.py      # Betting operations
│   │   ├── matches.py      # Match management
│   │   ├── payments.py     # Payment processing
│   │   ├── public.py       # Public endpoints
│   │   ├── ranking.py      # Ranking system
│   │   ├── statistics.py   # Statistics API
│   │   ├── test.py         # Test utilities
│   │   └── webhooks.py     # Payment webhooks
│   ├── services/           # Business logic services
│   │   ├── draw_engine.py  # Ranking draw algorithm
│   │   ├── points_calculator.py # Points calculation
│   │   ├── ranking_config.py # Ranking configuration
│   │   ├── temp_points_manager.py # Temporary points
│   │   └── wo_resolver.py  # W.O. resolution logic
│   ├── static/             # Generated static files
│   ├── utils/              # Utility functions
│   ├── auth.py             # Authentication logic
│   ├── database.py         # Database connection
│   ├── database_utils.py   # Database helpers
│   ├── email_service.py    # Email functionality
│   ├── logger.py           # Logging configuration
│   └── payment_gateway.py  # Payment processing
├── tests/                  # Unit tests
├── dist/                   # Production build output
├── main.py                 # Flask application entry
├── swagger.yaml            # OpenAPI specification
├── docker-compose.yml      # Development containers
├── docker-compose.prod.yml # Production containers
├── Dockerfile              # Container image
├── gunicorn.conf.py        # Gunicorn configuration
├── vercel.json             # Vercel deployment config
├── playwright.config.ts    # E2E test configuration
└── package.json            # Node dependencies

## Database Schema

### Core Tables
- **courts** - Tennis court information (id, name, type, description, active, image_url)
- **schedules** - Court bookings (id, court_id, date, start_time, player1_name, player2_name, match_type, deleted_at)
- **holidays_blocks** - Unavailable dates/times (id, date, start_time, end_time, description)
- **recurring_schedules** - Weekly recurring bookings (id, court_id, day_of_week, start_time, end_time, start_date, end_date)

### User & Authentication
- **users** - User accounts (id, email, password_hash, name, short_name, phone, pix_key, is_verified, is_lapen_member, lapen_approved, is_admin, created_at)

### Betting System
- **matches** - Match information (id, schedule_id, status, betting_enabled, total_pool, house_edge, created_at)
- **bets** - User bets (id, user_id, match_id, player_name, amount, potential_return, status, payment_id, created_at)
- **match_results** - Match outcomes (id, match_id, winner_name, score, finished_at, settled, total_winnings)
- **payment_logs** - Payment tracking (id, payment_id, event_type, status, amount, error_message, metadata, created_at)

### Statistics
- **match_statistics** - Match results (id, schedule_id, player1_name, player2_name, winner_name, sets, games, match_type, match_date, added_by)

### Ranking System
- **ranking_seasons** - Annual seasons (id, year, start_date, end_date, description, status)
- **ranking_season_config** - Season-specific configuration
- **ranking_temp_points_rules** - Initial ranking points
- **ranking_rounds** - Monthly rounds (id, season_id, round_number, month, year, draw_date, description, status, is_finals)
- **ranking_participants** - Season participants with stats
- **ranking_matches** - Ranking matches with results
- **ranking_draws** - Draw history for transparency
- **match_scheduling_logs** - W.O. evidence tracking

## API Architecture

### Authentication Layers
1. **Public Routes** (`/api/public/*`) - No authentication required
2. **User Routes** (`/api/auth/*`, `/api/betting/*`, `/api/matches/*`) - JWT token required
3. **Admin Routes** (`/api/admin/*`) - Session cookie required
4. **Webhook Routes** (`/api/webhooks/*`) - Signature verification

### API Blueprints
- **admin_bp** (`/api/admin`): Court, holiday, recurring schedule, user, LAPEN approval management
- **admin_matches_bp** (`/api/admin/matches`): Match finish, cancel, reports
- **auth_bp** (`/api/auth`): Register, login, profile, verify, password reset
- **betting_bp** (`/api/betting`): Payment intent, place bet, bet history
- **matches_bp** (`/api/matches`): List matches, create, toggle betting, status
- **payments_bp** (`/api/payments`): Webhook, payment status, history
- **public_bp** (`/api/public`): Courts, players, schedules, availability
- **ranking_bp** (`/api/ranking`): Seasons, rounds, participants, matches, draws
- **statistics_bp** (`/api/statistics`): Player stats, match history, leaderboards
- **webhooks_bp** (`/api/webhooks`): Mercado Pago payment notifications
- **test_bp** (`/api/test`): Test utilities (development only)

### Request Flow
```
Client Request
    ↓
CORS Middleware
    ↓
Route Handler
    ↓
Authentication Middleware (if required)
    ↓
Input Validation
    ↓
Business Logic
    ↓
Database Query (PostgreSQL)
    ↓
Response Formatting
    ↓
Client Response
```

## Payment Flow

### Betting Process
1. User selects match and player
2. Frontend calls `/api/betting/create-payment-intent`
3. Backend creates Mercado Pago payment (PIX or Card)
4. Returns payment ID and QR code (PIX) or client secret (Card)
5. User completes payment
6. Mercado Pago sends webhook to `/api/webhooks/mercadopago`
7. Backend verifies payment and activates bet
8. User receives confirmation email

### Settlement Process
1. Admin finishes match via `/api/admin/matches/{id}/finish`
2. Backend calculates winnings:
   - Total pool collected from all bets
   - Apply 20% house edge
   - Distribute 80% to winners proportionally
3. Update bet statuses (won/lost)
4. Send winner notification emails
5. Record settlement in match_results

### Refund Process
1. Admin cancels match via `/api/admin/matches/{id}/cancel`
2. Backend refunds all active bets
3. Update bet statuses to 'refunded'
4. Send refund notification emails

## Security Architecture

### Authentication
- **Users:** JWT tokens (7-day expiry, HTTP-only cookies)
- **Admin:** Session cookies (HTTP-only, Secure in production, SameSite=Lax)
- **Passwords:** bcrypt hashing (12 rounds minimum)

### Data Protection
- Environment-based secrets (SECRET_KEY, API keys)
- Input sanitization on all endpoints
- SQL parameterization (psycopg2 with %s placeholders)
- Path traversal prevention
- XSS protection via React escaping

### Network Security
- CORS restricted origins (localhost:5173, localhost:5001, production domain)
- Secure cookies in production (HTTPS)
- Rate limiting (recommended for production)
- Webhook signature verification

### Payment Security
- Device ID tracking (fraud prevention)
- External reference tracking
- Payment status verification
- Webhook signature validation
- PCI compliance via Stripe/Mercado Pago

## Deployment Architecture

### Development Environment
```
Frontend (Vite:5173) → Backend (Flask:5001) → PostgreSQL (Docker:5432)
                              ↓
                        Mercado Pago API
```

### Production Environment (Vercel)
```
User → Vercel Edge Network
         ↓
    Static Frontend (React SPA)
         ↓
    Serverless Functions (Flask API)
         ↓
    Vercel Postgres / External PostgreSQL
         ↓
    Mercado Pago API
```

### Production Environment (Docker/VPS)
```
User → Nginx (80/443)
         ↓
    Gunicorn (Flask:5001)
         ↓
    PostgreSQL (5432)
         ↓
    Mercado Pago API
```

## CI/CD Pipeline

### Workflow
```
Push to branch
    ↓
Unit Tests (pytest)
    ↓
Vercel Deployment
    ├─ main → Production
    └─ other → Preview
         ↓
    E2E Tests (Playwright)
         ↓
    Allure Report → GitHub Pages
         ↓
    Vercel Check Update
```

### GitHub Actions
- **test.yml**: Unit tests on every push/PR
- **e2e-tests.yml**: E2E tests on preview deployments
- **manual-e2e.yml**: Manual E2E testing
- **allure-report.yml**: Publish test reports to GitHub Pages

## Scalability Considerations

### Current Architecture
- Serverless functions (auto-scaling)
- PostgreSQL connection pooling
- Static asset CDN (Vercel Edge)
- No caching layer
- Synchronous processing

### Performance Optimizations
- Database indexes on frequently queried columns
- Lazy loading of React components
- Image optimization (Vite)
- Gzip compression (Nginx)
- Connection keepalive (PostgreSQL)

### Future Improvements
- Redis caching layer
- Message queue (Celery) for async tasks
- Rate limiting middleware
- Database read replicas
- CDN for static assets
- Horizontal scaling with load balancer
- WebSocket for real-time updates
