import { test, expect } from '@playwright/test';

async function openCleanEditor(page) {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('#level-canvas')).toBeVisible();
  return pageErrors;
}

async function canvasPoint(page, x, y) {
  const box = await page.locator('#level-canvas').boundingBox();
  if (!box) throw new Error('Canvas besitzt keine sichtbare Bounding Box.');
  return { x: box.x + ((x + 0.5) / 25) * box.width, y: box.y + ((y + 0.5) / 25) * box.height };
}

test('all nine exact game templates are discoverable, valid and exportable', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await expect(page.locator('.catalog-card')).toHaveCount(9);
  await page.locator('[data-level-id="home"]').click();
  await expect(page.locator('#stage-level-name')).toHaveText('Dahoam · Am Bramerhof');
  await expect(page.locator('#metric-walls')).toHaveText('16');
  await expect(page.locator('#metric-guttis')).toHaveText('70');
  await expect(page.locator('#validation-status')).toContainText('Level ist spielbar');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-level').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('home.level.json');
  expect(errors).toEqual([]);
});

test('search, drawing gestures, undo and redo work as one coherent workflow', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await page.locator('#catalog-search').fill('Zauberberg');
  await expect(page.locator('.catalog-card')).toHaveCount(1);
  await expect(page.locator('.catalog-card')).toContainText('Zauberberg');
  await page.locator('#new-level').click();
  await page.locator('[data-tool="rectangle"]').click();
  const start = await canvasPoint(page, 3, 3); const end = await canvasPoint(page, 5, 5);
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 4 }); await page.mouse.up();
  await expect(page.locator('#metric-walls')).toHaveText('1');
  await page.locator('#undo').click();
  await expect(page.locator('#metric-walls')).toHaveText('0');
  await page.locator('#redo').click();
  await expect(page.locator('#metric-walls')).toHaveText('1');
  expect(errors).toEqual([]);
});

test('autosave restores a custom draft after reload', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await page.locator('#new-level').click();
  await page.locator('#level-id').fill('meine-ilz-runde');
  await page.locator('#level-id').blur();
  await page.locator('#level-name').fill('Meine Ilz-Runde');
  await page.locator('#level-name').blur();
  await expect(page.locator('#save-indicator')).toHaveText(/GESPEICHERT/);
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator('#stage-level-id')).toHaveText('meine-ilz-runde');
  await expect(page.locator('#stage-level-name')).toHaveText('Meine Ilz-Runde');
  expect(errors).toEqual([]);
});

test('custom decorations and pixel actors survive editing and validation', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await page.locator('#new-level').click();
  await page.locator('[data-panel="design"]').click();
  await page.locator('#decoration-type').selectOption('sign');
  await page.locator('#decoration-label').fill('ILZ');
  await page.locator('#decoration-animation').selectOption('bob');
  await page.locator('[data-tool="decoration"]').click();
  const point = await canvasPoint(page, 7, 7);
  await page.mouse.click(point.x, point.y);
  await page.locator('[data-panel="figures"]').click();
  await page.locator('#sprite-designer-button').click();
  await expect(page.locator('#sprite-dialog')).toBeVisible();
  await page.locator('#sprite-target').selectOption('player');
  await page.locator('#sprite-animation-name').fill('walk');
  await page.locator('#sprite-add-animation').click();
  await page.locator('#sprite-add-frame').click();
  await page.locator('#sprite-fps').fill('8'); await page.locator('#sprite-fps').blur();
  await page.locator('#sprite-grid button').nth(0).click();
  await expect(page.locator('#sprite-frame-copy')).toHaveText('Frame 2 / 2');
  const paintedPreview = await page.locator('#sprite-preview').evaluate((canvas) => [...canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data].some((value, index) => index % 4 === 3 && value > 0));
  expect(paintedPreview).toBe(true);
  await page.locator('#sprite-save').click();
  await expect(page.locator('#actor-list')).toContainText('EIGENE PIXEL');
  await page.locator('#selection-card [data-setting="actorAnimation"]').selectOption('walk');
  await page.waitForTimeout(300); await page.reload();
  await page.locator('[data-panel="figures"]').click();
  await page.locator('#actor-list button').first().click();
  await expect(page.locator('#selection-card [data-setting="actorAnimation"]')).toHaveValue('walk');
  await page.locator('#selection-card button').filter({ hasText: 'Pixel-Design' }).click();
  await page.locator('#sprite-animation').selectOption('walk');
  await expect(page.locator('#sprite-fps')).toHaveValue('8');
  await page.locator('#sprite-dialog .modal-close').click();
  await page.locator('[data-panel="check"]').click();
  await expect(page.locator('#validation-status')).toContainText('Level ist spielbar');
  expect(errors).toEqual([]);
});

test('authored cat behavior, difficulty, camera and fullscreen use the game simulation', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await page.locator('[data-level-id="hals"]').click();
  await page.locator('[data-panel="figures"]').click();
  await page.locator('#actor-list button').nth(1).click();
  await page.locator('#selection-card [data-setting="strategy"]').selectOption('stationary');
  await page.locator('#profile-lives').fill('7'); await page.locator('#profile-lives').blur();
  await page.waitForTimeout(300);
  await page.locator('#playtest-button').click();
  await expect(page.locator('#playtest-lives')).toHaveText('7');
  await expect(page.locator('#playtest-camera')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#playtest-camera').click();
  await expect(page.locator('#playtest-camera')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#playtest-pause').click();
  await expect(page.locator('#playtest-state')).toHaveText('PAUSE');
  await page.locator('#playtest-pause').click();
  await page.locator('#playtest-fullscreen').click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement) || document.querySelector('#playtest-dialog').classList.contains('immersive'))).toBe(true);
  await page.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen(); });
  await page.locator('#playtest-dialog .modal-close').click();
  await expect(page.locator('#playtest-dialog')).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('original easter eggs include triggers, dialect text and live testlauf events', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await page.locator('[data-level-id="home"]').click();
  await page.locator('[data-panel="events"]').click();
  await expect(page.locator('#event-count')).toHaveText('2');
  await expect(page.locator('#event-list')).toContainText('Eisvogel an der Ilz');
  await expect(page.locator('#event-list')).toContainText('Lolas Lieblingsplatz');
  await page.locator('#event-list button').first().click();
  await expect(page.locator('#event-message')).toHaveValue('Donnerwetter, ein Eisvogel an der Ilz!');
  await expect(page.locator('#event-message-dialect')).toHaveValue('Sakradi, a Eisvogl an da Ilz!');
  await expect(page.locator('#event-zone-list > div')).toHaveCount(2);

  await page.locator('#new-level').click(); await page.locator('[data-panel="events"]').click(); await page.locator('#add-event').click();
  await page.locator('#event-name').fill('Ilz-Fund'); await page.locator('#event-name').blur();
  await page.locator('#event-message').fill('Ein Ereignis im Testlauf!'); await page.locator('#event-message').blur();
  await page.locator('#event-message-dialect').fill('A Ereignis im Testlauf!'); await page.locator('#event-message-dialect').blur();
  await page.locator('#draw-event-zone').click();
  const start = await canvasPoint(page, 2, 2); const end = await canvasPoint(page, 4, 3);
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 3 }); await page.mouse.up();
  await expect(page.locator('#event-zone-list > div')).toHaveCount(2);
  await page.locator('#place-event-visual').click(); const visual = await canvasPoint(page, 6, 6); await page.mouse.click(visual.x, visual.y);
  await expect(page.locator('#event-visual-x')).toHaveValue('6.5'); await expect(page.locator('#event-visual-y')).toHaveValue('6.5');
  await page.locator('#playtest-button').click();
  await expect(page.locator('#playtest-event')).toBeVisible(); await expect(page.locator('#playtest-event-name')).toHaveText('Ilz-Fund'); await expect(page.locator('#playtest-event-message')).toHaveText('Ein Ereignis im Testlauf!'); await expect(page.locator('#playtest-event-reward')).toHaveText('+100 Punkte');
  await page.locator('#playtest-language').click(); await expect(page.locator('#playtest-event-message')).toHaveText('A Ereignis im Testlauf!');
  await page.locator('#playtest-dialog .modal-close').click();
  expect(errors).toEqual([]);
});

test('playtest opens, moves, resets repeatedly and closes without deadlock', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await page.locator('[data-level-id="hals"]').click();
  await page.locator('#playtest-button').click();
  await expect(page.locator('#playtest-dialog')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await page.locator('#playtest-reset').click();
  await page.locator('#playtest-reset').click();
  await expect(page.locator('#playtest-dialog')).toBeVisible();
  await page.locator('#playtest-dialog .modal-close').click();
  await expect(page.locator('#playtest-dialog')).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('visible controls have an accessible name', async ({ page }) => {
  await openCleanEditor(page);
  const unnamed = await page.locator('button:visible, input:visible, select:visible, textarea:visible').evaluateAll((elements) => elements
    .filter((element) => !((element.getAttribute('aria-label') || element.getAttribute('title') || element.labels?.[0]?.textContent || element.textContent || '').trim()))
    .map((element) => `${element.tagName.toLowerCase()}#${element.id}`));
  expect(unnamed).toEqual([]);
});

test('@mobile editor remains usable without horizontal page overflow', async ({ page }) => {
  const errors = await openCleanEditor(page);
  await expect(page.locator('#level-canvas')).toBeVisible();
  await expect(page.locator('[data-tool="wall"]')).toBeVisible();
  const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, width: innerWidth }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.width + 1);
  await page.locator('#help-button').click();
  await expect(page.locator('#help-dialog')).toBeVisible();
  await page.locator('#help-dialog .modal-close').click();
  await page.locator('[data-level-id="bschuett"]').scrollIntoViewIfNeeded();
  await page.locator('[data-level-id="bschuett"]').click();
  await page.locator('#playtest-button').click();
  await expect(page.locator('.mobile-dpad')).toBeVisible();
  await page.locator('[data-play-direction="up"]').tap();
  await page.locator('#playtest-dialog .modal-close').tap();
  expect(errors).toEqual([]);
});
