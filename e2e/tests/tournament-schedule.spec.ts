import {expect, Page, test} from '@playwright/test';
import {
  addSessions,
  adminSession,
  cleanupTournamentData,
  collectConsoleErrors,
  createTestAdmin,
  disjointMatches,
  E2E_SECRET,
  getSchedule,
  goToTab,
  loginAsAdmin,
  matchesSharingAPlayer,
  openTournament,
  placeMatch,
  seedTournament,
  TestAdmin,
  windowAt,
} from '../helpers/tournament-helpers';

// Tournaments are global state (only one can be active), so this spec runs in its own project (playwright.config.ts), one test at a time.
test.describe.configure({ mode: 'serial' });

const cell = (page: Page, w: { court_id: number; date: string; time: string }) => page.getByTestId(`schedule-window-${w.court_id}-${w.date}-${w.time}`);
const match = (page: Page, id: number) => page.getByTestId(`schedule-match-${id}`);

test.describe('Tournament schedule (admin)', () => {
  let admin: TestAdmin;

  test.beforeEach(async ({ request }) => {
    test.skip(!E2E_SECRET, 'set E2E_TEST_SECRET (server and tests) to run the tournament specs');
    await cleanupTournamentData(request);
    admin = await createTestAdmin(request);
    await adminSession(request, admin);   // the API side of each test (setup and checks) talks as the same admin
  });

  test.afterEach(async ({ request }) => {
    if (E2E_SECRET) await cleanupTournamentData(request);
  });

  test('from no sessions to a published schedule the public can read', async ({ page, request, browser }) => {
    const seeded = await seedTournament(request, 'before_schedule');
    await loginAsAdmin(page, admin);
    const errors = collectConsoleErrors(page);
    await openTournament(page, seeded.slug);
    await goToTab(page, 'cronograma');
    await expect(page.getByTestId('schedule-empty')).toBeVisible();
    await expect(page.getByTestId('summary-pending')).not.toContainText('Pendentes: 0');

    // Two sessions: the dialog shows how many games each one holds
    for (const dayIndex of [1, 2]) {
      await page.getByTestId('new-session-button').click();
      await expect(page.getByTestId('session-dialog')).toBeVisible();
      await page.getByTestId('session-date').selectOption({ index: dayIndex });
      await expect(page.getByTestId('session-preview')).toContainText('6 janela(s)');
      await page.getByTestId('session-submit').click();
      await expect(page.getByTestId('session-dialog')).toHaveCount(0);
    }
    await expect(page.locator('[data-testid^="session-"][data-testid$="0"], [data-testid^="session-"]').filter({ hasText: 'janelas' })).toHaveCount(2);
    await expect(page.getByTestId('schedule-grid')).toBeVisible();

    // A bad session is refused with the reason
    await page.getByTestId('new-session-button').click();
    await page.getByTestId('session-start').fill('08:00');
    await page.getByTestId('session-end').fill('09:00');
    await expect(page.getByTestId('session-preview')).toContainText('ao menos 90 minutos');
    await expect(page.getByTestId('session-submit')).toBeDisabled();
    await page.getByTestId('session-cancel').click();

    // Distribute: the proposal is drawn on the grid and nothing is written until applied
    await page.getByTestId('sidebar-tab-distribute').click();
    await page.getByTestId('distribute-generate').click();
    await expect(page.getByTestId('distribute-result')).toBeVisible();
    await expect(page.getByTestId('distribute-summary')).toContainText('partida(s) com horário');
    await expect(page.getByTestId('distribute-metrics')).toContainText('Termina');
    await expect(page.locator('[data-testid^="schedule-ghost-"]').first()).toBeVisible();
    expect((await getSchedule(request, seeded.tournament_id)).summary.placed).toBe(0);
    await page.getByTestId('distribute-discard').click();
    await expect(page.locator('[data-testid^="schedule-ghost-"]')).toHaveCount(0);
    await page.getByTestId('distribute-generate').click();
    await page.getByTestId('distribute-apply').click();
    await expect(page.getByTestId('summary-placed')).not.toContainText('Com horário: 0');
    await expect(page.getByTestId('summary-conflicts')).toContainText('Conflitos: 0');
    expect((await getSchedule(request, seeded.tournament_id)).summary.placed).toBeGreaterThan(0);

    // Hidden from the public until published
    const publicPage = await browser.newPage();
    await publicPage.goto(`/tournaments/${seeded.slug}?aba=jogos`);
    await expect(publicPage.getByTestId('tab-jogos')).toBeVisible();
    await expect(publicPage.getByTestId('day-sem-data')).toBeVisible();
    const withTimes = publicPage.locator('[data-testid^="match-footer-"]').filter({ hasText: /\d{2}:\d{2}/ });
    await expect(withTimes).toHaveCount(0);

    await expect(page.getByTestId('publish-status')).toHaveText('Oculto ao público');
    await page.getByTestId('publish-button').click();
    await page.getByTestId('confirm-dialog-confirm').click();
    await expect(page.getByTestId('publish-status')).toContainText('Publicado em');

    await publicPage.reload();
    await expect(publicPage.getByTestId('tab-jogos')).toBeVisible();
    await expect(withTimes.first()).toBeVisible();
    await expect(publicPage.getByTestId('progress-text')).toHaveCount(0);

    await page.getByTestId('unpublish-button').click();
    await expect(page.getByTestId('publish-status')).toHaveText('Oculto ao público');
    await publicPage.reload();
    await expect(publicPage.getByTestId('tab-jogos')).toBeVisible();
    await expect(withTimes).toHaveCount(0);
    await publicPage.close();
    expect(errors).toEqual([]);
  });

  test('swap, move, pin and remove by tapping', async ({ page, request }) => {
    const seeded = await seedTournament(request, 'before_schedule');
    const schedule = await addSessions(request, admin, seeded.tournament_id, [1]);
    const [a, b] = disjointMatches(schedule.matches);
    const early = windowAt(schedule, 1, '08:00');
    const late = windowAt(schedule, 1, '14:00');
    const middle = windowAt(schedule, 1, '11:00');
    await placeMatch(request, seeded.tournament_id, a.id, early);
    await placeMatch(request, seeded.tournament_id, b.id, late);
    const timeOf = async (id: number) => (await getSchedule(request, seeded.tournament_id)).matches.find((m) => m.id === id)?.window?.time ?? null;

    await loginAsAdmin(page, admin);
    await openTournament(page, seeded.slug);
    await goToTab(page, 'cronograma');

    // Tap one match, then another: they trade places
    await match(page, a.id).click();
    await expect(page.getByTestId('selection-bar')).toContainText('Selecionada');
    await expect(match(page, a.id)).toHaveAttribute('data-selected', 'true');
    await match(page, b.id).click();
    await expect.poll(() => timeOf(a.id)).toBe('14:00');
    expect(await timeOf(b.id)).toBe('08:00');
    await expect(page.getByTestId('selection-bar')).toHaveCount(0);

    // Tap a match, then a free window: it moves
    await match(page, a.id).click();
    await cell(page, middle).click();
    await expect.poll(() => timeOf(a.id)).toBe('11:00');

    // Pin it: it cannot be removed or traded until released
    await match(page, a.id).click();
    await page.getByTestId('selection-lock').click();
    await expect(match(page, a.id)).toContainText('Fixada');
    await match(page, a.id).click();
    await expect(page.getByTestId('selection-unplace')).toBeDisabled();
    await match(page, b.id).click();                      // a trade with a pinned match is refused
    await expect.poll(() => timeOf(a.id)).toBe('11:00');
    expect(await timeOf(b.id)).toBe('08:00');
    await page.getByTestId('selection-clear').click().catch(() => {});
    await match(page, a.id).click();
    await page.getByTestId('selection-lock').click();
    await expect(match(page, a.id)).not.toContainText('Fixada');

    // Take it out of the schedule: it goes back to the list of matches without a time
    await match(page, a.id).click();
    await page.getByTestId('selection-unplace').click();
    await expect.poll(() => timeOf(a.id)).toBeNull();
    await expect(page.getByTestId('unscheduled-list').getByTestId(`schedule-match-${a.id}`)).toBeVisible();

    // Block a window: matches cannot go there until it is released
    await cell(page, late).click();
    await expect(page.getByTestId('selection-bar')).toContainText('livre');
    await page.getByTestId('selection-clear').click();
    await cell(page, middle).click();
    await page.getByTestId('selection-block').click();
    await expect(page.locator(`[data-testid="schedule-window-${middle.court_id}-${middle.date}-${middle.time}"][data-blocked="true"]`)).toBeVisible();
  });

  test('a rest warning asks before it applies, and the panel lists it afterwards', async ({ page, request }) => {
    const seeded = await seedTournament(request, 'before_schedule');
    const schedule = await addSessions(request, admin, seeded.tournament_id, [1]);
    const [first, second] = matchesSharingAPlayer(schedule.matches);
    await placeMatch(request, seeded.tournament_id, first.id, windowAt(schedule, 1, '08:00'));
    const tooSoon = windowAt(schedule, 1, '09:30');

    await loginAsAdmin(page, admin);
    await openTournament(page, seeded.slug);
    await goToTab(page, 'cronograma');
    await page.getByTestId('sidebar-tab-unscheduled').click();
    await match(page, second.id).click();
    await cell(page, tooSoon).click();
    await expect(page.getByTestId('attention-dialog')).toContainText('descanso');
    await page.getByTestId('attention-cancel').click();
    expect((await getSchedule(request, seeded.tournament_id)).matches.find((m) => m.id === second.id)?.window).toBeNull();

    await expect(page.getByTestId('selection-bar')).toBeVisible();     // still selected after going back: just try the window again
    await cell(page, tooSoon).click();
    await page.getByTestId('attention-confirm').click();
    await expect(page.getByTestId('summary-conflicts')).toContainText('Conflitos: 1');
    await page.getByTestId('sidebar-tab-conflicts').click();
    await expect(page.getByTestId('conflict-0')).toHaveAttribute('data-severity', 'warning');
    await expect(match(page, second.id)).toHaveAttribute('data-conflict', 'warning');
    await page.getByTestId('conflict-show-0').click();
    await expect(page.getByTestId('selection-bar')).toBeVisible();
  });

  test('a match can be dragged onto another with the mouse', async ({ page, request }) => {
    const seeded = await seedTournament(request, 'before_schedule');
    const schedule = await addSessions(request, admin, seeded.tournament_id, [1]);
    const [a, b] = disjointMatches(schedule.matches);
    await placeMatch(request, seeded.tournament_id, a.id, windowAt(schedule, 1, '08:00'));
    await placeMatch(request, seeded.tournament_id, b.id, windowAt(schedule, 1, '14:00'));
    await page.setViewportSize({ width: 1280, height: 1800 });   // a tall window: Playwright cannot scroll in the middle of a drag
    await loginAsAdmin(page, admin);
    await openTournament(page, seeded.slug);
    await goToTab(page, 'cronograma');
    await match(page, a.id).dragTo(match(page, b.id));
    await expect.poll(async () => (await getSchedule(request, seeded.tournament_id)).matches.find((m) => m.id === a.id)?.window?.time).toBe('14:00');
    // and onto a free window
    await match(page, a.id).dragTo(cell(page, windowAt(schedule, 1, '11:00')));
    await expect.poll(async () => (await getSchedule(request, seeded.tournament_id)).matches.find((m) => m.id === a.id)?.window?.time).toBe('11:00');
    // and back to the list
    await match(page, a.id).dragTo(page.getByTestId('unscheduled-list'), { targetPosition: { x: 150, y: 30 } });
    await expect.poll(async () => (await getSchedule(request, seeded.tournament_id)).matches.find((m) => m.id === a.id)?.window).toBeNull();
  });

  test('an impediment keeps a player out of the distribution', async ({ page, request }) => {
    const seeded = await seedTournament(request, 'before_schedule');
    const schedule = await addSessions(request, admin, seeded.tournament_id, [0, 1, 2, 3]);
    const masculine = schedule.matches.filter((m) => m.stage === 'group' && m.category_name.startsWith('Masculino'));
    const ids = masculine.flatMap((m) => m.sides.map((s) => s.registration_id as number));
    const target = Math.max(...ids);

    await loginAsAdmin(page, admin);
    await openTournament(page, seeded.slug);
    await goToTab(page, 'inscricoes');
    await page.getByTestId(`unavailability-registration-${target}`).click();
    await expect(page.getByTestId('unavailability-dialog')).toBeVisible();
    await expect(page.getByTestId('unavailability-empty')).toBeVisible();
    await page.getByTestId('unavailability-date').selectOption({ index: 1 });
    await page.getByTestId('unavailability-note').fill('trabalho');
    await page.getByTestId('unavailability-add').click();
    await expect(page.getByTestId('unavailability-item-0')).toContainText('dia todo');
    // a range must end after it starts
    await page.getByTestId('unavailability-whole-day').uncheck();
    await page.getByTestId('unavailability-start').fill('10:00');
    await page.getByTestId('unavailability-end').fill('09:00');
    await page.getByTestId('unavailability-add').click();
    await expect(page.getByTestId('unavailability-problem')).toBeVisible();
    await page.getByTestId('unavailability-save').click();
    await expect(page.getByTestId('unavailability-dialog')).toHaveCount(0);
    await expect(page.getByTestId(`unavailability-registration-${target}`)).toContainText('(1)');

    const items = await (await request.get(`/api/admin/tournaments/${seeded.tournament_id}/registrations/${target}/unavailability`)).json();
    expect(items.items).toHaveLength(1);
    const blockedDate = items.items[0].date;

    await goToTab(page, 'cronograma');
    await page.getByTestId('sidebar-tab-distribute').click();
    await page.getByTestId('distribute-generate').click();
    await page.getByTestId('distribute-apply').click();
    await expect(page.getByTestId('summary-placed')).not.toContainText('Com horário: 0');

    const after = await getSchedule(request, seeded.tournament_id);
    const mine = after.matches.filter((m) => m.sides.some((s) => s.registration_id === target));
    const placed = mine.filter((m) => m.window);
    expect(placed.length).toBeGreaterThan(0);
    expect(placed.every((m) => m.window!.date !== blockedDate)).toBe(true);
    expect(after.conflicts).toEqual([]);
  });
});
