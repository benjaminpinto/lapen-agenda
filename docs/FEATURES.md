# Features

## Court Management
- ✅ Multiple court types (Saibro, Sintético, etc.)
- ✅ Court availability tracking
- ✅ Court images and descriptions
- ✅ Active/inactive status

## Scheduling System
- ✅ 90-minute time slots (07:30 - 22:30)
- ✅ Weekly and monthly calendar views
- ✅ Real-time availability checking
- ✅ Player autocomplete
- ✅ Match types: Liga, Amistoso, Aula, Torneio
- ✅ Schedule editing and deletion
- ✅ Conflict prevention

## Recurring Schedules
- ✅ Weekly recurring bookings
- ✅ Date range configuration
- ✅ Multiple time slots per day
- ✅ Court-specific recurring schedules

## Holidays & Blocks
- ✅ Full-day blocks
- ✅ Partial-day blocks (time ranges)
- ✅ Custom descriptions
- ✅ Automatic conflict prevention

## Player Management
- ✅ Player database
- ✅ Autocomplete suggestions
- ✅ Usage statistics
- ✅ Top players tracking

## Match & Betting System
- ✅ Match creation from schedules
- ✅ Real-time betting odds
- ✅ PIX payment integration (Mercado Pago)
- ✅ Automatic bet settlement
- ✅ 20% house edge
- ✅ Betting history
- ✅ Match status tracking (upcoming, live, finished, cancelled)
- ✅ Refund system for cancelled matches

## User Authentication
- ✅ User registration with email verification
- ✅ JWT-based authentication (7-day expiry)
- ✅ Password management (change, reset)
- ✅ Secure password hashing (bcrypt, 12 rounds)
- ✅ LAPEN member system (request/approval)
- ✅ Profile management (name, phone, PIX key, short name)
- ✅ Admin role management
- ✅ Verification tokens
- ✅ Password reset tokens with expiry

## Admin Panel
- ✅ Session-based authentication
- ✅ Court CRUD operations
- ✅ Holiday/block management
- ✅ Recurring schedule management
- ✅ Match management (finish/cancel)
- ✅ User management (CRUD, password reset)
- ✅ LAPEN member approval workflow
- ✅ Dashboard statistics
- ✅ Betting reports
- ✅ Ranking season management
- ✅ Match result reporting
- ✅ W.O. resolution
- ✅ Draw execution

## Payment Integration
- ✅ Mercado Pago with PIX support (fully optimized)
- ✅ Stripe for card payments
- ✅ QR code generation (PIX)
- ✅ Real-time payment status
- ✅ Webhook notifications
- ✅ Device ID tracking (fraud prevention)
- ✅ External reference tracking
- ✅ Complete item details
- ✅ Automatic refunds
- ✅ Payment logs for audit trail
- ✅ 9/9 Mercado Pago quality recommendations implemented

## Communication
- ✅ WhatsApp message generation
- ✅ Monthly schedule sharing
- ✅ Email notifications (HTML templates)
- ✅ Registration verification emails
- ✅ Bet confirmation emails
- ✅ Winner notification emails
- ✅ Refund notification emails
- ✅ Password reset emails
- ✅ LAPEN approval notifications

## API & Documentation
- ✅ RESTful API
- ✅ Interactive Swagger documentation (OpenAPI 3.0.4)
- ✅ 60+ endpoints
- ✅ JWT and session authentication
- ✅ Comprehensive error handling
- ✅ 11 API blueprints (admin, auth, betting, matches, payments, public, ranking, statistics, webhooks, test)
- ✅ Request/response validation
- ✅ Detailed error messages in Portuguese

## Security
- ✅ Environment-based configuration
- ✅ Secure session cookies (HTTP-only, SameSite=Lax)
- ✅ CORS protection (restricted origins)
- ✅ Input sanitization
- ✅ SQL injection prevention (parameterized queries)
- ✅ Path traversal protection
- ✅ JWT token expiry (7 days)
- ✅ Webhook signature verification
- ✅ Device ID tracking (fraud prevention)
- ✅ Password reset tokens with expiry

## Ranking System
- ✅ Annual seasons with monthly rounds
- ✅ Elite and Challenger groups (50/50 split)
- ✅ Automated draw engine (avoids recent opponents)
- ✅ Points calculation (win/loss/W.O.)
- ✅ Temporary points for season start
- ✅ W.O. resolution with evidence tracking
- ✅ Finals qualification system
- ✅ Season configuration management
- ✅ Draw history and transparency
- ✅ Match scheduling logs

## Statistics Module
- ✅ Player performance tracking
- ✅ Head-to-head records
- ✅ Win/loss ratios
- ✅ Set/game statistics
- ✅ Match history by player
- ✅ Match type filtering (Liga, Amistoso, Aula, Torneio)
- ✅ Leaderboards (wins, games, sets)
- ✅ Recent matches display
- ✅ Performance trends
- ✅ Clay court themed charts

## Tournaments
- ✅ One active tournament at a time, several categories, a person may enter more than one
- ✅ Public sign-up page (honeypot, hourly limit, waiting list when a category is full)
- ✅ Admin panel: rules, categories, registrations (confirm, refuse, link to a LAPEN member), draw preview and publication
- ✅ Draw: groups + knockout, knockout only or round robin; manual seeds (ITF placement), byes, groups by snake
- ✅ Results by the admin only (normal, W.O., retirement), with correction, annulment and automatic propagation
- ✅ Group tables in ATP order, explained to the public; ties no criterion can break are decided by the organizer
- ✅ Public tracking screen: progress, groups with who advances, visual bracket, upcoming games, results, entries, rules
- ✅ Match calendar: sessions cut into 90-minute windows, day grid by court, swap/move by tap or drag, pin, block a window
- ✅ Automatic distribution of pending matches by phase (proposal first, apply after; rest of 60 minutes, order of rounds, no double booking)
- ✅ Player impediments (days and times) respected by the distribution and warned about in manual edits
- ✅ Schedule hidden from the public until published
- ✅ Results feed the statistics module when a LAPEN member plays ("Torneio" type; friendlies do not include them)
- ✅ Admin panel made for tablet and desktop; public screens made for phones

## UI/UX
- ✅ Responsive design (mobile-first, 320px minimum)
- ✅ Portuguese localization
- ✅ Toast notifications (Sonner)
- ✅ Loading states
- ✅ Error handling
- ✅ Intuitive navigation
- ✅ Clay court color theme (browns, oranges, ambers)
- ✅ Touch-friendly (44px minimum touch targets)
- ✅ shadcn/ui Dialog components (no browser alerts)
- ✅ Accessibility compliant (WCAG 2.1 AA)
