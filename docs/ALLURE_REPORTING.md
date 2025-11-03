# Allure Reporting Guide - LAPEN Agenda

## Overview

Allure Report provides enhanced test reporting with rich visualizations, history tracking, and detailed analytics for Playwright E2E tests.

## Features

- **📊 Interactive Dashboard**: Overview of test results with charts and graphs
- **📈 Trend Analysis**: Track test success rates over time
- **🔄 History Tracking**: Compare results across test runs
- **📸 Rich Attachments**: Screenshots, videos, and traces automatically attached
- **🏷️ Categorization**: Organize tests by suites, features, and stories
- **⚡ Flakiness Detection**: Identify unstable tests
- **🌍 Environment Info**: OS, Node version, browser details

## Local Usage

### Generate and View Reports

```bash
# Run tests (generates allure-results/)
npm run test:e2e

# Option 1: Generate and serve in one command (recommended)
npm run allure:serve

# Option 2: Generate report, then open
npm run allure:generate
npm run allure:open
```

### Available Scripts

- `npm run allure:serve` - Generate report from results and open in browser
- `npm run allure:generate` - Generate static HTML report in `allure-report/`
- `npm run allure:open` - Open previously generated report

## GitHub Pages Deployment

### Automatic Publishing

Allure reports are automatically published to GitHub Pages after E2E tests run in CI:

1. **Trigger**: E2E tests complete (preview deployments only)
2. **History**: Previous report history loaded from `gh-pages` branch
3. **Generation**: New report generated with historical data
4. **Publishing**: Report published to `gh-pages` branch
5. **Access**: Available at `https://<username>.github.io/<repo-name>/`

### Setup Requirements

**1. Enable GitHub Pages:**
- Go to repository Settings → Pages
- Source: Deploy from a branch
- Branch: `gh-pages` / `root`
- Save

**2. Grant Workflow Permissions:**
- Go to Settings → Actions → General
- Workflow permissions: "Read and write permissions"
- Save

**3. First Deployment:**
- Push to a non-main branch
- Wait for Vercel preview deployment
- E2E tests will run and publish first report
- GitHub Pages will be available after first publish

### Accessing Reports

**Public Repository:**
- URL: `https://<username>.github.io/<repo-name>/`
- Accessible to anyone

**Private Repository:**
- URL: Same as above
- Accessible only to repository members
- Configure in Settings → Pages → Visibility

## Report Structure

### Main Sections

**1. Overview**
- Total tests, passed, failed, broken, skipped
- Success rate and duration
- Trend graphs (requires history)

**2. Suites**
- Tests organized by file/suite
- Expandable tree view
- Status indicators

**3. Graphs**
- Status distribution
- Severity distribution
- Duration trends
- Flakiness detection

**4. Timeline**
- Chronological test execution
- Parallel execution visualization
- Duration analysis

**5. Behaviors**
- Tests organized by features/stories
- BDD-style organization

**6. Packages**
- Tests organized by directory structure

## Configuration

### Playwright Config

Current configuration in `playwright.config.ts`:

```typescript
reporter: [
  ['html'],
  ['list'],
  ['json', { outputFile: 'test-results/results.json' }],
  ['allure-playwright', {
    resultsDir: 'allure-results',
    detail: true,
    suiteTitle: true,
    environmentInfo: {
      os_platform: os.platform(),
      os_release: os.release(),
      os_version: os.version(),
      node_version: process.version,
    },
  }]
]
```

### Options

- `resultsDir`: Directory for test results (default: `allure-results`)
- `detail`: Include detailed steps for Playwright API calls (default: `true`)
- `suiteTitle`: Group tests by file name (default: `true`)
- `environmentInfo`: Key-value pairs displayed on main page

## Enhancing Tests

### Add Descriptions

```typescript
import { test } from '@playwright/test';
import * as allure from 'allure-js-commons';

test('user login', async ({ page }) => {
  await allure.description('Test user authentication flow');
  await allure.owner('QA Team');
  await allure.severity('critical');
  // Test code...
});
```

### Organize by Features

```typescript
test('place bet', async ({ page }) => {
  await allure.epic('Betting System');
  await allure.feature('Place Bet');
  await allure.story('User places bet on match');
  // Test code...
});
```

### Add Steps

```typescript
test('checkout flow', async ({ page }) => {
  await allure.step('Navigate to betting page', async () => {
    await page.goto('/betting');
  });
  
  await allure.step('Select match', async () => {
    await page.click('[data-testid="match-1"]');
  });
  
  await allure.step('Complete payment', async () => {
    await page.click('[data-testid="pay-button"]');
  });
});
```

### Attach Custom Data

```typescript
import * as allure from 'allure-js-commons';

test('api test', async ({ page }) => {
  const response = await page.request.get('/api/matches');
  
  await allure.attachment(
    'API Response',
    JSON.stringify(await response.json(), null, 2),
    'application/json'
  );
});
```

## CI/CD Integration

### Workflow Configuration

The E2E workflow (`.github/workflows/e2e-tests.yml`) includes:

```yaml
- name: Load test report history
  uses: actions/checkout@v3
  if: always()
  continue-on-error: true
  with:
    ref: gh-pages
    path: gh-pages

- name: Build Allure report
  uses: simple-elf/allure-report-action@v1.10
  if: always()
  with:
    gh_pages: gh-pages
    allure_history: allure-history
    allure_results: allure-results

- name: Publish Allure report to GitHub Pages
  uses: peaceiris/actions-gh-pages@v4
  if: always()
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_branch: gh-pages
    publish_dir: allure-history
```

### History Tracking

- **First Run**: Creates initial report
- **Subsequent Runs**: Loads previous history, adds new results
- **Trends**: Shows success rate changes over time
- **Retention**: All history preserved in `gh-pages` branch

## Troubleshooting

### Report Not Generating

```bash
# Check if results exist
ls -la allure-results/

# Ensure allure-commandline is installed
npm install --save-dev allure-commandline

# Try generating manually
npx allure generate allure-results --clean
```

### GitHub Pages Not Working

1. Check workflow permissions (Settings → Actions → General)
2. Verify `gh-pages` branch exists
3. Check GitHub Pages settings (Settings → Pages)
4. Review workflow logs for errors

### Missing History

- History only available after first successful publish
- Check `gh-pages` branch for `allure-history/` directory
- Ensure workflow has write permissions

### Attachments Not Showing

- Screenshots/videos automatically attached by Playwright
- Check `use.screenshot` and `use.video` in `playwright.config.ts`
- Verify test failures to trigger attachments

## Best Practices

1. **Run Locally First**: Test report generation before pushing
2. **Meaningful Names**: Use descriptive test names
3. **Add Context**: Use descriptions, tags, and steps
4. **Organize Tests**: Group by features/epics
5. **Review Trends**: Check for flaky tests
6. **Clean Results**: Delete old results before new runs locally

## Resources

- [Allure Report Documentation](https://allurereport.org/docs/)
- [Allure Playwright Integration](https://allurereport.org/docs/playwright/)
- [GitHub Actions Integration](https://allurereport.org/docs/integrations-github/)
- [Playwright Documentation](https://playwright.dev)

## Example Report

After running tests, your Allure report will show:

- **Overview**: 45 tests, 43 passed, 2 failed (95.6% success)
- **Duration**: 2m 34s
- **Environment**: macOS 14.0, Node 18.x, Chromium 120.0
- **Trends**: Success rate over last 10 runs
- **Attachments**: Screenshots of failures, video recordings
- **Timeline**: Parallel execution visualization

Access your report at: `https://<username>.github.io/lapen-agenda/`
