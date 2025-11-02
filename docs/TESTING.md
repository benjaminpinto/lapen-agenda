# Testing Guide - LAPEN Agenda

## Overview

LAPEN Agenda uses a comprehensive testing strategy with both unit tests (pytest) and end-to-end tests (Playwright).

## Test Types

### 1. Unit Tests (Python/pytest)
Located in `tests/` directory, covering backend logic:
- Authentication
- Betting scenarios
- Match utilities
- Odds calculator
- Payment gateway

**Run unit tests:**
```bash
pytest tests/ --cov=src --cov-report=term-missing
```

### 2. E2E Tests (Playwright)
Located in `e2e/` directory, covering full user flows:
- User registration and authentication
- Betting system (critical)
- Admin panel
- Schedule management
- Mobile responsiveness
- Navigation

**Run E2E tests:**
```bash
npm run test:e2e
```

## E2E Test Coverage

### Critical Flows (Per Project Rules)

#### Authentication
- ✅ User registration
- ✅ Email verification
- ✅ Login/logout
- ✅ Password reset
- ✅ LAPEN member approval workflow

#### Betting System (Critical)
- ✅ View available matches
- ✅ Place bet with PIX payment
- ✅ Place bet with card payment
- ✅ View betting odds
- ✅ View user bet history
- ✅ Match status updates
- ✅ Payment integration (Mercado Pago PIX)

#### Schedule Management
- ✅ View schedules (weekly/monthly)
- ✅ Create court schedule
- ✅ Edit/delete schedules
- ✅ Conflict prevention
- ✅ WhatsApp sharing

#### Admin Panel
- ✅ Court management
- ✅ Match management
- ✅ User management
- ✅ LAPEN approvals
- ✅ Match result reporting

#### Mobile Responsiveness (Critical)
- ✅ 320px minimum viewport
- ✅ 44px minimum touch targets
- ✅ Responsive layouts
- ✅ Mobile betting flow

## Test Environment Setup

### Prerequisites
```bash
# Install Python dependencies
pip install -r requirements.txt
pip install pytest pytest-cov

# Install Node dependencies
npm install

# Install Playwright browsers
npx playwright install --with-deps
```

### Environment Configuration
Create `.env.test` with test credentials:
```bash
ADMIN_PASSWORD=test_admin_password
SECRET_KEY=test_secret_key_min_32_characters_long
PAYMENT_MOCK_ACTIVE=true
VITE_PAYMENT_MOCK_ACTIVE=true
```

### Database Setup
```bash
python setup_db.py
```

## Running Tests

### All Tests
```bash
# Unit tests
pytest tests/

# E2E tests
npm run test:e2e
```

### Specific Test Suites
```bash
# Authentication tests
npx playwright test e2e/tests/auth.spec.ts

# Betting tests
npx playwright test e2e/tests/betting.spec.ts

# Mobile tests
npx playwright test e2e/tests/mobile.spec.ts --project=mobile-chrome
```

### Debug Mode
```bash
# Playwright UI mode
npm run test:e2e:ui

# Debug specific test
npm run test:e2e:debug

# Headed mode (see browser)
npm run test:e2e:headed
```

### Test Reports
```bash
# View Playwright HTML report
npm run test:e2e:report

# Unit test coverage
pytest tests/ --cov=src --cov-report=html
open htmlcov/index.html
```

## CI/CD Integration

### Automated Pipeline

**1. Unit Tests** (`.github/workflows/test.yml`)
- Trigger: Every push and PR (all branches)
- Runs: Python unit tests with pytest
- Coverage: Backend logic and utilities
- Blocks: Deployment if tests fail

**2. Vercel Deployment**
- **Main branch** → Production environment
- **Other branches** → Preview environments
- Automatic deployment after unit tests pass

**3. E2E Tests** (`.github/workflows/e2e-tests.yml`)
- Trigger: After successful Vercel preview deployment
- Event: `repository_dispatch` from Vercel
- Condition: Only runs for preview environments (non-main branches)
- Browsers: Chromium, Mobile Chrome, Mobile Safari
- Target: Preview deployment URL
- Reports: Results sent back to Vercel

**Pipeline Flow:**
```
Push to branch → Unit Tests → Vercel Deploy (preview) → E2E Tests → Vercel Check
```

**Manual E2E Testing** (`.github/workflows/manual-e2e.yml`)
- Trigger: Manual workflow dispatch
- Use: Test specific deployment URLs
- Access: GitHub Actions tab → Manual E2E Tests

### Configuration

**Required GitHub Secrets:**
- `ADMIN_PASSWORD`: Admin password for E2E tests

**Vercel Settings:**
- Repository Dispatch: Enabled
- Deployment Checks: Configured for E2E tests

See workflow files in `.github/workflows/` for detailed configuration.

## Writing New Tests

### Unit Tests (pytest)
```python
# tests/test_feature.py
def test_feature():
    result = my_function()
    assert result == expected_value
```

### E2E Tests (Playwright)
```typescript
// e2e/tests/feature.spec.ts
import { test, expect } from '@playwright/test';

test('should do something', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=Expected')).toBeVisible();
});
```

## Best Practices

### General
1. **Test Independence**: Each test should be independent
2. **Clear Names**: Use descriptive test names
3. **Minimal Setup**: Only setup what's needed
4. **Clean Data**: Use unique identifiers (timestamps)

### E2E Specific
1. **User-Facing Selectors**: Prefer text/labels over CSS classes
2. **Auto-Waiting**: Use Playwright's built-in waiting
3. **Mobile-First**: Test mobile viewports per project rules
4. **Real Flows**: Test complete user journeys

### Project Rules Compliance
- ✅ Test on both SQLite and PostgreSQL
- ✅ Verify mobile responsiveness (320px min)
- ✅ Check touch targets (44px min)
- ✅ Validate Portuguese UI text
- ✅ Test critical paths: auth, payments, bookings

## Troubleshooting

### Common Issues

**Tests fail locally:**
```bash
# Ensure services are running
python main.py &
npm run dev &

# Reset database
python setup_db.py
```

**Browser not found:**
```bash
npx playwright install --with-deps
```

**Flaky tests:**
- Check network conditions
- Review test isolation
- Increase timeouts if needed

**Port conflicts:**
```bash
# Kill processes on ports 5001 and 5173
lsof -ti:5001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

## Test Metrics

### Coverage Goals
- **Unit Tests**: 80%+ code coverage
- **E2E Tests**: 100% critical path coverage

### Critical Paths
1. User registration → Login → Place bet → View bet history
2. Admin login → Create match → Manage bets → Report results
3. Mobile user → View matches → Place bet → Check odds

## Resources

- [Playwright Documentation](https://playwright.dev)
- [pytest Documentation](https://docs.pytest.org)
- [Project Testing Rules](../.amazonq/rules/project-rules.md)

## Support

For testing issues:
1. Check this documentation
2. Review test logs and screenshots
3. Check CI/CD pipeline results
4. Review Playwright trace files
