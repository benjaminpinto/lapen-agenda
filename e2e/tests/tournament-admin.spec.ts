import {expect, test} from '@playwright/test';
import {
  cleanupTournamentData,
  collectConsoleErrors,
  createTestAdmin,
  E2E_SECRET,
  goToTab,
  loginAsAdmin,
  openTournament,
  openTournamentsList,
  seedTournament,
  signUp,
  TestAdmin,
} from '../helpers/tournament-helpers';

// Tournaments are global state (only one can be active), so this spec runs in its own project (playwright.config.ts), one test at a time.
test.describe.configure({ mode: 'serial' });

test.describe('Tournament admin panel', () => {
  let admin: TestAdmin;

  test.beforeEach(async ({ request }) => {
    test.skip(!E2E_SECRET, 'set E2E_TEST_SECRET (server and tests) to run the tournament specs');
    await cleanupTournamentData(request);
    admin = await createTestAdmin(request);
  });

  test.afterEach(async ({ request }) => {
    if (E2E_SECRET) await cleanupTournamentData(request);
  });

  test('from an empty list to the first recorded result', async ({ page, request }) => {
    await loginAsAdmin(page, admin);
    const errors = collectConsoleErrors(page);
    await openTournamentsList(page);
    await expect(page.getByTestId('tournaments-empty')).toBeVisible();

    // Create the tournament
    await page.getByTestId('new-tournament-button').click();
    await page.getByTestId('tournament-form-name').fill('E2E Copa');
    await page.getByTestId('tournament-form-start-date').fill('2099-03-10');
    await page.getByTestId('tournament-form-end-date').fill('2099-03-12');
    await page.getByTestId('tournament-form-location').fill('Clube LAPEN');
    await page.getByTestId('tournament-form-submit').click();
    await expect(page.getByTestId('tournament-title')).toHaveText('E2E Copa');
    await expect(page.getByTestId('tournament-status')).toHaveText('Rascunho');

    // Opening registrations needs a category
    await page.getByTestId('action-registration_open').click();
    await expect(page.getByTestId('tournament-status')).toHaveText('Rascunho');
    await goToTab(page, 'categorias');
    await expect(page.getByTestId('categories-empty')).toBeVisible();
    await page.getByTestId('new-category-button').click();
    await page.getByTestId('category-form-name').fill('Masculino E2E');
    await page.getByTestId('category-form-min').fill('2');
    await page.getByTestId('category-form-submit').click();
    await expect(page.locator('[data-testid^="category-card-"]')).toHaveCount(1);

    await page.getByTestId('action-registration_open').click();
    await expect(page.getByTestId('tournament-status')).toHaveText('Inscrições abertas');

    // Four people sign up through the public API
    const slug = 'e2e-copa';
    const category = (await (await request.get(`/api/tournaments/${slug}`)).json()).categories[0];
    await signUp(request, slug, category.id, 4);

    // Review them in bulk
    await goToTab(page, 'inscricoes');
    await expect(page.getByTestId('registrations-count')).toHaveText('4 inscrição(ões)');
    const boxes = page.locator('[data-testid^="select-registration-"]');
    await expect(boxes).toHaveCount(4);
    for (let index = 0; index < 4; index++) await boxes.nth(index).check();
    await page.getByTestId('batch-confirm').click();
    await expect(page.locator('[data-testid^="registration-status-"]').first()).toHaveText('Confirmada');
    await expect(page.locator('[data-testid^="registration-status-"]').filter({ hasText: 'Confirmada' })).toHaveCount(4);

    // Close registrations, draw, publish, start
    await page.getByTestId('action-registration_closed').click();
    await expect(page.getByTestId('tournament-status')).toHaveText('Inscrições encerradas');
    await goToTab(page, 'sorteio');
    await page.getByTestId(`draw-generate-${category.id}`).click();
    await expect(page.getByTestId(`draw-preview-${category.id}`)).toBeVisible();
    await expect(page.locator('[data-testid^="preview-match-"]')).toHaveCount(3); // 2 semifinals + final
    await page.getByTestId(`draw-publish-${category.id}`).click();
    await expect(page.getByTestId(`draw-undo-${category.id}`)).toBeVisible();
    await page.getByTestId('action-in_progress').click();
    await expect(page.getByTestId('tournament-status')).toHaveText('Em andamento');

    // Record a result
    await goToTab(page, 'partidas');
    const record = page.locator('[data-testid^="record-result-"]').first();
    const matchId = (await record.getAttribute('data-testid'))!.replace('record-result-', '');
    await record.click();
    await page.getByTestId('result-score').fill('6-4, 6-3');
    await page.getByTestId('result-submit').click();
    await expect(page.getByTestId(`match-status-${matchId}`)).toContainText('6-4, 6-3');

    // A wrong score is explained and changes nothing
    const other = page.locator('[data-testid^="record-result-"]').first();
    await other.click();
    await page.getByTestId('result-score').fill('6-5, 6-4');
    await page.getByTestId('result-submit').click();
    await expect(page.getByTestId('result-dialog')).toBeVisible();
    await page.getByTestId('result-cancel').click();

    // Annulling goes through a confirmation
    await page.getByTestId(`annul-result-${matchId}`).click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await page.getByTestId('confirm-dialog-confirm').click();
    await expect(page.getByTestId(`match-status-${matchId}`)).toHaveText('A jogar');

    expect(errors, 'no console errors on the admin screens').toEqual([]);
  });

  test('a tie nothing can break is decided by the organizer', async ({ page, request }) => {
    const seeded = await seedTournament(request, 'tie_pending');
    await loginAsAdmin(page, admin);
    const errors = collectConsoleErrors(page);
    await openTournament(page, seeded.slug);
    await goToTab(page, 'partidas');

    await expect(page.getByTestId('tie-A')).toBeVisible();
    await expect(page.getByTestId('tie-A')).toContainText('Empate — decisão do organizador');
    await expect(page.getByTestId('tie-submit-A')).toBeDisabled();
    const selects = page.locator('[data-testid^="tie-rank-"]');
    await expect(selects).toHaveCount(3);
    for (let index = 0; index < 3; index++) await selects.nth(index).selectOption(String(index + 1));
    await expect(page.getByTestId('tie-submit-A')).toBeEnabled();
    await page.getByTestId('tie-submit-A').click();

    await expect(page.getByTestId('tie-A')).toHaveCount(0);
    await expect(page.locator('[data-testid^="standing-state-A-"]').filter({ hasText: 'Classificado' })).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('the dashboard points at what is waiting', async ({ page, request }) => {
    await seedTournament(request, 'registration_open');
    await loginAsAdmin(page, admin);
    await expect(page.getByTestId('pending-registrations-count')).toHaveText('2');
    await expect(page.getByTestId('pending-ties-count')).toHaveText('0');
    await page.getByTestId('pending-registrations').click();
    await expect(page).toHaveURL(/tab=inscricoes/);
    await expect(page.getByTestId('registrations-panel')).toBeVisible();
    await expect(page.locator('[data-testid^="registration-status-"]').filter({ hasText: 'Pendente' })).toHaveCount(2);
  });

  test('a rejected or cancelled registration can be reopened as pending', async ({ page, request }) => {
    await seedTournament(request, 'registration_open');
    await loginAsAdmin(page, admin);
    await page.getByTestId('pending-registrations').click();
    const pending = page.locator('[data-testid^="registration-status-"]').filter({ hasText: 'Pendente' });
    await expect(pending).toHaveCount(2);
    await expect(page.locator('[data-testid^="reopen-registration-"]')).toHaveCount(0);

    await page.locator('[data-testid^="reject-registration-"]').first().click();
    await page.getByTestId('reject-reason').fill('Teste de reabertura');
    await page.getByTestId('reject-confirm').click();
    await expect(page.locator('[data-testid^="registration-status-"]').filter({ hasText: 'Recusada' })).toHaveCount(1);
    await expect(page.getByText('Recusada: Teste de reabertura')).toBeVisible();

    await page.locator('[data-testid^="cancel-registration-"]').first().click();
    await expect(page.locator('[data-testid^="registration-status-"]').filter({ hasText: 'Cancelada' })).toHaveCount(1);
    await expect(page.locator('[data-testid^="reopen-registration-"]')).toHaveCount(2);

    await page.locator('[data-testid^="reopen-registration-"]').first().click();
    await page.locator('[data-testid^="reopen-registration-"]').first().click();
    await expect(pending).toHaveCount(2);
    await expect(page.locator('[data-testid^="reopen-registration-"]')).toHaveCount(0);
    await expect(page.getByText('Recusada: Teste de reabertura')).toHaveCount(0);
  });

  test('cancelling a tournament asks for confirmation', async ({ page, request }) => {
    const seeded = await seedTournament(request, 'registration_open');
    await loginAsAdmin(page, admin);
    await openTournament(page, seeded.slug);

    await page.getByTestId('action-cancel').click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await page.getByTestId('confirm-dialog-cancel').click();
    await expect(page.getByTestId('tournament-status')).toHaveText('Inscrições abertas');

    await page.getByTestId('action-cancel').click();
    await page.getByTestId('confirm-dialog-confirm').click();
    await expect(page.getByTestId('tournament-status')).toHaveText('Cancelado');
    await expect(page.getByTestId('tournament-actions')).toHaveCount(1);
    await expect(page.getByTestId('action-cancel')).toHaveCount(0);
  });

  test('every tab fits a tablet and a desktop without scrolling the page sideways', async ({ page, request }) => {
    const seeded = await seedTournament(request, 'groups_in_progress');
    await loginAsAdmin(page, admin);
    const errors = collectConsoleErrors(page);
    await openTournament(page, seeded.slug);
    for (const [width, height] of [[768, 1024], [1024, 768], [1280, 800]]) {
      await page.setViewportSize({ width, height });
      for (const tab of ['dados', 'categorias', 'inscricoes', 'sorteio', 'cronograma', 'partidas'] as const) {
        await goToTab(page, tab);
        await page.waitForTimeout(300);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `horizontal scroll on the ${tab} tab at ${width}px`).toBeLessThanOrEqual(0);
      }
      await expect(page.getByTestId('desktop-notice')).toBeHidden();
    }
    expect(errors).toEqual([]);
  });

  test('on a phone the panel says it is made for a tablet or a computer', async ({ page, request }) => {
    const seeded = await seedTournament(request, 'groups_in_progress');
    await page.setViewportSize({ width: 390, height: 800 });
    await loginAsAdmin(page, admin);
    await expect(page.getByTestId('dashboard-tournaments-card')).toBeVisible();
    await openTournamentsList(page);
    await expect(page.getByTestId('desktop-notice')).toBeVisible();
    await page.getByTestId(`tournament-card-${seeded.slug}`).click();
    await expect(page.getByTestId('desktop-notice')).toBeVisible();
    await expect(page.getByTestId('desktop-notice')).toContainText('tablet ou computador');
  });
});
