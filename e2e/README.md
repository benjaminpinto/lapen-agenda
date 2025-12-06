# E2E Tests - Quick Reference

## 🚀 Running Tests

### Run All Tests
```bash
npm run test:e2e
```

### Run Specific Test File
```bash
npx playwright test e2e/tests/schedule-management.spec.ts
npx playwright test e2e/tests/betting-flow.spec.ts
npx playwright test e2e/tests/admin-matches.spec.ts
npx playwright test e2e/tests/admin-courts.spec.ts
npx playwright test e2e/tests/lapen-approval.spec.ts
```

### Run Tests with UI (Debug Mode)
```bash
npm run test:e2e:ui
```

### Run Tests in Headed Mode
```bash
npx playwright test --headed
```

### Run Specific Browser
```bash
npx playwright test --project=chromium
npx playwright test --project=mobile-chrome
npx playwright test --project=mobile-safari
```

---

## 📊 View Reports

### Allure Report (Recommended)
```bash
npm run allure:serve
```

### Playwright HTML Report
```bash
npx playwright show-report
```

### Live Reports
View test reports on GitHub Pages: https://benjaminpinto.github.io/lapen-agenda

---

## 📁 Test Structure

```
e2e/
├── fixtures/
│   └── test-data.ts          # Test data constants
├── helpers/
│   ├── api-helpers.ts        # API request helpers
│   ├── auth-helpers.ts       # Authentication helpers
│   ├── cleanup-helpers.ts    # Test cleanup utilities
│   ├── db-helpers.ts         # Database helpers
│   └── schedule-helpers.ts   # Schedule/match/bet helpers
└── tests/
    ├── admin.spec.ts              # Admin panel navigation (7 tests)
    ├── admin-courts.spec.ts       # Court CRUD operations (8 tests) ⭐
    ├── admin-matches.spec.ts      # Match management (7 tests) ⭐
    ├── auth.spec.ts               # Authentication flows (8 tests)
    ├── betting.spec.ts            # Betting UI display (5 tests)
    ├── betting-flow.spec.ts       # Complete betting flow (10 tests) ⭐
    ├── lapen-approval.spec.ts     # LAPEN approval workflow (8 tests) ⭐
    ├── mobile.spec.ts             # Mobile responsiveness (4 tests)
    ├── my-bets.spec.ts            # My bets page (4 tests)
    ├── navigation.spec.ts         # Navigation tests (8 tests)
    ├── schedule.spec.ts           # Schedule navigation (3 tests)
    └── schedule-management.spec.ts # Schedule CRUD (8 tests) ⭐
```

⭐ = New in Phase 1 implementation

---

## 🔧 Helper Functions

### Authentication
```typescript
import { loginAdmin, loginUser, registerUser, logout } from '../helpers/auth-helpers';

// Admin login
await loginAdmin(page, testAdmin.password);

// User login
await loginUser(page, email, password);

// User registration
await registerUser(page, userData);
```

### API Helpers
```typescript
import { createUserViaAPI, loginViaAPI } from '../helpers/api-helpers';
import { createScheduleViaAPI, createMatchViaAPI, placeBetViaAPI, approveLapenMember } from '../helpers/schedule-helpers';

// Create user
const { token } = await createUserViaAPI(request, userData);

// Approve LAPEN member
await approveLapenMember(request, email);

// Create schedule
await createScheduleViaAPI(request, token, scheduleData);

// Create match
const { matchId } = await createMatchViaAPI(request, token, scheduleId);

// Place bet
await placeBetViaAPI(request, token, betData);
```

### Test Data
```typescript
import { testUsers, testAdmin } from '../fixtures/test-data';
import { getProjectPrefix, getFutureDate } from '../helpers/cleanup-helpers';

// Unique email per test
const email = `${getProjectPrefix(browserName)}@example.com`;

// Future date for schedules
const dateStr = getFutureDate(7); // 7 days from now
```

---

## 🎯 Test Patterns

### Basic Test Structure
```typescript
test.describe('Feature Name', () => {
  test.beforeEach(async ({ page, request, browserName }) => {
    // Setup: create users, authenticate, navigate
  });

  test('should perform action', async ({ page }) => {
    // Arrange
    // Act
    // Assert
  });
});
```

### API-Based Setup (Recommended)
```typescript
test.beforeEach(async ({ page, request, browserName }) => {
  // Create user via API (faster)
  const email = `${getProjectPrefix(browserName)}@example.com`;
  const { token } = await createUserViaAPI(request, userData);
  
  // Approve LAPEN member if needed
  await approveLapenMember(request, email);
  
  // Navigate and set auth
  await page.goto('/schedule');
  await page.evaluate((token) => localStorage.setItem('auth_token', token), token);
  await page.reload();
});
```

### Waiting for Elements
```typescript
// Wait for element to be visible
await expect(page.locator('text=Success')).toBeVisible({ timeout: 10000 });

// Wait for URL change
await page.waitForURL('/dashboard');

// Wait for API response
const [response] = await Promise.all([
  page.waitForResponse(resp => resp.url().includes('/api/endpoint')),
  page.click('button[type="submit"]')
]);
```

---

## 🐛 Debugging

### Run Single Test in Debug Mode
```bash
npx playwright test e2e/tests/schedule-management.spec.ts --debug
```

### View Test Traces
```bash
npx playwright show-trace trace.zip
```

### Take Screenshots
```typescript
await page.screenshot({ path: 'screenshot.png' });
```

### Console Logs
```typescript
page.on('console', msg => console.log(msg.text()));
```

---

## 📝 Writing New Tests

### 1. Choose Test File
- Admin features → `admin-*.spec.ts`
- User features → `feature-name.spec.ts`
- Mobile-specific → `mobile.spec.ts`

### 2. Use Helpers
- Always use API helpers for setup
- Use auth helpers for login/logout
- Use cleanup helpers for unique IDs

### 3. Follow Patterns
- Use `data-testid` attributes when available
- Wait for elements properly
- Clean up test data
- Use descriptive test names

### 4. Test Checklist
- [ ] Unique test data (browserName prefix)
- [ ] Proper authentication
- [ ] API-based setup where possible
- [ ] Clear assertions
- [ ] Error case testing
- [ ] Mobile responsiveness (if applicable)

---

## 🔍 Common Issues

### Issue: Test fails with "Element not found"
**Solution:** Add proper wait conditions
```typescript
await expect(element).toBeVisible({ timeout: 10000 });
```

### Issue: Authentication fails
**Solution:** Ensure token is set and page is reloaded
```typescript
await page.evaluate((token) => localStorage.setItem('auth_token', token), token);
await page.reload();
```

### Issue: Test data conflicts
**Solution:** Use unique identifiers
```typescript
const email = `${getProjectPrefix(browserName)}@example.com`;
```

### Issue: LAPEN member cannot schedule
**Solution:** Approve member before testing
```typescript
await approveLapenMember(request, email);
```

---

## 📚 Documentation

- [E2E Test Plan](../docs/E2E_TEST_PLAN.md) - Complete test scenarios
- [Implementation Summary](../docs/E2E_IMPLEMENTATION_SUMMARY.md) - What's been implemented
- [Testing Guide](../docs/TESTING.md) - General testing documentation
- [Playwright Setup](../docs/PLAYWRIGHT_SETUP.md) - Configuration details

---

## 🎓 Best Practices

1. **Use API for Setup** - Faster and more reliable than UI
2. **Unique Test Data** - Prevent conflicts with browserName prefix
3. **Proper Waits** - Use expect().toBeVisible() instead of waitForTimeout
4. **Clean Assertions** - One assertion per test when possible
5. **Error Testing** - Test both happy path and error cases
6. **Mobile First** - Consider mobile viewports
7. **Portuguese Validation** - Check for Portuguese text in UI
8. **Cleanup** - Use cleanup helpers to remove test data

---

**Current Coverage:** 55% (79 tests)  
**Target Coverage:** 80%  
**Next Phase:** Recurring schedules, holidays/blocks, player management
