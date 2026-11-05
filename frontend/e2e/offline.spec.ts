import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

/**
 * Mode hors ligne et assistant, sur un build de production (service worker actif).
 * Comptes créés pour le test (@example.test, supprimés par `pnpm db:demo-reset`).
 * Les réponses de l'IA sont simulées : le test n'appelle jamais OpenAI.
 */
const PASSWORD = 'Motdepasse2026';

async function register(browser: Browser, role: 'MENTOR' | 'MENTEE') {
  const context = await browser.newContext({ locale: 'fr-FR', timezoneId: 'Africa/Conakry' });
  const page = await context.newPage();
  const email = `${role.toLowerCase()}-${randomUUID().slice(0, 8)}@example.test`;
  const api = context.request;
  const ok = async (r: Awaited<ReturnType<APIRequestContext['post']>>) => {
    expect(r.ok(), await r.text()).toBe(true);
    return r.json();
  };
  await ok(
    await api.post('/api/v1/auth/register', {
      data: { email, password: PASSWORD, firstName: 'Test', lastName: role, role },
    }),
  );
  const domains = await (await api.get('/api/v1/domains')).json();
  const domainId = domains.find((d: { slug: string }) => d.slug === 'numerique-technologies').id;
  if (role === 'MENTOR') {
    const r = await api.put('/api/v1/profile/mentor', {
      data: {
        headline: 'Mentor de test en développement web',
        bio: 'Profil créé par le test du mode hors ligne : il permet de vérifier la relecture des conversations et la file d’envoi des messages.',
        yearsExperience: 5,
        expertise: ['Développement web'],
        languages: ['Français'],
        modalities: ['REMOTE'],
        domainIds: [domainId],
        sessionDurationMin: 60,
      },
    });
    expect(r.ok()).toBe(true);
  } else {
    const r = await api.put('/api/v1/profile/mentee', {
      data: {
        situation: 'STUDENT',
        goalsSummary: 'Je souhaite progresser en développement web et trouver un stage.',
        desiredSkills: ['React'],
        preferredModality: 'REMOTE',
        interestDomainIds: [domainId],
      },
    });
    expect(r.ok()).toBe(true);
  }
  const me = (await (await api.get('/api/v1/auth/me')).json()) as { id: string };
  return { page, context, api, ok, id: me.id };
}

async function pair(browser: Browser) {
  const mentor = await register(browser, 'MENTOR');
  const mentee = await register(browser, 'MENTEE');
  const request = (await mentee.ok(
    await mentee.api.post('/api/v1/mentorship-requests', {
      data: {
        mentorId: mentor.id,
        goal: 'Construire un portfolio professionnel',
        message: 'Bonjour, je souhaite être accompagné pour structurer mon apprentissage du web.',
      },
    }),
  )) as { id: string };
  const accepted = (await mentor.ok(
    await mentor.api.post(`/api/v1/mentorship-requests/${request.id}/accept`, { data: {} }),
  )) as { mentorship: { id: string } };
  const mentorshipId = accepted.mentorship.id;
  await mentor.ok(
    await mentor.api.post(`/api/v1/mentorships/${mentorshipId}/messages`, {
      data: { content: 'Bienvenue, parlons de votre portfolio.' },
    }),
  );
  return { mentor, mentee, mentorshipId };
}

/** Attend que le service worker contrôle la page et que le cache soit écrit sur l'appareil. */
async function waitOfflineReady(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((r) =>
        navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }),
      );
    }
  });
  // Préchargement différé de 4 s, écriture du cache limitée à une fois toutes les 2 s.
  await page.waitForTimeout(9_000);
}

const welcome = (page: Page) =>
  page.getByRole('log').getByText('Bienvenue, parlons de votre portfolio.');

// Ordre fixe, mêmes comptes : le dernier test se déconnecte (et l'inscription est limitée par IP).
test.describe.configure({ mode: 'serial' });
let accounts: Awaited<ReturnType<typeof pair>>;
const pageErrors: string[] = [];

test.beforeAll(async ({ browser }) => {
  accounts = await pair(browser);
  accounts.mentee.page.on('pageerror', (e) => pageErrors.push(e.message.slice(0, 200)));
});
test.afterAll(async () => {
  expect(pageErrors, 'aucune erreur JavaScript ni d’hydratation').toEqual([]);
  await accounts.mentor.context.close();
  await accounts.mentee.context.close();
});

test('économie de données : photos masquées et actualisation espacée', async () => {
  const { mentee } = accounts;
  const page = mentee.page;
  await page.goto('/compte?section=donnees');
  await page.getByLabel('Économie de données').selectOption('on');
  await expect(page.getByText('Active en ce moment')).toBeVisible();
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-saver', '');
  const heroVisible = await page.locator('img.photo').first().isVisible();
  expect(heroVisible).toBe(false);

  await page.goto('/messages');
  await page.getByLabel('Votre message').waitFor();
  let polls = 0;
  page.on('request', (r) => {
    if (/\/messages\?limit=100/.test(r.url())) polls += 1;
  });
  await page.waitForTimeout(13_000);
  expect(polls).toBeLessThanOrEqual(1); // 4 s normalement, 30 s ici
  await page.goto('/compte?section=donnees');
  await page.getByLabel('Économie de données').selectOption('off');
});

test('assistant IA : orientation, explication et parcours validé (réponses simulées)', async () => {
  const { mentor, mentee, mentorshipId } = accounts;
  const page = mentee.page;
  await page.route('**/api/v1/ai/status', (r) =>
    r.fulfill({ json: { enabled: true, remainingToday: 30 } }),
  );
  await page.route('**/api/v1/ai/orientation', (r) =>
    r.fulfill({
      json: {
        summary: 'Vous voulez travailler dans le web.',
        domains: [
          {
            id: 'x',
            slug: 'numerique-technologies',
            name: 'Numérique et technologies',
            reason: 'Le développement web en fait partie.',
          },
        ],
        skills: ['React'],
      },
    }),
  );
  await page.route('**/api/v1/ai/mentorships/*/path-proposal', (r) =>
    r.fulfill({
      json: {
        goals: [
          {
            title: 'Publier trois projets',
            description: 'Montrer son travail.',
            milestones: ['Choisir les projets', 'Mettre en ligne'],
          },
          { title: 'Objectif écarté', description: '', milestones: ['Étape'] },
        ],
      },
    }),
  );

  await page.goto('/mentors');
  await page.getByRole('button', { name: /Vous ne savez pas par où commencer/ }).click();
  await page
    .getByLabel('Votre besoin')
    .fill('Je finis ma licence et je veux travailler dans le web.');
  await page.getByRole('button', { name: 'M’orienter' }).click();
  await expect(page.getByText('Vous voulez travailler dans le web.')).toBeVisible();
  await page.getByRole('button', { name: 'Voir les mentors' }).click();
  await expect(page).toHaveURL(/domain=numerique-technologies/);

  await page.goto(`/mentorats/${mentorshipId}`);
  await page.getByRole('tab', { name: /Objectifs/ }).click();
  await page.getByRole('button', { name: 'Proposer avec l’IA' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Générer une proposition' }).click();
  await dialog.getByRole('checkbox', { name: 'Objectif écarté' }).click();
  await dialog.getByRole('button', { name: /Ajouter l’objectif/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('Publier trois projets').first()).toBeVisible();
  const goals = await (await mentor.api.get(`/api/v1/mentorships/${mentorshipId}/goals`)).json();
  expect(goals.map((g: { title: string }) => g.title)).toEqual(['Publier trois projets']);
  await page.route('**/api/v1/ai/mentors/*/explanation', (r) =>
    r.fulfill({
      json: {
        score: 60,
        reasons: ['Domaine correspondant'],
        text: 'Ce mentor couvre le web, votre priorité.',
        source: 'ai',
      },
    }),
  );
  await page.goto(`/mentors/${mentor.id}`);
  await page.getByRole('button', { name: 'Pourquoi ce mentor ?' }).click();
  await expect(page.getByText('Ce mentor couvre le web, votre priorité.')).toBeVisible();
  await page.unrouteAll();
});

test('relecture hors ligne, message différé, effacement à la déconnexion', async () => {
  const { mentor, mentee, mentorshipId } = accounts;
  const page = mentee.page;

  await page.goto('/messages');
  await expect(welcome(page)).toBeVisible();
  await waitOfflineReady(page);

  await test.step('sans réseau : la page et la conversation restent lisibles', async () => {
    await mentee.context.setOffline(true);
    await page.reload();
    await expect(welcome(page)).toBeVisible();
    await expect(page.getByTestId('bandeau-hors-ligne')).toContainText(/Hors ligne, données du/);
  });

  await test.step('sans réseau : espace de mentorat et séances, préchargés sans visite', async () => {
    await page.goto(`/mentorats/${mentorshipId}`);
    await expect(page.getByTestId('bandeau-hors-ligne')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Test MENTOR/ })).toBeVisible();
    await page.getByRole('tab', { name: /Objectifs/ }).click();
    await expect(page.getByText('Publier trois projets').first()).toBeVisible();
    await page.goto('/seances');
    await expect(page.getByTestId('bandeau-hors-ligne')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await page.goto('/mentors');
    await expect(page.getByRole('heading', { name: 'Vous êtes hors ligne' })).toBeVisible();
  });

  await test.step('un message écrit sans réseau attend, survit au rechargement, puis part', async () => {
    await page.goto('/messages');
    const box = page.getByLabel('Votre message');
    await box.fill('Écrit sans réseau');
    await box.press('Enter');
    await expect(page.getByText('En attente d’envoi', { exact: true })).toBeVisible();
    await expect(page.getByTestId('bandeau-hors-ligne')).toContainText('1 message en attente');
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.getByText('Écrit sans réseau')).toBeVisible();

    await mentee.context.setOffline(false);
    await expect(page.getByText('En attente d’envoi', { exact: true })).toBeHidden({
      timeout: 30_000,
    });
    await expect(page.getByTestId('bandeau-hors-ligne')).toBeHidden({ timeout: 30_000 });
    await expect
      .poll(async () => {
        const list = await (
          await mentor.api.get(`/api/v1/mentorships/${mentorshipId}/messages`)
        ).json();
        return list.filter((m: { content: string }) => m.content === 'Écrit sans réseau').length;
      })
      .toBe(1);
  });

  await test.step('la déconnexion efface les données de l’appareil', async () => {
    const stored = () =>
      page.evaluate(
        () =>
          new Promise<string[]>((resolve, reject) => {
            const open = indexedDB.open('talents-connectes');
            open.onerror = () => reject(open.error);
            open.onsuccess = () => {
              const tx = open.result.transaction('offline');
              const req = tx.objectStore('offline').get('query-cache');
              req.onsuccess = () => resolve(req.result ? [String(req.result)] : []);
            };
          }),
      );
    await expect.poll(async () => (await stored()).join('')).toContain('portfolio');
    await page.getByRole('button', { name: 'Menu du compte' }).click();
    await page.getByRole('menuitem', { name: 'Se déconnecter' }).click();
    await page.waitForURL(/\/($|connexion)/);
    await page.waitForTimeout(3_000);
    expect((await stored()).join('')).not.toContain('portfolio');

    await mentee.context.setOffline(true);
    await page.goto('/messages');
    await expect(welcome(page)).toBeHidden();
    await mentee.context.setOffline(false);
  });
});
