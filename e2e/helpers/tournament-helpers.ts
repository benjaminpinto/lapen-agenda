import {APIRequestContext, expect, Page} from '@playwright/test';

// The fixture endpoints (/api/test/*) can create admin users, so they need a shared secret on both sides:
// E2E_TEST_SECRET in the server environment and the same value here. Without it the tournament specs skip themselves.
export const E2E_SECRET = process.env.E2E_TEST_SECRET;
const secretHeaders = { 'X-Test-Secret': E2E_SECRET ?? '' };

export type TestAdmin = { id: number; email: string; password: string };
export type SeedState =
  | 'registration_open' | 'before_draw' | 'before_schedule' | 'groups_in_progress' | 'tie_pending' | 'knockout_in_progress' | 'finished';

export async function cleanupTournamentData(request: APIRequestContext) {
  const response = await request.delete('/api/test/tournaments/cleanup', { headers: secretHeaders });
  expect(response.ok(), 'cleanup needs a valid E2E_TEST_SECRET').toBeTruthy();
}

export async function createTestAdmin(request: APIRequestContext, label = 'e2e-admin'): Promise<TestAdmin> {
  const response = await request.post('/api/test/users', { headers: secretHeaders, data: { label, is_admin: true } });
  expect(response.status()).toBe(201);
  return response.json();
}

export async function seedTournament(request: APIRequestContext, state: SeedState, slug?: string) {
  const response = await request.post('/api/test/tournaments/seed', { headers: secretHeaders, data: { state, slug } });
  expect(response.status(), await response.text()).toBe(201);
  return response.json() as Promise<{ tournament_id: number; slug: string; categories: { id: number; name: string }[] }>;
}

/** Sign sign-ups through the public API, each from its own address (the limiter is per IP). */
export async function signUp(request: APIRequestContext, slug: string, categoryId: number, count: number, from = 1) {
  for (let n = from; n < from + count; n++) {
    const response = await request.post(`/api/tournaments/${slug}/registrations`, {
      headers: { 'X-Forwarded-For': `198.51.100.${n}` },
      data: {
        category_id: categoryId, full_name: `Jogador Teste ${n}`, display_name: `Jogador ${n}`,
        email: `jogador${n}@e2e-signup.example`, phone: `2499999${String(n).padStart(4, '0')}`,
        accepted_terms: true, data_consent: true,
      },
    });
    expect(response.status(), await response.text()).toBe(201);
  }
}

export async function loginAsAdmin(page: Page, admin: TestAdmin) {
  await page.goto('/login');
  await page.fill('input[type="email"]', admin.email);
  await page.fill('input[type="password"]', admin.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/');
  await page.goto('/admin');
  await page.waitForURL('**/admin/dashboard');
}

/** The admin area keeps its state in memory, so a page reload sends you back to the dashboard: navigate by clicking. */
export async function openTournamentsList(page: Page) {
  await page.getByTestId('dashboard-tournaments-card').click();
  await expect(page.getByTestId('admin-tournaments')).toBeVisible();
}

export async function openTournament(page: Page, slug: string) {
  await openTournamentsList(page);
  await page.getByTestId(`tournament-card-${slug}`).click();
  await expect(page.getByTestId('admin-tournament-detail')).toBeVisible();
}

export async function goToTab(page: Page, tab: 'dados' | 'categorias' | 'inscricoes' | 'sorteio' | 'partidas') {
  await page.getByTestId(`tab-${tab}`).click();
}

/**
 * JavaScript errors raised after this call (the rest of the app has its own noise, so tests start listening late).
 * "Failed to load resource" is the browser logging an HTTP error status: the specs provoke some on purpose (a refused
 * action, an invalid score) and assert the message the screen shows, so those are not errors here.
 */
export function collectConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(`PAGEERROR ${error.message}`));
  return errors;
}

/** Log in as the test admin on a request context (the session cookie stays on it) for setup the screens cannot do. */
export async function adminSession(request: APIRequestContext, admin: TestAdmin) {
  const response = await request.post('/api/auth/login', { data: { email: admin.email, password: admin.password } });
  expect(response.ok(), await response.text()).toBeTruthy();
}

/** Cap a category at `max` confirmed entries, so the next sign-up lands on the waiting list. */
export async function capCategory(request: APIRequestContext, admin: TestAdmin, tournamentId: number, categoryId: number, max: number) {
  await adminSession(request, admin);
  const response = await request.put(`/api/admin/tournaments/${tournamentId}/categories/${categoryId}`, { data: { max_entries: max } });
  expect(response.ok(), await response.text()).toBeTruthy();
}

export async function countRegistrations(request: APIRequestContext, admin: TestAdmin, tournamentId: number) {
  await adminSession(request, admin);
  const response = await request.get(`/api/admin/tournaments/${tournamentId}/registrations`);
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = await response.json();
  return (Array.isArray(body) ? body : body.registrations).length as number;
}

/** What the seed plants as private (notes, e-mail domain, phone prefix, ip hash): none of it may reach a public page. */
export async function expectNoPrivateData(page: Page) {
  const html = await page.content();
  expect(html).not.toMatch(/NOTA-PRIVADA|seed\.example\.test|2499999|seed-ip-hash/);
}

// --- schedule helpers: set things up through the API so the specs can spend their time on the screen ----------------

export type ScheduleMatch = {
  id: number; category_id: number; category_name: string; stage: string; status: string; locked: boolean; people: number[];
  window: { court_id: number; date: string; time: string } | null; sides: { registration_id: number | null; name: string }[];
};
export type Schedule = {
  tournament: { start_date: string; end_date: string };
  courts: { id: number; name: string }[];
  windows: { court_id: number; date: string; time: string; blocked: boolean }[];
  matches: ScheduleMatch[]; conflicts: { kind: string; severity: string }[];
  summary: { pending: number; placed: number; unplaced: number; free_windows: number };
};

const dayAfter = (start: string, days: number) => {
  const [y, m, d] = start.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export async function getSchedule(request: APIRequestContext, tournamentId: number): Promise<Schedule> {
  const response = await request.get(`/api/admin/tournaments/${tournamentId}/schedule`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

/** One session per offset (0 = first day of the tournament), 08:00-17:00 on every active court. */
export async function addSessions(request: APIRequestContext, admin: TestAdmin, tournamentId: number, offsets: number[]) {
  await adminSession(request, admin);
  const schedule = await getSchedule(request, tournamentId);
  for (const offset of offsets) {
    const response = await request.post(`/api/admin/tournaments/${tournamentId}/schedule/sessions`, {
      data: { date: dayAfter(schedule.tournament.start_date, offset), start: '08:00', end: '17:00', court_ids: schedule.courts.map((c) => c.id) },
    });
    expect(response.status(), await response.text()).toBe(201);
  }
  return getSchedule(request, tournamentId);
}

export async function placeMatch(request: APIRequestContext, tournamentId: number, matchId: number, window: { court_id: number; date: string; time: string }) {
  const response = await request.post(`/api/admin/tournaments/${tournamentId}/schedule/place`, { data: { match_id: matchId, ...window } });
  expect(response.status(), await response.text()).toBe(200);
}

/** Two group matches that share a player (placing them close together breaks the rest rule). */
export function matchesSharingAPlayer(matches: ScheduleMatch[]) {
  const groups = matches.filter((m) => m.stage === 'group' && m.status === 'pending');
  for (const first of groups) {
    const second = groups.find((m) => m.id > first.id && m.category_id === first.category_id && m.people.some((p) => first.people.includes(p)));
    if (second) return [first, second] as const;
  }
  throw new Error('no two matches share a player');
}

/** Two group matches with no player in common. */
export function disjointMatches(matches: ScheduleMatch[], count = 2) {
  const picked: ScheduleMatch[] = [];
  for (const m of matches.filter((x) => x.stage === 'group' && x.status === 'pending')) {
    if (picked.every((p) => !p.people.some((person) => m.people.includes(person)))) picked.push(m);
    if (picked.length === count) return picked;
  }
  throw new Error('not enough disjoint matches');
}

export const windowAt = (schedule: Schedule, dayIndex: number, time: string, courtIndex = 0) => {
  const date = dayAfter(schedule.tournament.start_date, dayIndex);
  return { court_id: schedule.courts[courtIndex].id, date, time };
};
