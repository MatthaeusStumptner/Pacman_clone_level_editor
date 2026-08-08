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

async function openObjectLibrary(page) {
  await page.locator('[data-workspace="objects"]').click();
  await page.locator('.object-sidebar .sidebar-mode-tabs').getByRole('button', { name: /Bibliothek/ }).click();
  await expect(page.locator('.asset-list')).toBeVisible();
}

async function openSceneTree(page) {
  const tabs = page.locator('.sidebar-mode-tabs:visible');
  await tabs.getByRole('button', { name: /Szene/ }).click();
  await expect(page.locator('.scene-tree:visible')).toBeVisible();
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

async function canvasExactPoint(page, x, y) {
  const box = await page.locator('#level-canvas').boundingBox();
  if (!box) throw new Error('Canvas besitzt keine sichtbare Bounding Box.');
  return { x: box.x + (x / 25) * box.width, y: box.y + (y / 25) * box.height };
}

test('URL router restores level, discipline and selection with browser history', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await loadTemplate(page, 'zauberberg');
  await page.locator('[data-workspace="objects"]').click();
  await page.locator('[data-scene-key="theme-element:stage-lights"] .scene-node-main').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('workspace')).toBe('objects');
  await expect.poll(() => new URL(page.url()).searchParams.get('selection')).toBe('theme-element:stage-lights');
  await page.locator('[data-workspace="characters"]').click();
  await expect.poll(() => new URL(page.url()).searchParams.get('workspace')).toBe('characters');
  await page.goBack();
  await expect(page.locator('[data-workspace="objects"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.object-inspector')).toContainText('Bühnenlichter');
  await page.reload();
  await expect(page.locator('.document-identity')).toHaveAttribute('data-level-id', 'zauberberg');
  await expect(page.locator('.object-inspector')).toContainText('Bühnenlichter');
  await expect(page).toHaveTitle(/Zauberberg.*Objekte.*Franz & Lola Studio/);
  expect(errors).toEqual([]);
});

test('router keeps the publisher fragment separate and makes a closed project drawer inert', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/?level=hals&workspace=events&selection=__proto__%3Aignored#publisher_session=invalid-but-safe');
  await expect(page.locator('.document-identity')).toHaveAttribute('data-level-id', 'hals');
  await expect(page.locator('[data-workspace="events"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('#project-drawer')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('#project-drawer')).toHaveAttribute('inert', '');
  await openProject(page);
  await expect(page.locator('#project-drawer')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#project-drawer')).not.toHaveAttribute('inert', '');
  expect(new URL(page.url()).searchParams.get('workspace')).toBe('events');
  expect(errors).toEqual([]);
});

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
  await openProject(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Entwurf Meine Ilz-Runde löschen' }).click();
  await expect(page.locator('#project-drawer')).not.toContainText('Meine Ilz-Runde');
  await expect(page.locator('#level-id')).toHaveValue('meine-ilz-runde');
  expect(errors).toEqual([]);
});

test('canvas selection stays in context, overlap cycling works and explicit opening remains editable', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await loadTemplate(page, 'zauberberg');
  await page.locator('[data-workspace="level"]').click();
  await page.locator('[data-tool="select"]').click();
  const note = await canvasPoint(page, 11, 8);
  await page.mouse.click(note.x, note.y);
  await expect(page.locator('[data-workspace="level"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.selection-summary')).toBeVisible();
  await expect(page.locator('.selection-summary')).toContainText('Zauberberg-Zugabe');
  await page.keyboard.down('Alt');
  await page.mouse.click(note.x, note.y);
  await page.keyboard.up('Alt');
  await expect(page.locator('.selection-summary')).toContainText('Zauberberg-Note');
  await expect(page.locator('[data-workspace="level"]')).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: /In Objektwerkstatt öffnen/ }).click();
  await expect(page.locator('.object-inspector')).toContainText('Zauberberg-Note');
  await page.locator('.object-inspector').getByLabel('Bewegungsanimation', { exact: true }).selectOption('spin');
  await page.locator('.object-inspector').getByLabel('Bewegungsanimation Tempo', { exact: true }).fill('2.5'); await page.locator('.object-inspector').getByLabel('Bewegungsanimation Tempo', { exact: true }).blur();
  await page.waitForTimeout(250);
  await page.reload();
  await expect(page.locator('.object-inspector').getByLabel('Bewegungsanimation', { exact: true })).toHaveValue('spin');
  await expect(page.locator('.object-inspector').getByLabel('Bewegungsanimation Tempo', { exact: true })).toHaveValue('2.5');
  expect(errors).toEqual([]);
});

test('scene tree searches, filters, multi-selects, hides, locks and reorders stable instances', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await loadTemplate(page, 'zauberberg');
  await openSceneTree(page);
  const tree = page.locator('.scene-tree');
  await tree.getByLabel('Szenenbaum durchsuchen').fill('Konzertbox');
  await expect(tree.locator('.scene-node')).toHaveCount(1);
  await tree.getByLabel('Szenenbaum durchsuchen').fill('');
  await tree.getByLabel('Elementtyp filtern').selectOption('objects');
  await expect(tree.locator('.scene-node')).toHaveCount(5);
  await tree.getByLabel('Elementtyp filtern').selectOption('all');

  const note = tree.locator('[data-scene-key="decoration:zauberberg-note-frei"]');
  const speaker = tree.locator('[data-scene-key="decoration:zauberberg-box"]');
  await note.locator('.scene-node-main').click();
  await speaker.locator('.scene-node-main').click({ modifiers: ['Shift'] });
  await expect(page.locator('#level-canvas')).toHaveAttribute('data-selection-count', '2');
  await expect(page.locator('.selection-summary')).toContainText('2 Elemente ausgewählt');

  await speaker.getByRole('button', { name: 'Konzertbox ausblenden' }).click();
  await expect(speaker).toHaveClass(/hidden/);
  await speaker.getByRole('button', { name: 'Konzertbox einblenden' }).click();
  await speaker.getByRole('button', { name: 'Konzertbox sperren' }).click();
  await expect(speaker).toHaveClass(/locked/);
  await speaker.getByRole('button', { name: 'Konzertbox entsperren' }).click();

  const before = await tree.locator('[data-scene-key^="decoration:"]').evaluateAll((nodes) => nodes.map((node) => node.dataset.sceneKey));
  await note.getByRole('button', { name: 'Zauberberg-Note nach vorne' }).click();
  const after = await tree.locator('[data-scene-key^="decoration:"]').evaluateAll((nodes) => nodes.map((node) => node.dataset.sceneKey));
  expect(after).not.toEqual(before);

  await page.keyboard.press('Escape');
  await expect(page.locator('#level-canvas')).toHaveAttribute('data-selection-count', '0');
  expect(errors).toEqual([]);
});

test('placed wall blocks are selectable, individually editable and route-persistent', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await loadTemplate(page, 'hals');
  await page.locator('[data-workspace="level"]').click();
  await page.locator('[data-tool="select"]').click();
  const wall = await canvasPoint(page, 3, 3);
  await page.mouse.click(wall.x, wall.y);
  await expect(page.locator('.selection-summary')).toContainText(/Wand 1|Wandblock/);
  await expect(page.getByLabel('Ausgewählte Wand bearbeiten')).toBeVisible();
  await page.getByLabel('Wand Muster').selectOption('brick');
  await page.getByLabel('Themefarbe für Wand').uncheck();
  await page.getByLabel('Wand Eigenfarbe').fill('#a14f3f');
  await expect.poll(() => new URL(page.url()).searchParams.get('selection')).toMatch(/^wall:/);
  await page.waitForTimeout(250);
  await page.reload();
  await expect(page.getByLabel('Ausgewählte Wand bearbeiten')).toBeVisible();
  await expect(page.getByLabel('Wand Muster')).toHaveValue('brick');
  await expect(page.getByLabel('Themefarbe für Wand')).not.toBeChecked();
  expect(errors).toEqual([]);
});

test('all Zauberberg notes can be removed through their owning document systems', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await loadTemplate(page, 'zauberberg');
  await page.locator('[data-workspace="objects"]').click();
  await openSceneTree(page);
  const tree = page.locator('.scene-tree');
  await expect(tree.locator('[data-scene-key="decoration:zauberberg-note-frei"]')).toBeVisible();
  await expect(tree.locator('[data-scene-key="decoration:zauberberg-buehnen-note"]')).toBeVisible();
  await tree.locator('[data-scene-key="decoration:zauberberg-buehnen-note"] .scene-node-main').click();
  await page.keyboard.press('Delete');
  await expect(tree.locator('[data-scene-key="decoration:zauberberg-buehnen-note"]')).toHaveCount(0);
  await page.locator('[data-workspace="events"]').click();
  await page.locator('.event-browser button').filter({ hasText: 'Zauberberg-Zugabe' }).click();
  await page.getByRole('button', { name: 'Nur Ereignissymbol aus dem Level entfernen' }).click();
  await expect(page.locator('.property-panel').getByLabel('Symboltyp')).toHaveValue('none');
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
  await openObjectLibrary(page);
  await page.locator('[data-asset-id="music-note"]').click();
  const target = await canvasPoint(page, 2, 2); await page.mouse.click(target.x, target.y);
  await openSceneTree(page);
  await expect(page.locator('.scene-tree')).toContainText('Musiknote');
  await page.waitForTimeout(250);
  await page.reload();
  await expect(page.locator('.scene-tree')).toContainText('Musiknote');
  await page.locator('.object-sidebar .sidebar-mode-tabs').getByRole('button', { name: /Bibliothek/ }).click();
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
  await page.getByRole('button', { name: /Sprite-Sheet bearbeiten/ }).click();
  await expect(page.locator('.state-tabs button')).toHaveCount(5);
  const idleSignature = await canvasSignature(page.locator('.sprite-playback-stage .actor-thumbnail'));
  await page.locator('.state-tabs button').filter({ hasText: 'right' }).click();
  await expect(page.getByLabel('Verwendete Animation')).toHaveValue('right');
  await expect.poll(() => canvasSignature(page.locator('.sprite-playback-stage .actor-thumbnail'))).not.toBe(idleSignature);
  const before = await page.locator('.sheet-grid > button').count();
  await page.locator('.pixel-grid button[data-x="0"][data-y="0"]').click();
  await page.getByRole('button', { name: '⬚ Auswählen' }).click();
  await page.locator('.pixel-grid button[data-x="0"][data-y="0"]').click();
  await page.locator('.pixel-grid button[data-x="1"][data-y="0"]').click({ modifiers: ['Shift'] });
  await expect(page.locator('.sprite-layout')).toHaveAttribute('data-pixel-selection-count', '2');
  await page.getByRole('button', { name: 'Farbe anwenden' }).click();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.sprite-layout')).toHaveAttribute('data-pixel-selection-count', '2');
  await page.getByRole('button', { name: '＋ Keyframe duplizieren' }).click();
  await expect(page.locator('.sheet-grid > button')).toHaveCount(before + 1);
  await page.getByRole('button', { name: 'Sprite übernehmen' }).click();
  await expect(page.locator('.state-matrix')).toContainText('right');
  await page.waitForTimeout(250); await page.reload(); await page.locator('[data-workspace="characters"]').click();
  await expect(page.locator('.state-matrix')).toContainText('right');
  expect(errors).toEqual([]);
});

test('global character wizard creates a reusable non-cat figure and places a self-contained level instance', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await openProject(page);
  await page.getByRole('button', { name: /Neues Level/ }).click();
  await page.locator('[data-workspace="characters"]').click();
  await expect(page.locator('#create-character')).toBeVisible();
  await page.locator('#create-character').click();
  await expect(page.getByRole('dialog', { name: 'Wer soll Passau bereichern?' })).toBeVisible();
  await page.locator('#character-name').fill('Passauer Postler');
  await page.getByRole('button', { name: /Weiter zum Sprite-Studio/ }).click();
  await expect(page.locator('.sprite-studio')).toBeVisible();
  await expect(page.locator('.state-tabs button')).toHaveCount(5);
  await page.getByRole('button', { name: 'Sprite übernehmen' }).click();

  const globalCharacter = page.locator('[data-character-id="passauer-postler"]');
  await expect(globalCharacter).toContainText('Global · in allen Levels');
  await expect.poll(() => canvasHasVisiblePixels(globalCharacter.locator('.actor-thumbnail'))).toBe(true);
  await expect(page.locator('.property-panel')).toContainText('Freie Figuren stehen im normalen Spiel');
  await page.locator('.character-hero .place-character-button').click();
  await expect(page.locator('[data-workspace="level"]')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('.character-placement-banner')).toContainText('Passauer Postler platzieren');
  const point = await canvasPoint(page, 5, 5);
  await page.mouse.click(point.x, point.y);
  await expect(page.locator('.character-placement-banner')).toHaveCount(0);

  await page.locator('[data-workspace="characters"]').click();
  await expect(page.locator('[data-level-character-id]')).toHaveCount(1);
  await expect(page.locator('[data-level-character-id]')).toContainText('Passauer Postler');
  await expect(page.locator('.actor-browser button').filter({ hasText: /^Katze/ })).toHaveCount(0);
  await page.locator('[data-level-character-id]').click();
  await expect(page.locator('.property-panel').getByLabel('Name')).toHaveValue('Passauer Postler');
  await expect(page.locator('.property-panel')).toContainText('als Darsteller in Cutscenes');

  await loadTemplate(page, 'home');
  await page.locator('[data-workspace="characters"]').click();
  await expect(page.locator('[data-character-id="passauer-postler"]')).toBeVisible();
  await expect(page.locator('[data-level-character-id]')).toHaveCount(0);
  await page.reload();
  await page.locator('[data-workspace="characters"]').click();
  await expect(page.locator('[data-character-id="passauer-postler"]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('character creation stays usable on a phone viewport @mobile', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await page.locator('[data-workspace="characters"]').click();
  await expect(page.locator('#create-character')).toBeVisible();
  await page.locator('#create-character').click();
  const dialog = page.getByRole('dialog', { name: 'Wer soll Passau bereichern?' });
  await expect(dialog).toBeInViewport();
  await page.locator('#character-name').fill('Donaunixe');
  await dialog.getByText('Leere Leinwand').click();
  await dialog.getByRole('button', { name: /Weiter zum Sprite-Studio/ }).click();
  await expect(page.locator('.sprite-studio')).toBeVisible();
  await page.locator('.pixel-grid').scrollIntoViewIfNeeded();
  await expect(page.locator('.pixel-grid')).toBeInViewport();
  await page.getByRole('button', { name: 'Sprite übernehmen' }).click();
  await expect(page.locator('.character-hero')).toContainText('Donaunixe');
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

test('authorized non-technical editors share and publish several exact draft revisions together', async ({ page }) => {
  const errors = []; const published = []; const shared = new Map(); let checks = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://franz-lola-publisher.test.workers.dev/**', async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname;
    const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:4187', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (path === '/api/me') return route.fulfill({ headers, json: { login: 'freundin', name: 'Franz-Lola-Redaktion' } });
    if (path === '/api/drafts/bootstrap') return route.fulfill({ headers, json: { drafts: [...shared.values()].map(({ level, ...draft }) => draft) } });
    if (path.startsWith('/api/drafts/') && request.method() === 'PUT') {
      const body = request.postDataJSON(); const revision = body.expectedRevision + 1;
      const draft = { id: body.level.id, name: body.level.name.standard, icon: body.level.icon, area: body.level.location.area, revision, status: 'draft', updatedBy: 'freundin', updatedAt: '2026-08-08T12:00:00.000Z', level: body.level };
      shared.set(draft.id, draft); return route.fulfill({ headers, json: draft });
    }
    if (path === '/api/publish') { published.push(request.postDataJSON().drafts); return route.fulfill({ status: 202, headers, json: { publicationId: 42, state: 'testing', phase: 'upload-complete', phaseLabel: 'Level sicher übertragen', progress: 22, detail: 'Level wurden sicher übertragen.' } }); }
    if (path === '/api/publications/42') { checks += 1; return route.fulfill({ headers, json: checks > 1 ? { state: 'published', phase: 'published', phaseLabel: 'GitHub Pages ist aktuell', progress: 100, detail: 'Das Level ist live.', checkedAt: '2026-08-05T18:00:00.000Z', gameUrl: 'https://matthaeusstumptner.github.io/Geburtstagsspiel/' } : { state: 'deploying', phase: 'deploy-build', phaseLabel: 'Spiel für GitHub Pages bauen', progress: 89, detail: 'Das optimierte Browser-Spiel wird gebaut.', checkedAt: '2026-08-05T17:59:58.000Z' } }); }
    return route.fulfill({ status: 404, headers, json: { error: 'Nicht gefunden.' } });
  });
  await page.goto('/#publisher_session=test.session-token'); await expect(page.locator('#level-canvas')).toBeVisible();
  await loadTemplate(page, 'home'); await page.waitForTimeout(250);
  await loadTemplate(page, 'hals'); await page.waitForTimeout(250);
  await page.locator('[data-workspace="publish"]').click();
  await expect(page.locator('.publisher-user')).toContainText('Franz-Lola-Redaktion');
  await expect.poll(() => page.url()).not.toContain('publisher_session');
  await expect(page.locator('.publish-candidate')).toHaveCount(2);
  await page.getByLabel('Level Dahoam · Am Bramerhof auswählen').check();
  await page.locator('#publisher-confirm').click();
  await expect(page.getByRole('progressbar', { name: 'Veröffentlichungsfortschritt' })).toHaveAttribute('aria-valuenow', '100');
  await expect(page.locator('.publish-activity')).toContainText('GitHub Pages ist aktuell');
  await expect(page.locator('.publication-steps .done')).toHaveCount(5);
  await expect(page.locator('.publish-state')).toContainText('Level sind live!', { timeout: 10_000 });
  await openProject(page);
  await expect(page.locator('.shared-draft-section')).toContainText('Gemeinsame Entwürfe');
  await expect(page.locator('.shared-draft-section .draft-entry')).toHaveCount(2);
  expect(published).toHaveLength(1); expect(published[0].map((draft) => draft.id).sort()).toEqual(['hals', 'home']);
  expect(published[0].every((draft) => draft.revision === 1)).toBe(true); expect(errors).toEqual([]);
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
  const focusTabs = page.locator('.mobile-focus-tabs:visible');
  await expect(focusTabs).toBeVisible();
  await focusTabs.getByRole('button', { name: /Szene/ }).click();
  await expect(page.locator('[data-focus-panel="scene"].mobile-active')).toBeVisible();
  await expect(page.locator('#level-canvas')).toBeVisible();
  await page.locator('[data-focus-panel="scene"] .sidebar-mode-tabs').getByRole('button', { name: /Szene/ }).click();
  await expect(page.locator('.scene-tree:visible')).toBeVisible();
  await page.screenshot({ path: 'output/playwright/mobile-focus-panels.png' });
  const sceneSheet = await page.locator('[data-focus-panel="scene"].mobile-active').boundingBox();
  if (!sceneSheet) throw new Error('Mobiles Szenen-Sheet besitzt keine Bounding Box.');
  await page.mouse.click(8, Math.max(8, sceneSheet.y - 8));
  await expect(page.locator('.mobile-panel-scrim')).toHaveCount(0);
  await focusTabs.getByRole('button', { name: /Details/ }).click();
  await expect(page.locator('[data-focus-panel="inspector"].mobile-active')).toBeVisible();
  await focusTabs.getByRole('button', { name: /Canvas/ }).click();
  await expect(page.locator('#level-canvas')).toBeVisible();
  await page.locator('[data-workspace="playtest"]').click(); await page.locator('#start-playtest').click();
  await page.getByRole('button', { name: /Intro überspringen/ }).click();
  await expect(page.locator('.mobile-dpad')).toBeVisible();
  await page.locator('.mobile-dpad button').first().tap();
  expect(errors).toEqual([]);
});

test('object previews show renderer output and text blocks stay freely editable', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await openObjectLibrary(page);
  await expect(page.locator('.asset-list .object-thumbnail')).toHaveCount(16);
  await expect(page.locator('[data-asset-id="music-note"] canvas')).toBeVisible();
  await expect(page.locator('[data-asset-id="zauberberg-note"] canvas')).toBeVisible();
  await page.locator('[data-asset-id="text-block"]').click();
  const target = await canvasPoint(page, 8, 8); await page.mouse.click(target.x, target.y);
  await openSceneTree(page);
  await page.locator('.scene-tree .scene-node-main').filter({ hasText: 'Freier Textblock' }).click();
  await page.locator('.object-inspector').getByLabel('Text', { exact: true }).fill('Frei in Passau'); await page.locator('.object-inspector').getByLabel('Text', { exact: true }).blur();
  await page.getByLabel('Hintergrund transparent').check();
  await expect(page.getByLabel('Rahmen ausblenden')).toBeChecked();
  await page.locator('.object-inspector .effect-editor').getByRole('button', { name: '＋ Effekt' }).click();
  await expect(page.locator('.object-inspector [data-effect-type="glitch"]')).toHaveCount(1);
  await page.locator('.edge-effect-editor').getByRole('button', { name: '＋ Rand-Effekt' }).click();
  await expect(page.locator('.edge-effect-card')).toHaveCount(1);
  await expect(page.locator('#level-canvas')).toHaveAttribute('data-selection-count', '1');
  await expect(page.getByLabel('Hintergrund transparent')).toBeChecked();
  const xInput = page.locator('.object-inspector').getByLabel('X', { exact: true });
  const yInput = page.locator('.object-inspector').getByLabel('Y', { exact: true });
  const widthInput = page.locator('.object-inspector').getByLabel('Breite');
  const fontInput = page.locator('.object-inspector').getByLabel('Schriftgröße');
  await page.locator('[data-tool="transform"]').click();
  const moveFrom = await canvasExactPoint(page, 10, 9); const moveTo = await canvasExactPoint(page, 12.35, 11.15);
  await page.mouse.move(moveFrom.x, moveFrom.y); await page.mouse.down(); await page.mouse.move(moveTo.x, moveTo.y, { steps: 5 }); await page.mouse.up();
  await expect.poll(async () => Number(await xInput.inputValue())).toBeGreaterThan(10);
  await expect.poll(async () => Number(await yInput.inputValue())).toBeGreaterThan(10);
  const beforeWidth = Number(await widthInput.inputValue()); const beforeFont = Number(await fontInput.inputValue());
  const x = Number(await xInput.inputValue()); const y = Number(await yInput.inputValue());
  const height = Number(await page.locator('.object-inspector').getByLabel('Höhe').inputValue());
  const scaleFrom = await canvasExactPoint(page, x + beforeWidth, y + height); const scaleTo = await canvasExactPoint(page, x + beforeWidth + 1.5, y + height + 0.75);
  await page.mouse.move(scaleFrom.x, scaleFrom.y); await page.mouse.down(); await page.mouse.move(scaleTo.x, scaleTo.y, { steps: 5 }); await page.mouse.up();
  await expect.poll(async () => Number(await widthInput.inputValue())).toBeGreaterThan(beforeWidth);
  await expect.poll(async () => {
    const widthScale = Number(await widthInput.inputValue()) / beforeWidth;
    const fontScale = Number(await fontInput.inputValue()) / beforeFont;
    return Math.abs(widthScale - fontScale);
  }).toBeLessThan(0.01);
  await expect(page.locator('#level-canvas')).toHaveClass(/transform-tool/);
  await expect(page.locator('.transform-hint')).toContainText('Eckgriffe');
  expect(errors).toEqual([]);
});

test('sprite and transform animation studios expose keyframes, scrubbing and playback', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await openObjectLibrary(page); await page.locator('[data-asset-id="zauberberg-note"]').click();
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
