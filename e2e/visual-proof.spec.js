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
  await page.locator('.object-sidebar .sidebar-mode-tabs').getByRole('button', { name: /Bibliothek/ }).click();
  await page.locator('[data-asset-id="text-block"]').click();
  const placement = await canvasPoint(page, 7.5, 7.5); await page.mouse.click(placement.x, placement.y);
  await page.locator('.object-sidebar .sidebar-mode-tabs').getByRole('button', { name: /Szene/ }).click();
  await page.locator('.scene-tree .scene-node-main').filter({ hasText: 'Freier Textblock' }).click();
  await expect(page.getByLabel('Rahmen ausblenden')).toBeChecked();
  await page.locator('.object-inspector .effect-editor').getByRole('button', { name: '＋ Effekt' }).click();
  await page.locator('.edge-effect-editor').getByRole('button', { name: '＋ Rand-Effekt' }).click();
  await page.locator('.edge-effect-card select').first().selectOption('fish');
  await page.locator('.object-inspector').getByLabel('Text', { exact: true }).fill('ILZ · Franz & Lola gehen mit Gutti nach Passau');
  await page.locator('.object-inspector').getByLabel('Text', { exact: true }).blur();
  await page.getByLabel('Hintergrund transparent').check();
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

test('Mehrere Entwürfe lassen sich gemeinsam zur Veröffentlichung auswählen @visual', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.route('https://franz-lola-publisher.test.workers.dev/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4191', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path === '/api/me') return route.fulfill({ headers, json: { login: 'freundin', name: 'Franz-Lola-Redaktion' } });
    if (path === '/api/publish') return route.fulfill({ status: 202, headers, json: { publicationId: 77, state: 'testing', phase: 'upload-complete', phaseLabel: 'Level sicher übertragen', progress: 22, detail: 'Zwei Level wurden sicher übertragen.' } });
    if (path === '/api/publications/77') return route.fulfill({ headers, json: { state: 'deploying', phase: 'deploy-build', phaseLabel: 'Spiel für GitHub Pages bauen', progress: 89, detail: 'Das optimierte Browser-Spiel wird gebaut.', checkedAt: '2026-08-05T18:00:00.000Z' } });
    return route.fulfill({ status: 404, headers, json: { error: 'Nicht gefunden.' } });
  });
  await page.goto('/#publisher_session=visual.session');
  await expect(page.locator('#level-canvas')).toBeVisible();
  await loadTemplate(page, 'home'); await page.waitForTimeout(250);
  await loadTemplate(page, 'hals'); await page.waitForTimeout(250);
  await page.locator('[data-workspace="publish"]').click();
  await expect(page.locator('.publish-candidate')).toHaveCount(2);
  await page.getByRole('button', { name: 'Alle spielbaren' }).click();
  await expect(page.locator('.publish-candidate input:checked')).toHaveCount(2);
  await page.locator('#publisher-confirm').click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '89');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'output/playwright/publisher-live-progress.png' });
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
  await page.getByRole('button', { name: '⬚ Auswählen' }).click();
  await page.locator('.pixel-grid button[data-x="0"][data-y="0"]').click();
  await page.locator('.pixel-grid button[data-x="1"][data-y="0"]').click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'Farbe anwenden' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'output/playwright/pixel-multiselect.png' });
});

test('Alle neun Level-Ereignisse sind im UI erreichbar @visual', async ({ page }) => {
  await openCleanEditor(page);
  test.setTimeout(150_000);
  for (const [id, eventName] of stories) {
    await loadTemplate(page, id);
    await page.locator('[data-workspace="events"]').click();
    await page.locator('.event-browser button').filter({ hasText: eventName }).click({ force: true });
    await expect(page.locator('.event-message-preview')).toContainText(eventName);
    await page.waitForTimeout(280);
  }
  await page.screenshot({ path: 'output/playwright/ereignisse-alle-level.png' });
});

test('Alle neun angepassten Cutscenes spielen in steigender Komplexität @visual', async ({ page }) => {
  await openCleanEditor(page);
  test.setTimeout(150_000);
  for (const [id, , playhead] of stories) {
    await loadTemplate(page, id);
    await page.locator('[data-workspace="cutscenes"]').click();
    await page.locator('.cutscene-transport input').fill(String(playhead));
    await page.locator('.cutscene-transport button').click();
    await page.waitForTimeout(420);
  }
  await page.screenshot({ path: 'output/playwright/cutscenes-alle-level.png' });
});

test('Individuelle Wandstile und saubere Glitch-Effekte sind direkt sichtbar @visual', async ({ page }) => {
  await openCleanEditor(page);
  await loadTemplate(page, 'hals');
  await page.locator('[data-workspace="level"]').click();
  await page.locator('[data-tool="select"]').click();
  const wall = await canvasPoint(page, 3, 3);
  await page.mouse.click(wall.x, wall.y);
  await page.getByLabel('Wand Muster').selectOption('brick');
  await page.getByLabel('Themefarbe für Wand').uncheck();
  await page.getByLabel('Wand Eigenfarbe').fill('#a14f3f');
  await page.locator('.wall-instance-inspector .effect-editor').getByRole('button', { name: '＋ Effekt' }).click();
  await expect(page.locator('.wall-instance-inspector [data-effect-type="glitch"]')).toHaveCount(1);
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'output/playwright/wand-instanz-glitch-sauber.png' });

  await loadTemplate(page, 'zauberberg');
  await page.locator('[data-workspace="objects"]').click();
  await page.locator('.object-sidebar .sidebar-mode-tabs').getByRole('button', { name: /Szene/ }).click();
  await expect(page.locator('[data-scene-key="decoration:zauberberg-note-frei"]')).toBeVisible();
  await expect(page.locator('[data-scene-key="decoration:zauberberg-buehnen-note"]')).toBeVisible();
  await expect(page.locator('[data-scene-key="theme-element:stage-note"]')).toHaveCount(0);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'output/playwright/zauberberg-editierbare-elemente.png' });
});