import { test, expect } from '@playwright/test';

const stories = [
  ['home', 'Geburtstagspost', 2], ['hals', 'Das Rauschen der Ilz', 2.6], ['oberhaus', 'Goldener Passau-Blick', 2.5],
  ['dom', 'Der große Orgelakkord', 2.8], ['dreifluesseeck', 'Dreiklang der Flüsse', 3.2], ['uni', 'Das Prüfungs-Gutti', 2.1],
  ['bschuett', 'Lolas Superstöckchen', 2.4], ['tabakfabrik', 'Das alte Dampfzeichen', 2.9], ['zauberberg', 'Zauberberg-Zugabe', 3.6],
];

async function openCleanEditor(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(150);
  if (!await page.locator('#level-canvas').count()) throw new Error(`Editor konnte nicht starten: ${errors.join(' | ') || 'keine Page-Error-Meldung'}`);
  await expect(page.locator('#level-canvas')).toBeVisible();
}

async function loadTemplate(page, id) {
  await page.locator('.brand:visible, .mobile-project-button:visible').first().click();
  await page.locator(`[data-template-id="${id}"]`).click();
  await expect(page.locator('.document-identity')).toHaveAttribute('data-level-id', id);
}

test('Figuren werden wie im Spiel gerendert @visual', async ({ page }) => {
  await openCleanEditor(page);
  await loadTemplate(page, 'home');
  await page.locator('[data-workspace="characters"]').click();
  await page.waitForTimeout(500);
  for (const name of ['Katze 1', 'Katze 2', 'Katze 3', 'Franz & Lola']) {
    await page.locator('.actor-browser button').filter({ hasText: name }).click();
    await page.waitForTimeout(300);
  }
  await page.getByRole('button', { name: /Sprite-Sheet öffnen/ }).click();
  for (const state of ['idle', 'up', 'right', 'down', 'left']) {
    await page.locator('.state-tabs button').filter({ hasText: state }).click();
    await page.waitForTimeout(280);
  }
  await page.getByRole('button', { name: '▶ Playback' }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'output/playwright/figuren-renderer.png' });
});

test('Alle neun Level-Ereignisse sind im UI erreichbar @visual', async ({ page }) => {
  await openCleanEditor(page);
  for (const [id, eventName] of stories) {
    await loadTemplate(page, id);
    await page.locator('[data-workspace="events"]').click();
    await page.locator('.event-browser button').filter({ hasText: eventName }).click();
    await expect(page.locator('.event-message-preview')).toContainText(eventName);
    await page.waitForTimeout(280);
  }
  await page.screenshot({ path: 'output/playwright/ereignisse-alle-level.png' });
});

test('Alle neun angepassten Cutscenes spielen in steigender Komplexität @visual', async ({ page }) => {
  await openCleanEditor(page);
  for (const [id, , playhead] of stories) {
    await loadTemplate(page, id);
    await page.locator('[data-workspace="cutscenes"]').click();
    await page.locator('.cutscene-transport input').fill(String(playhead));
    await page.locator('.cutscene-transport button').click();
    await page.waitForTimeout(420);
    if (await page.locator('.cutscene-transport button').getAttribute('class')) await page.locator('.cutscene-transport button').click();
  }
  await page.screenshot({ path: 'output/playwright/cutscenes-alle-level.png' });
});
