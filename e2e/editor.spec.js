import { test, expect } from '@playwright/test';

async function openCleanEditor(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(150);
  if (!await page.locator('#level-canvas').count()) throw new Error(`Editor konnte nicht starten: ${errors.join(' | ') || 'keine Page-Error-Meldung'}`);
  await expect(page.locator('#level-canvas')).toBeVisible();
  return errors;
}

async function openProject(page) {
  const button = page.locator('.brand:visible, .mobile-project-button:visible').first();
  await button.click();
  await expect(page.locator('#project-drawer')).toBeInViewport();
}

async function loadTemplate(page, id) {
  await openProject(page);
  await page.locator(`[data-template-id="${id}"]`).click();
  await expect(page.locator('.document-identity')).toHaveAttribute('data-level-id', id);
}

async function canvasHasVisiblePixels(locator) {
  return locator.evaluate((canvas) => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) return true;
    return false;
  });
}

async function canvasSignature(locator) {
  return locator.evaluate((canvas) => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let hash = 2166136261;
    for (let index = 0; index < pixels.length; index += 17) hash = Math.imul(hash ^ pixels[index], 16777619);
    return hash >>> 0;
  });
}

const storyCases = [
  { id: 'home', event: 'Geburtstagspost', eventCount: 3, cutscene: 'Aufbruch am Bramerhof', tracks: 4, keyframes: 8, duration: 4 },
  { id: 'hals', event: 'Das Rauschen der Ilz', eventCount: 2, cutscene: 'Entlang der Ilz', tracks: 4, keyframes: 10, duration: 5.2 },
  { id: 'oberhaus', event: 'Goldener Passau-Blick', eventCount: 2, cutscene: 'Hinauf zur Veste', tracks: 4, keyframes: 12, duration: 5 },
  { id: 'dom', event: 'Der große Orgelakkord', eventCount: 2, cutscene: 'Glocken über Passau', tracks: 4, keyframes: 12, duration: 5.6 },
  { id: 'dreifluesseeck', event: 'Dreiklang der Flüsse', eventCount: 2, cutscene: 'Drei Flüsse, eine Runde', tracks: 4, keyframes: 15, duration: 6.4 },
  { id: 'uni', event: 'Das Prüfungs-Gutti', eventCount: 1, cutscene: 'Kurze Vorlesung für Lola', tracks: 4, keyframes: 10, duration: 4.3 },
  { id: 'bschuett', event: 'Lolas Superstöckchen', eventCount: 3, cutscene: 'Runde durch den Bschüttpark', tracks: 4, keyframes: 10, duration: 4.8 },
  { id: 'tabakfabrik', event: 'Das alte Dampfzeichen', eventCount: 1, cutscene: 'Die Fabrik erwacht', tracks: 5, keyframes: 13, duration: 5.8 },
  { id: 'zauberberg', event: 'Zauberberg-Zugabe', eventCount: 1, cutscene: 'Soundcheck am Zauberberg', tracks: 6, keyframes: 23, duration: 7.2 },
];

async function canvasPoint(page, x, y) {
  const box = await page.locator('#level-canvas').boundingBox();
  if (!box) throw new Error('Canvas besitzt keine sichtbare Bounding Box.');
  return { x: box.x + ((x + 0.5) / 25) * box.width, y: box.y + ((y + 0.5) / 25) * box.height };
}

test('seven disciplines separate the work and all nine exact templates stay available', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await expect(page.locator('.discipline-nav [data-workspace]')).toHaveCount(7);
  await expect(page.locator('[data-workspace="level"]')).toContainText('Level');
  await expect(page.locator('[data-workspace="objects"]')).toContainText('Objekte');
  await expect(page.locator('[data-workspace="characters"]')).toContainText('Figuren');
  await expect(page.locator('[data-workspace="cutscenes"]')).toContainText('Cutscenes');
  await openProject(page);
  await expect(page.locator('[data-template-id]')).toHaveCount(9);
  await page.locator('.search-field input').fill('Zauberberg');
  await expect(page.locator('[data-template-id]')).toHaveCount(1);
  await page.locator('[data-template-id="zauberberg"]').click();
  await expect(page.locator('.validation-card')).toContainText('Level ist spielbar');
  expect(errors).toEqual([]);
});

test('one reactive document keeps drawing, history, autosave and reload synchronized', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await openProject(page);
  await page.getByRole('button', { name: /Neues Level/ }).click();
  await page.locator('#level-id').fill('meine-ilz-runde'); await page.locator('#level-id').blur();
  await page.locator('#level-name').fill('Meine Ilz-Runde'); await page.locator('#level-name').blur();
  await page.locator('[data-tool="rectangle"]').click();
  const start = await canvasPoint(page, 3, 3); const end = await canvasPoint(page, 5, 5);
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 4 }); await page.mouse.up();
  await expect(page.locator('.history-actions button').first()).toBeEnabled();
  await page.locator('.history-actions button').first().click();
  await expect(page.locator('.history-actions button').nth(1)).toBeEnabled();
  await page.locator('.history-actions button').nth(1).click();
  await expect(page.locator('.canvas-status strong')).toHaveText('GESPEICHERT');
  await page.waitForTimeout(250);
  await page.reload();
  await expect(page.locator('#level-id')).toHaveValue('meine-ilz-runde');
  await expect(page.locator('#level-name')).toHaveValue('Meine Ilz-Runde');
  expect(errors).toEqual([]);
});

test('the Zauberberg music note is selectable directly on canvas and remains editable', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await loadTemplate(page, 'zauberberg');
  await page.locator('[data-workspace="level"]').click();
  await page.locator('[data-tool="select"]').click();
  const note = await canvasPoint(page, 12, 7);
  await page.mouse.click(note.x, note.y);
  await expect(page.locator('[data-workspace="objects"]')).toHaveClass(/active/);
  await expect(page.locator('.object-inspector')).toContainText('Zauberberg-Note');
  await page.locator('.object-inspector').getByLabel('Animation').selectOption('spin');
  await page.locator('.object-inspector').getByLabel('Tempo').fill('2.5'); await page.locator('.object-inspector').getByLabel('Tempo').blur();
  await page.waitForTimeout(250); await page.reload();
  await page.locator('[data-workspace="objects"]').click();
  await page.locator('.placed-object-strip').getByRole('button', { name: 'Zauberberg-Note', exact: true }).click();
  await expect(page.locator('.object-inspector').getByLabel('Animation')).toHaveValue('spin');
  await expect(page.locator('.object-inspector').getByLabel('Tempo')).toHaveValue('2.5');
  expect(errors).toEqual([]);
});

test('universal objects can be created as pixel assets and placed into any map', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await page.locator('[data-workspace="objects"]').click();
  await page.locator('#create-object').click();
  await expect(page.locator('.sprite-studio')).toBeVisible();
  await page.locator('.pixel-grid button[data-x="0"][data-y="0"]').click();
  await page.getByRole('button', { name: '＋ Keyframe duplizieren' }).click();
  await page.getByRole('button', { name: 'Sprite übernehmen' }).click();
  await expect(page.locator('.asset-list')).toContainText('Eigenes Objekt');
  await loadTemplate(page, 'hals');
  await page.locator('[data-workspace="objects"]').click();
  await page.locator('[data-asset-id="music-note"]').click();
  const target = await canvasPoint(page, 2, 2); await page.mouse.click(target.x, target.y);
  await expect(page.locator('.placed-object-strip')).toContainText('Musiknote');
  await page.waitForTimeout(250); await page.reload(); await page.locator('[data-workspace="objects"]').click();
  await expect(page.locator('.placed-object-strip')).toContainText('Musiknote');
  await expect(page.locator('.asset-list')).toContainText('Eigenes Objekt');
  expect(errors).toEqual([]);
});

test('Franz and Lola use a five-state sprite-sheet and tile-map workflow', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await loadTemplate(page, 'home');
  await page.locator('[data-workspace="characters"]').click();
  await expect(page.locator('.actor-browser .actor-thumbnail')).toHaveCount(4);
  for (const preview of await page.locator('.actor-browser .actor-thumbnail').all()) expect(await canvasHasVisiblePixels(preview)).toBe(true);
  await expect(page.locator('.state-matrix > div')).toHaveCount(5);
  await expect(page.locator('.state-matrix .actor-thumbnail')).toHaveCount(5);
  for (const preview of await page.locator('.state-matrix .actor-thumbnail').all()) expect(await canvasHasVisiblePixels(preview)).toBe(true);
  await page.locator('.actor-browser button').filter({ hasText: 'Katze 1' }).click();
  await expect(page.locator('.character-hero .actor-thumbnail')).toHaveAttribute('data-actor-kind', 'cat');
  expect(await canvasHasVisiblePixels(page.locator('.character-hero .actor-thumbnail'))).toBe(true);
  await page.locator('.actor-browser button').filter({ hasText: 'Franz & Lola' }).click();
  await page.getByRole('button', { name: /Sprite-Sheet öffnen/ }).click();
  await expect(page.locator('.state-tabs button')).toHaveCount(5);
  const idleSignature = await canvasSignature(page.locator('.sprite-playback-stage .actor-thumbnail'));
  await page.locator('.state-tabs button').filter({ hasText: 'right' }).click();
  await expect(page.getByLabel('Verwendete Animation')).toHaveValue('right');
  await expect.poll(() => canvasSignature(page.locator('.sprite-playback-stage .actor-thumbnail'))).not.toBe(idleSignature);
  const before = await page.locator('.sheet-grid > button').count();
  await page.locator('.pixel-grid button[data-x="0"][data-y="0"]').click();
  await page.getByRole('button', { name: '＋ Keyframe duplizieren' }).click();
  await expect(page.locator('.sheet-grid > button')).toHaveCount(before + 1);
  await page.getByRole('button', { name: 'Sprite übernehmen' }).click();
  await expect(page.locator('.state-matrix')).toContainText('right');
  await page.waitForTimeout(250); await page.reload(); await page.locator('[data-workspace="characters"]').click();
  await expect(page.locator('.state-matrix')).toContainText('right');
  expect(errors).toEqual([]);
});

test('every level exposes its own event and differently authored cutscene through the UI', async ({ page }) => {
  test.setTimeout(60_000);
  const errors = await openCleanEditor(page);
  const signatures = [];
  for (const story of storyCases) {
    await loadTemplate(page, story.id);
    await page.locator('[data-workspace="events"]').click();
    await expect(page.locator('.event-browser button')).toHaveCount(story.eventCount);
    const eventButton = page.locator('.event-browser button').filter({ hasText: story.event });
    await expect(eventButton).toHaveCount(1);
    await eventButton.click();
    await expect(page.locator('.event-message-preview')).toContainText(story.event);
    await expect(page.locator('.property-panel').getByLabel('Meldung', { exact: true })).not.toHaveValue('');
    await expect(page.locator('.property-panel').getByLabel('Meldung im Dialekt')).not.toHaveValue('');
    await expect(page.locator('.property-panel').getByLabel('Objekt aus Bibliothek')).not.toHaveValue('');

    await page.locator('[data-workspace="cutscenes"]').click();
    await expect(page.locator('.cutscene-selector')).toContainText(story.cutscene);
    await expect(page.locator('.timeline-row')).toHaveCount(story.tracks);
    await expect(page.locator('.timeline-lane > button')).toHaveCount(story.keyframes);
    await expect(page.locator('.cutscene-transport input')).toHaveAttribute('max', String(story.duration));
    await expect.poll(() => canvasHasVisiblePixels(page.getByLabel('Cutscene-Vorschau'))).toBe(true);
    signatures.push(`${story.duration}:${story.tracks}:${story.keyframes}`);
  }
  expect(new Set(signatures).size).toBe(storyCases.length);
  expect(errors).toEqual([]);
});

test('level-bound cutscenes combine camera, actors, objects, dialogue and timeline preview', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await loadTemplate(page, 'zauberberg');
  await page.locator('[data-workspace="cutscenes"]').click();
  await expect(page.locator('.timeline-row')).toHaveCount(6);
  await expect(page.locator('.track-browser')).toContainText('note-solo');
  await expect(page.locator('.track-browser')).toContainText('rock-katze');
  await page.locator('.cutscene-transport input').evaluate((input) => { input.value = '3'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.locator('.dialogue-card')).toContainText('Rock, Punk und Metal');
  await page.locator('.cutscene-transport button').click();
  await page.waitForTimeout(250); await page.reload(); await page.locator('[data-workspace="cutscenes"]').click();
  await expect(page.locator('.timeline-row')).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('events keep triggers, both language variants and visual placement in one discipline', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await loadTemplate(page, 'home');
  await page.locator('[data-workspace="events"]').click();
  await expect(page.locator('.event-browser button')).toHaveCount(3);
  await expect(page.locator('.event-browser')).toContainText('Eisvogel an der Ilz');
  await expect(page.locator('.property-panel').getByLabel('Meldung', { exact: true })).toHaveValue('Donnerwetter, ein Eisvogel an der Ilz!');
  await expect(page.locator('.property-panel').getByLabel('Meldung im Dialekt')).toHaveValue('Sakradi, a Eisvogl an da Ilz!');
  await page.locator('#add-event').click();
  await page.locator('.property-panel').getByLabel('Name', { exact: true }).fill('Ilz-Fund'); await page.locator('.property-panel').getByLabel('Name', { exact: true }).blur();
  await page.getByRole('button', { name: /Zone im Canvas/ }).click();
  const start = await canvasPoint(page, 2, 2); const end = await canvasPoint(page, 4, 3);
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 3 }); await page.mouse.up();
  await expect(page.locator('.zone-list span')).toHaveCount(2);
  await page.getByRole('button', { name: /Symbol setzen/ }).click(); const visual = await canvasPoint(page, 6, 6); await page.mouse.click(visual.x, visual.y);
  await expect(page.locator('.property-panel').getByLabel('X', { exact: true })).toHaveValue('6.5');
  expect(errors).toEqual([]);
});

test('testplay runs the same intro, camera and direct controls as the game', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await page.locator('[data-workspace="cutscenes"]').click(); await page.locator('#add-cutscene').click();
  await page.locator('[data-workspace="playtest"]').click(); await page.locator('#start-playtest').click();
  await expect(page.locator('.playtest-top-overlay')).toContainText('CUTSCENE');
  await page.getByRole('button', { name: /Intro überspringen/ }).click();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => page.locator('#playtest-canvas').getAttribute('data-player-direction')).toBe('right');
  await page.locator('.playtest-hud').getByRole('button', { name: /Pause/ }).click();
  await expect(page.locator('.play-state')).toHaveText('PAUSE');
  await page.locator('.playtest-hud').getByRole('button', { name: /Weiter/ }).click();
  await page.locator('.playtest-hud').getByRole('button', { name: /Ende/ }).click();
  await expect(page.locator('.playtest-empty')).toBeVisible();
  expect(errors).toEqual([]);
});

test('authorized non-technical editors publish one validated level and see the live result', async ({ page }) => {
  const errors = []; const published = []; let checks = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://franz-lola-publisher.test.workers.dev/**', async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4187', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path === '/api/me') return route.fulfill({ headers, json: { login: 'freundin', name: 'Franz-Lola-Redaktion' } });
    if (path === '/api/publish') { published.push(request.postDataJSON().level); return route.fulfill({ status: 202, headers, json: { publicationId: 42 } }); }
    if (path === '/api/publications/42') { checks += 1; return route.fulfill({ headers, json: checks > 1 ? { state: 'published', detail: 'Das Level ist live.', gameUrl: 'https://matthaeusstumptner.github.io/Geburtstagsspiel/' } : { state: 'deploying', detail: 'Das Spiel wird veröffentlicht.' } }); }
    return route.fulfill({ status: 404, headers, json: { error: 'Nicht gefunden.' } });
  });
  await page.goto('/#publisher_session=test.session-token'); await expect(page.locator('#level-canvas')).toBeVisible();
  await loadTemplate(page, 'hals');
  await page.locator('[data-workspace="publish"]').click();
  await expect(page.locator('.publisher-user')).toContainText('Franz-Lola-Redaktion');
  await expect.poll(() => page.url()).not.toContain('publisher_session');
  await page.locator('#publisher-confirm').click();
  await expect(page.locator('.publish-state')).toContainText('Level ist live!', { timeout: 10_000 });
  expect(published).toHaveLength(1); expect(published[0].id).toBe('hals'); expect(errors).toEqual([]);
});

test('all visible controls have accessible names', async ({ page }) => {
  const errors = await openCleanEditor(page);
  const unnamed = await page.locator('button:visible, input:visible, select:visible, textarea:visible').evaluateAll((elements) => elements
    .filter((element) => !((element.getAttribute('aria-label') || element.getAttribute('title') || element.labels?.[0]?.textContent || element.textContent || '').trim()))
    .map((element) => `${element.tagName.toLowerCase()}#${element.id}`));
  expect(unnamed).toEqual([]);
  expect(errors).toEqual([]);
});

test('@mobile studio has no page overflow and keeps project, navigation and direct controls usable', async ({ page }) => {
  const errors = await openCleanEditor(page);
  const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: innerWidth }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.width + 1);
  await openProject(page); await expect(page.locator('[data-template-id]')).toHaveCount(9);
  await page.locator('[data-template-id="bschuett"]').click();
  await page.locator('[data-workspace="playtest"]').click(); await page.locator('#start-playtest').click();
  await page.getByRole('button', { name: /Intro überspringen/ }).click();
  await expect(page.locator('.mobile-dpad')).toBeVisible();
  await page.locator('.mobile-dpad button').first().tap();
  expect(errors).toEqual([]);
});

test('object previews show renderer output and text blocks stay freely editable', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await page.locator('[data-workspace="objects"]').click();
  await expect(page.locator('.asset-list .object-thumbnail')).toHaveCount(16);
  await expect(page.locator('[data-asset-id="music-note"] canvas')).toBeVisible();
  await expect(page.locator('[data-asset-id="zauberberg-note"] canvas')).toBeVisible();
  await page.locator('[data-asset-id="text-block"]').click();
  const target = await canvasPoint(page, 8, 8); await page.mouse.click(target.x, target.y);
  await page.locator('.placed-object-strip button').filter({ hasText: 'Freier Textblock' }).click();
  await page.locator('.object-inspector').getByLabel('Text', { exact: true }).fill('Frei in Passau'); await page.locator('.object-inspector').getByLabel('Text', { exact: true }).blur();
  await page.locator('.object-inspector').getByLabel('X', { exact: true }).fill('5'); await page.locator('.object-inspector').getByLabel('X', { exact: true }).blur();
  await expect(page.locator('.object-inspector').getByLabel('X', { exact: true })).toHaveValue('5');
  expect(errors).toEqual([]);
});

test('sprite and transform animation studios expose keyframes, scrubbing and playback', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await page.locator('[data-workspace="objects"]').click(); await page.locator('[data-asset-id="zauberberg-note"]').click();
  await page.getByRole('button', { name: /Sprite-Keyframes bearbeiten/ }).click();
  await expect(page.locator('.keyframe-ruler')).toBeVisible();
  await page.getByRole('button', { name: '▶ Playback' }).click(); await page.waitForTimeout(120);
  await expect(page.getByRole('button', { name: 'Ⅱ Pause' })).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await page.getByRole('button', { name: /Bewegung mit Keyframes/ }).click();
  await expect(page.locator('.motion-studio')).toBeVisible();
  await page.getByRole('button', { name: '＋ Keyframe am Playhead' }).click();
  await expect(page.locator('.motion-editor-grid > aside button.active')).toContainText('0.00 s');
  expect(errors).toEqual([]);
});
