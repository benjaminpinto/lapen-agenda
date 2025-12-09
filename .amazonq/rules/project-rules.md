# LAPEN Agenda - Project Rules

## Database Rules
- **PostgreSQL ONLY** - SQLite support has been removed
- Use PostgreSQL-specific features when beneficial (RETURNING, array types, JSON, etc.)
- Use `%s` placeholders for query parameters (not `?`)
- DATABASE_URL environment variable is required
- Local development uses Docker PostgreSQL (see docker-compose.yml)
- Migrations are in `src/database/migrations/*_postgres.sql`

## Frontend Rules
- Mobile-first approach: design and implement for mobile screens first, then scale up
- All UI components MUST be fully responsive and mobile-compatible
- Test on mobile viewports (320px minimum width)
- Touch-friendly UI: minimum 44px touch targets, adequate spacing
- Optimize images and assets for mobile bandwidth
- Use Tailwind responsive utilities (sm:, md:, lg:, xl:)
- Add data-testid attributes to all interactive elements and key UI components for E2E testing

## UI/UX Rules
- Portuguese language for all user-facing text
- Follow existing shadcn/ui component patterns
- Maintain consistent spacing and color scheme
- Ensure accessibility (WCAG 2.1 AA minimum)
- Loading states for all async operations
- Clear error messages in Portuguese
- NEVER use browser alert(), confirm(), or prompt() - always use shadcn/ui Dialog components

## Color Palette (Clay Court Theme)
- Primary colors inspired by clay tennis courts
- Brown 600: #92400e - Primary emphasis
- Brown 500: #a16207 - Secondary emphasis
- Brown 400: #ca8a04 - Tertiary emphasis
- Orange 600: #ea580c - Accents, highlights
- Amber 500: #f59e0b - Interactive elements
- Amber 400: #fbbf24 - Subtle highlights
- Use these colors consistently across statistics, charts, and UI elements
- Avoid bright blues, purples, or greens that clash with the clay court theme

## Backend Rules
- Follow Flask best practices and existing route patterns
- JWT authentication required for protected endpoints
- Input validation on all endpoints
- Proper HTTP status codes
- Error handling with descriptive messages
- API documentation in Swagger format
- Whenever creating or updating routes, update API swagger related document files 

## Payment Integration Rules
- PIX payments use Mercado Pago
- Card payments use Stripe
- Include device ID for fraud prevention
- Complete item details in payment requests
- External reference tracking for all transactions
- Webhook handling for payment status updates

## Security Rules
- Never commit credentials or secrets
- Use environment variables for sensitive data
- Bcrypt for password hashing (12 rounds minimum)
- Sanitize all user inputs
- CORS configuration for production domains only
- JWT tokens expire in 7 days maximum

## Code Quality Rules
- Minimal, focused implementations - avoid verbose code
- DRY principle: reuse existing components and utilities
- Clear variable and function names in English
- Comments only for complex business logic
- Remove unused imports and dead code

## Testing Rules
- Test critical paths: authentication, payments, bookings
- Verify mobile responsiveness before PR
- Use Docker PostgreSQL for local testing
- Validate PIX payment flow in sandbox environment

## Git Rules
- Descriptive commit messages in English
- Feature branches from main
- No direct commits to main
- Keep commits focused and atomic

## Debugging
- When fixing UI issues, always use Playwright MCP to reproduce the issue and investigate instead of trying to guess stuff
