# E2E Tests with Playwright

## Overview
Comprehensive end-to-end tests for LAPEN Agenda covering critical user flows and business logic.

## Test Coverage

### Authentication Tests (`auth.spec.ts`)
- User registration
- Login/logout
- Password reset
- LAPEN member registration with approval

### Betting System Tests (`betting.spec.ts`)
- View available matches
- Select match and player
- Validate bet amounts
- Payment methods (PIX and Card)
- View betting odds
- Navigate to bet history

### Admin Panel Tests (`admin.spec.ts`)
- Admin login
- Navigate to courts, matches, reports
- LAPEN member approvals
- Access control

### Schedule Tests (`schedule.spec.ts`)
- View schedules
- Weekly calendar navigation
- Filter by court
- Share schedules

### My Bets Tests (`my-bets.spec.ts`)
- View bet history
- Active vs finished bets
- Potential returns display

### Mobile Tests (`mobile.spec.ts`)
- Mobile viewport (320px minimum)
- Touch-friendly buttons (44px minimum)
- Responsive layouts
- Mobile betting flow

### Navigation Tests (`navigation.spec.ts`)
- Route navigation
- Header visibility
- Back navigation

## Running Tests

### Install Dependencies
```bash
npm install
npx playwright install
```

### Run All Tests
```bash
npm run test:e2e
```

### Run Tests with UI
```bash
npm run test:e2e:ui
```

### Run Tests in Headed Mode
```bash
npm run test:e2e:headed
```

### Debug Tests
```bash
npm run test:e2e:debug
```

### View Test Report
```bash
npm run test:e2e:report
```

### Run Specific Test File
```bash
npx playwright test e2e/tests/auth.spec.ts
```

### Run Tests on Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=mobile-chrome
```

## Test Configuration

### Browsers
- Desktop Chrome (chromium)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

### Base URL
- Development: `http://localhost:5173`
- Configured in `playwright.config.ts`

### Environment Variables
Tests use `.env.test` for configuration:
- `ADMIN_PASSWORD`: Admin panel password
- `PAYMENT_MOCK_ACTIVE`: Enable mock payments
- Other credentials for test environment

## Test Structure

```
e2e/
├── fixtures/          # Test data and fixtures
│   └── test-data.ts
├── helpers/           # Helper functions
│   ├── auth-helpers.ts
│   └── db-helpers.ts
└── tests/            # Test specifications
    ├── auth.spec.ts
    ├── betting.spec.ts
    ├── admin.spec.ts
    ├── schedule.spec.ts
    ├── my-bets.spec.ts
    ├── mobile.spec.ts
    └── navigation.spec.ts
```

## Best Practices

1. **Unique Test Data**: Use timestamps for unique emails to avoid conflicts
2. **Cleanup**: Tests should be independent and not rely on previous test state
3. **Assertions**: Use meaningful assertions with clear error messages
4. **Waits**: Use Playwright's auto-waiting, avoid hard waits
5. **Selectors**: Prefer user-facing selectors (text, labels) over CSS classes
6. **Mobile-First**: Test mobile viewports as per project rules

## CI/CD Integration

Tests run automatically on:
- Push to any branch
- Pull requests

See `.github/workflows/test.yml` for CI configuration.

## Troubleshooting

### Tests Failing Locally
1. Ensure backend is running: `python main.py`
2. Ensure frontend is running: `npm run dev`
3. Check database is initialized: `python setup_db.py`
4. Verify environment variables in `.env.test`

### Flaky Tests
- Check network conditions
- Increase timeout if needed
- Review test isolation

### Browser Issues
```bash
npx playwright install --with-deps
```

## Adding New Tests

1. Create test file in `e2e/tests/`
2. Import fixtures and helpers
3. Use `test.describe()` for grouping
4. Add `test.beforeEach()` for setup
5. Write clear test descriptions
6. Follow existing patterns

## Project Rules Compliance

- ✅ Mobile-first: Tests include mobile viewport validation
- ✅ Touch targets: Validates 44px minimum button size
- ✅ Portuguese UI: Tests check for Portuguese text
- ✅ Critical paths: Authentication, payments, bookings covered
- ✅ Both databases: Tests work with SQLite (local) and PostgreSQL (production)
