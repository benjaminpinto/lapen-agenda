import {expect, Page, test} from '@playwright/test';
import {
  capCategory,
  cleanupTournamentData,
  collectConsoleErrors,
  countRegistrations,
  createTestAdmin,
  E2E_SECRET,
  expectNoPrivateData,
  seedTournament,
  TestAdmin,
} from '../helpers/tournament-helpers';

// Tournaments are global state (only one can be active), so this spec runs in its own project (playwright.config.ts), one test at a time.
test.describe.configure({ mode: 'serial' });

const tracking = (slug: string, tab?: string, category?: number) =>
  `/tournaments/${slug}${tab || category ? '?' : ''}${[category && `categoria=${category}`, tab && `aba=${tab}`].filter(Boolean).join('&')}`;

async function pageOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

test.describe('Tournament public screens', () => {
  test.beforeEach(async ({ request }) => {
    test.skip(!E2E_SECRET, 'set E2E_TEST_SECRET (server and tests) to run the tournament specs');
    await cleanupTournamentData(request);
  });

  test.afterEach(async ({ request }) => {
    if (E2E_SECRET) await cleanupTournamentData(request);
  });

  test('home: the tournament running now and the past ones with their champions', async ({ page, request }) => {
    await seedTournament(request, 'finished');
    await page.goto('/tournaments');
    await expect(page.getByTestId('no-current-tournament')).toBeVisible();
    const history = page.getByTestId('history-e2e-finished');
    await expect(history).toContainText('Ana Souza');
    await expect(history).toContainText('Iara Mendes');

    await seedTournament(request, 'registration_open');
    await page.reload();
    await expect(page.getByTestId('current-tournament-name')).toHaveText('Copa LAPEN — inscrições');
    await expect(page.getByTestId('current-tournament-status')).toHaveText('Inscrições abertas');
    await expect(page.getByTestId('register-link')).toBeVisible();
    await expect(page.getByTestId('history-e2e-finished')).toBeVisible();

    await page.getByTestId('follow-tournament-link').click();
    await expect(page).toHaveURL(/\/tournaments\/e2e-registration-open$/);
    await expect(page.getByTestId('tournament-name')).toHaveText('Copa LAPEN — inscrições');
  });

  test('menu: the Torneios link on a wide screen, a tablet and a phone', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByTestId('nav-tournaments').click();
    await expect(page).toHaveURL(/\/tournaments$/);
    await expect(page.getByTestId('tournament-home')).toBeVisible();

    // A tablet in portrait already uses the compact menu (the full one does not fit before 1024px)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.getByTestId('nav-tournaments')).toBeHidden();
    await page.getByTestId('mobile-menu-button').click();
    await expect(page.getByTestId('nav-tournaments-mobile')).toBeVisible();

    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    await expect(page.getByTestId('nav-tournaments')).toBeHidden();
    await page.getByTestId('mobile-menu-button').click();
    await page.getByTestId('nav-tournaments-mobile').click();
    await expect(page).toHaveURL(/\/tournaments$/);
    await expect(page.getByTestId('tournament-home')).toBeVisible();
    await expect(page.getByTestId('nav-tournaments-mobile')).toHaveCount(0);
  });

  test('tracking: the seven tabs, who advances, and nothing private on the page', async ({ page, request }) => {
    const seeded = await seedTournament(request, 'groups_in_progress');
    const errors = collectConsoleErrors(page);
    await page.goto(tracking(seeded.slug));

    await expect(page.getByTestId('tournament-name')).toHaveText('Copa LAPEN — fase de grupos');
    await expect(page.getByTestId('progress-text')).toContainText('6 de 15');
    await expect(page.getByTestId('step-groups')).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId('section-upcoming')).toBeVisible();
    await expectNoPrivateData(page);

    // Groups: provisional qualifiers say where they would go
    await page.getByTestId('tab-button-grupos').click();
    await expect(page).toHaveURL(/aba=grupos/);
    await expect(page.getByTestId('group-card-A')).toBeVisible();
    await expect(page.getByTestId('group-card-B')).toBeVisible();
    const provisional = page.locator('[data-testid^="standings-row-"][data-state="provisional"]');
    await expect(provisional).toHaveCount(4);
    await expect(provisional.first()).toContainText('Avança (provisório)');
    await expect(provisional.first()).toContainText('Semifinal');
    await expect(page.getByTestId('tiebreak-explainer')).toBeVisible();
    await page.getByTestId('tiebreak-explainer-toggle').click();
    await expect(page.getByTestId('tiebreak-explainer')).toContainText('Mais vitórias');
    await expectNoPrivateData(page);

    // Bracket skeleton: the slots say where each player comes from
    await page.getByTestId('tab-button-chave').click();
    await expect(page.getByTestId('bracket-tree')).toBeVisible();
    await expect(page.getByTestId('bracket-tree')).toContainText('1º Grupo A');
    await expect(page.getByTestId('bracket-round-2')).toContainText('Vencedor da semifinal 1');

    await page.getByTestId('tab-button-jogos').click();
    await expect(page.getByTestId('tab-jogos')).toBeVisible();
    await expect(page.locator('[data-testid^="match-card-"]').first()).toBeVisible();
    await expect(page.locator('[data-testid^="slot-"]').first()).toContainText(/\d{2}:\d{2}/);   // grouped by day, then by start time
    await expect(page.getByTestId('schedule-unpublished-note')).toHaveCount(0);                    // the seed published its schedule

    await page.getByTestId('tab-button-resultados').click();
    await expect(page.locator('[data-testid^="match-card-"][data-status="completed"]').first()).toBeVisible();

    await page.getByTestId('tab-button-inscritos').click();
    await expect(page.getByTestId('entries-count')).toContainText('8 inscritos confirmados');
    await expect(page.locator('[data-testid^="entry-"]')).toHaveCount(8);
    await expectNoPrivateData(page);

    await page.getByTestId('tab-button-regulamento').click();
    await expect(page.getByTestId('rules-text')).toContainText('Regulamento de teste');
    await expect(page.getByTestId('rules-contact')).toContainText('organizacao@lapen.example');

    // The second category keeps the tab and has its own data
    await page.getByTestId(`category-chip-${seeded.categories[1].id}`).click();
    await expect(page).toHaveURL(new RegExp(`categoria=${seeded.categories[1].id}`));
    await expect(page.getByTestId('tab-regulamento')).toBeVisible();
    await page.getByTestId('tab-button-grupos').click();
    await expect(page.getByTestId('tab-grupos')).toContainText('eliminatória');
    await page.getByTestId('tab-button-chave').click();
    await expect(page.getByTestId('bracket-tree')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('group tie waiting for the organizer, and the champion at the end', async ({ page, request }) => {
    const tie = await seedTournament(request, 'tie_pending');
    await page.goto(tracking(tie.slug, 'grupos'));
    await expect(page.getByTestId('group-status-A')).toContainText('Empate a decidir');
    await expect(page.getByTestId('group-tie-notice-A')).toBeVisible();
    await expect(page.locator('[data-testid^="standings-row-"][data-state="tie_pending"]')).toHaveCount(3);
    await expect(page.locator('[data-testid^="standings-row-"][data-state="qualified"]')).toHaveCount(1);

    await cleanupTournamentData(request);
    const done = await seedTournament(request, 'finished');
    await page.goto(tracking(done.slug, undefined, done.categories[0].id));
    await expect(page.getByTestId('champion-name')).toHaveText('Ana Souza');
    await expect(page.getByTestId('runner-up-name')).toContainText('Vice');
    await expect(page.getByTestId('step-champion')).toHaveAttribute('data-state', 'done');
    await expect(page.getByTestId('section-upcoming')).toHaveCount(0);
  });

  test('bracket: whole tree on a wide screen, one round at a time on a phone', async ({ page, request }) => {
    const seeded = await seedTournament(request, 'knockout_in_progress');
    const url = tracking(seeded.slug, 'chave');

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(url);
    await expect(page.getByTestId('bracket-tree')).toBeVisible();
    await expect(page.getByTestId('bracket-rounds')).toHaveCount(0);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);

    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(url);
    await expect(page.getByTestId('bracket-rounds')).toBeVisible();
    await expect(page.getByTestId('bracket-tree')).toHaveCount(0);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    await expect(page.getByTestId('bracket-round-1')).toBeVisible();
    await expect(page.getByTestId('bracket-round-2')).toHaveCount(0);

    await page.getByTestId('bracket-tab-2').click();
    await expect(page.getByTestId('bracket-round-2')).toBeVisible();
    await page.getByTestId('bracket-tab-1').click();
    await expect(page.getByTestId('bracket-round-1')).toBeVisible();

    // Swipe left on the cards: next round
    await page.evaluate(() => {
      const target = document.querySelector('[data-testid="bracket-round-1"]')!;
      const touch = (x: number) => new Touch({ identifier: 1, target, clientX: x, clientY: 200 });
      target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(250)], changedTouches: [touch(250)] }));
      target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [touch(80)] }));
    });
    await expect(page.getByTestId('bracket-round-2')).toBeVisible();
  });

  test('every tab fits a 320px phone without scrolling the page sideways', async ({ page, request }) => {
    const seeded = await seedTournament(request, 'knockout_in_progress');
    await page.setViewportSize({ width: 320, height: 700 });
    for (const tab of ['andamento', 'grupos', 'chave', 'jogos', 'resultados', 'inscritos', 'regulamento']) {
      await page.goto(tracking(seeded.slug, tab));
      await expect(page.getByTestId(`tab-button-${tab}`)).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('tournament-page')).toBeVisible();
      await page.waitForTimeout(300);
      expect(await pageOverflow(page), `tab ${tab}`).toBeLessThanOrEqual(0);
    }
  });

  test('polling: a hidden tab asks for nothing, coming back refreshes', async ({ page, request }) => {
    const seeded = await seedTournament(request, 'groups_in_progress');
    let calls = 0;
    page.on('request', (r) => {
      if (/\/api\/tournaments\/[^/]+\/categories\/\d+$/.test(new URL(r.url()).pathname)) calls += 1;
    });
    await page.clock.install({ time: new Date('2030-01-01T10:00:00') });
    await page.goto(tracking(seeded.slug));
    await expect(page.getByTestId('progress-text')).toBeVisible();
    await page.clock.pauseAt(new Date('2030-01-01T10:00:05'));
    const initial = calls;

    await page.clock.runFor(61_000);
    await expect.poll(() => calls).toBe(initial + 1);
    await expect(page.getByTestId('updated-at')).toContainText('10:01');

    const setHidden = (hidden: boolean) => page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { value, configurable: true });
      Object.defineProperty(document, 'visibilityState', { value: value ? 'hidden' : 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    }, hidden);

    await setHidden(true);
    await page.clock.runFor(180_000);
    await page.waitForTimeout(500);
    expect(calls).toBe(initial + 1);

    await setHidden(false);
    await expect.poll(() => calls).toBe(initial + 2);
    await expect(page.getByTestId('updated-at')).toContainText('10:04');

    await page.getByTestId('refresh-button').click();
    await expect.poll(() => calls).toBe(initial + 3);
  });

  test.describe('sign-up', () => {
    let admin: TestAdmin;
    const person = { name: 'Maria Teste da Silva', email: 'maria.teste@e2e-signup.example', phone: '(24) 99999-0001' };

    test.beforeEach(async ({ request, page }, testInfo) => {
      admin = await createTestAdmin(request);
      // The hourly limit is per address and the browser always comes from the same one: give each test its own
      await page.setExtraHTTPHeaders({ 'X-Forwarded-For': `203.0.113.${100 + testInfo.workerIndex + testInfo.retry}` });
    });

    async function fill(page: Page, category: string, email = person.email) {
      await page.getByTestId('reg-category').selectOption({ label: category });
      await page.getByTestId('reg-full-name').fill(person.name);
      await page.getByTestId('reg-email').fill(email);
      await page.getByTestId('reg-phone').fill(person.phone);
      await page.getByTestId('reg-terms').check();
      await page.getByTestId('reg-consent').check();
    }

    test('success, same e-mail twice, and a second category for the same person', async ({ page, request }) => {
      const seeded = await seedTournament(request, 'registration_open');
      const errors = collectConsoleErrors(page);
      await page.goto(`/tournaments/${seeded.slug}`);
      await page.getByTestId('header-register-link').click();
      await expect(page.getByTestId('registration-form')).toBeVisible();

      // Empty form: the screen says what is missing and sends nothing
      await page.getByTestId('reg-submit').click();
      for (const field of ['category_id', 'full_name', 'email', 'phone', 'accepted_terms', 'data_consent']) {
        await expect(page.getByTestId(`reg-error-${field}`)).toBeVisible();
      }

      await fill(page, 'Masculino 3ª Classe');
      await page.getByTestId('reg-submit').click();
      await expect(page.getByTestId('registration-success')).toBeVisible();
      await expect(page.getByTestId('registration-success')).toHaveAttribute('data-waitlisted', 'false');
      await expect(page.getByTestId('registration-success-message')).toContainText('organizador');

      // Another category: the personal data stays, the category and the agreements do not
      await page.getByTestId('register-another').click();
      await expect(page.getByTestId('reg-email')).toHaveValue(person.email);
      await expect(page.getByTestId('reg-category')).toHaveValue('');
      await expect(page.getByTestId('reg-terms')).not.toBeChecked();
      await page.getByTestId('reg-category').selectOption({ label: 'Feminino Livre' });
      await page.getByTestId('reg-terms').check();
      await page.getByTestId('reg-consent').check();
      await page.getByTestId('reg-submit').click();
      await expect(page.getByTestId('registration-success')).toBeVisible();

      // The same e-mail in the same category is refused with the server's message
      await page.getByTestId('register-another').click();
      await fill(page, 'Masculino 3ª Classe');
      await page.getByTestId('reg-submit').click();
      await expect(page.getByTestId('reg-error')).toContainText('já existe uma inscrição', { ignoreCase: true });
      await expect(page.getByTestId('registration-success')).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test('a full category sends the person to the waiting list', async ({ page, request }) => {
      const seeded = await seedTournament(request, 'registration_open');
      await capCategory(request, admin, seeded.tournament_id, seeded.categories[1].id, 4);
      await page.goto(`/tournaments/${seeded.slug}/register`);
      await expect(page.getByTestId('reg-category')).toContainText('Feminino Livre (lotada: lista de espera)');
      await fill(page, 'Feminino Livre (lotada: lista de espera)');
      await page.getByTestId('reg-submit').click();
      await expect(page.getByTestId('registration-success')).toHaveAttribute('data-waitlisted', 'true');
      await expect(page.getByTestId('registration-success-message')).toContainText('lista de espera');
    });

    test('the honeypot looks like success but stores nothing', async ({ page, request }) => {
      const seeded = await seedTournament(request, 'registration_open');
      const before = await countRegistrations(request, admin, seeded.tournament_id);
      await page.goto(`/tournaments/${seeded.slug}/register`);
      await fill(page, 'Masculino 3ª Classe');
      await page.getByTestId('reg-website').fill('http://spam.example');
      await page.getByTestId('reg-submit').click();
      await expect(page.getByTestId('registration-success')).toBeVisible();
      expect(await countRegistrations(request, admin, seeded.tournament_id)).toBe(before);
    });

    test('registrations closed: no form, a way to follow the tournament', async ({ page, request }) => {
      const seeded = await seedTournament(request, 'before_draw');
      await page.goto(`/tournaments/${seeded.slug}/register`);
      await expect(page.getByTestId('registration-closed')).toContainText('encerradas');
      await expect(page.getByTestId('registration-form')).toHaveCount(0);

      await page.goto(`/tournaments/${seeded.slug}`);
      await expect(page.getByTestId('header-register-link')).toHaveCount(0);
    });

    test('unknown tournament', async ({ page }) => {
      await page.goto('/tournaments/nao-existe');
      await expect(page.getByTestId('tournament-not-found')).toBeVisible();
      await page.goto('/tournaments/nao-existe/register');
      await expect(page.getByTestId('register-not-found')).toBeVisible();
    });
  });
});
