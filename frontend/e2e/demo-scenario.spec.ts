import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Scénario de démonstration du jury, rejoué de bout en bout avec deux navigateurs :
 * Aminata (mentorée) trouve Fatoumata (mentore), est acceptée, réserve une séance que
 * Fatoumata confirme, elles échangent, puis suivent un objectif et un parcours guidé.
 */
const PASSWORD = 'Mentorat2026!';
const AMINATA = 'aminata@demo.talents-connectes.test';
const FATOUMATA = 'fatoumata@demo.talents-connectes.test';

async function loginAs(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/connexion');
  // Attendre l'hydratation : sinon le formulaire est soumis nativement (premier rendu en dev).
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Adresse email').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(PASSWORD);
  await expect(page.getByLabel('Adresse email')).toHaveValue(email);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/tableau-de-bord/);
  return page;
}

test('parcours complet : demande, acceptation, séance, conversation et objectifs', async ({
  browser,
}) => {
  const aminata = await loginAs(browser, AMINATA);
  const fatoumata = await loginAs(browser, FATOUMATA);

  await test.step('Aminata trouve Fatoumata (recherche sans accent)', async () => {
    await aminata.goto('/mentors');
    await aminata.getByPlaceholder('Compétence, métier, nom…').fill('developpement web');
    await aminata
      .getByRole('link', { name: /Fatoumata Camara/ })
      .first()
      .click();
    await expect(aminata).toHaveURL(/\/mentors\/[^/]+$/);
  });

  await test.step('Aminata envoie une demande motivée', async () => {
    await aminata.getByRole('button', { name: 'Demander un accompagnement' }).click();
    const dialog = aminata.getByRole('dialog');
    await dialog.getByLabel('Votre objectif').fill('Devenir développeuse web junior');
    await dialog
      .getByLabel('Votre message')
      .fill(
        'Bonjour Fatoumata, je termine ma licence et je veux structurer mon portfolio pour décrocher un premier poste.',
      );
    await dialog.getByRole('button', { name: 'Envoyer la demande' }).click();
    await expect(aminata.getByRole('link', { name: 'Suivre ma demande' })).toBeVisible();
  });

  await test.step('Fatoumata accepte la demande', async () => {
    await fatoumata.goto('/demandes');
    await expect(fatoumata.getByText('Devenir développeuse web junior')).toBeVisible();
    // Après la remise à zéro, la demande d'Aminata est la seule en attente.
    await fatoumata.getByRole('button', { name: 'Accepter' }).first().click();
    await fatoumata.getByRole('dialog').getByRole('button', { name: 'Accepter' }).click();
    await expect(fatoumata.getByText(/Vous accompagnez désormais/)).toBeVisible();
  });

  let workspaceUrl = '';
  await test.step('Aminata ouvre l’espace de mentorat et réserve un créneau', async () => {
    await aminata.reload();
    await aminata.getByRole('link', { name: 'Ouvrir l’espace de mentorat' }).click();
    await expect(aminata).toHaveURL(/\/mentorats\/[^/]+$/);
    workspaceUrl = new URL(aminata.url()).pathname;

    await aminata.getByRole('tab', { name: 'Séances' }).click();
    await aminata.getByRole('button', { name: 'Réserver une séance' }).first().click();
    const dialog = aminata.getByRole('dialog');
    await dialog.getByRole('radio').first().click();
    await dialog.getByLabel('Sujet de la séance').fill('Revue de mon portfolio');
    await dialog.getByRole('button', { name: /^Réserver à/ }).click();
    await expect(dialog).toBeHidden();
  });

  await test.step('Fatoumata confirme : une salle de visio est générée', async () => {
    await fatoumata.goto('/seances');
    const card = fatoumata.locator('article', { hasText: 'Revue de mon portfolio' }).first();
    await card.getByRole('button', { name: 'Confirmer' }).click();
    await fatoumata
      .getByRole('dialog')
      .getByRole('button', { name: 'Confirmer la séance' })
      .click();
    await expect(card.getByRole('link', { name: /Salle de visio/ })).toBeVisible();
  });

  await test.step('Elles échangent dans la conversation privée', async () => {
    await aminata.goto(workspaceUrl);
    const input = aminata.getByPlaceholder('Écrire à Fatoumata…');
    await input.fill('Merci pour votre acceptation !');
    await input.press('Enter');
    await expect(aminata.getByText('Merci pour votre acceptation !')).toBeVisible();

    await fatoumata.goto(workspaceUrl);
    await expect(fatoumata.getByText('Merci pour votre acceptation !')).toBeVisible();
    const reply = fatoumata.getByPlaceholder('Écrire à Aminata…');
    await reply.fill('Avec plaisir, à bientôt pour la séance.');
    await reply.press('Enter');
    await expect(aminata.getByText('Avec plaisir, à bientôt pour la séance.')).toBeVisible();
  });

  await test.step('Aminata crée un objectif découpé en trois jalons', async () => {
    await aminata.getByRole('tab', { name: 'Objectifs' }).click();
    await aminata.getByRole('button', { name: 'Créer un objectif' }).click();
    const dialog = aminata.getByRole('dialog');
    await dialog.getByLabel('Objectif', { exact: true }).fill('Publier mon portfolio');
    const steps = ['Choisir trois projets', 'Rédiger les descriptions', 'Mettre en ligne'];
    for (const [i, step] of steps.entries()) {
      if (i > 0) await dialog.getByRole('button', { name: 'Ajouter un jalon' }).click();
      await dialog.getByRole('textbox', { name: `Jalon ${i + 1}`, exact: true }).fill(step);
    }
    await dialog.getByRole('button', { name: 'Créer l’objectif' }).click();
    await expect(aminata.getByRole('heading', { name: 'Publier mon portfolio' })).toBeVisible();
  });

  await test.step('Fatoumata coche un jalon (33 %) et écrit un retour', async () => {
    await fatoumata.reload();
    await fatoumata.getByRole('tab', { name: 'Objectifs' }).click();
    // L'état coché vient de la réponse de l'API (pas de mise à jour optimiste) : on attend la progression.
    await fatoumata.getByRole('checkbox', { name: 'Choisir trois projets' }).click();
    await expect(
      fatoumata.getByRole('tabpanel', { name: 'Objectifs' }).getByText('33 %'),
    ).toBeVisible();
    await fatoumata.getByRole('button', { name: 'Écrire' }).click();
    await fatoumata
      .getByLabel('Retour du mentor')
      .fill('Très bon choix de projets, détaillez le contexte de chacun.');
    await fatoumata.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(
      fatoumata.getByText('Très bon choix de projets, détaillez le contexte de chacun.'),
    ).toBeVisible();
  });

  await test.step('Aminata ajoute un parcours guidé', async () => {
    await aminata.reload();
    await aminata.getByRole('tab', { name: 'Objectifs' }).click();
    await aminata.getByRole('button', { name: 'Parcours guidé' }).click();
    const dialog = aminata.getByRole('dialog');
    await expect(dialog.getByRole('radiogroup', { name: 'Parcours' })).toBeVisible();
    await dialog.getByRole('button', { name: /^Ajouter/ }).click();
    await expect(dialog).toBeHidden();
    await expect(aminata.getByText(/objectifs? ajoutés? au mentorat/)).toBeVisible();
  });
});
