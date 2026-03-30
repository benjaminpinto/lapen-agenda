# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LAPEN Agenda is a full-stack tennis court management system for the Brazilian market. It includes court scheduling, a betting platform (PIX + card payments), a ranking system with automated draws, player challenges, statistics, and an admin dashboard. All user-facing text is in Portuguese.

## Tech Stack

**Backend:** Flask 3.0.0 (Python 3.9+), PostgreSQL 15, Gunicorn, JWT (users) + session cookies (admin), bcrypt (12 rounds), Mercado Pago (PIX), Stripe (cards), Flask-Mail (Gmail), Flasgger (OpenAPI 3.0.4)

**Frontend:** React 18.3.1, Vite 6.0.1, Tailwind CSS 3.4.17, shadcn/ui (Radix UI), Recharts 3.5.1, React Router 6.28.0, Sonner (toasts), html2canvas

**Testing:** pytest + pytest-cov (unit), Playwright 1.48.0 (E2E), Allure 2.34.1 (reports), GitHub Actions (CI/CD)

## Development Commands

```bash
# Backend
python main.py                    # Flask dev server (port 5001)

# Frontend
npm run dev                       # Vite dev server (port 5173)
npm run build                     # Production build → dist/

# Docker (recommended for local dev)
docker-compose up -d              # Start all services (app + postgres)

# Unit tests (requires PostgreSQL)
export DATABASE_URL="postgresql://lapen_user:lapen_password@localhost:5432/lapen_agenda"
pytest tests/                     # All tests
pytest tests/test_wo_result.py -v # Single file
pytest tests/ --cov=src           # With coverage

# E2E tests
npm run test:e2e                  # Headless (runs cleanup first)
npm run test:e2e:ui               # With UI
npm run test:e2e:headed           # Headed browser
npm run test:e2e:debug            # Debug mode
npm run allure:serve              # Generate + view Allure report

# Database queries (always use docker exec, never psql on host)
docker exec lapen-postgres psql -U lapen_user -d lapen_agenda -c "YOUR_QUERY"
```

## Architecture

### Request Flow

```
Client → CORS → Route Handler → Auth Middleware → Input Validation → Business Logic → PostgreSQL → Response
```

### API Blueprints

| Blueprint | Prefix | Auth |
|-----------|--------|------|
| `public_bp` | `/api/public` | None |
| `auth_bp` | `/api/auth` | None / JWT |
| `matches_bp` | `/api/matches` | JWT |
| `betting_bp` | `/api/betting` | JWT |
| `payments_bp` | `/api/payments` | JWT |
| `ranking_bp` | `/api/ranking` | JWT / Admin |
| `statistics_bp` | `/api/statistics` | JWT |
| `challenges_bp` | `/api/challenges` | JWT |
| `admin_bp` | `/api/admin` | Session cookie |
| `admin_matches_bp` | `/api/admin/matches` | Session cookie |
| `webhooks_bp` | `/api/webhooks` | Signature verification |
| `test_bp` | `/api/test` | Dev only |

### Authentication Layers

- **Users**: JWT tokens (7-day expiry, HTTP-only cookies) — `src/auth.py`
- **Admin**: Session cookies (HTTP-only, Secure in prod, SameSite=Lax)
- **Webhooks**: Signature verification (Mercado Pago / Stripe)

### Key Business Logic (src/services/)

- `draw_engine.py` — Ranking draw algorithm (avoids recent opponents, splits Elite/Challenger/NextGen)
- `points_calculator.py` — Configurable scoring with set/game bonuses
- `ranking_config.py` — Season-specific configuration management
- `temp_points_manager.py` — Season-start positioning with automatic expiration
- `wo_resolver.py` — W.O. resolution with evidence tracking

### Payment Flow

1. `POST /api/betting/create-payment-intent` → creates Mercado Pago (PIX) or Stripe (card) payment
2. User pays → Mercado Pago/Stripe sends webhook to `/api/webhooks/mercadopago` or `/api/webhooks/stripe`
3. Backend verifies signature → creates bet (status=active) → updates pool → sends confirmation email
4. Admin finishes match → 80% of pool distributed to winners (20% house edge) → emails sent

## Database Rules

- **PostgreSQL ONLY** — SQLite support was removed. Use `%s` placeholders (not `?`).
- **Always query via docker exec**: `docker exec lapen-postgres psql -U lapen_user -d lapen_agenda -c "..."`
- The `unaccent` extension is active for accent-insensitive text comparisons.

### Database Migrations

All schema changes go through `src/database/migrations/` (numbered `001_…`, `002_…`, etc.). Every migration must be **idempotent** (`IF NOT EXISTS`, `IF EXISTS`).

When creating a migration, you must also update:
1. `src/database/postgres_schema.sql` — keep the master schema in sync
2. `.amazonq/rules/architecture.md` — update the Database Architecture section

### Core Tables of Note

- `schedules` — Court bookings (soft-deleted via `deleted_at`)
- `matches` / `bets` / `match_results` / `payment_logs` — Betting system
- `ranking_seasons` / `ranking_rounds` / `ranking_participants` / `ranking_matches` — Ranking system (groups: Elite, Challenger, NextGen)
- `challenges` — Player-to-player challenges (target types: victories, balance, sets)
- `match_statistics` — Results for statistics module

## Frontend Rules

- **Mobile-first**: minimum 320px width, 44px touch targets. Use Tailwind responsive utilities (`sm:`, `md:`, etc.).
- **No browser dialogs**: never use `alert()`, `confirm()`, or `prompt()` — use shadcn/ui Dialog components.
- **data-testid** attributes are required on all interactive elements and key UI components (for Playwright).
- **Color palette** (clay court theme): Brown 600 `#92400e` (primary), Orange 600 `#ea580c` (accents), Amber 500 `#f59e0b` (interactive). Avoid blue/purple/green.

## Code Rules

- Prefer extending existing methods with optional parameters over creating new ones. Consolidate duplicate logic.
- When fixing UI issues, use Playwright MCP to reproduce and investigate before guessing.
- Update `swagger.yaml` whenever creating or modifying routes.
- Bcrypt minimum 12 rounds. JWT max 7-day expiry.
- PostgreSQL queries use `%s` parameter binding via psycopg2.

## Environment Variables

**Required:**
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/lapen_agenda
SECRET_KEY=<min 32 chars>
ADMIN_PASSWORD=<admin panel password>
MAIL_USERNAME=<gmail address>
MAIL_PASSWORD=<gmail app password>
MERCADOPAGO_ACCESS_TOKEN=<token>
MERCADOPAGO_PUBLIC_KEY=<key>
```

**Optional:**
```bash
FRONTEND_URL=https://your-domain.com
STRIPE_SECRET_KEY=...
STRIPE_PUBLISHABLE_KEY=...
STRIPE_WEBHOOK_SECRET=...
FLASK_ENV=development
```

## Deployment

- **Dev**: Vite (5173) + Flask (5001) + Docker PostgreSQL (5432)
- **Production (Vercel)**: serverless Flask + Vercel Postgres + static React SPA
- **Production (VPS)**: Nginx → Gunicorn (5001) → PostgreSQL (5432)
- CI/CD: push → unit tests → Vercel deploy → E2E tests (preview only) → Allure report → Vercel check update
