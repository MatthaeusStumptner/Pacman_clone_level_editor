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

async function canvasPoint(page, x, y) {
  const box = await page.locator('#level-canvas').boundingBox();
  if (!box) throw new Error('Canvas besitzt keine sichtbare Bounding Box.');
  return { x: box.x + (x / 25) * box.width, y: box.y + (y / 25) * box.height };
}

test('Textblock bleibt bei Retina-Auflösung scharf und frei transformierbar @visual', async ({ page }) => {
  await openCleanEditor(page);
  await page.locator('[data-workspace="objects"]').click();
  await page.locator('[data-asset-id="text-block"]').click();
  const placement = await canvasPoint(page, 7.5, 7.5); await page.mouse.click(placement.x, placement.y);
  await page.locator('.placed-object-strip button').filter({ hasText: 'Freier Textblock' }).click();
  await page.locator('.object-inspector').getByLabel('Text', { exact: true }).fill('ILZ · Franz & Lola gehen mit Gutti nach Passau');
  await page.locator('.object-inspector').getByLabel('Text', { exact: true }).blur();
  await page.locator('[data-tool="transform"]').click();
  const moveFrom = await canvasPoint(page, 10, 8.5); const moveTo = await canvasPoint(page, 12.1, 10.35);
  await page.mouse.move(moveFrom.x, moveFrom.y); await page.mouse.down(); await page.mouse.move(moveTo.x, moveTo.y, { steps: 10 }); await page.mouse.up();
  const x = Number(await page.locator('.object-inspector').getByLabel('X', { exact: true }).inputValue());
  const y = Number(await page.locator('.object-inspector').getByLabel('Y', { exact: true }).inputValue());
  const width = Number(await page.locator('.object-inspector').getByLabel('Breite').inputValue());
  const height = Number(await page.locator('.object-inspector').getByLabel('Höhe').inputValue());
  const scaleFrom = await canvasPoint(page, x + width, y + height); const scaleTo = await canvasPoint(page, x + width + 2, y + height + 1);
  await page.mouse.move(scaleFrom.x, scaleFrom.y); await page.mouse.down(); await page.mouse.move(scaleTo.x, scaleTo.y, { steps: 10 }); await page.mouse.up();
  const density = await page.locator('#level-canvas').evaluate((canvas) => canvas.width / canvas.getBoundingClientRect().width);
  expect(density).toBeGreaterThanOrEqual(1.9);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'output/playwright/textblock-retina-transform.png' });
});

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
