import {expect, test} from '@playwright/test';

// The type filter of the statistics screen offers "Torneio" and sends it to the API. The data comes from stubs, so this
// spec does not depend on (or touch) the tournament state and runs in every project.
test.describe('Statistics: tournament filter', () => {
  test('the type filter has Torneio and the screen asks the API for it', async ({ page }) => {
    await page.route('**/api/statistics/players', (route) => route.fulfill({ json: { players: ['Ada Teste', 'Bia Teste'] } }));
    await page.route('**/api/statistics/opponents/**', (route) => route.fulfill({ json: { opponents: ['Bia Teste'] } }));
    await page.route('**/api/statistics/player?**', (route) => route.fulfill({
      json: { total_matches: 0, wins: 0, losses: 0, sets_won: 0, sets_lost: 0, games_won: 0, games_lost: 0, matches: [] },
    }));

    await page.goto('/statistics');
    const filters = page.getByTestId('statistics-filters');
    await filters.getByText('Filtros').click();
    await page.getByTestId('player1-select').click();
    await filters.getByText('Ada Teste', { exact: true }).click();

    await page.getByTestId('match-type-select').click();
    for (const option of ['Ranking', 'Amistoso', 'Torneio']) {
      await expect(filters.getByText(option, { exact: true })).toBeVisible();
    }
    await filters.getByText('Torneio', { exact: true }).click();

    const request = page.waitForRequest((r) => r.url().includes('/api/statistics/player?'));
    await page.getByTestId('fetch-stats-btn').click();
    const url = new URL((await request).url());
    expect(url.searchParams.get('player1')).toBe('Ada Teste');
    expect(url.searchParams.get('match_type')).toBe('Torneio');
  });
});
